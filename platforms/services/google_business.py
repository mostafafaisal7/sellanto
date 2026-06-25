"""
Google Business Profile Service
================================
Wraps the Google Business Profile API (formerly Google My Business).

The GBP API is split across several host services:
  - Account Management API   → mybusinessaccountmanagement.googleapis.com  (list accounts)
  - Business Information API  → mybusinessbusinessinformation.googleapis.com (list locations)
  - Posts (localPosts)       → mybusiness.googleapis.com/v4               (create Google Posts)

Auth: Bearer access_token (OAuth2). Scope: https://www.googleapis.com/auth/business.manage
Token refresh: standard Google OAuth2 refresh_token flow.

NOTE: The Business Profile APIs are access-restricted by Google. The OAuth/connect
and account/location listing work once the project has API access approved. The
localPosts create endpoint requires the same approval. Calls return clear errors
when access has not yet been granted (HTTP 403 PERMISSION_DENIED).
"""

import logging
import requests

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

ACCOUNT_MGMT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1'
BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
# Posts (localPosts) still live on the legacy v4 host.
MYBUSINESS_V4_BASE = 'https://mybusiness.googleapis.com/v4'

# Valid call-to-action button types for a Google Post.
VALID_CTA_TYPES = {
    'BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL',
}


def _headers(access_token):
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }


def _error_detail(resp):
    """Extract a human-readable error message from a Google API response."""
    try:
        data = resp.json()
        err = data.get('error', {})
        msg = err.get('message', '')
        status_str = err.get('status', '')
        if status_str == 'PERMISSION_DENIED':
            return (
                'Permission denied. Your Google Cloud project has not been granted '
                'access to the Business Profile API yet (or the location is not owned '
                'by this account). Request access in Google Cloud Console.'
            )
        return msg or f'HTTP {resp.status_code}'
    except ValueError:
        return f'HTTP {resp.status_code}'


class GoogleBusinessError(Exception):
    """Raised on Google Business Profile API failures."""


class GoogleBusinessService:

    # ──────────────────────────────────────────────────────────────────────────
    # Token Refresh (standard Google OAuth2)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def refresh_access_token(refresh_token, client_id, client_secret):
        """Refresh a Google access token. Returns (success, data_or_error)."""
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
            return False, data.get('error_description', data.get('error', 'Refresh failed'))

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Validation — list the user's GBP accounts
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def list_accounts(access_token):
        """
        List the authenticated user's Business Profile accounts.
        Returns: (success, [ {account_id, name, account_type}, ... ] or error_str)
        """
        try:
            resp = requests.get(
                f'{ACCOUNT_MGMT_BASE}/accounts',
                headers=_headers(access_token),
                timeout=15,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code != 200:
                return False, _error_detail(resp)

            data = resp.json()
            accounts = []
            for acc in data.get('accounts', []):
                # acc['name'] is like "accounts/123456789"
                resource = acc.get('name', '')
                accounts.append({
                    'account_id': resource,
                    'name': acc.get('accountName', '') or resource,
                    'account_type': acc.get('type', ''),
                    'verification_state': acc.get('verificationState', ''),
                })
            return True, accounts

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    @staticmethod
    def validate_credentials(access_token):
        """
        Validate token by listing accounts. Returns (success, {account_id, name} or error).
        Picks the first account as the primary one for the SocialAccount record.
        """
        ok, result = GoogleBusinessService.list_accounts(access_token)
        if not ok:
            return False, result
        if not result:
            return False, 'No Business Profile account found for this Google account.'
        first = result[0]
        return True, {
            'account_id': first['account_id'],
            'name': first['name'],
            'all_accounts': result,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # List locations under an account
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def list_locations(access_token, account_id):
        """
        List business locations under a GBP account.
        account_id: resource string like "accounts/123456789".
        Returns: (success, [ {location_id, title, address, ...}, ... ] or error_str)
        """
        try:
            # read_mask is required by the Business Information API.
            params = {
                'readMask': 'name,title,storefrontAddress,phoneNumbers,websiteUri',
                'pageSize': 100,
            }
            resp = requests.get(
                f'{BUSINESS_INFO_BASE}/{account_id}/locations',
                headers=_headers(access_token),
                params=params,
                timeout=15,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code != 200:
                return False, _error_detail(resp)

            data = resp.json()
            locations = []
            for loc in data.get('locations', []):
                addr = loc.get('storefrontAddress', {})
                address_lines = addr.get('addressLines', [])
                locality = addr.get('locality', '')
                full_address = ', '.join(filter(None, address_lines + [locality]))
                locations.append({
                    'location_id': loc.get('name', ''),  # "locations/123"
                    'title': loc.get('title', ''),
                    'address': full_address,
                    'phone': (loc.get('phoneNumbers', {}) or {}).get('primaryPhone', ''),
                    'website': loc.get('websiteUri', ''),
                })
            return True, locations

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Create a Google Post (localPost)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def create_post(access_token, account_id, location_id, summary,
                    image_url=None, cta_type=None, cta_url=None, phone=None):
        """
        Publish a Google Post to a business location.

        Args:
            account_id:  "accounts/123"
            location_id: "locations/456"
            summary:     Post text (max ~1500 chars).
            image_url:   Optional public image URL.
            cta_type:    One of VALID_CTA_TYPES (BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL).
            cta_url:     URL for the CTA button (required for non-CALL CTAs).
            phone:       Phone number (only meaningful for CALL CTA — set on the location).

        Returns: (success, {post_name, search_url} or error_str)

        The localPosts endpoint path is:
          POST /v4/{account}/{location}/localPosts
        where {location} is "locations/456".
        """
        if not summary or not summary.strip():
            return False, 'Post text (summary) is required.'

        body = {
            'languageCode': 'en',
            'summary': summary.strip()[:1500],
            'topicType': 'STANDARD',
        }

        if image_url:
            body['media'] = [{
                'mediaFormat': 'PHOTO',
                'sourceUrl': image_url,
            }]

        if cta_type:
            cta_type = cta_type.upper()
            if cta_type not in VALID_CTA_TYPES:
                return False, f'Invalid CTA type "{cta_type}". Must be one of: {", ".join(sorted(VALID_CTA_TYPES))}'
            call_to_action = {'actionType': cta_type}
            # CALL uses the location's phone; all others require a URL.
            if cta_type != 'CALL':
                if not cta_url:
                    return False, f'CTA type "{cta_type}" requires a URL (cta_url).'
                call_to_action['url'] = cta_url
            body['callToAction'] = call_to_action

        try:
            url = f'{MYBUSINESS_V4_BASE}/{account_id}/{location_id}/localPosts'
            resp = requests.post(
                url,
                headers=_headers(access_token),
                json=body,
                timeout=30,
            )

            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code not in (200, 201):
                return False, _error_detail(resp)

            data = resp.json()
            post_name = data.get('name', '')
            search_url = data.get('searchUrl', '')
            logger.info(f'[GBP] Post created: {post_name}')
            return True, {'post_name': post_name, 'search_url': search_url}

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            logger.error(f'[GBP] Post create exception: {e}')
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # List recent posts for a location
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def list_posts(access_token, account_id, location_id, page_size=20):
        """List recent local posts. Returns (success, [posts] or error_str)."""
        try:
            url = f'{MYBUSINESS_V4_BASE}/{account_id}/{location_id}/localPosts'
            resp = requests.get(
                url,
                headers=_headers(access_token),
                params={'pageSize': page_size},
                timeout=15,
            )
            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code != 200:
                return False, _error_detail(resp)

            data = resp.json()
            posts = []
            for p in data.get('localPosts', []):
                posts.append({
                    'name': p.get('name', ''),
                    'summary': p.get('summary', ''),
                    'state': p.get('state', ''),
                    'search_url': p.get('searchUrl', ''),
                    'create_time': p.get('createTime', ''),
                })
            return True, posts

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    # ──────────────────────────────────────────────────────────────────────────
    # Reviews
    # ──────────────────────────────────────────────────────────────────────────

    # Google returns star ratings as enum strings; map to integers for the UI.
    _STAR_MAP = {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5}

    @staticmethod
    def list_reviews(access_token, account_id, location_id, page_size=20):
        """
        List reviews for a location.
        Returns (success, [ {review_id, reviewer, star_rating, comment,
                             reply, create_time}, ... ] or error_str).

        Reviews live on the legacy v4 host:
          GET /v4/{account}/{location}/reviews
        """
        try:
            url = f'{MYBUSINESS_V4_BASE}/{account_id}/{location_id}/reviews'
            resp = requests.get(
                url,
                headers=_headers(access_token),
                params={'pageSize': page_size},
                timeout=15,
            )
            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code != 200:
                return False, _error_detail(resp)

            data = resp.json()
            reviews = []
            for r in data.get('reviews', []):
                reply = r.get('reviewReply', {}) or {}
                reviews.append({
                    'review_id': r.get('reviewId', '') or r.get('name', ''),
                    'name': r.get('name', ''),  # full resource path for replying
                    'reviewer': (r.get('reviewer', {}) or {}).get('displayName', 'Anonymous'),
                    'star_rating': GoogleBusinessService._STAR_MAP.get(r.get('starRating', ''), 0),
                    'comment': r.get('comment', ''),
                    'reply': reply.get('comment', ''),
                    'has_reply': bool(reply.get('comment')),
                    'create_time': r.get('createTime', ''),
                    'update_time': r.get('updateTime', ''),
                })
            return True, reviews

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            return False, str(e)

    @staticmethod
    def reply_to_review(access_token, review_name, reply_text):
        """
        Post (or update) the owner reply to a review.

        review_name: the full resource path, e.g.
          "accounts/123/locations/456/reviews/AbC..."
        Uses PUT /v4/{review_name}/reply.
        Returns (success, {comment, update_time} or error_str).
        """
        if not review_name:
            return False, 'Missing review identifier.'
        if not reply_text or not reply_text.strip():
            return False, 'Reply text is required.'

        try:
            url = f'{MYBUSINESS_V4_BASE}/{review_name}/reply'
            resp = requests.put(
                url,
                headers=_headers(access_token),
                json={'comment': reply_text.strip()[:4096]},
                timeout=20,
            )
            if resp.status_code == 401:
                return False, 'Token expired or revoked'
            if resp.status_code not in (200, 201):
                return False, _error_detail(resp)

            data = resp.json()
            return True, {
                'comment': data.get('comment', reply_text.strip()),
                'update_time': data.get('updateTime', ''),
            }

        except requests.Timeout:
            return False, 'Google API timed out'
        except requests.ConnectionError:
            return False, 'Could not reach Google (network error)'
        except Exception as e:
            logger.error(f'[GBP] Reply exception: {e}')
            return False, str(e)
