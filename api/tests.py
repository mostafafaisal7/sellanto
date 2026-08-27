from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from django.utils import timezone
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient

from posts.models import Post, Comment
from platforms.models import SocialAccount


def _mk_resp(data):
    """Return a MagicMock that behaves like a requests.Response with .json() → data."""
    r = MagicMock()
    r.json.return_value = data
    return r


class MetaAppReviewAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('testuser', 'test@test.com', 'pass')
        self.client.force_authenticate(user=self.user)

        self.fb = SocialAccount.objects.create(
            user=self.user,
            platform='facebook',
            account_name='Test Page',
            facebook_page_id='111000111',
            facebook_access_token='fake-fb-token',
            is_active=True,
        )

        self.ig = SocialAccount.objects.create(
            user=self.user,
            platform='instagram',
            account_name='Test IG',
            instagram_business_account_id='222000222',
            instagram_access_token='fake-ig-token',
            is_active=True,
        )

        self.post = Post.objects.create(
            user=self.user,
            caption='Test post',
            platforms='["facebook"]',
            status='posted',
            facebook_post_id='333_444',
        )

        self.comment = Comment.objects.create(
            post=self.post,
            platform='facebook',
            external_id='555_666',
            author_name='Jane',
            body='Great product!',
            sentiment='positive',
            created_at=timezone.now(),
        )

    # ── Authentication ────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self):
        anon = APIClient()
        r = anon.get(reverse('leads-forms'))
        self.assertEqual(r.status_code, 401)

    # ── Leads: GET /leads/forms/ ──────────────────────────────────────────────

    def test_leads_forms_success(self):
        mock_data = {'data': [{'id': 'f1', 'name': 'Spring Promo', 'status': 'ACTIVE', 'leads_count': 7, 'created_time': '2025-01-01'}]}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.get(reverse('leads-forms'))
        self.assertEqual(r.status_code, 200)
        self.assertIn('forms', r.data)
        self.assertEqual(len(r.data['forms']), 1)
        self.assertEqual(r.data['forms'][0]['id'], 'f1')
        self.assertEqual(r.data['forms'][0]['leads_count'], 7)

    def test_leads_forms_no_fb_account(self):
        self.fb.delete()
        r = self.client.get(reverse('leads-forms'))
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    def test_leads_forms_graph_api_error(self):
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp({'error': {'message': 'Invalid OAuth token', 'type': 'OAuthException'}})
            r = self.client.get(reverse('leads-forms'))
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    # ── Leads: GET /leads/forms/<form_id>/submissions/ ────────────────────────

    def test_leads_submissions_success(self):
        mock_data = {'data': [{'id': 'lead1', 'created_time': '2025-01-02', 'field_data': [{'name': 'email', 'values': ['a@b.com']}]}]}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.get(reverse('leads-submissions', kwargs={'form_id': 'form_abc'}))
        self.assertEqual(r.status_code, 200)
        self.assertIn('submissions', r.data)
        self.assertEqual(len(r.data['submissions']), 1)

    def test_leads_submissions_no_fb_account(self):
        self.fb.delete()
        r = self.client.get(reverse('leads-submissions', kwargs={'form_id': 'form_abc'}))
        self.assertEqual(r.status_code, 400)

    # ── Leads: POST /leads/sync/ ──────────────────────────────────────────────

    def test_leads_sync_success(self):
        mock_data = {'data': [{'id': 'f1', 'leads_count': 10}, {'id': 'f2', 'leads_count': 5}]}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.post(reverse('leads-sync'))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['synced'], 15)

    def test_leads_sync_no_fb_account(self):
        self.fb.delete()
        r = self.client.post(reverse('leads-sync'))
        self.assertEqual(r.status_code, 400)

    # ── Instagram Content: GET /instagram/content/ ────────────────────────────

    def test_instagram_content_success(self):
        mock_data = {
            'data': [{'id': 'm1', 'media_type': 'IMAGE', 'media_url': 'http://cdn.example.com/img.jpg', 'timestamp': '2025-03-01T10:00:00+00:00'}],
            'paging': {'cursors': {'after': 'next_cursor_xyz'}},
        }
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.get(reverse('instagram-content'))
        self.assertEqual(r.status_code, 200)
        self.assertIn('media', r.data)
        self.assertEqual(len(r.data['media']), 1)
        self.assertEqual(r.data['media'][0]['id'], 'm1')
        self.assertEqual(r.data['next_cursor'], 'next_cursor_xyz')

    def test_instagram_content_no_ig_account(self):
        self.ig.delete()
        r = self.client.get(reverse('instagram-content'))
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    def test_instagram_content_pagination_forwarded(self):
        mock_data = {'data': [], 'paging': {'cursors': {}}}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            self.client.get(reverse('instagram-content') + '?after=cursor123')
            call_params = m.get.call_args[1]['params']
        self.assertEqual(call_params['after'], 'cursor123')

    # ── Instagram Content Archive: POST /instagram/content/<media_id>/archive/ ─

    def test_instagram_archive_success(self):
        with patch('api.views._requests') as m:
            m.delete.return_value = _mk_resp({'success': True})
            r = self.client.post(reverse('instagram-content-archive', kwargs={'media_id': 'media999'}))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['archived'])

    def test_instagram_archive_no_ig_account(self):
        self.ig.delete()
        r = self.client.post(reverse('instagram-content-archive', kwargs={'media_id': 'media999'}))
        self.assertEqual(r.status_code, 400)

    def test_instagram_archive_graph_error(self):
        with patch('api.views._requests') as m:
            m.delete.return_value = _mk_resp({'error': {'message': 'Insufficient permissions'}})
            r = self.client.post(reverse('instagram-content-archive', kwargs={'media_id': 'media999'}))
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    # ── FB Pages Metadata: GET /platforms/facebook/pages/metadata/ ───────────

    def test_fb_pages_metadata_success(self):
        mock_data = {'id': '111000111', 'name': 'Test Page', 'category': 'Shopping & Retail', 'about': 'We sell stuff.', 'website': 'https://example.com', 'phone': '+880'}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.get(reverse('fb-pages-metadata'))
        self.assertEqual(r.status_code, 200)
        self.assertIn('pages', r.data)
        self.assertEqual(len(r.data['pages']), 1)
        self.assertEqual(r.data['pages'][0]['id'], '111000111')
        self.assertEqual(r.data['pages'][0]['category'], 'Shopping & Retail')

    def test_fb_pages_metadata_no_accounts_returns_empty(self):
        self.fb.delete()
        r = self.client.get(reverse('fb-pages-metadata'))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['pages'], [])

    # ── FB Page Metadata Update: PATCH /platforms/facebook/pages/<page_id>/metadata/ ─

    def test_fb_page_metadata_update_success(self):
        with patch('api.views._requests') as m:
            m.post.return_value = _mk_resp({'success': True})
            r = self.client.patch(
                reverse('fb-page-metadata-update', kwargs={'page_id': '111000111'}),
                {'about': 'Updated about text'},
                format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['success'])

    def test_fb_page_metadata_update_not_found(self):
        r = self.client.patch(
            reverse('fb-page-metadata-update', kwargs={'page_id': 'nonexistent_page'}),
            {'about': 'test'},
            format='json',
        )
        self.assertEqual(r.status_code, 404)

    def test_fb_page_metadata_update_no_valid_fields(self):
        r = self.client.patch(
            reverse('fb-page-metadata-update', kwargs={'page_id': '111000111'}),
            {'invalid_field': 'value', 'another_bad_field': 123},
            format='json',
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    def test_fb_page_metadata_update_graph_error(self):
        with patch('api.views._requests') as m:
            m.post.return_value = _mk_resp({'error': {'message': 'Update failed — permission denied'}})
            r = self.client.patch(
                reverse('fb-page-metadata-update', kwargs={'page_id': '111000111'}),
                {'about': 'test'},
                format='json',
            )
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    # ── Post Comments: GET /posts/<post_id>/comments/ ────────────────────────

    def test_post_comments_fetches_and_caches(self):
        mock_data = {'data': [{'id': 'c_new_1', 'from': {'name': 'Bob'}, 'message': 'Love this!', 'created_time': '2025-01-01T00:00:00+00:00'}]}
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp(mock_data)
            r = self.client.get(reverse('post-comments', kwargs={'post_id': self.post.id}))
        self.assertEqual(r.status_code, 200)
        # The endpoint answers with a bare list -- that is what the comment UI
        # consumes. These two assertions expected a {'comments': [...]} wrapper
        # that the view has never returned, so they had always failed.
        self.assertIsInstance(r.data, list)
        self.assertTrue(Comment.objects.filter(external_id='c_new_1').exists())
        cached = Comment.objects.get(external_id='c_new_1')
        self.assertEqual(cached.sentiment, 'positive')

    def test_post_comments_not_found(self):
        r = self.client.get(reverse('post-comments', kwargs={'post_id': 99999}))
        self.assertEqual(r.status_code, 404)

    def test_post_comments_no_external_id_returns_cached(self):
        self.post.facebook_post_id = ''
        self.post.save()
        r = self.client.get(reverse('post-comments', kwargs={'post_id': self.post.id}))
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)
        ids = [c['id'] for c in r.data]
        self.assertIn(self.comment.id, ids)

    def test_post_comments_no_fb_account(self):
        self.fb.delete()
        r = self.client.get(reverse('post-comments', kwargs={'post_id': self.post.id}))
        self.assertEqual(r.status_code, 400)

    # ── Comment Reply: POST /comments/<comment_id>/reply/ ────────────────────

    def test_comment_reply_success(self):
        with patch('api.views._requests') as m:
            m.post.return_value = _mk_resp({'id': 'reply_123'})
            r = self.client.post(
                reverse('comment-reply', kwargs={'comment_id': self.comment.id}),
                {'reply_body': 'Thanks so much!', 'reply_type': 'human'},
                format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['success'])
        self.assertEqual(r.data['reply_type'], 'human')
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.reply_body, 'Thanks so much!')
        self.assertEqual(self.comment.reply_type, 'human')
        self.assertIsNotNone(self.comment.replied_at)

    def test_comment_reply_empty_body_rejected(self):
        r = self.client.post(
            reverse('comment-reply', kwargs={'comment_id': self.comment.id}),
            {'reply_body': '   '},
            format='json',
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    def test_comment_reply_not_found(self):
        r = self.client.post(
            reverse('comment-reply', kwargs={'comment_id': 99999}),
            {'reply_body': 'Hi!'},
            format='json',
        )
        self.assertEqual(r.status_code, 404)

    def test_comment_reply_graph_error(self):
        with patch('api.views._requests') as m:
            m.post.return_value = _mk_resp({'error': {'message': 'Reply failed — rate limit exceeded'}})
            r = self.client.post(
                reverse('comment-reply', kwargs={'comment_id': self.comment.id}),
                {'reply_body': 'Thanks!'},
                format='json',
            )
        self.assertEqual(r.status_code, 400)
        self.assertIn('error', r.data)

    # ── Comment AI Reply: POST /comments/<comment_id>/ai-reply/ ─────────────

    def test_comment_ai_reply_success(self):
        with patch('api.views.get_llm_service') as mock_svc:
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.content = '  Thank you for the kind words!  '
            mock_svc.return_value.chat_completion.return_value = mock_result
            r = self.client.post(
                reverse('comment-ai-reply', kwargs={'comment_id': self.comment.id}),
                {},
                format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertIn('reply_body', r.data)
        self.assertEqual(r.data['reply_body'], 'Thank you for the kind words!')
        self.assertIn('used_prompt', r.data)

    def test_comment_ai_reply_with_override_prompt(self):
        with patch('api.views.get_llm_service') as mock_svc:
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.content = 'Custom reply.'
            mock_svc.return_value.chat_completion.return_value = mock_result
            r = self.client.post(
                reverse('comment-ai-reply', kwargs={'comment_id': self.comment.id}),
                {'override_prompt': 'Reply formally.'},
                format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['used_prompt'], 'Reply formally.')

    def test_comment_ai_reply_not_found(self):
        r = self.client.post(
            reverse('comment-ai-reply', kwargs={'comment_id': 99999}),
            {},
            format='json',
        )
        self.assertEqual(r.status_code, 404)

    def test_comment_ai_reply_llm_failure(self):
        with patch('api.views.get_llm_service') as mock_svc:
            mock_result = MagicMock()
            mock_result.success = False
            mock_result.error = 'LLM quota exceeded'
            mock_svc.return_value.chat_completion.return_value = mock_result
            r = self.client.post(
                reverse('comment-ai-reply', kwargs={'comment_id': self.comment.id}),
                {},
                format='json',
            )
        self.assertEqual(r.status_code, 500)
        self.assertIn('error', r.data)


class PostNowTests(TestCase):
    """Post Now publishes through the scheduler's own publish_post().

    The guards matter more than the happy path: publish_post has no idea
    whether a post is already live, so anything that lets it run twice
    duplicates real content on every connected platform.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('poster', 'poster@test.com', 'pass')
        self.client.force_authenticate(user=self.user)

    def _post(self, status='scheduled', platforms='["twitter"]', **kw):
        return Post.objects.create(
            user=self.user, caption='hello', platforms=platforms,
            status=status, **kw
        )

    def _publish(self, post):
        return self.client.post(f'/api/v1/posts/{post.id}/publish/')

    def test_publishes_through_the_scheduler_helper(self):
        post = self._post(scheduled_time=timezone.now())
        with patch('posts.scheduler.publish_post') as mock_publish:
            def mark_posted(p):
                p.status = 'posted'
                p.twitter_post_id = '1900000000'
                p.save()
            mock_publish.side_effect = mark_posted
            r = self._publish(post)

        self.assertEqual(r.status_code, 200)
        mock_publish.assert_called_once()
        self.assertEqual(r.data['status'], 'posted')

    def test_a_post_with_no_time_still_publishes(self):
        """scheduled_time is nullable, and publish_post formats it for its log
        line — an unguarded null would raise inside the publish."""
        post = self._post(scheduled_time=None)
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(post)
        self.assertEqual(r.status_code, 200)
        mock_publish.assert_called_once()
        post.refresh_from_db()
        self.assertIsNotNone(post.scheduled_time)

    def test_already_posted_is_refused(self):
        post = self._post(status='posted')
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(post)
        self.assertEqual(r.status_code, 400)
        self.assertIn('already', r.data['error'].lower())
        mock_publish.assert_not_called()

    def test_mid_publish_is_refused(self):
        """Guards the double click, which would post the content twice."""
        post = self._post(status='posting')
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(post)
        self.assertEqual(r.status_code, 400)
        mock_publish.assert_not_called()

    def test_cancelled_is_refused(self):
        post = self._post(status='cancelled')
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(post)
        self.assertEqual(r.status_code, 400)
        mock_publish.assert_not_called()

    def test_no_platform_selected_is_refused(self):
        post = self._post(platforms='[]')
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(post)
        self.assertEqual(r.status_code, 400)
        self.assertIn('platform', r.data['error'].lower())
        mock_publish.assert_not_called()

    def test_cannot_publish_another_users_post(self):
        other = User.objects.create_user('other', 'other@test.com', 'pass')
        foreign = Post.objects.create(
            user=other, caption='x', platforms='["twitter"]', status='scheduled'
        )
        with patch('posts.scheduler.publish_post') as mock_publish:
            r = self._publish(foreign)
        self.assertEqual(r.status_code, 404)
        mock_publish.assert_not_called()

    def test_a_publish_that_raises_does_not_500_silently(self):
        post = self._post()
        with patch('posts.scheduler.publish_post', side_effect=RuntimeError('boom')):
            r = self._publish(post)
        self.assertEqual(r.status_code, 500)
        self.assertIn('boom', r.data['error'])


class PostPlatformLinkTests(TestCase):
    """Public URLs for a published post, per platform."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('linker', 'linker@test.com', 'pass')
        self.client.force_authenticate(user=self.user)

    def test_ids_are_turned_into_public_urls(self):
        from api.views import _derive_platform_url
        cases = [
            # /feed returns "<page>_<post>"; /photos returns a bare media id.
            ('facebook', '1234_5678', 'https://www.facebook.com/1234/posts/5678'),
            ('facebook', '99887766', 'https://www.facebook.com/99887766'),
            ('twitter', '190', 'https://twitter.com/i/web/status/190'),
            ('linkedin', 'urn:li:share:42',
             'https://www.linkedin.com/feed/update/urn:li:share:42/'),
            ('youtube', 'abc', 'https://www.youtube.com/watch?v=abc'),
            ('pinterest', '555', 'https://www.pinterest.com/pin/555/'),
            # Neither id addresses a post without a handle we never store.
            ('tiktok', '777', None),
            ('telegram', '777', None),
            ('facebook', '', None),
        ]
        for platform, post_id, expected in cases:
            with self.subTest(platform=platform, post_id=post_id):
                self.assertEqual(_derive_platform_url(platform, post_id), expected)

    def test_only_platforms_that_actually_published_are_linked(self):
        post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["twitter", "facebook", "tiktok"]',
            twitter_post_id='190',
            # facebook has no id: it failed or was never attempted.
            tiktok_post_id='777',  # published, but has no derivable URL
        )
        r = self.client.get(f'/api/v1/posts/{post.id}/links/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['links'], [
            {'platform': 'twitter', 'url': 'https://twitter.com/i/web/status/190'},
        ])

    def test_instagram_link_uses_the_graph_permalink(self):
        """An Instagram media id has no derivable URL, so it must come from
        Graph — and be cached, since this runs per post on the posts list."""
        from django.core.cache import cache
        cache.clear()
        SocialAccount.objects.create(
            user=self.user, platform='instagram', account_name='IG',
            instagram_business_account_id='222', instagram_access_token='tok',
            is_active=True,
        )
        post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["instagram"]', instagram_post_id='media-1',
        )
        with patch('requests.get',
                   return_value=_mk_resp({'permalink': 'https://instagram.com/p/AAA/'})) as g:
            r = self.client.get(f'/api/v1/posts/{post.id}/links/')
            self.assertEqual(r.data['links'],
                             [{'platform': 'instagram',
                               'url': 'https://instagram.com/p/AAA/'}])
            self.client.get(f'/api/v1/posts/{post.id}/links/')
        self.assertEqual(g.call_count, 1, 'permalink should be cached, not re-fetched')

    def test_a_failed_graph_lookup_does_not_break_the_list(self):
        from django.core.cache import cache
        cache.clear()
        SocialAccount.objects.create(
            user=self.user, platform='instagram', account_name='IG',
            instagram_business_account_id='222', instagram_access_token='tok',
            is_active=True,
        )
        post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["instagram"]', instagram_post_id='media-1',
        )
        with patch('requests.get', side_effect=RuntimeError('network down')):
            r = self.client.get(f'/api/v1/posts/{post.id}/links/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['links'], [])


class PostCommentPlatformTests(TestCase):
    """Comments are synced per platform, so a post on both has both tabs.

    The old view chose a platform with `if facebook ... elif instagram`, so a
    post published to both only ever synced and showed Facebook.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('commenter', 'c@test.com', 'pass')
        self.client.force_authenticate(user=self.user)
        SocialAccount.objects.create(
            user=self.user, platform='facebook', account_name='Page',
            facebook_page_id='111', facebook_access_token='fb-tok', is_active=True,
        )
        SocialAccount.objects.create(
            user=self.user, platform='instagram', account_name='IG',
            instagram_business_account_id='222',
            instagram_access_token='ig-tok', is_active=True,
        )
        self.post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["facebook", "instagram"]',
            facebook_post_id='111_999', instagram_post_id='ig-media-1',
            scheduled_time=timezone.now(),
        )

    def _graph(self):
        """Answer each /comments call with that platform's own field names."""
        def fake_get(url, **kwargs):
            if url.startswith('https://graph.facebook.com/v21.0/111_999'):
                return _mk_resp({'data': [{
                    'id': 'fb-c1', 'from': {'name': 'Ann'},
                    'message': 'great', 'created_time': '2025-01-01T00:00:00+00:00',
                }]})
            return _mk_resp({'data': [{
                'id': 'ig-c1', 'username': 'bob',
                'text': 'love this', 'timestamp': '2025-01-02T00:00:00+00:00',
            }]})
        return fake_get

    def test_both_platforms_are_synced(self):
        with patch('api.views._requests') as m:
            m.get.side_effect = self._graph()
            r = self.client.get(f'/api/v1/posts/{self.post.id}/comments/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            {c['platform'] for c in r.data}, {'facebook', 'instagram'}
        )

    def test_platform_filter_scopes_the_response(self):
        with patch('api.views._requests') as m:
            m.get.side_effect = self._graph()
            r = self.client.get(
                f'/api/v1/posts/{self.post.id}/comments/?platform=instagram'
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c['platform'] for c in r.data], ['instagram'])
        self.assertEqual(r.data[0]['author_name'], 'bob')
        self.assertEqual(r.data[0]['body'], 'love this')

    def test_one_platform_failing_does_not_hide_the_other(self):
        def half_broken(url, **kwargs):
            if url.startswith('https://graph.facebook.com/v21.0/111_999'):
                return _mk_resp({'error': {'message': 'permission denied'}})
            return _mk_resp({'data': [{
                'id': 'ig-c1', 'username': 'bob',
                'text': 'love this', 'timestamp': '2025-01-02T00:00:00+00:00',
            }]})

        with patch('api.views._requests') as m:
            m.get.side_effect = half_broken
            r = self.client.get(f'/api/v1/posts/{self.post.id}/comments/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c['platform'] for c in r.data], ['instagram'])

    def test_every_platform_failing_is_reported(self):
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp({'error': {'message': 'token expired'}})
            r = self.client.get(f'/api/v1/posts/{self.post.id}/comments/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('token expired', r.data['error'])

    def test_a_platform_without_comment_support_is_rejected(self):
        r = self.client.get(
            f'/api/v1/posts/{self.post.id}/comments/?platform=tiktok'
        )
        self.assertEqual(r.status_code, 400)


class InstagramCommentModerationTests(TestCase):
    """Hide / unhide / delete an Instagram comment (instagram_manage_comments).

    Hiding is reversible on Instagram's side, deleting is not -- so the local
    row must never claim a state Instagram did not actually accept.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('mod', 'mod@test.com', 'pass')
        self.client.force_authenticate(user=self.user)
        self.ig = SocialAccount.objects.create(
            user=self.user, platform='instagram', account_name='IG',
            instagram_business_account_id='222',
            instagram_access_token='ig-tok', is_active=True,
        )
        self.post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["instagram"]', instagram_post_id='media-1',
            scheduled_time=timezone.now(),
        )
        self.comment = Comment.objects.create(
            post=self.post, platform='instagram', external_id='ig-c1',
            author_name='bob', body='rude thing', sentiment='negative',
            created_at=timezone.now(),
        )

    # ── hide ────────────────────────────────────────────────────────────────

    def test_hide_calls_instagram_and_records_the_state(self):
        with patch('platforms.services.instagram.requests') as m:
            m.post.return_value = _mk_resp({'success': True})
            r = self.client.post(
                reverse('comment-hide', kwargs={'comment_id': self.comment.id}),
                {'hidden': True}, format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_hidden'])
        url, kwargs = m.post.call_args[0][0], m.post.call_args[1]
        self.assertTrue(url.endswith('/ig-c1'))
        self.assertEqual(kwargs['data']['hide'], 'true')
        self.comment.refresh_from_db()
        self.assertTrue(self.comment.is_hidden)

    def test_unhide_sends_false(self):
        self.comment.is_hidden = True
        self.comment.save()
        with patch('platforms.services.instagram.requests') as m:
            m.post.return_value = _mk_resp({'success': True})
            r = self.client.post(
                reverse('comment-hide', kwargs={'comment_id': self.comment.id}),
                {'hidden': False}, format='json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['is_hidden'])
        self.assertEqual(m.post.call_args[1]['data']['hide'], 'false')
        self.comment.refresh_from_db()
        self.assertFalse(self.comment.is_hidden)

    def test_a_refused_hide_leaves_the_local_state_alone(self):
        """Instagram still shows the comment, so SellAnto must not say hidden."""
        with patch('platforms.services.instagram.requests') as m:
            m.post.return_value = _mk_resp(
                {'error': {'message': 'Insufficient permission'}}
            )
            r = self.client.post(
                reverse('comment-hide', kwargs={'comment_id': self.comment.id}),
                {'hidden': True}, format='json',
            )
        self.assertEqual(r.status_code, 400)
        self.assertIn('Insufficient permission', r.data['error'])
        self.comment.refresh_from_db()
        self.assertFalse(self.comment.is_hidden)

    # ── delete ──────────────────────────────────────────────────────────────

    def test_delete_removes_it_from_instagram_and_locally(self):
        with patch('platforms.services.instagram.requests') as m:
            m.delete.return_value = _mk_resp({'success': True})
            r = self.client.delete(
                reverse('comment-delete', kwargs={'comment_id': self.comment.id})
            )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(m.delete.call_args[0][0].endswith('/ig-c1'))
        self.assertFalse(Comment.objects.filter(id=self.comment.id).exists())

    def test_a_refused_delete_keeps_the_row(self):
        with patch('platforms.services.instagram.requests') as m:
            m.delete.return_value = _mk_resp({'error': {'message': 'nope'}})
            r = self.client.delete(
                reverse('comment-delete', kwargs={'comment_id': self.comment.id})
            )
        self.assertEqual(r.status_code, 400)
        self.assertTrue(Comment.objects.filter(id=self.comment.id).exists())

    def test_a_comment_already_gone_is_still_cleared_locally(self):
        """Otherwise the row survives forever and can never be acted on."""
        with patch('platforms.services.instagram.requests') as m:
            m.delete.return_value = _mk_resp(
                {'error': {'message': "Object with ID does not exist"}}
            )
            r = self.client.delete(
                reverse('comment-delete', kwargs={'comment_id': self.comment.id})
            )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Comment.objects.filter(id=self.comment.id).exists())

    # ── scope + ownership boundaries ────────────────────────────────────────

    def test_facebook_comments_are_refused_with_a_reason(self):
        """Hiding a Facebook comment needs pages_manage_engagement, which this
        app does not request -- say so instead of failing at Graph."""
        fb_comment = Comment.objects.create(
            post=self.post, platform='facebook', external_id='fb-c1',
            author_name='ann', body='hi', created_at=timezone.now(),
        )
        with patch('platforms.services.instagram.requests') as m:
            r = self.client.post(
                reverse('comment-hide', kwargs={'comment_id': fb_comment.id}),
                {'hidden': True}, format='json',
            )
        self.assertEqual(r.status_code, 400)
        self.assertIn('Instagram', r.data['error'])
        m.post.assert_not_called()

    def test_cannot_moderate_another_users_comment(self):
        other = User.objects.create_user('intruder', 'i@test.com', 'pass')
        other_post = Post.objects.create(
            user=other, caption='x', platforms='["instagram"]',
            status='posted', instagram_post_id='m2',
        )
        foreign = Comment.objects.create(
            post=other_post, platform='instagram', external_id='ig-x',
            author_name='z', body='z', created_at=timezone.now(),
        )
        with patch('platforms.services.instagram.requests') as m:
            r = self.client.delete(
                reverse('comment-delete', kwargs={'comment_id': foreign.id})
            )
        self.assertEqual(r.status_code, 404)
        m.delete.assert_not_called()
        self.assertTrue(Comment.objects.filter(id=foreign.id).exists())

    def test_disconnected_instagram_is_reported(self):
        self.ig.delete()
        r = self.client.post(
            reverse('comment-hide', kwargs={'comment_id': self.comment.id}),
            {'hidden': True}, format='json',
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn('not connected', r.data['error'])

    # ── the flag is read back, not owned ────────────────────────────────────

    def test_sync_reads_the_hidden_flag_back_from_instagram(self):
        """A comment unhidden in the Instagram app must stop reading as hidden
        here, so the sync overwrites the local flag rather than preserving it."""
        self.comment.is_hidden = True
        self.comment.save()
        with patch('api.views._requests') as m:
            m.get.return_value = _mk_resp({'data': [{
                'id': 'ig-c1', 'username': 'bob', 'text': 'rude thing',
                'timestamp': '2025-01-01T00:00:00+00:00', 'hidden': False,
            }]})
            r = self.client.get(
                f'/api/v1/posts/{self.post.id}/comments/?platform=instagram'
            )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data[0]['is_hidden'])
        # and the hidden flag is actually requested from Graph
        self.assertIn('hidden', m.get.call_args[1]['params']['fields'])


class InstagramHideSwitchTests(TestCase):
    """Admin switch for hiding Instagram comments.

    Hiding takes a real person's comment out of public view, so an operator can
    turn the capability off. Unhiding is deliberately NOT gated: if it were,
    flipping the switch off would strand every already-hidden comment with no
    way to restore it.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('sw', 'sw@test.com', 'pass')
        self.client.force_authenticate(user=self.user)
        SocialAccount.objects.create(
            user=self.user, platform='instagram', account_name='IG',
            instagram_business_account_id='222',
            instagram_access_token='ig-tok', is_active=True,
        )
        self.post = Post.objects.create(
            user=self.user, caption='x', status='posted',
            platforms='["instagram"]', instagram_post_id='media-1',
            scheduled_time=timezone.now(),
        )
        self.comment = Comment.objects.create(
            post=self.post, platform='instagram', external_id='ig-c1',
            author_name='bob', body='x', created_at=timezone.now(),
        )

    def _set(self, enabled):
        from accounts.models import SiteConfiguration
        SiteConfiguration.set('instagram_comment_hide_enabled',
                              'true' if enabled else 'false')

    def _hide(self, hidden):
        return self.client.post(
            reverse('comment-hide', kwargs={'comment_id': self.comment.id}),
            {'hidden': hidden}, format='json',
        )

    def test_default_is_enabled_when_never_configured(self):
        """No row in SiteConfiguration must not silently disable the feature."""
        from accounts.utils import is_instagram_comment_hide_enabled
        self.assertTrue(is_instagram_comment_hide_enabled())

    def test_hiding_is_refused_when_switched_off(self):
        self._set(False)
        with patch('platforms.services.instagram.requests') as m:
            r = self._hide(True)
        self.assertEqual(r.status_code, 403)
        self.assertIn('administrator', r.data['error'])
        # Nothing reached Instagram, and nothing changed locally.
        m.post.assert_not_called()
        self.comment.refresh_from_db()
        self.assertFalse(self.comment.is_hidden)

    def test_unhiding_still_works_when_switched_off(self):
        """Otherwise the switch traps comments that are already hidden."""
        self._set(False)
        self.comment.is_hidden = True
        self.comment.save()
        with patch('platforms.services.instagram.requests') as m:
            m.post.return_value = _mk_resp({'success': True})
            r = self._hide(False)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['is_hidden'])
        self.assertEqual(m.post.call_args[1]['data']['hide'], 'false')
        self.comment.refresh_from_db()
        self.assertFalse(self.comment.is_hidden)

    def test_hiding_works_again_once_switched_back_on(self):
        self._set(False)
        self._set(True)
        with patch('platforms.services.instagram.requests') as m:
            m.post.return_value = _mk_resp({'success': True})
            r = self._hide(True)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_hidden'])

    def test_flag_endpoint_reports_the_switch(self):
        self._set(False)
        r = self.client.get(reverse('feature-flags'))
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['instagram_comment_hide_enabled'])

        self._set(True)
        r = self.client.get(reverse('feature-flags'))
        self.assertTrue(r.data['instagram_comment_hide_enabled'])

    def test_flag_endpoint_requires_login(self):
        anon = APIClient()
        self.assertEqual(anon.get(reverse('feature-flags')).status_code, 401)


class AdminHideSwitchTests(TestCase):
    """The switch is settable from the admin Facebook Settings panel."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            'boss', 'boss@test.com', 'pass', is_staff=True, is_superuser=True
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_turn_it_off_and_back_on(self):
        from accounts.utils import is_instagram_comment_hide_enabled

        r = self.client.post('/api/v1/admin/facebook-settings/',
                             {'instagram_comment_hide_enabled': False},
                             format='json')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['instagram_comment_hide_enabled'])
        self.assertFalse(is_instagram_comment_hide_enabled())

        r = self.client.post('/api/v1/admin/facebook-settings/',
                             {'instagram_comment_hide_enabled': True},
                             format='json')
        self.assertTrue(r.data['instagram_comment_hide_enabled'])
        self.assertTrue(is_instagram_comment_hide_enabled())

    def test_settings_read_reports_the_current_value(self):
        from accounts.models import SiteConfiguration
        SiteConfiguration.set('instagram_comment_hide_enabled', 'false')
        r = self.client.get('/api/v1/admin/facebook-settings/')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['instagram_comment_hide_enabled'])

    def test_other_settings_are_untouched_by_this_toggle(self):
        """Posting only this key must not disturb the Messenger switch."""
        from accounts.models import SiteConfiguration
        SiteConfiguration.set('messenger_feature_enabled', 'true')
        self.client.post('/api/v1/admin/facebook-settings/',
                         {'instagram_comment_hide_enabled': False},
                         format='json')
        self.assertEqual(
            SiteConfiguration.get('messenger_feature_enabled'), 'true'
        )
