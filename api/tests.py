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
        self.assertIn('comments', r.data)
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
        self.assertIn('comments', r.data)
        ids = [c['id'] for c in r.data['comments']]
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
