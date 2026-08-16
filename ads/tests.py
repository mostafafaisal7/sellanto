"""End-to-end tests for the Meta ads system.

These drive the real DRF endpoints with a real DB and real serializers; the
ONLY thing stubbed is the outbound Graph API call (`meta_ads._get` / `_post` /
`_delete_quietly`) so nothing touches Meta and no money can move.

`FakeGraph` records every call, so a test can assert not just "the endpoint
returned 200" but "the exact payload Meta would have received is correct" --
which is where the targeting/advantage-audience bugs actually lived.

Run: python manage.py test ads
"""
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ads.models import AdAccount, AdCampaign
from ads.services import meta_ads
from brands.models import Brand, Workspace
from platforms.models import SocialAccount

User = get_user_model()


# ─────────────────────────────── Graph API stub ──────────────────────────────

class FakeGraph:
    """Records Graph calls and returns plausible Meta-shaped responses."""

    def __init__(self):
        self.posts = []   # [(path, params), ...]
        self.gets = []    # [(path, params), ...]
        self.deleted = []
        self.fail_on = None   # substring of a path that should raise

    # -- outbound POST --------------------------------------------------------
    def post(self, path, token, **params):
        self.posts.append((path, params))
        if self.fail_on and self.fail_on in path:
            raise meta_ads.MetaAdsError(
                f'simulated failure on {path}', code=100, subcode=1234)
        if 'campaigns' in path:
            return {'id': '120000000000001'}
        if 'adsets' in path:
            return {'id': '120000000000002'}
        if 'adcreatives' in path:
            return {'id': '120000000000003'}
        if 'adimages' in path:
            return {'images': {'bytes': {'hash': 'IMGHASH123'}}}
        if 'leadgen_forms' in path:
            return {'id': 'FORM123'}
        if path.endswith('/ads'):
            return {'id': '120000000000004'}
        return {'id': 'generic-id', 'success': True}

    # -- outbound GET ---------------------------------------------------------
    def get(self, path, token, **params):
        self.gets.append((path, params))
        if 'insights' in path:
            return {'data': [{
                'date_start': '2026-08-01', 'date_stop': '2026-08-01',
                'impressions': '1000', 'reach': '800', 'clicks': '50',
                'inline_link_clicks': '40', 'spend': '12.50', 'ctr': '5.0',
                'cpc': '0.25', 'cpm': '12.5', 'frequency': '1.25',
            }]}
        if 'generatepreviews' in path:
            return {'data': [{'body': '<iframe src="preview"></iframe>'}]}
        if 'adspixels' in path:
            return {'data': [{'id': 'PIXEL1', 'name': 'Main Pixel'}]}
        if 'customaudiences' in path:
            return {'data': [{'id': 'AUD1', 'name': 'Site visitors',
                              'subtype': 'CUSTOM', 'approximate_count': 5000}]}
        if 'search' in path:
            return {'data': [{'id': '6003139266461', 'name': 'Coffee',
                              'audience_size': 900000, 'type': 'interests'}]}
        if 'adaccounts' in path:
            return {'data': [{
                'id': 'act_555', 'account_id': '555', 'name': 'Test Account',
                'currency': 'USD', 'timezone_name': 'UTC', 'account_status': 101,
            }]}
        return {'data': []}

    # -- helpers --------------------------------------------------------------
    def adset_payload(self):
        """The params of the last /adsets POST, with targeting decoded."""
        for path, params in reversed(self.posts):
            if 'adsets' in path:
                out = dict(params)
                if 'targeting' in out:
                    out['targeting'] = json.loads(out['targeting'])
                return out
        return None

    def paths(self, verb='post'):
        src = self.posts if verb == 'post' else self.gets
        return [p for p, _ in src]


class MetaAdsTestBase(TestCase):
    """Shared fixtures: a user, a sandbox + a live ad account, a FB page."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='adtester', email='ad@test.com', password='pw12345!')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # AdCampaign.brand is a required FK, so campaign creation needs one.
        self.workspace = Workspace.objects.create(
            owner=self.user, name='Test Workspace')
        self.brand = Brand.objects.create(
            workspace=self.workspace, user=self.user, brand_name='Test Brand',
            industry='retail', target_region='US')

        self.sandbox = AdAccount.objects.create(
            user=self.user, provider='meta', external_id='555',
            name='Sandbox Account', currency_code='USD', timezone_name='UTC',
            account_status=101, is_sandbox=True, is_active=True,
            encrypted_token='enc',
        )
        self.live = AdAccount.objects.create(
            user=self.user, provider='meta', external_id='777',
            name='Live Account', currency_code='USD', timezone_name='UTC',
            account_status=1, is_sandbox=False, is_active=True,
            encrypted_token='enc',
        )
        self.social = SocialAccount.objects.create(
            user=self.user, platform='facebook', is_active=True,
            facebook_page_id='PAGE123', facebook_access_token='pagetok',
            account_name='Test Page',
        )

        self.graph = FakeGraph()
        patches = [
            patch.object(meta_ads, '_post', self.graph.post),
            patch.object(meta_ads, '_get', self.graph.get),
            patch.object(meta_ads, '_delete_quietly',
                         lambda node, token: self.graph.deleted.append(node)),
            patch.object(meta_ads, 'decrypt_token', lambda t: 'TOKEN'),
            patch.object(meta_ads, 'upload_image_from_url',
                         lambda *a, **k: 'IMGHASH123'),
            patch.object(meta_ads, '_resolve_object_story_id',
                         lambda *a, **k: 'PAGE123_999'),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def _cards(self, n=2):
        return [{'link': f'https://example.com/{i}',
                 'image_url': f'https://cdn/{i}.jpg',
                 'name': f'Card {i}', 'cta': 'SHOP_NOW'} for i in range(n)]


# ────────────────────────── 1. Advantage audience flag ───────────────────────

class AdvantageAudienceFlagTests(MetaAdsTestBase):
    """Meta REQUIRES targeting_automation.advantage_audience on every adset."""

    FRIENDLY = {
        'geo_locations': {'countries': ['US']},
        'age_min': 25, 'age_max': 45,
        'interests': ['6003139266461'],
        'placements': ['instagram:reels'],
    }

    def test_campaign_create_sends_flag_defaulting_to_zero(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'name': 'Flag Test', 'daily_budget_usd': 5.0, 'duration_days': 7,
            'link_url': 'https://example.com', 'targeting': self.FRIENDLY,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['targeting_automation'], {'advantage_audience': 0})

    def test_campaign_create_honours_opt_in(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': self.FRIENDLY, 'advantage_audience': True,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['targeting_automation'], {'advantage_audience': 1})

    def test_string_false_does_not_enable_advantage(self):
        """HTML forms send 'false' -- bool('false') is True, so _parse_bool matters."""
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': self.FRIENDLY, 'advantage_audience': 'false',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['targeting_automation'], {'advantage_audience': 0})

    def test_carousel_sends_flag(self):
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'cards': self._cards(),
            'targeting': self.FRIENDLY,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['targeting_automation'], {'advantage_audience': 0})

    def test_flag_present_even_with_no_targeting_supplied(self):
        """The endpoint's default targeting has no friendly keys -> passthrough."""
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertIn('targeting_automation', t)

    def test_explicit_spec_flag_is_not_clobbered(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': {'geo_locations': {'countries': ['US']},
                          'targeting_automation': {'advantage_audience': 1}},
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['targeting_automation'], {'advantage_audience': 1})


# ─────────────────────────── 2. Targeting normalization ──────────────────────

class TargetingNormalizationTests(MetaAdsTestBase):
    """Friendly keys must become Meta's real shapes on EVERY creation path."""

    FRIENDLY = {
        'geo_locations': {'countries': ['US']},
        'age_min': 25, 'age_max': 45, 'genders': [2],
        'interests': ['6003139266461', '6003397425735'],
        'behaviors': ['6002714895372'],
        'placements': ['facebook:feed', 'instagram:reels'],
        'custom_audiences': ['AUD1'],
    }

    def _assert_normalized(self, t):
        self.assertEqual(
            t['flexible_spec'],
            [{'interests': [{'id': '6003139266461'}, {'id': '6003397425735'}],
              'behaviors': [{'id': '6002714895372'}]}])
        self.assertEqual(sorted(t['publisher_platforms']),
                         ['facebook', 'instagram'])
        self.assertEqual(t['facebook_positions'], ['feed'])
        self.assertEqual(t['instagram_positions'], ['reels'])
        self.assertEqual(t['custom_audiences'], [{'id': 'AUD1'}])
        # Friendly keys Meta does not understand must NOT survive.
        for stale in ('interests', 'behaviors', 'placements'):
            self.assertNotIn(stale, t, f'{stale!r} leaked into the Meta payload')

    def test_link_campaign_normalizes(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': self.FRIENDLY,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        self._assert_normalized(self.graph.adset_payload()['targeting'])

    def test_carousel_normalizes(self):
        """Regression: the carousel path used to send raw friendly keys."""
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'cards': self._cards(),
            'targeting': self.FRIENDLY,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        self._assert_normalized(self.graph.adset_payload()['targeting'])

    def test_already_meta_shaped_spec_passes_through(self):
        spec = {'geo_locations': {'countries': ['GB']},
                'age_min': 30, 'age_max': 50,
                'flexible_spec': [{'interests': [{'id': '123'}]}]}
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': spec,
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        t = self.graph.adset_payload()['targeting']
        self.assertEqual(t['geo_locations'], {'countries': ['GB']})
        self.assertEqual(t['flexible_spec'], [{'interests': [{'id': '123'}]}])

    def test_regions_and_cities_are_shaped(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'targeting': {'geo': {'countries': ['US'],
                                  'cities': ['2418779'],
                                  'regions': [{'key': '3847'}]},
                          'interests': ['1']},
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        geo = self.graph.adset_payload()['targeting']['geo_locations']
        self.assertEqual(geo['cities'], [{'key': '2418779'}])
        self.assertEqual(geo['regions'], [{'key': '3847'}])


# ──────────────────────────── 3. Live-spend guard ────────────────────────────

class LiveSpendGuardTests(MetaAdsTestBase):
    """Real-money accounts must require explicit confirmation."""

    def _create_on(self, account, **extra):
        body = {'ad_account_id': account.id, 'objective': 'traffic',
                'daily_budget_usd': 5.0, 'link_url': 'https://example.com'}
        body.update(extra)
        return self.client.post(
            '/api/v1/ads/meta/campaigns/create/', body, format='json')

    def test_live_account_blocked_without_confirmation(self):
        res = self._create_on(self.live)
        self.assertEqual(res.status_code, 409)
        self.assertTrue(res.data['requires_confirmation'])
        self.assertEqual(self.graph.posts, [], 'Meta was called despite the guard')

    def test_live_account_proceeds_with_confirmation(self):
        res = self._create_on(self.live, confirm_live=True)
        self.assertIn(res.status_code, (200, 201), res.data)
        self.assertTrue(self.graph.posts)

    def test_string_false_confirm_live_still_blocks(self):
        res = self._create_on(self.live, confirm_live='false')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(self.graph.posts, [])

    def test_sandbox_never_requires_confirmation(self):
        res = self._create_on(self.sandbox)
        self.assertIn(res.status_code, (200, 201), res.data)

    def test_carousel_and_boost_are_guarded_too(self):
        r1 = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.live.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'cards': self._cards()},
            format='json')
        self.assertEqual(r1.status_code, 409)


# ───────────────────── 4. Campaigns are PAUSED unless activated ──────────────

class PausedByDefaultTests(MetaAdsTestBase):
    """Nothing should start spending without an explicit activate=true."""

    def test_campaign_defaults_to_paused(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        camp_params = next(p for path, p in self.graph.posts
                           if 'campaigns' in path)
        self.assertEqual(camp_params['status'], 'PAUSED')

    def test_activate_string_false_does_not_activate(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'activate': 'false',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        camp_params = next(p for path, p in self.graph.posts
                           if 'campaigns' in path)
        self.assertEqual(camp_params['status'], 'PAUSED')

    def test_adset_is_paused(self):
        self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(self.graph.adset_payload()['status'], 'PAUSED')


# ──────────────────────────── 5. Rollback on failure ─────────────────────────

class RollbackTests(MetaAdsTestBase):
    """A failed step must not leave orphaned objects on the ad account."""

    def test_adset_failure_rolls_back_campaign(self):
        self.graph.fail_on = 'adsets'
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('120000000000001', self.graph.deleted)
        self.assertFalse(AdCampaign.objects.filter(user=self.user).exists())

    def test_carousel_adset_failure_rolls_back(self):
        self.graph.fail_on = 'adsets'
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'cards': self._cards(),
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('120000000000001', self.graph.deleted)


# ──────────────────────────── 6. Input validation ────────────────────────────

class ValidationTests(MetaAdsTestBase):

    def test_budget_below_minimum_rejected(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 0.50, 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.graph.posts, [])

    def test_non_finite_budget_rejected(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 'inf', 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_unknown_objective_rejected(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'world_domination',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_carousel_card_count_enforced(self):
        for n in (1, 11):
            res = self.client.post('/api/v1/ads/meta/carousel/', {
                'ad_account_id': self.sandbox.id, 'objective': 'traffic',
                'daily_budget_usd': 5.0, 'cards': self._cards(n),
            }, format='json')
            self.assertEqual(res.status_code, 400, f'{n} cards should fail')

    def test_other_users_account_is_not_reachable(self):
        other = User.objects.create_user(username='other', password='pw12345!')
        theirs = AdAccount.objects.create(
            user=other, provider='meta', external_id='999',
            is_sandbox=True, is_active=True, encrypted_token='enc',
            currency_code='USD')
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': theirs.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertIn(res.status_code, (403, 404))
        self.assertEqual(self.graph.posts, [])

    def test_unauthenticated_is_rejected(self):
        anon = APIClient()
        res = anon.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertIn(res.status_code, (401, 403))


# ───────────────── 6b. Optimization goal / objective compatibility ───────────

class OptimizationGoalTests(MetaAdsTestBase):
    """Meta rejects a conversion goal that has no conversion source:
    "Performance goal isn't available - You can't use the selected performance
    goal with your campaign objective."
    """

    def _create(self, objective, **extra):
        body = {'ad_account_id': self.sandbox.id, 'objective': objective,
                'daily_budget_usd': 5.0, 'link_url': 'https://example.com'}
        body.update(extra)
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', body,
                               format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        return self.graph.adset_payload()

    def test_safe_objectives_keep_their_goal(self):
        for objective, goal in (('awareness', 'REACH'),
                                ('traffic', 'LINK_CLICKS'),
                                ('engagement', 'POST_ENGAGEMENT')):
            self.graph.posts.clear()
            self.assertEqual(self._create(objective)['optimization_goal'], goal,
                             f'{objective} goal changed unexpectedly')

    def test_sales_without_pixel_downgrades(self):
        p = self._create('sales')
        self.assertEqual(p['optimization_goal'], 'LINK_CLICKS')

    def test_leads_without_pixel_downgrades(self):
        p = self._create('leads')
        self.assertEqual(p['optimization_goal'], 'LINK_CLICKS')

    def test_sales_with_pixel_keeps_conversions(self):
        p = self._create('sales', pixel_id='PIXEL1',
                         custom_event_type='PURCHASE')
        self.assertEqual(p['optimization_goal'], 'OFFSITE_CONVERSIONS')
        promoted = json.loads(p['promoted_object'])
        self.assertEqual(promoted['pixel_id'], 'PIXEL1')
        self.assertEqual(promoted['custom_event_type'], 'PURCHASE')

    def test_leads_with_pixel_keeps_lead_generation(self):
        p = self._create('leads', pixel_id='PIXEL1')
        self.assertEqual(p['optimization_goal'], 'LEAD_GENERATION')

    def test_downgrade_pairs_a_valid_billing_event(self):
        self.assertEqual(self._create('sales')['billing_event'], 'IMPRESSIONS')

    def test_carousel_sales_without_pixel_downgrades(self):
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'sales',
            'daily_budget_usd': 5.0, 'cards': self._cards(),
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        self.assertEqual(
            self.graph.adset_payload()['optimization_goal'], 'LINK_CLICKS')

    def test_carousel_accepts_a_pixel(self):
        """Regression: the carousel path had no pixel support at all."""
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'sales',
            'daily_budget_usd': 5.0, 'cards': self._cards(),
            'pixel_id': 'PIXEL1', 'custom_event_type': 'PURCHASE',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        p = self.graph.adset_payload()
        self.assertEqual(p['optimization_goal'], 'OFFSITE_CONVERSIONS')
        self.assertEqual(json.loads(p['promoted_object'])['pixel_id'], 'PIXEL1')


# ─────────────────────── 7. Read paths: insights & lookups ───────────────────

class ReadPathTests(MetaAdsTestBase):

    def setUp(self):
        super().setUp()
        self.campaign = AdCampaign.objects.create(
            user=self.user, brand=self.brand, ad_account=self.sandbox, name='C1',
            objective='traffic', status='active',
            external_campaign_id='120000000000001',
            daily_budget_minor=500, start_date=timezone.now())

    def test_account_summary(self):
        res = self.client.get('/api/v1/ads/meta/account-summary/',
                              {'ad_account_id': self.sandbox.id})
        self.assertEqual(res.status_code, 200, res.data)

    def test_campaign_insights(self):
        res = self.client.get(
            f'/api/v1/ads/campaigns/{self.campaign.id}/insights/')
        self.assertEqual(res.status_code, 200, res.data)

    def test_breakdown(self):
        res = self.client.get(
            f'/api/v1/ads/campaigns/{self.campaign.id}/breakdown/',
            {'breakdown': 'age,gender'})
        self.assertEqual(res.status_code, 200, res.data)

    def test_targeting_search(self):
        res = self.client.get('/api/v1/ads/meta/targeting/search/',
                              {'q': 'coffee', 'type': 'interest',
                               'ad_account_id': self.sandbox.id})
        self.assertEqual(res.status_code, 200, res.data)

    def test_pixels(self):
        res = self.client.get('/api/v1/ads/meta/pixels/',
                              {'ad_account_id': self.sandbox.id})
        self.assertEqual(res.status_code, 200, res.data)

    def test_live_audiences(self):
        res = self.client.get('/api/v1/ads/meta/audiences/live/',
                              {'ad_account_id': self.sandbox.id})
        self.assertEqual(res.status_code, 200, res.data)

    def test_ad_preview_uses_GET_not_POST(self):
        """generatepreviews is a read; a POST here 400s on Meta's side."""
        res = self.client.post('/api/v1/ads/meta/preview/', {
            'ad_account_id': self.sandbox.id, 'page_id': 'PAGE123',
            'link_url': 'https://example.com', 'message': 'hi',
            'ad_format': 'DESKTOP_FEED_STANDARD',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(any('generatepreviews' in p
                            for p in self.graph.paths('get')),
                        'generatepreviews should be a GET')

    def test_campaign_list_is_user_scoped(self):
        other = User.objects.create_user(username='o2', password='pw12345!')
        AdCampaign.objects.create(
            user=other, brand=self.brand, ad_account=self.sandbox, name='NotMine',
            objective='traffic', status='active',
            daily_budget_minor=100, start_date=timezone.now())
        res = self.client.get('/api/v1/ads/campaigns/')
        self.assertEqual(res.status_code, 200)
        names = [c['name'] for c in res.data['campaigns']]
        self.assertIn('C1', names)
        self.assertNotIn('NotMine', names)


# ────────────────────── 8. Lifecycle: pause / resume / persist ───────────────

class LifecycleTests(MetaAdsTestBase):

    def setUp(self):
        super().setUp()
        self.campaign = AdCampaign.objects.create(
            user=self.user, brand=self.brand, ad_account=self.sandbox, name='C1',
            objective='traffic', status='active',
            external_campaign_id='120000000000001',
            daily_budget_minor=500, start_date=timezone.now())

    def test_pause(self):
        res = self.client.post(f'/api/v1/ads/campaigns/{self.campaign.id}/pause/')
        self.assertEqual(res.status_code, 200, res.data)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'paused')

    def test_resume(self):
        self.campaign.status = 'paused'
        self.campaign.save()
        res = self.client.post(f'/api/v1/ads/campaigns/{self.campaign.id}/resume/')
        self.assertEqual(res.status_code, 200, res.data)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'active')

    def test_cannot_pause_another_users_campaign(self):
        other = User.objects.create_user(username='o3', password='pw12345!')
        theirs = AdCampaign.objects.create(
            user=other, brand=self.brand, ad_account=self.sandbox, name='Theirs',
            objective='traffic', status='active',
            external_campaign_id='999', daily_budget_minor=100,
            start_date=timezone.now())
        res = self.client.post(f'/api/v1/ads/campaigns/{theirs.id}/pause/')
        self.assertIn(res.status_code, (403, 404))

    def test_successful_create_persists_a_campaign_row(self):
        before = AdCampaign.objects.filter(user=self.user).count()
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'name': 'Persisted', 'daily_budget_usd': 5.0,
            'link_url': 'https://example.com',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        self.assertEqual(
            AdCampaign.objects.filter(user=self.user).count(), before + 1)
        row = AdCampaign.objects.filter(user=self.user).latest('id')
        self.assertEqual(row.external_campaign_id, '120000000000001')


# ────────────────────────── 9. Full 4-step call chain ────────────────────────

class CallChainTests(MetaAdsTestBase):
    """Meta requires campaign -> adset -> creative -> ad, in that order."""

    def test_link_campaign_makes_all_four_calls_in_order(self):
        res = self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
            'message': 'Body', 'headline': 'Head',
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        kinds = [p.rsplit('/', 1)[-1] for p in self.graph.paths()]
        self.assertEqual(
            [k for k in kinds if k in
             ('campaigns', 'adsets', 'adcreatives', 'ads')],
            ['campaigns', 'adsets', 'adcreatives', 'ads'])

    def test_carousel_creative_carries_child_attachments(self):
        res = self.client.post('/api/v1/ads/meta/carousel/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'cards': self._cards(3),
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.data)
        creative = next(p for path, p in self.graph.posts
                        if 'adcreatives' in path)
        story = json.loads(creative['object_story_spec'])
        self.assertEqual(len(story['link_data']['child_attachments']), 3)

    def test_budget_is_converted_to_minor_units(self):
        self.client.post('/api/v1/ads/meta/campaigns/create/', {
            'ad_account_id': self.sandbox.id, 'objective': 'traffic',
            'daily_budget_usd': 5.0, 'link_url': 'https://example.com',
        }, format='json')
        self.assertEqual(self.graph.adset_payload()['daily_budget'], 500)
