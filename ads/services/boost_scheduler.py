"""
Boost-on-publish scheduler.

When a user queues "boost this scheduled post after it publishes"
(BoostFromPostView, Path B), we persist a draft AdCampaign with
creative_json['boost_on_publish']=True and boosted_post set. This module turns
those drafts into real Meta boosts once the underlying post has a
facebook_post_id.

Two entry points:
  • launch_pending_boosts_for_post(post) — called synchronously right after a
    post publishes to Facebook (posts/scheduler.py), so the boost fires
    immediately.
  • run_pending_boosts() — a periodic safety net that catches any queued boost
    whose post published through a path that didn't call the hook.
"""
import logging

logger = logging.getLogger(__name__)


def _launch_one(campaign) -> bool:
    """Turn a single queued draft AdCampaign into a live Meta boost.

    Returns True on success. Never raises — logs and marks the campaign
    'failed' on error so it isn't retried forever.
    """
    from ads.services import meta_ads
    from ads.services.meta_ads import MetaAdsError
    from platforms.models import SocialAccount
    from django.utils import timezone

    post = campaign.boosted_post
    cfg = campaign.creative_json or {}

    if post is None or not post.facebook_post_id:
        return False  # not ready yet

    # Resolve the publishing Page (id + token) — boost_post needs the page_id
    # as the creative's page, same as BoostPostView.
    sa = SocialAccount.objects.filter(
        user=campaign.user, platform='facebook', is_active=True).first()
    page_access_token = (sa.facebook_access_token if sa else '') or ''
    page_id = (sa.facebook_page_id if sa else '') or ''

    if not page_id:
        logger.warning('[boost-on-publish] campaign=%s no connected FB Page — cannot boost',
                       campaign.id)
        campaign.status = 'failed'
        campaign.rejection_reason = 'No connected Facebook Page to run the ad from.'
        campaign.save(update_fields=['status', 'rejection_reason'])
        return False

    try:
        result = meta_ads.boost_post(
            ad_account=campaign.ad_account,
            page_id=page_id,
            fb_post_id=post.facebook_post_id,
            daily_budget_cents=campaign.daily_budget_minor,
            duration_days=int(cfg.get('duration_days', 7) or 7),
            targeting=campaign.targeting_json or {},
            campaign_name=campaign.name,
            page_access_token=page_access_token,
        )
    except MetaAdsError as e:
        logger.warning('[boost-on-publish] campaign=%s failed: %s', campaign.id, e)
        campaign.status = 'failed'
        campaign.rejection_reason = str(e)[:500]
        campaign.save(update_fields=['status', 'rejection_reason'])
        return False
    except Exception as e:  # noqa: BLE001
        # Any non-Meta error (bug, network, bad data) must NOT leave the campaign
        # stuck as 'draft' forever — mark it failed so it isn't retried endlessly.
        logger.error('[boost-on-publish] campaign=%s unexpected: %s', campaign.id, e)
        campaign.status = 'failed'
        campaign.rejection_reason = f'Boost error: {e}'[:500]
        campaign.save(update_fields=['status', 'rejection_reason'])
        return False

    # Success — record the provider ids and flip to paused (Meta review state).
    campaign.external_campaign_id = result.get('campaign_id', '')
    campaign.external_adset_id = result.get('adset_id', '')
    campaign.external_creative_id = result.get('creative_id', '')
    campaign.external_ad_id = result.get('ad_id', '')
    campaign.status = 'paused'
    updated = campaign.creative_json or {}
    updated['boost_on_publish'] = False  # consumed
    updated['launched_at'] = timezone.now().isoformat()
    campaign.creative_json = updated
    campaign.save()
    logger.info('[boost-on-publish] launched campaign=%s from post=%s', campaign.id, post.id)
    return True


def launch_pending_boosts_for_post(post) -> int:
    """Launch any queued boosts tied to a just-published post. Returns count launched."""
    from ads.models import AdCampaign

    if not post or not post.facebook_post_id:
        return 0
    queued = AdCampaign.objects.filter(
        boosted_post=post, status='draft',
        creative_json__boost_on_publish=True,
    )
    return sum(1 for c in queued if _launch_one(c))


def run_pending_boosts() -> int:
    """Periodic safety net: launch queued boosts whose post has since published."""
    from ads.models import AdCampaign

    queued = AdCampaign.objects.filter(
        status='draft', creative_json__boost_on_publish=True,
        boosted_post__isnull=False,
    ).select_related('boosted_post')
    launched = 0
    for c in queued:
        if c.boosted_post and c.boosted_post.facebook_post_id:
            if _launch_one(c):
                launched += 1
    return launched
