"""
Video Ad service -- "Publish + Boost in one click" flow.

Wraps two existing operations:
  1. Publish a video to the user's Facebook Page (organic post)
  2. Boost that post as a paid ad

Total user-perceived time: 30s - 3min (Meta video encoding dominates).
All four boost-post-chain fixes (is_adset_budget_sharing_enabled,
destination_type, promoted_object, FX) apply automatically since we call
meta_ads.boost_post() unchanged.
"""
import json
import logging
import os
import time
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from ads.models import AdAccount, AdCampaign
from ads.services import meta_ads
from posts.models import Post


logger = logging.getLogger(__name__)

GRAPH = 'https://graph.facebook.com/v21.0'
UPLOAD_TIMEOUT = 600     # 10 min for large video uploads
STATUS_POLL_TIMEOUT = 30
DEFAULT_MAX_WAIT_SEC = 180  # 3 min — typical encode is 30-90s
POLL_INTERVAL_SEC = 5


class VideoAdError(Exception):
    """Raised when the video-ad flow fails at any step."""
    def __init__(self, message, step=None, code=None, subcode=None, raw=None):
        super().__init__(message)
        self.step = step
        self.code = code
        self.subcode = subcode
        self.raw = raw or {}


# ── Step 1: upload video to Page ──────────────────────────────────────────────

def _upload_video_to_page(page_id, page_access_token, description, video_path):
    """Upload a video file to /<page>/videos.

    Returns: {'video_id': <media id>, 'post_id': <feed post id or None>}
    Raises VideoAdError on Meta error.
    """
    url = f'{GRAPH}/{page_id}/videos'
    with open(video_path, 'rb') as f:
        files = {'source': f}
        data = {
            'description': description or '',
            'access_token': page_access_token,
            'published': 'true',
        }
        resp = requests.post(url, files=files, data=data, timeout=UPLOAD_TIMEOUT)

    try:
        body = resp.json()
    except ValueError:
        raise VideoAdError(
            f'Non-JSON response from Meta ({resp.status_code})',
            step='upload',
        )

    err = body.get('error') if isinstance(body, dict) else None
    if err:
        raise VideoAdError(
            err.get('message', 'Video upload failed'),
            step='upload',
            code=err.get('code'),
            subcode=err.get('error_subcode'),
            raw=err,
        )

    return {
        'video_id': body.get('id'),
        'post_id': body.get('post_id'),
    }


# ── Step 2: wait for video to be processed ────────────────────────────────────

def _wait_for_video_ready(video_id, page_access_token, max_wait_sec=DEFAULT_MAX_WAIT_SEC):
    """Poll GET /<video_id>?fields=status until video_status='ready'.

    Meta returns:
        {"status": {"video_status": "uploaded|processing|ready|error"}}
    Boosting will fail if attempted before 'ready'.
    """
    deadline = time.time() + max_wait_sec
    last_status = None
    poll_count = 0

    while time.time() < deadline:
        poll_count += 1
        try:
            resp = requests.get(
                f'{GRAPH}/{video_id}',
                params={'fields': 'status', 'access_token': page_access_token},
                timeout=STATUS_POLL_TIMEOUT,
            )
            body = resp.json() if resp.content else {}
        except Exception as e:
            logger.warning(f'[video_ad] poll {poll_count} failed: {e}; retrying')
            time.sleep(POLL_INTERVAL_SEC)
            continue

        if 'error' in body:
            err = body['error']
            raise VideoAdError(
                err.get('message', 'video status check failed'),
                step='wait_ready',
                code=err.get('code'),
                subcode=err.get('error_subcode'),
                raw=err,
            )

        status_obj = body.get('status') or {}
        video_status = status_obj.get('video_status') or status_obj.get('status') or ''
        last_status = video_status
        logger.info(
            f'[video_ad] poll {poll_count}: video={video_id} status={video_status!r}'
        )

        if video_status == 'ready':
            return True
        if video_status in ('error', 'failed'):
            raise VideoAdError(
                f'Video processing failed (status={video_status})',
                step='wait_ready',
                raw=status_obj,
            )
        time.sleep(POLL_INTERVAL_SEC)

    raise VideoAdError(
        f'Video processing timed out after {max_wait_sec}s '
        f'(last status: {last_status!r}). Try again or use a shorter video.',
        step='wait_ready',
    )


# ── Steps 3-5: main orchestration ─────────────────────────────────────────────

def publish_and_boost_video(
    *,
    user,
    ad_account: AdAccount,
    social_account,        # platforms.models.SocialAccount with FB page + token
    video_path: str,       # absolute path to a saved video file
    caption: str,
    daily_budget_minor: int,
    duration_days: int,
    targeting: dict,
    max_wait_sec: int = DEFAULT_MAX_WAIT_SEC,
):
    """Full publish + boost flow.

    Returns dict:
        {
            'post': {'id', 'facebook_post_id', 'video_id'},
            'campaign': {'id', 'external_campaign_id', 'status',
                         'daily_budget_minor'}
        }
    """
    page_id = social_account.facebook_page_id
    page_token = social_account.facebook_access_token
    if not (page_id and page_token):
        raise VideoAdError(
            'Facebook Page is not properly connected. Reconnect Facebook first.',
            step='precheck',
        )

    # 1. Upload video
    logger.info(f'[video_ad] step 1/5 uploading video to page {page_id}')
    upload = _upload_video_to_page(page_id, page_token, caption, video_path)
    video_id = upload['video_id']
    fb_post_id = upload['post_id']
    logger.info(
        f'[video_ad] step 1 OK video_id={video_id} fb_post_id={fb_post_id!r}'
    )
    if not video_id:
        raise VideoAdError('Upload succeeded but Meta returned no video_id.', step='upload')

    # 2. Wait for video to be ready
    logger.info(f'[video_ad] step 2/5 polling for video {video_id} ready')
    _wait_for_video_ready(video_id, page_token, max_wait_sec=max_wait_sec)
    logger.info('[video_ad] step 2 OK video ready')

    # If Meta didn't return post_id at upload, query it now
    if not fb_post_id:
        try:
            resp = requests.get(
                f'{GRAPH}/{video_id}',
                params={'fields': 'post_id', 'access_token': page_token},
                timeout=STATUS_POLL_TIMEOUT,
            )
            data = resp.json()
            fb_post_id = data.get('post_id')
        except Exception:
            pass
        if not fb_post_id:
            # Fall back to <page>_<video> -- boost_post resolver handles this
            fb_post_id = video_id
            logger.warning(
                f'[video_ad] post_id missing; using video_id as fb_post_id={video_id}'
            )

    # 3. Create local Post row so the ad is tracked alongside other posts
    logger.info('[video_ad] step 3/5 creating Sellanto Post row')
    media_rel = video_path
    try:
        if video_path.startswith(str(settings.MEDIA_ROOT)):
            media_rel = os.path.relpath(video_path, settings.MEDIA_ROOT).replace('\\', '/')
    except Exception:
        pass

    post = Post.objects.create(
        user=user,
        caption=caption or '',
        media_files=json.dumps([media_rel]),
        platforms=json.dumps(['facebook']),
        status='posted',
        source='manual',
        facebook_post_id=fb_post_id,
        posted_at=timezone.now(),
        format_type='reel',
    )
    logger.info(f'[video_ad] step 3 OK Post id={post.id}')

    # 4. Boost the post
    logger.info('[video_ad] step 4/5 calling meta_ads.boost_post')
    try:
        boost = meta_ads.boost_post(
            ad_account=ad_account,
            page_id=page_id,
            fb_post_id=fb_post_id,
            daily_budget_cents=daily_budget_minor,
            duration_days=duration_days,
            targeting=targeting,
            campaign_name=f'Video Ad: {(caption or "")[:40] or post.id}',
            page_access_token=page_token,
        )
    except meta_ads.MetaAdsError as e:
        raise VideoAdError(
            str(e), step='boost', code=e.code, subcode=e.subcode, raw=e.raw,
        )
    logger.info(f'[video_ad] step 4 OK campaign_id={boost["campaign_id"]}')

    # 5. Save AdCampaign row
    logger.info('[video_ad] step 5/5 saving AdCampaign row')
    now = timezone.now()
    campaign = AdCampaign.objects.create(
        user=user,
        brand=post.brand,
        ad_account=ad_account,
        boosted_post=post,
        name=f'Video Ad: {(caption or "")[:40] or post.id}',
        objective='boost_post',
        status='pending_review',
        external_campaign_id=boost['campaign_id'],
        external_adset_id=boost['adset_id'],
        external_creative_id=boost['creative_id'],
        external_ad_id=boost['ad_id'],
        daily_budget_minor=daily_budget_minor,
        start_date=now,
        end_date=now + timedelta(days=duration_days),
        targeting_json=targeting,
        creative_json={
            'object_story_id': f'{page_id}_{fb_post_id}',
            'video_id': video_id,
        },
    )
    logger.info(f'[video_ad] step 5 OK AdCampaign id={campaign.id}')

    return {
        'post': {
            'id': post.id,
            'facebook_post_id': fb_post_id,
            'video_id': video_id,
        },
        'campaign': {
            'id': campaign.id,
            'external_campaign_id': campaign.external_campaign_id,
            'status': campaign.status,
            'daily_budget_minor': campaign.daily_budget_minor,
        },
    }
