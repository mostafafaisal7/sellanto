# """
# LinkedIn Platform Integration
# Using your working code from linkedin_auth.py
# """
# import requests

# class LinkedInService:
#     """LinkedIn API Integration"""
    
#     BASE_URL = 'https://api.linkedin.com/v2'
    
#     @staticmethod
#     def validate_credentials(access_token, person_urn=None):
#         """
#         Validate LinkedIn credentials
#         Your approach from linkedin_auth.py
        
#         Returns: (success: bool, name: str or error: str)
#         """
#         try:
#             headers = {'Authorization': f'Bearer {access_token}'}
#             response = requests.get('https://api.linkedin.com/v2/userinfo', headers=headers)
#             profile = response.json()
            
#             if 'error' in profile:
#                 return False, profile.get('error_description', 'Unknown error')
            
#             name = profile.get('name', 'LinkedIn User')
            
#             # Extract person URN if not provided
#             if not person_urn:
#                 person_urn = profile.get('sub', '')
            
#             return True, name
            
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def post_to_linkedin(access_token, person_urn, text, media_url=None):
#         """
#         Post to LinkedIn
        
#         Args:
#             access_token: LinkedIn Access Token
#             person_urn: Person URN (from profile)
#             text: Post text
#             media_url: Optional image URL
        
#         Returns:
#             (success: bool, post_id: str or error: str)
#         """
#         try:
#             headers = {
#                 'Authorization': f'Bearer {access_token}',
#                 'Content-Type': 'application/json'
#             }
            
#             url = f'{LinkedInService.BASE_URL}/ugcPosts'
            
#             # Build post data
#             post_data = {
#                 'author': f'urn:li:person:{person_urn}',
#                 'lifecycleState': 'PUBLISHED',
#                 'specificContent': {
#                     'com.linkedin.ugc.ShareContent': {
#                         'shareCommentary': {
#                             'text': text
#                         },
#                         'shareMediaCategory': 'NONE'
#                     }
#                 },
#                 'visibility': {
#                     'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
#                 }
#             }
            
#             # Add media if provided
#             if media_url:
#                 post_data['specificContent']['com.linkedin.ugc.ShareContent']['shareMediaCategory'] = 'IMAGE'
#                 post_data['specificContent']['com.linkedin.ugc.ShareContent']['media'] = [
#                     {
#                         'status': 'READY',
#                         'originalUrl': media_url
#                     }
#                 ]
            
#             response = requests.post(url, headers=headers, json=post_data)
#             result = response.json()
            
#             if response.status_code == 201:
#                 post_id = result.get('id', '')
#                 return True, post_id
#             else:
#                 error_msg = result.get('message', 'Unknown error')
#                 return False, error_msg
                
#         except Exception as e:
#             return False, str(e)

# v2

# """
# LinkedIn Service - YOUR EXACT WORKING CODE
# """
# import requests

# class LinkedInService:
    
#     @staticmethod
#     def post_to_linkedin(access_token, person_urn, text):
#         """YOUR exact LinkedIn code from linkedin_auth.py"""
#         try:
#             headers = {
#                 'Authorization': f'Bearer {access_token}',
#                 'Content-Type': 'application/json'
#             }
            
#             url = 'https://api.linkedin.com/v2/ugcPosts'
            
#             post_data = {
#                 'author': f'urn:li:person:{person_urn}',
#                 'lifecycleState': 'PUBLISHED',
#                 'specificContent': {
#                     'com.linkedin.ugc.ShareContent': {
#                         'shareCommentary': {
#                             'text': text
#                         },
#                         'shareMediaCategory': 'NONE'
#                     }
#                 },
#                 'visibility': {
#                     'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
#                 }
#             }
            
#             response = requests.post(url, headers=headers, json=post_data)
#             result = response.json()
            
#             if response.status_code == 201:
#                 post_id = result.get('id', '')
#                 return True, post_id
#             else:
#                 error_msg = result.get('message', 'Unknown error')
#                 return False, error_msg
                
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def validate_credentials(access_token, person_urn=None):
#         """Validate LinkedIn credentials"""
#         headers = {'Authorization': f'Bearer {access_token}'}
#         response = requests.get('https://api.linkedin.com/v2/userinfo', headers=headers)
#         profile = response.json()
        
#         if 'error' in profile:
#             return False, profile.get('error_description', 'Unknown error')
        
#         name = profile.get('name', 'LinkedIn User')
#         return True, name

# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\services\linkedin.py

"""
LinkedIn Service - With Image/Video Support
"""
import requests
import base64


class LinkedInService:
    
    @staticmethod
    def post_to_linkedin(access_token, person_urn, text, image_path=None):
        """
        Post to LinkedIn with optional image
        
        Args:
            access_token: LinkedIn OAuth token
            person_urn: Person URN (from sub field in /v2/userinfo)
            text: Post text
            image_path: Optional path to image file
        
        Returns:
            (success: bool, post_id or error: str)
        """
        
        # If image provided, post with image
        if image_path:
            return LinkedInService._post_with_image(access_token, person_urn, text, image_path)
        else:
            return LinkedInService._post_text(access_token, person_urn, text)
    
    @staticmethod
    def _post_text(access_token, person_urn, text):
        """Post text only"""
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            url = 'https://api.linkedin.com/v2/ugcPosts'
            
            post_data = {
                'author': f'urn:li:person:{person_urn}',
                'lifecycleState': 'PUBLISHED',
                'specificContent': {
                    'com.linkedin.ugc.ShareContent': {
                        'shareCommentary': {
                            'text': text
                        },
                        'shareMediaCategory': 'NONE'
                    }
                },
                'visibility': {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            }
            
            response = requests.post(url, headers=headers, json=post_data)
            result = response.json()
            
            if response.status_code == 201:
                post_id = result.get('id', '')
                return True, post_id
            else:
                error_msg = result.get('message', 'Unknown error')
                return False, error_msg
                
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def _post_with_image(access_token, person_urn, text, image_path):
        """Post with image - LinkedIn Media Upload"""
        
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            # Step 1: Register upload
            register_url = 'https://api.linkedin.com/v2/assets?action=registerUpload'
            
            register_data = {
                'registerUploadRequest': {
                    'recipes': ['urn:li:digitalmediaRecipe:feedshare-image'],
                    'owner': f'urn:li:person:{person_urn}',
                    'serviceRelationships': [{
                        'relationshipType': 'OWNER',
                        'identifier': 'urn:li:userGeneratedContent'
                    }]
                }
            }
            
            register_response = requests.post(register_url, headers=headers, json=register_data)
            register_result = register_response.json()
            
            if register_response.status_code != 200:
                error = register_result.get('message', 'Registration failed')
                return False, f"Upload registration failed: {error}"
            
            # Get upload URL and asset
            upload_url = register_result['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
            asset = register_result['value']['asset']
            
            # Step 2: Upload image
            with open(image_path, 'rb') as image_file:
                image_data = image_file.read()
            
            upload_headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            upload_response = requests.put(upload_url, headers=upload_headers, data=image_data)
            
            if upload_response.status_code not in [200, 201]:
                return False, f"Image upload failed: {upload_response.status_code}"
            
            # Step 3: Create post with image
            post_url = 'https://api.linkedin.com/v2/ugcPosts'
            
            post_data = {
                'author': f'urn:li:person:{person_urn}',
                'lifecycleState': 'PUBLISHED',
                'specificContent': {
                    'com.linkedin.ugc.ShareContent': {
                        'shareCommentary': {
                            'text': text
                        },
                        'shareMediaCategory': 'IMAGE',
                        'media': [{
                            'status': 'READY',
                            'media': asset
                        }]
                    }
                },
                'visibility': {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            }
            
            post_response = requests.post(post_url, headers=headers, json=post_data)
            post_result = post_response.json()
            
            if post_response.status_code == 201:
                post_id = post_result.get('id', '')
                return True, post_id
            else:
                error_msg = post_result.get('message', 'Unknown error')
                return False, error_msg
                
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def validate_credentials(access_token, person_urn=None):
        """Validate LinkedIn credentials"""
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get('https://api.linkedin.com/v2/userinfo', headers=headers)
        profile = response.json()
        
        if 'error' in profile:
            return False, profile.get('error_description', 'Unknown error')
        
        name = profile.get('name', 'LinkedIn User')
        return True, name