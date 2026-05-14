"""
Pinterest Service — API v5
============================
Supports:
  - Token validation (GET /v5/user_account)
  - Token refresh (POST /v5/oauth/token with grant_type=refresh_token)
  - List boards (GET /v5/boards)
  - Create image pin (POST /v5/pins — URL or base64)
  - Create video pin (POST /v5/media → S3 upload → poll → POST /v5/pins)

Auth: HTTP Basic (base64 client_id:client_secret) for token endpoints
       Bearer token for API endpoints
"""

import base64
import logging
import time
import requests

logger = logging.getLogger(__name__)

PIN_API_BASE = 'https://api.pinterest.com/v5'


def _bearer_headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }


def _basic_auth_header(client_id, client_secret):
    """HTTP Basic Auth header for Pinterest token endpoints."""
    credentials = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    return {'Authorization': f'Basic {credentials}'}


class PinterestService:

    # ──────────────────────────────────────────────────────────────────────────
    # Validation
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate Pinterest token by calling /v5/user_account.
        Returns: (success: bool, username_or_error: str)
        """
        try:
            resp = requests.get(
                f'{PIN_API_BASE}/user_account',
                headers=_bearer_headers(access_token),
                timeout=10
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'

            if resp.status_code != 200:
                return False, f'Pinterest returned HTTP {resp.status_code}'

            try:
                data = resp.json()
            except ValueError:
                return False, 'Pinterest returned invalid response'

            username = data.get('username', data.get('business_name', 'Pinterest User'))
            return True, username

        except requests.Timeout:
            return False, 'Pinterest API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Pinterest (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Token Refresh
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_id, client_secret):
        """
        Refresh an expired access token.
        Pinterest uses HTTP Basic Auth for token endpoints.
        Returns: (success, {access_token, refresh_token, ...} or error)
        """
        try:
            resp = requests.post(
                f'{PIN_API_BASE}/oauth/token',
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
                return False, f'Pinterest returned invalid response (HTTP {resp.status_code})'

            if 'access_token' in data:
                return True, data
            else:
                return False, data.get('message', f'Refresh failed (HTTP {resp.status_code})')

        except requests.Timeout:
            return False, 'Pinterest API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Pinterest (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # List Boards
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def list_boards(access_token):
        """
        Fetch user's boards for pin placement.
        Returns: (success, list_of_boards or error)
        """
        try:
            boards = []
            bookmark = None
            max_pages = 20  # Safety: max 500 boards (20 pages * 25 per page)

            for _ in range(max_pages):
                params = {'page_size': 25}
                if bookmark:
                    params['bookmark'] = bookmark

                resp = requests.get(
                    f'{PIN_API_BASE}/boards',
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
                    return False, 'Pinterest returned invalid response'

                for board in data.get('items', []):
                    boards.append({
                        'id': board.get('id', ''),
                        'name': board.get('name', ''),
                        'description': board.get('description', ''),
                        'privacy': board.get('privacy', 'PUBLIC'),
                        'pin_count': board.get('pin_count', 0),
                    })

                bookmark = data.get('bookmark')
                if not bookmark:
                    break

            return True, boards

        except requests.Timeout:
            return False, 'Pinterest API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Pinterest (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Create Pin (image)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def create_image_pin(access_token, board_id, title, description, image_url=None, image_path=None, link=None):
        """
        Create an image pin.
        Either image_url (public URL) or image_path (local file → base64) required.
        """
        try:
            pin_data = {
                'board_id': board_id,
                'title': (title or '')[:100],
                'description': (description or '')[:800],
            }

            if link:
                pin_data['link'] = link[:2048]

            if image_url:
                pin_data['media_source'] = {
                    'source_type': 'image_url',
                    'url': image_url,
                }
            elif image_path:
                import mimetypes
                mime_type = mimetypes.guess_type(image_path)[0] or 'image/jpeg'
                content_type = 'image/png' if 'png' in mime_type else 'image/jpeg'

                with open(image_path, 'rb') as f:
                    image_b64 = base64.b64encode(f.read()).decode()

                pin_data['media_source'] = {
                    'source_type': 'image_base64',
                    'content_type': content_type,
                    'data': image_b64,
                }
            else:
                return False, 'Either image_url or image_path is required'

            resp = requests.post(
                f'{PIN_API_BASE}/pins',
                headers=_bearer_headers(access_token),
                json=pin_data,
                timeout=30
            )

            if resp.status_code == 201:
                result = resp.json()
                pin_id = result.get('id', '')
                logger.info(f'[Pinterest] Image pin created: {pin_id}')
                return True, pin_id
            else:
                try:
                    error = resp.json()
                except ValueError:
                    error = {}
                error_msg = error.get('message', f'HTTP {resp.status_code}')
                logger.error(f'[Pinterest] Image pin failed ({resp.status_code}): {error_msg}')
                return False, error_msg

        except FileNotFoundError:
            return False, f'Image file not found: {image_path}'
        except requests.ConnectionError:
            return False, 'Could not reach Pinterest (network error)'
        except Exception as e:
            logger.error(f'[Pinterest] Image pin exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Create Video Pin (3-step async: register → S3 upload → poll → create)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def create_video_pin(access_token, board_id, title, description, video_path, cover_image_url=None, link=None):
        """
        Create a video pin:
        Step 1: Register media upload → get S3 upload URL
        Step 2: Upload video to S3
        Step 3: Poll media status until succeeded
        Step 4: Create pin with media_id
        """
        try:
            # Step 1: Register media upload
            register_resp = requests.post(
                f'{PIN_API_BASE}/media',
                headers=_bearer_headers(access_token),
                json={'media_type': 'video'},
                timeout=15
            )

            if register_resp.status_code != 200:
                try:
                    error = register_resp.json()
                except ValueError:
                    error = {}
                return False, f"Media register failed: {error.get('message', f'HTTP {register_resp.status_code}')}"

            register_data = register_resp.json()
            media_id = register_data.get('media_id', '')
            upload_url = register_data.get('upload_url', '')
            upload_params = register_data.get('upload_parameters', {})

            if not media_id or not upload_url:
                return False, 'Media register returned no media_id or upload_url'

            # Step 2: Upload to S3 (multipart form with upload_parameters + file)
            with open(video_path, 'rb') as f:
                files = {'file': (video_path.split('/')[-1].split('\\')[-1], f)}

                # upload_parameters can be a list of {name, value} dicts OR a flat dict
                if isinstance(upload_params, list):
                    form_data = {field['name']: field['value'] for field in upload_params if isinstance(field, dict)}
                elif isinstance(upload_params, dict):
                    form_data = upload_params
                else:
                    form_data = {}

                upload_resp = requests.post(
                    f'https:{upload_url}' if upload_url.startswith('//') else upload_url,
                    data=form_data,
                    files=files,
                    timeout=300
                )

            if upload_resp.status_code not in [200, 201, 204]:
                return False, f'S3 upload failed: HTTP {upload_resp.status_code}'

            logger.info(f'[Pinterest] Video uploaded to S3, media_id={media_id}')

            # Step 3: Poll media status (max 5 minutes)
            max_polls = 30
            for i in range(max_polls):
                time.sleep(10)
                status_resp = requests.get(
                    f'{PIN_API_BASE}/media/{media_id}',
                    headers=_bearer_headers(access_token),
                    timeout=10
                )

                if status_resp.status_code == 200:
                    media_status = status_resp.json().get('status', '')
                    logger.info(f'[Pinterest] Media status poll {i+1}: {media_status}')
                    if media_status == 'succeeded':
                        break
                    elif media_status == 'failed':
                        return False, 'Video processing failed on Pinterest'
                else:
                    logger.warning(f'[Pinterest] Media status poll failed: {status_resp.status_code}')
            else:
                return False, 'Video processing timed out (5 minutes)'

            # Step 4: Create pin with video media_id
            pin_data = {
                'board_id': board_id,
                'title': (title or '')[:100],
                'description': (description or '')[:800],
                'media_source': {
                    'source_type': 'video_id',
                    'media_id': media_id,
                },
            }

            if cover_image_url:
                pin_data['media_source']['cover_image_url'] = cover_image_url
            if link:
                pin_data['link'] = link[:2048]

            resp = requests.post(
                f'{PIN_API_BASE}/pins',
                headers=_bearer_headers(access_token),
                json=pin_data,
                timeout=30
            )

            if resp.status_code == 201:
                result = resp.json()
                pin_id = result.get('id', '')
                logger.info(f'[Pinterest] Video pin created: {pin_id}')
                return True, pin_id
            else:
                try:
                    error = resp.json()
                except ValueError:
                    error = {}
                return False, error.get('message', f'HTTP {resp.status_code}')

        except FileNotFoundError:
            return False, f'Video file not found: {video_path}'
        except requests.ConnectionError:
            return False, 'Could not reach Pinterest (network error)'
        except Exception as e:
            logger.error(f'[Pinterest] Video pin exception: {e}')
            return False, str(e)
