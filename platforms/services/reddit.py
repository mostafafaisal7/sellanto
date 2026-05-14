"""
Reddit Service — OAuth API
============================
Supports:
  - Token validation (GET /api/v1/me)
  - Token refresh (POST /api/v1/access_token with grant_type=refresh_token)
  - List subscribed subreddits (GET /subreddits/mine/subscriber)
  - Submit text post (POST /api/submit kind=self)
  - Submit link post (POST /api/submit kind=link)
  - Upload and submit image (3-step S3 lease)
  - Upload and submit video (3-step S3 lease)

Auth: HTTP Basic Auth (base64 client_id:client_secret) for token endpoints
      Bearer token for API endpoints
ALL API calls go to https://oauth.reddit.com (NOT www.reddit.com)
Custom User-Agent MANDATORY — generic UA gets blocked/throttled.
Access token: 1 hour. Refresh token: never expires (if duration=permanent).
"""

import base64
import logging
import mimetypes
import os
import requests

logger = logging.getLogger(__name__)

REDDIT_AUTH_API = 'https://oauth.reddit.com'
REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
REDDIT_USER_AGENT = 'SocialSyncAI/1.0 (by /u/sellantoai)'
REDDIT_S3_BASE = 'https://reddit-uploaded-media.s3-accelerate.amazonaws.com'


def _bearer_headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': REDDIT_USER_AGENT,
    }


def _basic_auth_header(client_id, client_secret):
    """HTTP Basic Auth header for Reddit token endpoints."""
    credentials = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    return {
        'Authorization': f'Basic {credentials}',
        'User-Agent': REDDIT_USER_AGENT,
    }


class RedditService:

    # ──────────────────────────────────────────────────────────────────────────
    # Validation
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate Reddit token by calling /api/v1/me.
        Returns: (success: bool, {username, ...} or error_string)
        """
        try:
            resp = requests.get(
                f'{REDDIT_AUTH_API}/api/v1/me',
                headers=_bearer_headers(access_token),
                timeout=10
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code == 403:
                return False, 'Access denied. Check your Reddit API scopes.'

            if resp.status_code != 200:
                return False, f'Reddit returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'Reddit returned invalid response'

            username = data.get('name', '')
            if not username:
                return False, 'Could not determine Reddit username'

            return True, {
                'username': username,
                'icon_img': data.get('icon_img', ''),
                'link_karma': data.get('link_karma', 0),
                'comment_karma': data.get('comment_karma', 0),
                'is_gold': data.get('is_gold', False),
            }

        except requests.Timeout:
            return False, 'Reddit API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Token Refresh
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_id, client_secret):
        """
        Refresh Reddit access token using HTTP Basic Auth.
        Returns: (success, {access_token, expires_in, ...} or error)
        """
        try:
            resp = requests.post(
                REDDIT_TOKEN_URL,
                headers={
                    **_basic_auth_header(client_id, client_secret),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                },
                timeout=15
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            if 'access_token' in data:
                return True, data
            else:
                error = data.get('message', data.get('error', f'Refresh failed (HTTP {resp.status_code})'))
                return False, error

        except requests.Timeout:
            return False, 'Reddit API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # List Subreddits
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def list_subreddits(access_token):
        """
        Fetch user's subscribed subreddits.
        Returns: (success, list_of_subreddits or error)
        """
        try:
            subreddits = []
            after = None
            max_pages = 10  # Safety limit

            for _ in range(max_pages):
                params = {'limit': 100}
                if after:
                    params['after'] = after

                resp = requests.get(
                    f'{REDDIT_AUTH_API}/subreddits/mine/subscriber',
                    headers=_bearer_headers(access_token),
                    params=params,
                    timeout=10
                )

                if resp.status_code == 401:
                    return False, 'Token expired or revoked'

                if resp.status_code != 200:
                    return False, f'HTTP {resp.status_code}'

                try:
                    data = resp.json()
                except ValueError:
                    return False, 'Reddit returned invalid response'

                listing = data.get('data', {})
                for child in listing.get('children', []):
                    sub = child.get('data', {})
                    subreddits.append({
                        'name': sub.get('display_name', ''),
                        'display_name_prefixed': sub.get('display_name_prefixed', ''),
                        'title': sub.get('title', ''),
                        'subscribers': sub.get('subscribers', 0),
                        'icon_img': sub.get('icon_img', ''),
                        'over18': sub.get('over18', False),
                    })

                after = listing.get('after')
                if not after:
                    break

            return True, subreddits

        except requests.Timeout:
            return False, 'Reddit API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Submit Text Post
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def submit_text_post(access_token, subreddit, title, text):
        """
        Submit a self/text post to a subreddit.
        Returns: (success, post_url or error)
        """
        try:
            resp = requests.post(
                f'{REDDIT_AUTH_API}/api/submit',
                headers={
                    **_bearer_headers(access_token),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'api_type': 'json',
                    'sr': subreddit,
                    'title': title[:300],
                    'kind': 'self',
                    'text': text,
                },
                timeout=30
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            json_data = data.get('json', {})
            errors = json_data.get('errors', [])
            if errors:
                error_msgs = '; '.join([str(e) for e in errors])
                logger.error(f'[Reddit] Submit text post errors: {error_msgs}')
                return False, f'Reddit errors: {error_msgs}'

            post_data = json_data.get('data', {})
            post_url = post_data.get('url', '')
            post_id = post_data.get('id', '')

            if post_url or post_id:
                logger.info(f'[Reddit] Text post submitted: {post_url or post_id}')
                return True, post_url or post_id
            else:
                return False, 'Post submitted but no URL returned'

        except requests.Timeout:
            return False, 'Reddit API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            logger.error(f'[Reddit] Submit text post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Submit Link Post
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def submit_link_post(access_token, subreddit, title, url):
        """
        Submit a link post to a subreddit.
        Returns: (success, post_url or error)
        """
        try:
            resp = requests.post(
                f'{REDDIT_AUTH_API}/api/submit',
                headers={
                    **_bearer_headers(access_token),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'api_type': 'json',
                    'sr': subreddit,
                    'title': title[:300],
                    'kind': 'link',
                    'url': url,
                },
                timeout=30
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            json_data = data.get('json', {})
            errors = json_data.get('errors', [])
            if errors:
                error_msgs = '; '.join([str(e) for e in errors])
                logger.error(f'[Reddit] Submit link post errors: {error_msgs}')
                return False, f'Reddit errors: {error_msgs}'

            post_data = json_data.get('data', {})
            post_url = post_data.get('url', '')
            post_id = post_data.get('id', '')

            if post_url or post_id:
                logger.info(f'[Reddit] Link post submitted: {post_url or post_id}')
                return True, post_url or post_id
            else:
                return False, 'Post submitted but no URL returned'

        except requests.Timeout:
            return False, 'Reddit API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            logger.error(f'[Reddit] Submit link post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Internal: Get Upload Lease (S3)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_upload_lease(access_token, filepath, mimetype):
        """
        Request an S3 upload lease from Reddit.
        Returns: (success, lease_data or error)
        """
        try:
            filename = os.path.basename(filepath)
            resp = requests.post(
                f'{REDDIT_AUTH_API}/api/media/asset.json',
                headers=_bearer_headers(access_token),
                data={
                    'filepath': filename,
                    'mimetype': mimetype,
                },
                timeout=15
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            if resp.status_code != 200:
                error = data.get('message', f'HTTP {resp.status_code}')
                return False, f'Upload lease failed: {error}'

            # Extract S3 upload fields
            args = data.get('args', {})
            action = args.get('action', '')
            fields = args.get('fields', [])
            asset = data.get('asset', {})
            asset_id = asset.get('asset_id', '')
            websocket_url = asset.get('websocket_url', '')

            if not action or not fields:
                return False, 'Upload lease returned no action or fields'

            return True, {
                'action': action,
                'fields': fields,
                'asset_id': asset_id,
                'websocket_url': websocket_url,
            }

        except requests.Timeout:
            return False, 'Reddit API timed out (upload lease)'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Internal: Upload to S3
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _upload_to_s3(lease_data, file_path):
        """
        Upload file to Reddit's S3 bucket using the lease data.
        Returns: (success, s3_url or error)
        """
        try:
            action = lease_data['action']
            fields = lease_data['fields']

            # Build form data from lease fields
            form_data = {}
            for field in fields:
                form_data[field['name']] = field['value']

            # The 'key' field contains the S3 path
            s3_key = form_data.get('key', '')

            # Upload URL
            upload_url = f'https:{action}' if action.startswith('//') else action

            with open(file_path, 'rb') as f:
                filename = os.path.basename(file_path)
                files = {'file': (filename, f)}
                resp = requests.post(
                    upload_url,
                    data=form_data,
                    files=files,
                    headers={'User-Agent': REDDIT_USER_AGENT},
                    timeout=300  # 5 minutes for large files
                )

            if resp.status_code in [200, 201, 204]:
                s3_url = f'{REDDIT_S3_BASE}/{s3_key}'
                logger.info(f'[Reddit] File uploaded to S3: {s3_url}')
                return True, s3_url
            else:
                logger.error(f'[Reddit] S3 upload failed: HTTP {resp.status_code}')
                return False, f'S3 upload failed: HTTP {resp.status_code}'

        except FileNotFoundError:
            return False, f'File not found: {file_path}'
        except requests.ConnectionError:
            return False, 'Could not reach S3 (network error)'
        except requests.Timeout:
            return False, 'S3 upload timed out'
        except Exception as e:
            logger.error(f'[Reddit] S3 upload exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Upload and Submit Image
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def upload_and_submit_image(access_token, subreddit, title, image_path):
        """
        Upload image via 3-step S3 lease, then submit as image post.
        Step 1: Get upload lease
        Step 2: Upload to S3
        Step 3: Submit post with S3 URL
        Returns: (success, post_url or error)
        """
        try:
            if not os.path.exists(image_path):
                return False, f'Image file not found: {image_path}'

            mimetype = mimetypes.guess_type(image_path)[0] or 'image/jpeg'

            # Step 1: Get upload lease
            success, lease_data = RedditService._get_upload_lease(access_token, image_path, mimetype)
            if not success:
                return False, f'Upload lease failed: {lease_data}'

            # Step 2: Upload to S3
            success, s3_url = RedditService._upload_to_s3(lease_data, image_path)
            if not success:
                return False, f'S3 upload failed: {s3_url}'

            # Step 3: Submit post with image URL
            resp = requests.post(
                f'{REDDIT_AUTH_API}/api/submit',
                headers={
                    **_bearer_headers(access_token),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'api_type': 'json',
                    'sr': subreddit,
                    'title': title[:300],
                    'kind': 'image',
                    'url': s3_url,
                },
                timeout=30
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            json_data = data.get('json', {})
            errors = json_data.get('errors', [])
            if errors:
                error_msgs = '; '.join([str(e) for e in errors])
                return False, f'Reddit errors: {error_msgs}'

            post_data = json_data.get('data', {})
            post_url = post_data.get('url', '')
            post_id = post_data.get('id', '')

            if post_url or post_id:
                logger.info(f'[Reddit] Image post submitted: {post_url or post_id}')
                return True, post_url or post_id
            else:
                return False, 'Image post submitted but no URL returned'

        except FileNotFoundError:
            return False, f'Image file not found: {image_path}'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            logger.error(f'[Reddit] Image post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Upload and Submit Video
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def upload_and_submit_video(access_token, subreddit, title, video_path):
        """
        Upload video via 3-step S3 lease, then submit as video post.
        Step 1: Get upload lease
        Step 2: Upload to S3
        Step 3: Submit post with S3 URL
        Returns: (success, post_url or error)
        """
        try:
            if not os.path.exists(video_path):
                return False, f'Video file not found: {video_path}'

            mimetype = mimetypes.guess_type(video_path)[0] or 'video/mp4'

            # Step 1: Get upload lease
            success, lease_data = RedditService._get_upload_lease(access_token, video_path, mimetype)
            if not success:
                return False, f'Upload lease failed: {lease_data}'

            # Step 2: Upload to S3
            success, s3_url = RedditService._upload_to_s3(lease_data, video_path)
            if not success:
                return False, f'S3 upload failed: {s3_url}'

            # Step 3: Submit post with video URL
            resp = requests.post(
                f'{REDDIT_AUTH_API}/api/submit',
                headers={
                    **_bearer_headers(access_token),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data={
                    'api_type': 'json',
                    'sr': subreddit,
                    'title': title[:300],
                    'kind': 'video',
                    'url': s3_url,
                },
                timeout=30
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'Reddit returned invalid response (HTTP {resp.status_code})'

            json_data = data.get('json', {})
            errors = json_data.get('errors', [])
            if errors:
                error_msgs = '; '.join([str(e) for e in errors])
                return False, f'Reddit errors: {error_msgs}'

            post_data = json_data.get('data', {})
            post_url = post_data.get('url', '')
            post_id = post_data.get('id', '')

            if post_url or post_id:
                logger.info(f'[Reddit] Video post submitted: {post_url or post_id}')
                return True, post_url or post_id
            else:
                return False, 'Video post submitted but no URL returned'

        except FileNotFoundError:
            return False, f'Video file not found: {video_path}'
        except requests.ConnectionError:
            return False, 'Could not reach Reddit (network error)'
        except Exception as e:
            logger.error(f'[Reddit] Video post exception: {e}')
            return False, str(e)
