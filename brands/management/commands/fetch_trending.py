"""
Fetch trending topics for social media content ideation.

Uses OpenAI to generate current trending topics per platform.
Falls back to industry defaults when no API key is available.
Populates the TrendingCache table used by the Ideas Hub sidebar.
"""
import json
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from brands.models import TrendingCache
from accounts.api_keys import get_openai_key

logger = logging.getLogger(__name__)

# Fallback trending topics when no LLM is available
FALLBACK_TOPICS = [
    # Twitter/X
    {'platform': 'twitter', 'topic': 'AI tools for small business', 'volume_score': 92, 'region': 'global'},
    {'platform': 'twitter', 'topic': 'Remote work productivity tips', 'volume_score': 88, 'region': 'global'},
    {'platform': 'twitter', 'topic': 'Sustainable business practices', 'volume_score': 85, 'region': 'global'},
    {'platform': 'twitter', 'topic': 'Creator economy growth', 'volume_score': 82, 'region': 'global'},
    {'platform': 'twitter', 'topic': 'Digital marketing automation', 'volume_score': 79, 'region': 'global'},
    # LinkedIn
    {'platform': 'linkedin', 'topic': 'Leadership in hybrid teams', 'volume_score': 91, 'region': 'global'},
    {'platform': 'linkedin', 'topic': 'Personal branding for founders', 'volume_score': 87, 'region': 'global'},
    {'platform': 'linkedin', 'topic': 'AI in hiring and recruitment', 'volume_score': 84, 'region': 'global'},
    {'platform': 'linkedin', 'topic': 'Employee retention strategies', 'volume_score': 80, 'region': 'global'},
    {'platform': 'linkedin', 'topic': 'SaaS growth metrics', 'volume_score': 77, 'region': 'global'},
    # Google Trends
    {'platform': 'google', 'topic': 'How to use AI for content creation', 'volume_score': 95, 'region': 'global'},
    {'platform': 'google', 'topic': 'Social media scheduling tools', 'volume_score': 89, 'region': 'global'},
    {'platform': 'google', 'topic': 'Short form video marketing', 'volume_score': 86, 'region': 'global'},
    {'platform': 'google', 'topic': 'Brand storytelling examples', 'volume_score': 83, 'region': 'global'},
    {'platform': 'google', 'topic': 'Influencer marketing ROI', 'volume_score': 78, 'region': 'global'},
]


class Command(BaseCommand):
    help = 'Fetch trending topics for the Ideas Hub sidebar'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fallback-only',
            action='store_true',
            help='Only use fallback topics, skip LLM call',
        )

    def handle(self, *args, **options):
        self.stdout.write('Fetching trending topics...')

        # Clear expired entries
        expired = TrendingCache.objects.filter(expires_at__lt=timezone.now()).delete()
        logger.info(f'Cleared {expired[0]} expired trending entries')

        # Check if we still have valid entries
        valid_count = TrendingCache.objects.filter(expires_at__gt=timezone.now()).count()
        if valid_count >= 10:
            self.stdout.write(self.style.SUCCESS(f'Already have {valid_count} valid trending topics, skipping fetch.'))
            return

        expires_at = timezone.now() + timedelta(hours=6)

        if not options.get('fallback_only'):
            # Try LLM-based trending fetch
            api_key = self._get_any_openai_key()
            if api_key:
                try:
                    topics = self._fetch_via_llm(api_key)
                    if topics:
                        self._save_topics(topics, expires_at)
                        self.stdout.write(self.style.SUCCESS(f'Saved {len(topics)} LLM-generated trending topics.'))
                        return
                except Exception as e:
                    logger.error(f'LLM trending fetch failed: {e}')
                    self.stdout.write(self.style.WARNING(f'LLM fetch failed: {e}. Using fallback.'))

        # Fallback
        self._save_topics(FALLBACK_TOPICS, expires_at)
        self.stdout.write(self.style.SUCCESS(f'Saved {len(FALLBACK_TOPICS)} fallback trending topics.'))

    def _get_any_openai_key(self):
        """Get an OpenAI key from any user in the system."""
        for user in User.objects.filter(is_active=True)[:10]:
            key = get_openai_key(user)
            if key:
                return key
        return None

    def _fetch_via_llm(self, api_key):
        """Use OpenAI to generate trending topics."""
        import openai

        client = openai.OpenAI(api_key=api_key)
        today = timezone.now().strftime('%B %d, %Y')

        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'You are a social media trends analyst. Generate currently trending '
                        'topics that content creators should post about. Return a JSON array.'
                    ),
                },
                {
                    'role': 'user',
                    'content': (
                        f'Date: {today}\n\n'
                        'Generate 15 trending topics for social media content creation, '
                        '5 for each platform: twitter, linkedin, google.\n'
                        'Each topic should be a phrase that a content creator could base a post on.\n'
                        'Return JSON array: [{{"platform": "twitter|linkedin|google", '
                        '"topic": "...", "volume_score": 50-100, "region": "global"}}]'
                    ),
                },
            ],
            temperature=0.8,
            max_tokens=2000,
            response_format={'type': 'json_object'},
        )

        result = json.loads(response.choices[0].message.content)
        topics = result.get('topics', result.get('trending', []))

        # If the LLM returned the array directly
        if isinstance(result, list):
            topics = result

        return topics if topics else []

    def _save_topics(self, topics, expires_at):
        """Bulk-create trending cache entries."""
        entries = []
        for t in topics:
            entries.append(TrendingCache(
                platform=t.get('platform', 'google'),
                topic=t['topic'],
                volume_score=t.get('volume_score', 50),
                region=t.get('region', 'global'),
                expires_at=expires_at,
            ))
        TrendingCache.objects.bulk_create(entries)
