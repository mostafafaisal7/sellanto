"""
TikTok Service — Content Posting API v2
========================================
Supports:
  - Token validation (GET user info)
  - Token refresh (TikTok OAuth2 refresh_token flow, 365-day refresh tokens)
  - Creator info query (MUST call before posting)
  - Video direct post (init + status check)
  - Photo/carousel post (init + status check)
  - Publish status check
  - Token revocation

Auth: Bearer token for API, client_key/client_secret for refresh
Note: access_token expires every 24 hours. refresh_token lasts 365 days.
      Before app audit, all posts are SELF_ONLY (private).
"""

import logging
import requests

logger = logging.getLogger(__name__)

TT_AUTH_BASE = 'https://open.tiktokapis.com/v2/oauth'
TT_USER_BASE = 'https://open.tiktokapis.com/v2/user'
TT_POST_BASE = 'https://open.tiktokapis.com/v2/post/publish'


def _bearer_headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json; charset=UTF-8',
    }


class TikTokService:

    # ──────────────────────────────────────────────────────────────────────────
    # Validation — GET /v2/user/info/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate TikTok token by fetching user info.
        Returns: (success, {open_id, display_name, avatar_url} or error)
        """
        try:
            resp = requests.get(
                f'{TT_USER_BASE}/info/',
                params={'fields': 'open_id,display_name,avatar_url'},
                headers=_bearer_headers(access_token),
                timeout=10,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code == 403:
                return False, 'Access denied. Check your TikTok API scopes.'

            if resp.status_code != 200:
                return False, f'TikTok returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'TikTok returned invalid response'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                logger.error(f'[TikTok] User info error: {err_msg}')
                return False, err_msg

            user_data = data.get('data', {}).get('user', {})
            if not user_data:
                return False, 'No TikTok user data returned'

            open_id = user_data.get('open_id', '')
            display_name = user_data.get('display_name', 'TikTok User')
            avatar_url = user_data.get('avatar_url', '')

            return True, {
                'open_id': open_id,
                'display_name': display_name,
                'avatar_url': avatar_url,
            }

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] validate_credentials exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Token Refresh — POST /v2/oauth/token/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_key, client_secret):
        """
        Refresh TikTok access token using refresh_token.
        Returns: (success, {access_token, refresh_token, expires_in, ...} or error)
        """
        try:
            resp = requests.post(
                f'{TT_AUTH_BASE}/token/',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                    'client_key': client_key,
                    'client_secret': client_secret,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=15,
            )

            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok returned invalid response (HTTP {resp.status_code})'

            if 'access_token' in data:
                logger.info('[TikTok] Token refreshed successfully')
                return True, data
            else:
                error = data.get('error_description', data.get('error', 'Refresh failed'))
                logger.error(f'[TikTok] Token refresh failed: {error}')
                return False, error

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] refresh_access_token exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Token Revocation — POST /v2/oauth/revoke/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def revoke_token(access_token, client_key, client_secret):
        """
        Revoke a TikTok access token.
        Returns: (success, message or error)
        """
        try:
            resp = requests.post(
                f'{TT_AUTH_BASE}/revoke/',
                data={
                    'client_key': client_key,
                    'client_secret': client_secret,
                    'token': access_token,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10,
            )

            if resp.status_code == 200:
                logger.info('[TikTok] Token revoked successfully')
                return True, 'Token revoked'

            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok returned HTTP {resp.status_code}'

            error = data.get('error_description', data.get('error', 'Revocation failed'))
            return False, error

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] revoke_token exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Creator Info — POST /v2/post/publish/creator_info/query/
    # MUST call before posting to check creator eligibility
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def query_creator_info(access_token):
        """
        Query creator posting capabilities. Must call before any post.
        Returns: (success, {creator_avatar_url, creator_nickname, ...} or error)
        """
        try:
            resp = requests.post(
                f'{TT_POST_BASE}/creator_info/query/',
                headers=_bearer_headers(access_token),
                json={},
                timeout=10,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code != 200:
                return False, f'TikTok returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'TikTok returned invalid response'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                logger.error(f'[TikTok] Creator info error: {err_msg}')
                return False, err_msg

            creator_data = data.get('data', {})
            logger.info(f'[TikTok] Creator info fetched successfully')
            return True, creator_data

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] query_creator_info exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Video Direct Post — POST /v2/post/publish/video/init/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def init_video_post(access_token, post_info, source_info):
        """
        Initiate a video direct post on TikTok.
        Args:
            access_token: TikTok OAuth token
            post_info: dict with title, description, privacy_level, etc.
                       privacy_level: SELF_ONLY (before audit), MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, PUBLIC_TO_EVERYONE
            source_info: dict with source (PULL_FROM_URL or FILE_UPLOAD), video_url, etc.
        Returns: (success, {publish_id} or error)

        Example post_info:
            {
                "title": "My video",
                "privacy_level": "SELF_ONLY",
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            }
        Example source_info:
            {"source": "PULL_FROM_URL", "video_url": "https://..."}
        """
        try:
            body = {
                'post_info': post_info,
                'source_info': source_info,
            }

            resp = requests.post(
                f'{TT_POST_BASE}/video/init/',
                headers=_bearer_headers(access_token),
                json=body,
                timeout=30,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok returned invalid response (HTTP {resp.status_code})'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                log_id = error_obj.get('log_id', '')
                logger.error(f'[TikTok] Video post init failed: {err_msg} (log_id={log_id})')
                return False, err_msg

            publish_id = data.get('data', {}).get('publish_id', '')
            if not publish_id:
                return False, 'TikTok did not return a publish_id'

            logger.info(f'[TikTok] Video post initiated: publish_id={publish_id}')
            return True, {'publish_id': publish_id}

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] init_video_post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Video FILE_UPLOAD — init + upload chunks
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def post_video_file_upload(access_token, post_info, video_path):
        """
        Upload a local video file to TikTok using FILE_UPLOAD source.
        Steps:
          1. Init: tell TikTok the file size → get publish_id + upload_url
          2. PUT the raw video bytes to upload_url
        Returns: (success, publish_id or error_string)
        """
        import math
        import os

        try:
            file_size = os.path.getsize(video_path)
        except OSError as e:
            return False, f'Cannot read video file: {e}'

        # TikTok max chunk size is 64 MB; we send in one chunk for files ≤ 64 MB
        chunk_size = min(file_size, 64 * 1024 * 1024)
        total_chunks = math.ceil(file_size / chunk_size)

        source_info = {
            'source': 'FILE_UPLOAD',
            'video_size': file_size,
            'chunk_size': chunk_size,
            'total_chunk_count': total_chunks,
        }

        # ── Step 1: Init ──────────────────────────────────────────────────────
        try:
            resp = requests.post(
                f'{TT_POST_BASE}/video/init/',
                headers=_bearer_headers(access_token),
                json={'post_info': post_info, 'source_info': source_info},
                timeout=30,
            )
            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok init returned invalid response (HTTP {resp.status_code})'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                err_code = error_obj.get('code', '')
                log_id = error_obj.get('log_id', '')
                logger.error(f'[TikTok] FILE_UPLOAD init failed — code={err_code} msg={err_msg} log_id={log_id} full_response={data}')
                return False, f'[{err_code}] {err_msg}'

            publish_id = data.get('data', {}).get('publish_id', '')
            upload_url = data.get('data', {}).get('upload_url', '')
            if not publish_id or not upload_url:
                return False, 'TikTok did not return publish_id or upload_url'

            logger.info(f'[TikTok] FILE_UPLOAD init OK: publish_id={publish_id}')

        except requests.Timeout:
            return False, 'TikTok init request timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] FILE_UPLOAD init exception: {e}')
            return False, str(e)

        # ── Step 2: Upload video in chunks ────────────────────────────────────
        try:
            with open(video_path, 'rb') as f:
                chunk_index = 0
                uploaded = 0
                while True:
                    chunk_data = f.read(chunk_size)
                    if not chunk_data:
                        break

                    content_range = f'bytes {uploaded}-{uploaded + len(chunk_data) - 1}/{file_size}'
                    upload_headers = {
                        'Content-Type': 'video/mp4',
                        'Content-Range': content_range,
                        'Content-Length': str(len(chunk_data)),
                    }
                    put_resp = requests.put(
                        upload_url,
                        data=chunk_data,
                        headers=upload_headers,
                        timeout=120,
                    )
                    if put_resp.status_code not in (200, 201, 206):
                        return False, f'Video upload failed at chunk {chunk_index} (HTTP {put_resp.status_code}): {put_resp.text[:200]}'

                    uploaded += len(chunk_data)
                    chunk_index += 1
                    logger.info(f'[TikTok] Uploaded chunk {chunk_index}/{total_chunks} ({uploaded}/{file_size} bytes)')

            logger.info(f'[TikTok] FILE_UPLOAD complete: publish_id={publish_id}')
            return True, publish_id

        except requests.Timeout:
            return False, 'Video upload timed out (file may be too large)'
        except requests.ConnectionError:
            return False, 'Network error during video upload'
        except Exception as e:
            logger.error(f'[TikTok] FILE_UPLOAD upload exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Inbox Upload — POST /v2/post/publish/inbox/video/init/
    # Works for unaudited apps — no private account required.
    # Video is sent to user's TikTok inbox as a draft; user publishes manually.
    # Requires: video.upload scope (not video.publish)
    # Limit: max 5 pending inbox shares per user per 24 hours
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def post_video_inbox_upload(access_token, video_path):
        """
        Upload video to user's TikTok inbox (draft mode).
        No post_info needed — user sets title/privacy inside TikTok app.
        Returns: (success, publish_id or error_string)
        """
        import math
        import os

        try:
            file_size = os.path.getsize(video_path)
        except OSError as e:
            return False, f'Cannot read video file: {e}'

        chunk_size = min(file_size, 64 * 1024 * 1024)
        total_chunks = math.ceil(file_size / chunk_size)

        source_info = {
            'source': 'FILE_UPLOAD',
            'video_size': file_size,
            'chunk_size': chunk_size,
            'total_chunk_count': total_chunks,
        }

        # ── Step 1: Init ──────────────────────────────────────────────────────
        try:
            resp = requests.post(
                f'{TT_POST_BASE}/inbox/video/init/',
                headers=_bearer_headers(access_token),
                json={'source_info': source_info},   # No post_info for inbox
                timeout=30,
            )
            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok inbox init returned invalid response (HTTP {resp.status_code})'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_code = error_obj.get('code', '')
                err_msg = error_obj.get('message', 'Unknown error')
                log_id = error_obj.get('log_id', '')
                logger.error(f'[TikTok] Inbox init failed — code={err_code} msg={err_msg} log_id={log_id}')
                return False, f'[{err_code}] {err_msg}'

            publish_id = data.get('data', {}).get('publish_id', '')
            upload_url = data.get('data', {}).get('upload_url', '')
            if not publish_id or not upload_url:
                return False, 'TikTok did not return publish_id or upload_url'

            logger.info(f'[TikTok] Inbox init OK: publish_id={publish_id}')

        except requests.Timeout:
            return False, 'TikTok inbox init timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] Inbox init exception: {e}')
            return False, str(e)

        # ── Step 2: Upload video chunks ───────────────────────────────────────
        try:
            with open(video_path, 'rb') as f:
                chunk_index = 0
                uploaded = 0
                while True:
                    chunk_data = f.read(chunk_size)
                    if not chunk_data:
                        break
                    content_range = f'bytes {uploaded}-{uploaded + len(chunk_data) - 1}/{file_size}'
                    put_resp = requests.put(
                        upload_url,
                        data=chunk_data,
                        headers={
                            'Content-Type': 'video/mp4',
                            'Content-Range': content_range,
                            'Content-Length': str(len(chunk_data)),
                        },
                        timeout=120,
                    )
                    if put_resp.status_code not in (200, 201, 206):
                        return False, f'Upload failed at chunk {chunk_index} (HTTP {put_resp.status_code})'
                    uploaded += len(chunk_data)
                    chunk_index += 1
                    logger.info(f'[TikTok] Inbox upload chunk {chunk_index}/{total_chunks}')

            logger.info(f'[TikTok] Inbox upload complete: publish_id={publish_id}')
            return True, publish_id

        except requests.Timeout:
            return False, 'Video upload timed out'
        except requests.ConnectionError:
            return False, 'Network error during video upload'
        except Exception as e:
            logger.error(f'[TikTok] Inbox upload exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Photo/Carousel Post — POST /v2/post/publish/content/init/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def init_photo_post(access_token, post_info, source_info):
        """
        Initiate a photo or carousel post on TikTok.
        Args:
            access_token: TikTok OAuth token
            post_info: dict with title, description, privacy_level, etc.
            source_info: dict with source (PULL_FROM_URL), photo_images (list of URLs), etc.
        Returns: (success, {publish_id} or error)

        Note: Photo posting requires a verified domain. Before domain verification,
              only video posting is available.

        Example source_info:
            {
                "source": "PULL_FROM_URL",
                "photo_cover_index": 0,
                "photo_images": ["https://...", "https://..."]
            }
        """
        try:
            body = {
                'post_info': post_info,
                'source_info': source_info,
            }

            resp = requests.post(
                f'{TT_POST_BASE}/content/init/',
                headers=_bearer_headers(access_token),
                json=body,
                timeout=30,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            try:
                data = resp.json()
            except ValueError:
                return False, f'TikTok returned invalid response (HTTP {resp.status_code})'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                log_id = error_obj.get('log_id', '')
                logger.error(f'[TikTok] Photo post init failed: {err_msg} (log_id={log_id})')
                return False, err_msg

            publish_id = data.get('data', {}).get('publish_id', '')
            if not publish_id:
                return False, 'TikTok did not return a publish_id'

            logger.info(f'[TikTok] Photo post initiated: publish_id={publish_id}')
            return True, {'publish_id': publish_id}

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] init_photo_post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Publish Status — POST /v2/post/publish/status/fetch/
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def check_publish_status(access_token, publish_id):
        """
        Check the publish status of a video/photo post.
        Returns: (success, {status, ...} or error)

        Status values: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX,
                       PUBLISH_COMPLETE, FAILED
        """
        try:
            resp = requests.post(
                f'{TT_POST_BASE}/status/fetch/',
                headers=_bearer_headers(access_token),
                json={'publish_id': publish_id},
                timeout=10,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code != 200:
                return False, f'TikTok returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'TikTok returned invalid response'

            error_obj = data.get('error', {})
            if error_obj.get('code', 'ok') != 'ok':
                err_msg = error_obj.get('message', 'Unknown error')
                return False, err_msg

            status_data = data.get('data', {})
            logger.info(f'[TikTok] Publish status for {publish_id}: {status_data.get("status", "unknown")}')
            return True, status_data

        except requests.Timeout:
            return False, 'TikTok API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach TikTok (network error)'
        except Exception as e:
            logger.error(f'[TikTok] check_publish_status exception: {e}')
            return False, str(e)
