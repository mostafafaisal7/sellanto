# """
# Facebook Platform Integration
# Using your working code from api_test.py
# """
# import requests
# from datetime import datetime

# class FacebookService:
#     """Facebook Graph API Integration"""
    
#     API_VERSION = 'v18.0'
#     BASE_URL = f'https://graph.facebook.com/{API_VERSION}'
    
#     @staticmethod
#     def validate_credentials(page_id, access_token):
#         """
#         Validate Facebook Page credentials
#         Returns: (success: bool, account_name: str or error: str)
#         """
#         try:
#             url = f"{FacebookService.BASE_URL}/{page_id}"
#             params = {
#                 'fields': 'id,name,access_token',
#                 'access_token': access_token
#             }
            
#             response = requests.get(url, params=params)
#             result = response.json()
            
#             if 'error' in result:
#                 return False, result['error']['message']
            
#             page_name = result.get('name', 'Facebook Page')
#             return True, page_name
            
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def post_to_facebook(page_id, access_token, caption, media_url=None):
#         """
#         Post to Facebook Page
#         Your exact code from api_test.py
        
#         Args:
#             page_id: Facebook Page ID
#             access_token: Page Access Token
#             caption: Post caption/message
#             media_url: Optional image URL (must be publicly accessible)
        
#         Returns:
#             (success: bool, post_id: str or error: str)
#         """
#         try:
#             url = f"{FacebookService.BASE_URL}/{page_id}/feed"
            
#             payload = {
#                 'message': caption,
#                 'access_token': access_token
#             }
            
#             # Add image if provided
#             if media_url:
#                 payload['link'] = media_url
            
#             response = requests.post(url, data=payload)
#             result = response.json()
            
#             if 'id' in result:
#                 post_id = result['id']
#                 return True, post_id
#             else:
#                 error_msg = result.get('error', {}).get('message', 'Unknown error')
#                 return False, error_msg
                
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def post_photo(page_id, access_token, caption, photo_url):
#         """
#         Post photo to Facebook
        
#         Args:
#             page_id: Facebook Page ID
#             access_token: Page Access Token
#             caption: Photo caption
#             photo_url: Public URL of photo
        
#         Returns:
#             (success: bool, post_id: str or error: str)
#         """3
#         try:
#             url = f"{FacebookService.BASE_URL}/{page_id}/photos"
            
#             payload = {
#                 'url': photo_url,
#                 'caption': caption,
#                 'access_token': access_token
#             }
            
#             response = requests.post(url, data=payload)
#             result = response.json()
            
#             if 'id' in result:
#                 return True, result['id']
#             else:
#                 error_msg = result.get('error', {}).get('message', 'Unknown error')
#                 return False, error_msg
                
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def check_permissions(access_token):
#         """
#         Check token permissions
#         """
#         try:
#             url = f"{FacebookService.BASE_URL}/me/permissions"
#             params = {'access_token': access_token}
            
#             response = requests.get(url, params=params)
#             permissions = response.json().get('data', [])
            
#             granted = [p['permission'] for p in permissions if p.get('status') == 'granted']
            
#             required = ['pages_manage_posts', 'pages_read_engagement']
#             missing = [p for p in required if p not in granted]
            
#             return len(missing) == 0, granted, missing
            
#         except Exception as e:
#             return False, [], []


# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\services\facebook.py

"""
Facebook Service - Complete with Media Support
"""
import requests
import os


class FacebookService:

    @staticmethod
    def _get_page_token(page_id, access_token):
        """
        Ensure we have a Page Access Token. If a User token is passed,
        exchange it for the Page token automatically.
        """
        try:
            url = f"https://graph.facebook.com/v18.0/debug_token"
            params = {'input_token': access_token, 'access_token': access_token}
            r = requests.get(url, params=params, timeout=10)
            data = r.json().get('data', {})

            if data.get('type') == 'PAGE':
                return access_token

            # It's a User token - exchange for Page token
            page_url = f"https://graph.facebook.com/v18.0/{page_id}"
            page_params = {'fields': 'access_token', 'access_token': access_token}
            r2 = requests.get(page_url, params=page_params, timeout=10)
            page_data = r2.json()

            if 'access_token' in page_data:
                return page_data['access_token']
        except Exception:
            pass

        return access_token

    @staticmethod
    def post_to_facebook(page_id, access_token, message, media_path=None):
        """
        Post to Facebook - Text or Photo/Video
        
        Args:
            page_id: Facebook Page ID
            access_token: Page Access Token
            message: Post caption/message
            media_path: Optional path to image/video file
        
        Returns:
            (success: bool, post_id or error: str)
        """
        
        # Ensure we have a Page token
        access_token = FacebookService._get_page_token(page_id, access_token)

        # Check if media exists and post accordingly
        if media_path and os.path.exists(media_path):
            # Get file extension
            ext = os.path.splitext(media_path)[1].lower()
            
            if ext in ['.mp4', '.mov', '.avi']:
                # Video
                return FacebookService._post_video(page_id, access_token, message, media_path)
            else:
                # Photo
                return FacebookService._post_photo(page_id, access_token, message, media_path)
        else:
            # Text only
            return FacebookService._post_text(page_id, access_token, message)
    
    @staticmethod
    def _post_text(page_id, access_token, message):
        """Post text only"""
        url = f"https://graph.facebook.com/v18.0/{page_id}/feed"
        
        payload = {
            'message': message,
            'access_token': access_token
        }
        
        response = requests.post(url, data=payload)
        result = response.json()
        
        if 'id' in result:
            return True, result['id']
        else:
            error_msg = result.get('error', {}).get('message', 'Unknown error')
            return False, error_msg
    
    @staticmethod
    def _post_photo(page_id, access_token, caption, photo_path):
        """Post photo"""
        url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
        
        try:
            with open(photo_path, 'rb') as photo:
                files = {'source': photo}
                data = {
                    'caption': caption,
                    'access_token': access_token
                }
                
                response = requests.post(url, files=files, data=data)
                result = response.json()
            
            if 'id' in result:
                return True, result['id']
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                return False, error_msg
                
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def _post_video(page_id, access_token, description, video_path):
        """Post video"""
        url = f"https://graph.facebook.com/v18.0/{page_id}/videos"
        
        try:
            with open(video_path, 'rb') as video:
                files = {'source': video}
                data = {
                    'description': description,
                    'access_token': access_token
                }
                
                response = requests.post(url, files=files, data=data)
                result = response.json()
            
            if 'id' in result:
                return True, result['id']
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                return False, error_msg
                
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def validate_credentials(page_id, access_token):
        """Validate credentials"""
        url = f"https://graph.facebook.com/v18.0/{page_id}"
        params = {
            'fields': 'id,name',
            'access_token': access_token
        }
        
        response = requests.get(url, params=params)
        result = response.json()
        
        if 'error' in result:
            return False, result['error']['message']
        
        return True, result.get('name', 'Facebook Page')