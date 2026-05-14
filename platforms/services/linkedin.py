"""
LinkedIn Service — REST API (Posts API, Images API, Videos API)
================================================================
Uses the NEW LinkedIn REST API — NOT the deprecated ugcPosts/Assets APIs.

Supports:
  - Text posts (personal + company page)
  - Single image posts (2-step: init upload → PUT binary → create post)
  - Multi-image posts (up to 20 images — same upload flow, multiImage content)
  - Video posts (4-step: init → chunked PUT → finalize → poll → create post)
  - Article/link posts (URL with preview card)
  - Token validation (via organizationAcls — works with Community Management API)
  - Organization listing

Required headers on ALL REST API calls:
  - Authorization: Bearer {token}
  - LinkedIn-Version: YYYYMM
  - X-Restli-Protocol-Version: 2.0.0
"""

import logging
import os
import time
import requests

logger = logging.getLogger(__name__)

# LinkedIn API versioning — update every ~6 months
LI_API_VERSION = '202604'
LI_REST_BASE = 'https://api.linkedin.com/rest'
LI_V2_BASE = 'https://api.linkedin.com/v2'

# Video chunk size: 4 MB (LinkedIn requirement)
VIDEO_CHUNK_SIZE = 4 * 1024 * 1024


def _headers(access_token, content_type='application/json'):
    """Standard headers for LinkedIn REST API."""
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': content_type,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LI_API_VERSION,
    }


class LinkedInService:

    # ──────────────────────────────────────────────────────────────────────────
    # Validation
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate a LinkedIn token — works for both Personal and Community app tokens.

        Strategy:
          1. Try /v2/userinfo  → works for Personal tokens (openid scope)
          2. If 403/4xx, try /rest/organizationAcls → works for Community tokens
          3. If either succeeds, token is valid

        Returns: (success: bool, info_or_error: str)
        """
        try:
            # Try personal token validation first
            resp = requests.get(
                f'{LI_V2_BASE}/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            if resp.status_code == 200:
                try:
                    profile = resp.json()
                    if 'error' not in profile:
                        name = profile.get('name', 'LinkedIn User')
                        return True, name
                except ValueError:
                    pass
            elif resp.status_code == 401:
                return False, 'Token expired or revoked'

            # Fall back to community token validation
            resp2 = requests.get(
                f'{LI_REST_BASE}/organizationAcls',
                params={'q': 'roleAssignee', 'role': 'ADMINISTRATOR', 'state': 'APPROVED'},
                headers=_headers(access_token),
                timeout=10
            )
            if resp2.status_code == 200:
                count = len(resp2.json().get('elements', []))
                return True, f'Token valid — {count} company page(s) accessible'
            elif resp2.status_code == 401:
                return False, 'Token expired or revoked'
            else:
                return False, f'LinkedIn returned HTTP {resp2.status_code}'

        except requests.Timeout:
            return False, 'LinkedIn API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Refresh Token
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_id, client_secret):
        """
        Refresh an expired access token using the refresh token.
        Only works with Community Management API approved apps.
        Returns: (success, {access_token, expires_in, refresh_token} or error)
        """
        try:
            resp = requests.post(
                'https://www.linkedin.com/oauth/v2/accessToken',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                    'client_id': client_id,
                    'client_secret': client_secret,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=15
            )
            data = resp.json()

            if 'access_token' in data:
                return True, data
            else:
                return False, data.get('error_description', 'Refresh failed')

        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Post to LinkedIn (text, image, video)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def post_to_linkedin(access_token, author_urn, text, image_path=None,
                         video_path=None, image_paths=None, article_url=None,
                         article_title=None, article_description=None):
        """
        Post to LinkedIn. author_urn can be personal (urn:li:person:xxx)
        or organization (urn:li:organization:xxx).

        Args:
            access_token:        LinkedIn OAuth token
            author_urn:          Full URN (urn:li:person:xxx or urn:li:organization:xxx)
            text:                Post text (max 3000 chars)
            image_path:          Single image file path
            image_paths:         List of image file paths (multi-image, up to 20)
            video_path:          Video file path
            article_url:         URL to share as an article/link post
            article_title:       Optional title for article preview
            article_description: Optional description for article preview

        Returns: (success: bool, post_id_or_error: str)
        """
        # Multi-image takes priority over single image
        if video_path:
            return LinkedInService._post_with_video(access_token, author_urn, text, video_path)
        elif image_paths and len(image_paths) > 1:
            return LinkedInService._post_with_multi_image(access_token, author_urn, text, image_paths)
        elif image_paths and len(image_paths) == 1:
            return LinkedInService._post_with_image(access_token, author_urn, text, image_paths[0])
        elif image_path:
            return LinkedInService._post_with_image(access_token, author_urn, text, image_path)
        elif article_url:
            return LinkedInService._post_with_article(
                access_token, author_urn, text, article_url,
                article_title, article_description
            )
        else:
            return LinkedInService._post_text(access_token, author_urn, text)

    # ──────────────────────────────────────────────────────────────────────────
    # Text Post (new Posts API)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _post_text(access_token, author_urn, text):
        """Create a text-only post using the REST Posts API."""
        try:
            post_data = {
                'author': author_urn,
                'commentary': text[:3000],
                'visibility': 'PUBLIC',
                'distribution': {
                    'feedDistribution': 'MAIN_FEED',
                    'targetEntities': [],
                    'thirdPartyDistributionChannels': [],
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }

            resp = requests.post(
                f'{LI_REST_BASE}/posts',
                headers=_headers(access_token),
                json=post_data,
                timeout=15
            )

            if resp.status_code == 201:
                post_urn = resp.headers.get('x-restli-id', '')
                logger.info(f'[LinkedIn] Text post created: {post_urn}')
                return True, post_urn
            else:
                try:
                    error = resp.json() if resp.text else {}
                except ValueError:
                    error = {}
                error_msg = error.get('message', f'HTTP {resp.status_code}')
                logger.error(f'[LinkedIn] Text post failed ({resp.status_code}): {error_msg}')
                return False, error_msg

        except requests.ConnectionError:
            logger.error('[LinkedIn] Text post: network error')
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            logger.error(f'[LinkedIn] Text post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Image Post (new Images API — 2-step upload)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _post_with_image(access_token, author_urn, text, image_path):
        """
        Post with image using the new Images API:
        Step 1: Initialize upload → get upload URL + image URN
        Step 2: PUT binary to upload URL
        Step 3: Create post referencing image URN
        """
        try:
            # Step 1: Initialize image upload
            init_resp = requests.post(
                f'{LI_REST_BASE}/images?action=initializeUpload',
                headers=_headers(access_token),
                json={
                    'initializeUploadRequest': {
                        'owner': author_urn,
                    }
                },
                timeout=15
            )

            if init_resp.status_code != 200:
                try:
                    error = init_resp.json() if init_resp.text else {}
                except ValueError:
                    error = {}
                return False, f"Image upload init failed: {error.get('message', f'HTTP {init_resp.status_code}')}"

            init_data = init_resp.json().get('value', {})
            upload_url = init_data.get('uploadUrl', '')
            image_urn = init_data.get('image', '')

            if not upload_url or not image_urn:
                return False, 'Image upload init returned no URL or URN'

            # Step 2: Upload binary
            with open(image_path, 'rb') as f:
                image_data = f.read()

            upload_resp = requests.put(
                upload_url,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/octet-stream',
                },
                data=image_data,
                timeout=60
            )

            if upload_resp.status_code not in [200, 201]:
                return False, f'Image upload failed: HTTP {upload_resp.status_code}'

            # Step 3: Create post with image
            post_data = {
                'author': author_urn,
                'commentary': text[:3000],
                'visibility': 'PUBLIC',
                'distribution': {
                    'feedDistribution': 'MAIN_FEED',
                    'targetEntities': [],
                    'thirdPartyDistributionChannels': [],
                },
                'content': {
                    'media': {
                        'altText': text[:200] if text else 'Image',
                        'id': image_urn,
                    }
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }

            resp = requests.post(
                f'{LI_REST_BASE}/posts',
                headers=_headers(access_token),
                json=post_data,
                timeout=15
            )

            if resp.status_code == 201:
                post_urn = resp.headers.get('x-restli-id', '')
                logger.info(f'[LinkedIn] Image post created: {post_urn}')
                return True, post_urn
            else:
                try:
                    error = resp.json() if resp.text else {}
                except ValueError:
                    error = {}
                return False, error.get('message', f'HTTP {resp.status_code}')

        except FileNotFoundError:
            logger.error(f'[LinkedIn] Image file not found: {image_path}')
            return False, f'Image file not found: {image_path}'
        except requests.ConnectionError:
            logger.error('[LinkedIn] Image post: network error')
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            logger.error(f'[LinkedIn] Image post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Multi-Image Post (up to 20 images)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _post_with_multi_image(access_token, author_urn, text, image_paths):
        """
        Post with multiple images (up to 20) using the new Images API.
        Each image is uploaded individually then referenced in a multiImage post.
        """
        try:
            image_urns = []

            for path in image_paths[:20]:  # LinkedIn max 20 images
                # Init upload for each image
                init_resp = requests.post(
                    f'{LI_REST_BASE}/images?action=initializeUpload',
                    headers=_headers(access_token),
                    json={'initializeUploadRequest': {'owner': author_urn}},
                    timeout=15
                )
                if init_resp.status_code != 200:
                    try:
                        error = init_resp.json() if init_resp.text else {}
                    except ValueError:
                        error = {}
                    return False, f"Image upload init failed for {path}: {error.get('message', f'HTTP {init_resp.status_code}')}"

                init_data = init_resp.json().get('value', {})
                upload_url = init_data.get('uploadUrl', '')
                image_urn = init_data.get('image', '')

                if not upload_url or not image_urn:
                    return False, f'Image upload init returned no URL/URN for {path}'

                # Upload binary
                with open(path, 'rb') as f:
                    upload_resp = requests.put(
                        upload_url,
                        headers={
                            'Authorization': f'Bearer {access_token}',
                            'Content-Type': 'application/octet-stream',
                        },
                        data=f.read(),
                        timeout=60
                    )

                if upload_resp.status_code not in [200, 201]:
                    return False, f'Image upload failed for {path}: HTTP {upload_resp.status_code}'

                image_urns.append(image_urn)
                logger.info(f'[LinkedIn] Uploaded image {len(image_urns)}/{len(image_paths)}: {image_urn}')

            # Build multiImage post
            post_data = {
                'author': author_urn,
                'commentary': text[:3000],
                'visibility': 'PUBLIC',
                'distribution': {
                    'feedDistribution': 'MAIN_FEED',
                    'targetEntities': [],
                    'thirdPartyDistributionChannels': [],
                },
                'content': {
                    'multiImage': {
                        'images': [
                            {'altText': f'Image {i+1}', 'id': urn}
                            for i, urn in enumerate(image_urns)
                        ]
                    }
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }

            resp = requests.post(
                f'{LI_REST_BASE}/posts',
                headers=_headers(access_token),
                json=post_data,
                timeout=15
            )

            if resp.status_code == 201:
                post_urn = resp.headers.get('x-restli-id', '')
                logger.info(f'[LinkedIn] Multi-image post created ({len(image_urns)} images): {post_urn}')
                return True, post_urn
            else:
                try:
                    error = resp.json() if resp.text else {}
                except ValueError:
                    error = {}
                return False, error.get('message', f'HTTP {resp.status_code}')

        except FileNotFoundError as e:
            logger.error(f'[LinkedIn] Image file not found: {e}')
            return False, f'Image file not found: {e}'
        except requests.ConnectionError:
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            logger.error(f'[LinkedIn] Multi-image post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Article / Link Post
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _post_with_article(access_token, author_urn, text, url,
                           title=None, description=None):
        """
        Share a URL as an article post with link preview card.
        LinkedIn auto-fetches OG tags if title/description are omitted.
        """
        try:
            article_content = {'source': url}
            if title:
                article_content['title'] = title[:400]
            if description:
                article_content['description'] = description[:1000]

            post_data = {
                'author': author_urn,
                'commentary': text[:3000],
                'visibility': 'PUBLIC',
                'distribution': {
                    'feedDistribution': 'MAIN_FEED',
                    'targetEntities': [],
                    'thirdPartyDistributionChannels': [],
                },
                'content': {
                    'article': article_content,
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }

            resp = requests.post(
                f'{LI_REST_BASE}/posts',
                headers=_headers(access_token),
                json=post_data,
                timeout=15
            )

            if resp.status_code == 201:
                post_urn = resp.headers.get('x-restli-id', '')
                logger.info(f'[LinkedIn] Article post created: {post_urn}')
                return True, post_urn
            else:
                try:
                    error = resp.json() if resp.text else {}
                except ValueError:
                    error = {}
                return False, error.get('message', f'HTTP {resp.status_code}')

        except requests.ConnectionError:
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            logger.error(f'[LinkedIn] Article post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Video Post (new Videos API — 4-step upload)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _post_with_video(access_token, author_urn, text, video_path):
        """
        Post with video using the new Videos API:
        Step 1: Initialize upload → get upload instructions + video URN
        Step 2: Upload video in 4MB chunks (PUT each chunk)
        Step 3: Finalize upload with ETags
        Step 4: Poll until video status is AVAILABLE
        Step 5: Create post referencing video URN
        """
        try:
            file_size = os.path.getsize(video_path)

            # Step 1: Initialize video upload
            init_resp = requests.post(
                f'{LI_REST_BASE}/videos?action=initializeUpload',
                headers=_headers(access_token),
                json={
                    'initializeUploadRequest': {
                        'owner': author_urn,
                        'fileSizeBytes': file_size,
                        'uploadCaptions': False,
                        'uploadThumbnail': False,
                    }
                },
                timeout=15
            )

            if init_resp.status_code != 200:
                try:
                    error = init_resp.json() if init_resp.text else {}
                except ValueError:
                    error = {}
                return False, f"Video upload init failed: {error.get('message', f'HTTP {init_resp.status_code}')}"

            init_data = init_resp.json().get('value', {})
            video_urn = init_data.get('video', '')
            upload_instructions = init_data.get('uploadInstructions', [])
            upload_token = init_data.get('uploadToken', '')

            if not video_urn or not upload_instructions:
                return False, 'Video upload init returned no URN or instructions'

            # Step 2: Upload video in chunks
            etags = []
            with open(video_path, 'rb') as f:
                for instruction in upload_instructions:
                    upload_url = instruction.get('uploadUrl', '')
                    first_byte = instruction.get('firstByte', 0)
                    last_byte = instruction.get('lastByte', 0)
                    chunk_size = last_byte - first_byte + 1

                    f.seek(first_byte)
                    chunk_data = f.read(chunk_size)

                    chunk_resp = requests.put(
                        upload_url,
                        headers={
                            'Authorization': f'Bearer {access_token}',
                            'Content-Type': 'application/octet-stream',
                        },
                        data=chunk_data,
                        timeout=120
                    )

                    if chunk_resp.status_code not in [200, 201]:
                        return False, f'Video chunk upload failed: HTTP {chunk_resp.status_code}'

                    etag = chunk_resp.headers.get('ETag', chunk_resp.headers.get('etag', ''))
                    etags.append(etag)
                    logger.info(f'[LinkedIn] Video chunk uploaded: bytes {first_byte}-{last_byte}')

            # Step 3: Finalize upload
            finalize_resp = requests.post(
                f'{LI_REST_BASE}/videos?action=finalizeUpload',
                headers=_headers(access_token),
                json={
                    'finalizeUploadRequest': {
                        'video': video_urn,
                        'uploadToken': upload_token,
                        'uploadedPartIds': etags,
                    }
                },
                timeout=15
            )

            if finalize_resp.status_code not in [200, 204]:
                try:
                    error = finalize_resp.json() if finalize_resp.text else {}
                except ValueError:
                    error = {}
                return False, f"Video finalize failed: {error.get('message', f'HTTP {finalize_resp.status_code}')}"

            # Step 4: Poll until video is AVAILABLE (max 5 minutes)
            encoded_urn = requests.utils.quote(video_urn, safe='')
            max_polls = 30
            for i in range(max_polls):
                time.sleep(10)
                status_resp = requests.get(
                    f'{LI_REST_BASE}/videos/{encoded_urn}',
                    headers=_headers(access_token),
                    timeout=10
                )
                if status_resp.status_code == 200:
                    video_status = status_resp.json().get('status', '')
                    logger.info(f'[LinkedIn] Video status poll {i+1}: {video_status}')
                    if video_status == 'AVAILABLE':
                        break
                    elif video_status in ('FAILED', 'PROCESSING_FAILED'):
                        return False, 'Video processing failed on LinkedIn'
                else:
                    logger.warning(f'[LinkedIn] Video status poll failed: {status_resp.status_code}')
            else:
                return False, 'Video processing timed out (5 minutes)'

            # Step 5: Create post with video
            post_data = {
                'author': author_urn,
                'commentary': text[:3000],
                'visibility': 'PUBLIC',
                'distribution': {
                    'feedDistribution': 'MAIN_FEED',
                    'targetEntities': [],
                    'thirdPartyDistributionChannels': [],
                },
                'content': {
                    'media': {
                        'title': text[:100] if text else 'Video',
                        'id': video_urn,
                    }
                },
                'lifecycleState': 'PUBLISHED',
                'isReshareDisabledByAuthor': False,
            }

            resp = requests.post(
                f'{LI_REST_BASE}/posts',
                headers=_headers(access_token),
                json=post_data,
                timeout=15
            )

            if resp.status_code == 201:
                post_urn = resp.headers.get('x-restli-id', '')
                logger.info(f'[LinkedIn] Video post created: {post_urn}')
                return True, post_urn
            else:
                try:
                    error = resp.json() if resp.text else {}
                except ValueError:
                    error = {}
                return False, error.get('message', f'HTTP {resp.status_code}')

        except FileNotFoundError:
            logger.error(f'[LinkedIn] Video file not found: {video_path}')
            return False, f'Video file not found: {video_path}'
        except requests.ConnectionError:
            logger.error('[LinkedIn] Video post: network error')
            return False, 'Could not reach LinkedIn (network error)'
        except Exception as e:
            logger.error(f'[LinkedIn] Video post exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Fetch admin organizations
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def get_admin_organizations(access_token):
        """
        Fetch organizations the user is admin of.
        Returns: (success, list_of_orgs or error)
        """
        try:
            resp = requests.get(
                f'{LI_REST_BASE}/organizationAcls',
                params={
                    'q': 'roleAssignee',
                    'role': 'ADMINISTRATOR',
                    'state': 'APPROVED',
                },
                headers=_headers(access_token),
                timeout=15
            )

            if resp.status_code != 200:
                return False, f'HTTP {resp.status_code}'

            elements = resp.json().get('elements', [])
            orgs = []
            for el in elements:
                org_urn = el.get('organization', '')
                org_id = org_urn.split(':')[-1] if ':' in org_urn else ''
                orgs.append({
                    'urn': org_urn,
                    'id': org_id,
                    'role': el.get('role', ''),
                })

            return True, orgs

        except Exception as e:
            return False, str(e)
