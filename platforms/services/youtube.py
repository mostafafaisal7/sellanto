"""
YouTube Service — Data API v3
===============================
Supports:
  - Token validation (GET channel info)
  - Token refresh (Google OAuth2 refresh_token flow)
  - Resumable video upload (videos.insert)
  - Custom thumbnail upload
  - Shorts (vertical video + #Shorts tag)

Auth: Bearer token for API, client_id/secret for refresh
Quota: 10,000 units/day default. Upload = 1,600 units.
"""

import logging
import os
import requests

logger = logging.getLogger(__name__)

YT_API_BASE = 'https://www.googleapis.com/youtube/v3'
YT_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'


def _headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }


class YouTubeService:

    # ──────────────────────────────────────────────────────────────────────────
    # Validation
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate YouTube token by fetching the user's channel.
        Returns: (success, {channel_id, channel_title} or error)
        """
        try:
            resp = requests.get(
                f'{YT_API_BASE}/channels',
                params={'part': 'snippet', 'mine': 'true'},
                headers=_headers(access_token),
                timeout=10
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code == 403:
                try:
                    err = resp.json()
                    reason = err.get('error', {}).get('errors', [{}])[0].get('reason', '')
                    if reason in ('quotaExceeded', 'rateLimitExceeded'):
                        return False, 'YouTube API quota exceeded. Try again tomorrow.'
                except (ValueError, IndexError, KeyError):
                    pass
                return False, 'Access denied. Check your YouTube API scopes.'

            if resp.status_code != 200:
                return False, f'YouTube returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'YouTube returned invalid response'

            items = data.get('items', [])
            if not items:
                return False, 'No YouTube channel found for this account'

            channel = items[0]
            channel_id = channel.get('id', '')
            channel_title = channel.get('snippet', {}).get('title', 'YouTube Channel')

            return True, {'channel_id': channel_id, 'channel_title': channel_title}

        except requests.Timeout:
            return False, 'YouTube API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach YouTube (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Token Refresh
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_id, client_secret):
        """
        Refresh Google/YouTube access token.
        Returns: (success, {access_token, expires_in, ...} or error)
        """
        try:
            resp = requests.post(GOOGLE_TOKEN_URL, data={
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
                'client_id': client_id,
                'client_secret': client_secret,
            }, timeout=15)

            try:
                data = resp.json()
            except ValueError:
                return False, f'Google returned invalid response (HTTP {resp.status_code})'

            if 'access_token' in data:
                return True, data
            else:
                error = data.get('error_description', data.get('error', 'Refresh failed'))
                return False, error

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Video Upload (resumable)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def upload_video(access_token, video_path, title, description='', tags=None,
                     privacy='public', category_id='22', is_short=False,
                     publish_at=None):
        """
        Upload video via resumable upload.
        Args:
            access_token: Google OAuth token
            video_path: Path to video file
            title: Video title (max 100 chars)
            description: Video description (max 5000 chars)
            tags: List of tags
            privacy: public / unlisted / private
            category_id: YouTube category (22 = People & Blogs)
            is_short: If True, adds #Shorts to title
            publish_at: ISO datetime for scheduled publish (requires privacy=private)
        Returns: (success, video_id or error)
        """
        try:
            if not os.path.exists(video_path):
                return False, f'Video file not found: {video_path}'

            file_size = os.path.getsize(video_path)

            # Add #Shorts tag for Shorts
            effective_title = title[:100]
            if is_short and '#Shorts' not in effective_title:
                effective_title = f'{effective_title[:92]} #Shorts'

            # Build metadata
            body = {
                'snippet': {
                    'title': effective_title,
                    'description': (description or '')[:5000],
                    'tags': tags or [],
                    'categoryId': str(category_id),
                },
                'status': {
                    'privacyStatus': privacy,
                    'selfDeclaredMadeForKids': False,
                },
            }

            # Scheduled publish: must be private + publishAt
            if publish_at and privacy == 'private':
                body['status']['publishAt'] = publish_at

            # Step 1: Initiate resumable upload
            init_resp = requests.post(
                f'{YT_UPLOAD_BASE}/videos',
                params={'uploadType': 'resumable', 'part': 'snippet,status'},
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Length': str(file_size),
                    'X-Upload-Content-Type': 'video/*',
                },
                json=body,
                timeout=30
            )

            if init_resp.status_code != 200:
                try:
                    error = init_resp.json()
                except ValueError:
                    error = {}
                error_msg = error.get('error', {}).get('message', f'HTTP {init_resp.status_code}')
                logger.error(f'[YouTube] Upload init failed: {error_msg}')
                return False, f'Upload init failed: {error_msg}'

            upload_url = init_resp.headers.get('Location', '')
            if not upload_url:
                return False, 'YouTube did not return an upload URL'

            # Step 2: Upload video bytes
            with open(video_path, 'rb') as f:
                upload_resp = requests.put(
                    upload_url,
                    headers={
                        'Content-Type': 'video/*',
                        'Content-Length': str(file_size),
                    },
                    data=f,
                    timeout=600  # 10 minutes for large files
                )

            if upload_resp.status_code in [200, 201]:
                try:
                    result = upload_resp.json()
                except ValueError:
                    result = {}
                video_id = result.get('id', '')
                logger.info(f'[YouTube] Video uploaded: {video_id}')
                return True, video_id
            else:
                try:
                    error = upload_resp.json()
                except ValueError:
                    error = {}
                error_msg = error.get('error', {}).get('message', f'HTTP {upload_resp.status_code}')
                logger.error(f'[YouTube] Upload failed: {error_msg}')
                return False, f'Upload failed: {error_msg}'

        except FileNotFoundError:
            return False, f'Video file not found: {video_path}'
        except requests.ConnectionError:
            return False, 'Could not reach YouTube (network error)'
        except requests.Timeout:
            return False, 'Upload timed out'
        except Exception as e:
            logger.error(f'[YouTube] Upload exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Thumbnail Upload
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def set_thumbnail(access_token, video_id, thumbnail_path):
        """
        Upload custom thumbnail for a video.
        Requires channel to be phone-verified. Max 2MB, JPG/PNG.
        """
        try:
            if not os.path.exists(thumbnail_path):
                return False, f'Thumbnail file not found: {thumbnail_path}'

            with open(thumbnail_path, 'rb') as f:
                resp = requests.post(
                    f'{YT_UPLOAD_BASE}/thumbnails/set',
                    params={'videoId': video_id},
                    headers={
                        'Authorization': f'Bearer {access_token}',
                        'Content-Type': 'image/jpeg',
                    },
                    data=f,
                    timeout=30
                )

            if resp.status_code == 200:
                logger.info(f'[YouTube] Thumbnail set for video {video_id}')
                return True, 'Thumbnail uploaded'
            else:
                try:
                    error = resp.json()
                except ValueError:
                    error = {}
                return False, error.get('error', {}).get('message', f'HTTP {resp.status_code}')

        except Exception as e:
            logger.error(f'[YouTube] Thumbnail exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # List Channel Info
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def get_channel_info(access_token):
        """Fetch authenticated user's channel details."""
        try:
            resp = requests.get(
                f'{YT_API_BASE}/channels',
                params={'part': 'snippet,statistics', 'mine': 'true'},
                headers=_headers(access_token),
                timeout=10
            )

            if resp.status_code != 200:
                return False, f'HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'Invalid response'

            items = data.get('items', [])
            if not items:
                return False, 'No channel found'

            ch = items[0]
            return True, {
                'channel_id': ch.get('id', ''),
                'title': ch.get('snippet', {}).get('title', ''),
                'description': ch.get('snippet', {}).get('description', ''),
                'thumbnail': ch.get('snippet', {}).get('thumbnails', {}).get('default', {}).get('url', ''),
                'subscriber_count': ch.get('statistics', {}).get('subscriberCount', '0'),
                'video_count': ch.get('statistics', {}).get('videoCount', '0'),
            }

        except Exception as e:
            return False, str(e)
