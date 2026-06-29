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

    def handle(self, *args, **options):
        email = options.get('email')
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
                label='instagram_basic → GET /me?fields=id,name,username,biography',
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

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('Done. All calls completed above.'))
        self.stdout.write('Go back to Meta App Review → Allowed usage and refresh.')
        self.stdout.write('='*60 + '\n')

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
