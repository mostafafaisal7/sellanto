"""
Django management command to perform required Meta Graph API test calls
for App Review submission. Makes real API calls using stored credentials.

Usage:
    python manage.py meta_test_calls
    python manage.py meta_test_calls --email user@example.com
"""
import requests
from django.core.management.base import BaseCommand
from platforms.models import SocialAccount


GRAPH = 'https://graph.facebook.com/v21.0'


class Command(BaseCommand):
    help = 'Make Meta Graph API test calls required for App Review'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Filter by user email (optional)')
        parser.add_argument(
            '--exercise-delete', action='store_true',
            help='Exercise pages_manage_posts DELETE: publishes a temporary '
                 'Page post, then deletes it. Safe (creates its own throwaway '
                 'post). Off by default so no real content is touched.',
        )

    def handle(self, *args, **options):
        email = options.get('email')
        exercise_delete = options.get('exercise_delete')
        ig_qs = SocialAccount.objects.filter(platform='instagram', is_active=True)
        fb_qs = SocialAccount.objects.filter(platform='facebook', is_active=True)
        if email:
            ig_qs = ig_qs.filter(user__email=email)
            fb_qs = fb_qs.filter(user__email=email)

        ig = ig_qs.first()
        fb = fb_qs.first()

        if not ig and not fb:
            self.stderr.write(self.style.ERROR('No active connected accounts found.'))
            return

        self.stdout.write('\n' + '='*60)
        self.stdout.write('Meta App Review — Required API Test Calls')
        self.stdout.write('='*60 + '\n')

        # ── instagram_manage_comments ────────────────────────────
        if ig and ig.instagram_business_account_id:
            self._call(
                label='instagram_manage_comments → GET /{ig-user-id}/media (to find a media ID)',
                method='GET',
                url=f"{GRAPH}/{ig.instagram_business_account_id}/media",
                params={
                    'fields': 'id,caption,timestamp',
                    'limit': 5,
                    'access_token': ig.instagram_access_token,
                },
            )
            # Try to fetch comments on the first media item
            media_id = self._get_first_media_id(ig)
            if media_id:
                self._call(
                    label=f'instagram_manage_comments → GET /{media_id}/comments',
                    method='GET',
                    url=f"{GRAPH}/{media_id}/comments",
                    params={
                        'fields': 'id,text,username,timestamp',
                        'access_token': ig.instagram_access_token,
                    },
                )

        # ── instagram_manage_contents ────────────────────────────
        if ig and ig.instagram_business_account_id:
            self._call(
                label='instagram_manage_contents → GET /{ig-user-id}/media (content list)',
                method='GET',
                url=f"{GRAPH}/{ig.instagram_business_account_id}/media",
                params={
                    'fields': 'id,media_type,media_url,thumbnail_url,caption,timestamp,like_count,comments_count',
                    'limit': 10,
                    'access_token': ig.instagram_access_token,
                },
            )

        # ── instagram_basic ──────────────────────────────────────
        if ig and ig.instagram_business_account_id:
            self._call(
                label='instagram_basic → GET /me?fields=id,name,username,followers_count,media_count,account_type',
                method='GET',
                url=f"{GRAPH}/me",
                params={
                    'fields': 'id,name,username,followers_count,media_count,account_type',
                    'access_token': ig.instagram_access_token,
                },
            )

        # ── instagram_content_publish ────────────────────────────
        if ig and ig.instagram_business_account_id:
            self._call(
                label='instagram_content_publish → GET /{ig-user-id}/content_publishing_limit',
                method='GET',
                url=f"{GRAPH}/{ig.instagram_business_account_id}/content_publishing_limit",
                params={
                    'fields': 'config,quota_usage',
                    'access_token': ig.instagram_access_token,
                },
            )

        # ── pages_manage_posts ───────────────────────────────────
        if fb and fb.facebook_page_id:
            self._call(
                label='pages_manage_posts → GET /{page-id}/feed',
                method='GET',
                url=f"{GRAPH}/{fb.facebook_page_id}/feed",
                params={
                    'fields': 'id,message,created_time',
                    'limit': 5,
                    'access_token': fb.facebook_access_token,
                },
            )

        # ── pages_manage_posts (DELETE) ──────────────────────────
        # Opt-in: publish a throwaway post then delete it, so the DELETE
        # capability is exercised without touching any real content.
        if exercise_delete and fb and fb.facebook_page_id:
            self.stdout.write('\n▶ pages_manage_posts (DELETE) → publish temp post, then DELETE /{post-id}')
            try:
                pub = requests.post(
                    f"{GRAPH}/{fb.facebook_page_id}/feed",
                    data={
                        'message': 'SellAnto App Review test post — will be deleted automatically.',
                        'published': 'true',
                        'access_token': fb.facebook_access_token,
                    },
                    timeout=15,
                )
                pub_data = pub.json()
                temp_id = pub_data.get('id')
                if not temp_id:
                    err = pub_data.get('error', {}).get('message', str(pub_data))
                    self.stdout.write(self.style.ERROR(f'  ✗ Could not create temp post: {err}'))
                else:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Temp post created: {temp_id}'))
                    self._call(
                        label=f'pages_manage_posts → DELETE /{temp_id}',
                        method='DELETE',
                        url=f"{GRAPH}/{temp_id}",
                        params={'access_token': fb.facebook_access_token},
                    )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Exception: {e}'))
        elif fb and fb.facebook_page_id:
            self.stdout.write(self.style.WARNING(
                '\n⚠ Skipping pages_manage_posts DELETE test call. '
                'Re-run with --exercise-delete to publish+delete a throwaway post.'
            ))

        # ── leads_retrieval ──────────────────────────────────────
        if fb and fb.facebook_page_id:
            self._call(
                label='leads_retrieval → GET /{page-id}/leadgen_forms',
                method='GET',
                url=f"{GRAPH}/{fb.facebook_page_id}/leadgen_forms",
                params={
                    'fields': 'id,name,status,leads_count',
                    'access_token': fb.facebook_access_token,
                },
            )

        # ── ads_read / ads_management ────────────────────────────
        # Uses the AdAccount model (Meta system-user token, encrypted),
        # not SocialAccount. These calls satisfy the App Review test-call
        # requirement for both ads_read and ads_management.
        ad_account, ad_token = self._get_ad_account(email)
        if ad_account and ad_token:
            act = ad_account.external_id  # bare digits, no 'act_' prefix
            # ads_read → enumerate ad accounts on the token
            self._call(
                label='ads_read → GET /me/adaccounts',
                method='GET',
                url=f"{GRAPH}/me/adaccounts",
                params={
                    'fields': 'id,account_id,name,currency,account_status',
                    'limit': 10,
                    'access_token': ad_token,
                },
            )
            # ads_read → list campaigns in the account
            self._call(
                label='ads_read → GET /act_{id}/campaigns',
                method='GET',
                url=f"{GRAPH}/act_{act}/campaigns",
                params={
                    'fields': 'id,name,objective,status,effective_status',
                    'limit': 10,
                    'access_token': ad_token,
                },
            )
            # ads_management → read insights (also demonstrates Marketing API access)
            self._call(
                label='ads_management → GET /act_{id}/insights',
                method='GET',
                url=f"{GRAPH}/act_{act}/insights",
                params={
                    'fields': 'impressions,reach,clicks,spend,cpc,cpm,ctr',
                    'date_preset': 'maximum',
                    'level': 'account',
                    'access_token': ad_token,
                },
            )
        else:
            self.stdout.write(self.style.WARNING(
                '\n⚠ No connected Meta AdAccount found — skipping ads_read / '
                'ads_management test calls. Connect an ad account (grant '
                'ads_read/ads_management during Facebook OAuth) and re-run.'
            ))

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('Done. All calls completed above.'))
        self.stdout.write('Go back to Meta App Review → Allowed usage and refresh.')
        self.stdout.write('='*60 + '\n')

    def _get_ad_account(self, email=None):
        """Return (AdAccount, decrypted_token) for the first active Meta ad
        account, optionally filtered by owner email. Returns (None, None) if
        none is connected or the token can't be decrypted."""
        try:
            from ads.models import AdAccount
            from ads.services.token_encryption import decrypt_token
        except Exception:
            return None, None

        qs = AdAccount.objects.filter(provider='meta', is_active=True)
        if email:
            qs = qs.filter(user__email=email)
        acct = qs.exclude(encrypted_token='').first()
        if not acct:
            return None, None
        try:
            return acct, decrypt_token(acct.encrypted_token)
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'  ✗ Could not decrypt AdAccount token: {e}'
            ))
            return None, None

    def _get_first_media_id(self, ig):
        try:
            r = requests.get(
                f"{GRAPH}/{ig.instagram_business_account_id}/media",
                params={'fields': 'id', 'limit': 1, 'access_token': ig.instagram_access_token},
                timeout=15,
            )
            data = r.json().get('data', [])
            return data[0]['id'] if data else None
        except Exception:
            return None

    def _call(self, label, method, url, params):
        self.stdout.write(f'\n▶ {label}')
        try:
            if method == 'GET':
                r = requests.get(url, params=params, timeout=15)
            elif method == 'DELETE':
                r = requests.delete(url, params=params, timeout=15)
            else:
                r = requests.post(url, data=params, timeout=15)
            data = r.json()
            if 'error' in data:
                self.stdout.write(self.style.ERROR(
                    f"  ✗ ERROR: {data['error'].get('message', str(data['error']))}"
                ))
            else:
                count = len(data.get('data', [data]))
                self.stdout.write(self.style.SUCCESS(f"  ✓ HTTP {r.status_code} — {count} item(s) returned"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Exception: {e}"))
