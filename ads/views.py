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

        # Convert USD → cents
        try:
            daily_budget_cents = int(round(float(daily_budget_usd) * 100))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid daily_budget_usd'},
                            status=status.HTTP_400_BAD_REQUEST)

        if daily_budget_cents < 100:
            return Response(
                {'error': 'Minimum daily budget is $1.00.'},
                status=status.HTTP_400_BAD_REQUEST,
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
            )
        except meta_ads.MetaAdsError as e:
            logger.warning(
                'boost_post failed user=%s post=%s err=%s',
                request.user.id, post.id, e,
            )
            return Response(
                {'error': str(e), 'code': e.code, 'subcode': e.subcode},
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
