"""
Ads API views.

Endpoints (mounted under /api/v1/ads/ in api/urls.py):
    GET    /ads/accounts/                — list user's connected ad accounts
    POST   /ads/accounts/connect-meta/   — exchange OAuth token → save ad account(s)
    GET    /ads/campaigns/               — list user's campaigns
    POST   /ads/campaigns/               — create draft campaign (not launched)
    GET    /ads/campaigns/<id>/          — retrieve one campaign
    PATCH  /ads/campaigns/<id>/          — update draft fields
    POST   /ads/campaigns/<id>/pause/    — pause a running campaign
    POST   /ads/campaigns/<id>/resume/   — resume a paused campaign
    GET    /ads/campaigns/<id>/insights/ — pull live insights from Meta
    POST   /ads/boost-post/              — MVP killer feature: boost an organic post
"""
import logging
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ads.models import AdAccount, AdCampaign, AdInsight
from ads.services import meta_ads
from ads.services.token_encryption import encrypt_token
from brands.models import Brand
from posts.models import Post

logger = logging.getLogger(__name__)


def _serialize_account(a: AdAccount) -> dict:
    return {
        'id': a.id,
        'provider': a.provider,
        'external_id': a.external_id,
        'name': a.name,
        'currency_code': a.currency_code,
        'timezone_name': a.timezone_name,
        'is_active': a.is_active,
        'last_synced_at': a.last_synced_at.isoformat() if a.last_synced_at else None,
        'created_at': a.created_at.isoformat(),
    }


def _serialize_campaign(c: AdCampaign) -> dict:
    return {
        'id': c.id,
        'name': c.name,
        'objective': c.objective,
        'status': c.status,
        'provider': c.ad_account.provider,
        'ad_account_id': c.ad_account_id,
        'brand_id': c.brand_id,
        'boosted_post_id': c.boosted_post_id,
        'external_campaign_id': c.external_campaign_id,
        'external_ad_id': c.external_ad_id,
        'daily_budget_minor': c.daily_budget_minor,
        'spend_to_date_minor': c.spend_to_date_minor,
        'start_date': c.start_date.isoformat() if c.start_date else None,
        'end_date': c.end_date.isoformat() if c.end_date else None,
        'rejection_reason': c.rejection_reason,
        'created_at': c.created_at.isoformat(),
    }


# ─────────────────────────── Ad Accounts ────────────────────────────


class AdAccountListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = AdAccount.objects.filter(user=request.user, is_active=True)
        return Response({
            'accounts': [_serialize_account(a) for a in accounts],
        })


class ConnectMetaAdAccountView(APIView):
    """POST { user_access_token } → enumerates ad accounts the user has access
    to and stores them. Idempotent: re-running updates name/currency.

    The token passed in is the long-lived user token already exchanged during
    Sellanto's standard FB OAuth flow. We store it (encrypted) per ad account.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_token = (request.data.get('user_access_token') or '').strip()
        brand_id = request.data.get('brand_id')

        if not user_token:
            return Response(
                {'error': 'user_access_token required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            accounts_data = meta_ads.list_user_ad_accounts(user_token)
        except meta_ads.MetaAdsError as e:
            return Response(
                {'error': f'Meta API error: {e}', 'code': e.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception('ad account enumeration failed')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not accounts_data:
            return Response({
                'connected': [],
                'message': 'No ad accounts found for this user. Verify ads_management permission was granted.',
            })

        brand = None
        if brand_id:
            try:
                brand = Brand.objects.get(id=brand_id, user=request.user)
            except Brand.DoesNotExist:
                pass

        connected = []
        for a in accounts_data:
            obj, _ = AdAccount.objects.update_or_create(
                user=request.user,
                provider='meta',
                external_id=a['account_id'],
                defaults={
                    'brand': brand,
                    'name': a['name'],
                    'currency_code': a['currency'],
                    'timezone_name': a['timezone_name'],
                    'business_id': a['business_id'],
                    'encrypted_token': encrypt_token(user_token),
                    'is_active': True,
                    'last_synced_at': timezone.now(),
                },
            )
            connected.append(_serialize_account(obj))

        return Response({'connected': connected, 'count': len(connected)})


# ─────────────────────────── Campaigns ──────────────────────────────


class CampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campaigns = AdCampaign.objects.filter(user=request.user).select_related('ad_account', 'brand')
        return Response({
            'campaigns': [_serialize_campaign(c) for c in campaigns],
        })


class CampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        try:
            return AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return None

    def get(self, request, pk):
        c = self._get(request, pk)
        if not c:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_campaign(c))

    def patch(self, request, pk):
        c = self._get(request, pk)
        if not c:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if c.status != 'draft':
            return Response(
                {'error': 'Only draft campaigns are editable. Pause first if running.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for field in ('name', 'daily_budget_minor', 'targeting_json', 'creative_json'):
            if field in request.data:
                setattr(c, field, request.data[field])
        c.save()
        return Response(_serialize_campaign(c))


class CampaignPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            meta_ads.pause_campaign(c)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.status = 'paused'
        c.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_campaign(c))


class CampaignResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            meta_ads.resume_campaign(c)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        c.status = 'active'
        c.save(update_fields=['status', 'updated_at'])
        return Response(_serialize_campaign(c))


class CampaignInsightsView(APIView):
    """Pull live insights from Meta and upsert into AdInsight rows."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = AdCampaign.objects.get(id=pk, user=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        date_preset = request.GET.get('date_preset', 'last_7d')

        try:
            rows = meta_ads.get_campaign_insights(c, date_preset=date_preset)
        except meta_ads.MetaAdsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        saved = []
        for r in rows:
            d = r.get('date_start')
            if not d:
                continue
            try:
                day = datetime.strptime(d, '%Y-%m-%d').date()
            except ValueError:
                continue

            impressions = int(r.get('impressions', 0) or 0)
            clicks = int(r.get('clicks', 0) or 0)
            spend = int(float(r.get('spend', 0) or 0) * 100)  # USD → cents

            obj, _ = AdInsight.objects.update_or_create(
                campaign=c, date=day,
                defaults={
                    'impressions': impressions,
                    'reach': int(r.get('reach', 0) or 0),
                    'clicks': clicks,
                    'spend_minor': spend,
                    'ctr': float(r.get('ctr', 0) or 0) / 100.0,  # Meta returns %
                    'cpc_minor': int(float(r.get('cpc', 0) or 0) * 100),
                    'cpm_minor': int(float(r.get('cpm', 0) or 0) * 100),
                    'frequency': float(r.get('frequency', 0) or 0),
                    'raw_data': r,
                },
            )
            saved.append({
                'date': str(obj.date),
                'impressions': obj.impressions,
                'clicks': obj.clicks,
                'spend_minor': obj.spend_minor,
                'ctr': obj.ctr,
            })

        return Response({'insights': saved, 'count': len(saved)})


# ─────────────────────────── Boost Post (MVP) ───────────────────────


class BoostPostView(APIView):
    """POST {
        post_id: int,            # Sellanto Post.id
        ad_account_id: int,
        daily_budget_usd: float, # e.g. 10.00 → 1000 cents
        duration_days: int,      # e.g. 7
        targeting: {...}         # geo_locations, age_min, age_max, interests
    }
    Creates Campaign+AdSet+Creative+Ad on Meta, persists AdCampaign locally.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        post_id = request.data.get('post_id')
        ad_account_id = request.data.get('ad_account_id')
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days', 7))
        targeting = request.data.get('targeting') or {}

        if not (post_id and ad_account_id and daily_budget_usd):
            return Response(
                {'error': 'post_id, ad_account_id, daily_budget_usd are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if not post.facebook_post_id:
            return Response(
                {'error': 'Post has not been published to Facebook yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True,
            )
        except AdAccount.DoesNotExist:
            return Response(
                {'error': 'Ad account not found or not connected.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Resolve Page ID from the post's brand → SocialAccount
        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True,
        ).first()
        if not sa or not sa.facebook_page_id:
            return Response(
                {'error': 'No connected Facebook Page found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Convert USD → ad-account-currency minor units.
        # Meta's daily_budget is in the ad account's currency minor units
        # (e.g. cents for USD, paisa for BDT). If we send USD cents to a BDT
        # account, Meta interprets 100 as 1 BDT (way below the ~124 BDT min).
        # Approximate rates — refresh quarterly. For production, fetch live
        # rates from an FX service. Default 1.0 means "treat as USD".
        FX_PER_USD = {
            'USD': 1.0,
            'BDT': 120.0,
            'INR': 84.0,
            'PKR': 280.0,
            'IDR': 16000.0,
            'EUR': 0.92,
            'GBP': 0.78,
            'CAD': 1.38,
            'AUD': 1.55,
            'SGD': 1.35,
            'MYR': 4.5,
            'AED': 3.67,
            'SAR': 3.75,
        }
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)

        # $1.00 works for USD accounts but BDT/PKR/IDR have higher absolute
        # minimums (e.g. Meta requires BDT ~124/day). Requiring $1.50 USD
        # comfortably exceeds the threshold for all supported currencies.
        if usd < 1.5:
            return Response(
                {'error': 'Minimum daily budget is $1.50.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = (ad_account.currency_code or 'USD').upper()
        fx_rate = FX_PER_USD.get(currency, 1.0)
        daily_budget_cents = int(round(usd * fx_rate * 100))
        logger.info(
            f'[boost_post] budget conversion: ${usd} USD x {fx_rate} '
            f'= {daily_budget_cents} {currency} minor units'
        )

        # Diamond pre-check
        try:
            from accounts.services.diamond_service import pre_check, deduct_diamonds
            can_afford, cost, balance = pre_check(request.user, 'ads_boost_post')
            if not can_afford:
                return Response({
                    'error': 'Insufficient Diamond Tokens',
                    'diamond_cost': cost,
                    'diamond_balance': balance,
                    'code': 'INSUFFICIENT_DIAMONDS',
                }, status=402)
        except Exception:
            # Feature not yet wired in DIAMOND_COSTS — skip gracefully during MVP
            pass

        # Create the campaign on Meta
        try:
            result = meta_ads.boost_post(
                ad_account=ad_account,
                page_id=sa.facebook_page_id,
                fb_post_id=post.facebook_post_id,
                daily_budget_cents=daily_budget_cents,
                duration_days=duration_days,
                targeting=targeting,
                campaign_name=f'Boost: {post.caption[:40] if post.caption else post.id}',
                page_access_token=sa.facebook_access_token or '',
            )
        except meta_ads.MetaAdsError as e:
            logger.warning(
                'boost_post failed user=%s post=%s err=%s raw=%s',
                request.user.id, post.id, e, e.raw,
            )
            # Surface Meta's human-readable error message when available.
            # e.raw is the full {'message','code','error_subcode',
            # 'error_user_title','error_user_msg',...} block from Graph API.
            raw = e.raw or {}
            user_title = raw.get('error_user_title')
            user_msg = raw.get('error_user_msg')
            display = ' - '.join(filter(None, [user_title, user_msg])) or str(e)
            return Response(
                {
                    'error': display,
                    'code': e.code,
                    'subcode': e.subcode,
                    'error_user_title': user_title,
                    'error_user_msg': user_msg,
                    'step': str(e).split(':')[0] if ':' in str(e) else None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist locally
        now = timezone.now()
        campaign = AdCampaign.objects.create(
            user=request.user,
            brand=post.brand,
            ad_account=ad_account,
            boosted_post=post,
            name=f'Boost: {post.caption[:40] if post.caption else post.id}',
            objective='boost_post',
            status='pending_review',
            external_campaign_id=result['campaign_id'],
            external_adset_id=result['adset_id'],
            external_creative_id=result['creative_id'],
            external_ad_id=result['ad_id'],
            daily_budget_minor=daily_budget_cents,
            start_date=now,
            end_date=now + timedelta(days=duration_days),
            targeting_json=targeting,
            creative_json={
                'object_story_id': f'{sa.facebook_page_id}_{post.facebook_post_id}',
            },
        )

        # Deduct diamonds (after success)
        try:
            from accounts.services.diamond_service import deduct_diamonds
            deduct_diamonds(user=request.user, feature='ads_boost_post', provider='meta')
        except Exception:
            pass

        return Response(_serialize_campaign(campaign), status=status.HTTP_201_CREATED)


# ─────────────────────────── Run Video Ad (Path A) ───────────────────────────


class RunVideoAdView(APIView):
    """One-click "Publish + Boost" video ad.

    POST multipart/form-data:
        video:             video file (mp4/mov/avi)
        caption:           str (becomes both the FB post description and ad text)
        ad_account_id:     int (Sellanto AdAccount.id)
        daily_budget_usd:  float (USD; converted to account currency server-side)
        duration_days:     int (>=1)
        targeting:         JSON string {"geo_locations": ..., "age_min": ..., "age_max": ...}

    Returns 201 with {post, campaign} on success.
    """
    permission_classes = [IsAuthenticated]

    # Approx 200 MB cap to keep upload UX reasonable (Meta allows up to 4 GB
    # but typical ad-friendly clips are < 1 min and 50 MB).
    MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024
    ALLOWED_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm')

    def post(self, request):
        video_file = request.FILES.get('video')
        caption = (request.data.get('caption') or '').strip()
        ad_account_id = request.data.get('ad_account_id')
        daily_budget_usd = request.data.get('daily_budget_usd')
        duration_days = int(request.data.get('duration_days') or 1)
        targeting_raw = request.data.get('targeting') or '{}'

        # ── validate inputs ───────────────────────────────────────────────────
        if not video_file:
            return Response({'error': 'video file is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if video_file.size > self.MAX_VIDEO_SIZE_BYTES:
            return Response(
                {'error': f'Video must be under {self.MAX_VIDEO_SIZE_BYTES // (1024 * 1024)} MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ext = ('.' + video_file.name.rsplit('.', 1)[-1].lower()) if '.' in video_file.name else ''
        if ext not in self.ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Unsupported file format {ext!r}. Use {", ".join(self.ALLOWED_EXTENSIONS)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ad_account_id:
            return Response({'error': 'ad_account_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not daily_budget_usd:
            return Response({'error': 'daily_budget_usd is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            targeting = (
                targeting_raw if isinstance(targeting_raw, dict)
                else __import__('json').loads(targeting_raw)
            )
        except Exception:
            return Response({'error': 'targeting must be valid JSON'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            ad_account = AdAccount.objects.get(
                id=ad_account_id, user=request.user, provider='meta', is_active=True,
            )
        except AdAccount.DoesNotExist:
            return Response(
                {'error': 'Ad account not found or not connected.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from platforms.models import SocialAccount
        sa = SocialAccount.objects.filter(
            user=request.user, platform='facebook', is_active=True,
        ).first()
        if not sa or not sa.facebook_page_id:
            return Response(
                {'error': 'No connected Facebook Page found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── FX-convert USD to account currency minor units ────────────────────
        # Same table/logic as BoostPostView. Refresh quarterly for production.
        FX_PER_USD = {
            'USD': 1.0, 'BDT': 120.0, 'INR': 84.0, 'PKR': 280.0, 'IDR': 16000.0,
            'EUR': 0.92, 'GBP': 0.78, 'CAD': 1.38, 'AUD': 1.55, 'SGD': 1.35,
            'MYR': 4.5, 'AED': 3.67, 'SAR': 3.75,
        }
        try:
            usd = float(daily_budget_usd)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)
        if usd < 1.5:
            return Response(
                {'error': 'Minimum daily budget is $1.50.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        currency = (ad_account.currency_code or 'USD').upper()
        fx_rate = FX_PER_USD.get(currency, 1.0)
        daily_budget_minor = int(round(usd * fx_rate * 100))

        # ── save uploaded file to disk ────────────────────────────────────────
        import os
        from django.conf import settings as dj_settings
        from django.utils import timezone as dj_tz
        safe_name = video_file.name.replace('/', '_').replace('\\', '_')
        rel_dir = f'ads_videos/{request.user.id}'
        abs_dir = os.path.join(dj_settings.MEDIA_ROOT, rel_dir)
        os.makedirs(abs_dir, exist_ok=True)
        filename = f'{int(dj_tz.now().timestamp())}_{safe_name}'
        abs_path = os.path.join(abs_dir, filename)
        with open(abs_path, 'wb') as f:
            for chunk in video_file.chunks():
                f.write(chunk)
        logger.info(f'[run_video_ad] saved upload to {abs_path}')

        # ── run the publish+boost flow ────────────────────────────────────────
        from ads.services.video_ad import (
            publish_and_boost_video, VideoAdError,
        )
        try:
            result = publish_and_boost_video(
                user=request.user,
                ad_account=ad_account,
                social_account=sa,
                video_path=abs_path,
                caption=caption,
                daily_budget_minor=daily_budget_minor,
                duration_days=duration_days,
                targeting=targeting,
            )
        except VideoAdError as e:
            logger.warning(
                'run_video_ad failed user=%s step=%s err=%s raw=%s',
                request.user.id, e.step, e, e.raw,
            )
            raw = e.raw or {}
            return Response(
                {
                    'error': raw.get('error_user_msg') or str(e),
                    'error_user_title': raw.get('error_user_title'),
                    'error_user_msg': raw.get('error_user_msg'),
                    'step': e.step,
                    'code': e.code,
                    'subcode': e.subcode,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception('run_video_ad unexpected error')
            return Response(
                {'error': f'Unexpected error: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result, status=status.HTTP_201_CREATED)
