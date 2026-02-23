# Version: 1
# Perfectly fine code. No changes needed for Image upload to Instagram via Facebook Graph API.


# """
# Instagram Service - Using Facebook URL (Working Logic from main.py)
# """
# import requests
# import time


# class InstagramService:
    
#     @staticmethod
#     def post_to_instagram(access_token, business_account_id, caption, image_path, page_id, page_access_token):
#         """
#         Post to Instagram using Facebook upload (YOUR working logic)
        
#         Args:
#             access_token: Instagram access token (same as FB)
#             business_account_id: Instagram Business Account ID
#             caption: Post caption
#             image_path: Local file path to image
#             page_id: Facebook Page ID (needed for upload)
#             page_access_token: Facebook Page Access Token
#         """
#         try:
#             print(f"         Instagram Posting - YOUR Working Logic...")
#             print(f"         Step 1: Upload to Facebook first...")
            
#             # Step 1: Upload image to Facebook Page (unpublished)
#             upload_url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
            
#             with open(image_path, 'rb') as photo:
#                 files = {'source': photo}
#                 payload = {
#                     'access_token': page_access_token,
#                     'published': 'false'  # Keep unpublished
#                 }
                
#                 upload_response = requests.post(upload_url, data=payload, files=files, timeout=60)
            
#             upload_data = upload_response.json()
#             print(f"         Upload response: {upload_data}")
            
#             if upload_response.status_code not in [200, 201]:
#                 error_msg = upload_data.get('error', {}).get('message', 'Upload failed')
#                 return False, f'Facebook upload failed: {error_msg}'
            
#             fb_media_id = upload_data.get('id')
#             if not fb_media_id:
#                 return False, 'No media ID from Facebook'
            
#             print(f"         ✓ Uploaded to FB: {fb_media_id}")
            
#             # Step 2: Get image URL from Facebook
#             image_info_url = f"https://graph.facebook.com/v18.0/{fb_media_id}?fields=images&access_token={page_access_token}"
#             image_info_response = requests.get(image_info_url, timeout=30)
#             image_info = image_info_response.json()
            
#             print(f"         Image info: {image_info}")
            
#             # Get highest resolution image URL
#             images = image_info.get('images', [])
#             if images:
#                 image_url = images[0].get('source')
#             else:
#                 # Fallback to picture endpoint
#                 image_url = f"https://graph.facebook.com/{fb_media_id}/picture?type=large&access_token={page_access_token}"
            
#             if not image_url:
#                 return False, 'Failed to get image URL from Facebook'
            
#             print(f"         ✓ Image URL: {image_url}")
            
#             # Step 3: Create Instagram container
#             container_url = f"https://graph.facebook.com/v18.0/{business_account_id}/media"
            
#             container_payload = {
#                 'image_url': image_url,  # Facebook URL!
#                 'caption': caption,
#                 'access_token': access_token
#             }
            
#             print(f"         Step 2: Creating Instagram container...")
#             container_response = requests.post(container_url, data=container_payload, timeout=60)
#             container_data = container_response.json()
            
#             print(f"         Container response: {container_data}")
            
#             if 'id' not in container_data:
#                 error_msg = container_data.get('error', {}).get('message', 'Container creation failed')
#                 return False, error_msg
            
#             container_id = container_data['id']
#             print(f"         ✓ Container created: {container_id}")
            
#             # Step 4: Wait for processing
#             print(f"         Step 3: Waiting 10 seconds...")
#             time.sleep(10)
            
#             # Step 5: Publish
#             publish_url = f"https://graph.facebook.com/v18.0/{business_account_id}/media_publish"
            
#             publish_payload = {
#                 'creation_id': container_id,
#                 'access_token': access_token
#             }
            
#             print(f"         Step 4: Publishing...")
#             publish_response = requests.post(publish_url, data=publish_payload, timeout=60)
#             publish_data = publish_response.json()
            
#             print(f"         Publish response: {publish_data}")
            
#             if 'id' in publish_data:
#                 post_id = publish_data['id']
#                 print(f"         ✅ SUCCESS! Post ID: {post_id}")
#                 return True, post_id
#             else:
#                 error_msg = publish_data.get('error', {}).get('message', 'Publish failed')
#                 return False, error_msg
            
#         except Exception as e:
#             error_msg = f"Exception: {str(e)}"
#             print(f"         ❌ {error_msg}")
#             return False, error_msg
    
#     @staticmethod
#     def validate_credentials(access_token, business_account_id):
#         """Validate Instagram credentials"""
#         try:
#             url = f"https://graph.facebook.com/v18.0/{business_account_id}"
#             params = {
#                 'fields': 'username,profile_picture_url',
#                 'access_token': access_token
#             }
            
#             response = requests.get(url, params=params)
#             result = response.json()
            
#             if 'error' in result:
#                 return False, result['error']['message']
            
#             username = f"@{result.get('username', 'instagram')}"
#             return True, username
            
#         except Exception as e:
#             return False, str(e)


# =================================================================
# version 2:

# tring to added img and video both

# =================================================================



# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\services\instagram.py
"""
Instagram Service - Image + Video (REELS) Support
Based on YOUR working main.py logic
"""
import requests
import time
import os


class InstagramService:
    
    @staticmethod
    def post_to_instagram(access_token, business_account_id, caption, media_path, page_id, page_access_token):
        """
        Post to Instagram - Image OR Video (REELS)
        
        Args:
            access_token: Instagram access token
            business_account_id: Instagram Business Account ID
            caption: Post caption
            media_path: Local file path to image/video
            page_id: Facebook Page ID
            page_access_token: Facebook Page Access Token
        """
        try:
            # Detect media type
            ext = os.path.splitext(media_path)[1].lower()
            is_video = ext in ['.mp4', '.mov', '.avi']
            
            print(f"         {'🎥 VIDEO' if is_video else '📸 IMAGE'} Detected: {ext}")
            print(f"         Instagram Posting - YOUR Working Logic...")
            print(f"         Step 1: Upload to Facebook first...")
            
            # Step 1: Upload to Facebook Page (unpublished)
            if is_video:
                upload_url = f"https://graph.facebook.com/v18.0/{page_id}/videos"
                print(f"         Uploading VIDEO to Facebook...")
            else:
                upload_url = f"https://graph.facebook.com/v18.0/{page_id}/photos"
                print(f"         Uploading IMAGE to Facebook...")
            
            with open(media_path, 'rb') as media_file:
                files = {'source': media_file}
                payload = {
                    'access_token': page_access_token,
                    'published': 'false'  # Keep unpublished
                }
                
                upload_response = requests.post(upload_url, data=payload, files=files, timeout=300)
            
            upload_data = upload_response.json()
            print(f"         Upload response: {upload_data}")
            
            if upload_response.status_code not in [200, 201]:
                error_msg = upload_data.get('error', {}).get('message', 'Upload failed')
                return False, f'Facebook upload failed: {error_msg}'
            
            fb_media_id = upload_data.get('id')
            if not fb_media_id:
                return False, 'No media ID from Facebook'
            
            print(f"         ✓ Uploaded to FB: {fb_media_id}")
            
             # Step 2: Get media URL from Facebook
            if is_video:
                # For videos, MUST wait for processing to complete!
                print(f"         Waiting for video processing...")
                
                # Poll video status until ready
                max_attempts = 12  # 2 minutes max
                attempt = 0
                video_ready = False
                
                while attempt < max_attempts and not video_ready:
                    time.sleep(10)  # Wait 10 seconds between checks
                    attempt += 1
                    
                    video_info_url = f"https://graph.facebook.com/v18.0/{fb_media_id}?fields=source,permalink_url,status&access_token={page_access_token}"
                    video_info_response = requests.get(video_info_url, timeout=30)
                    video_info = video_info_response.json()
                    
                    print(f"         Attempt {attempt}: Checking video status...")
                    
                    # Check processing status
                    status = video_info.get('status', {})
                    video_status = status.get('video_status', 'unknown')
                    
                    print(f"         Video status: {video_status}")
                    
                    if video_status == 'ready':
                        video_ready = True
                        print(f"         ✅ Video is READY!")
                        break
                    elif video_status == 'processing':
                        progress = status.get('processing_progress', 0)
                        print(f"         ⏳ Still processing... ({progress}%)")
                        continue
                    elif video_status == 'error':
                        return False, 'Facebook video processing failed'
                
                if not video_ready:
                    return False, 'Video processing timeout (2 minutes)'
                
                # NOW get the video URL
                print(f"         Getting video URL...")
                video_info_url = f"https://graph.facebook.com/v18.0/{fb_media_id}?fields=source&access_token={page_access_token}"
                video_info_response = requests.get(video_info_url, timeout=30)
                video_info = video_info_response.json()
                
                print(f"         Video info: {video_info}")
                
                # Get video source URL
                media_url = video_info.get('source')
                
                if not media_url:
                    return False, 'Failed to get video source URL from Facebook'
                
                print(f"         ✓ Video URL: {media_url[:100]}...")
                
            else:
                # For images
                image_info_url = f"https://graph.facebook.com/v18.0/{fb_media_id}?fields=images&access_token={page_access_token}"
                image_info_response = requests.get(image_info_url, timeout=30)
                image_info = image_info_response.json()
                
                print(f"         Image info: {image_info}")
                
                # Get highest resolution
                images = image_info.get('images', [])
                if images:
                    media_url = images[0].get('source')
                else:
                    media_url = f"https://graph.facebook.com/{fb_media_id}/picture?type=large&access_token={page_access_token}"
                
                print(f"         ✓ Image URL: {media_url[:100]}...")
            
            # Step 3: Create Instagram container
            container_url = f"https://graph.facebook.com/v18.0/{business_account_id}/media"
            
            container_payload = {
                'caption': caption,
                'access_token': access_token
            }
            
            if is_video:
                # CRITICAL: Use REELS for videos!
                container_payload['media_type'] = 'REELS'
                container_payload['video_url'] = media_url
                container_payload['share_to_feed'] = True
                print(f"         Creating REELS container...")
            else:
                container_payload['media_type'] = 'IMAGE'
                container_payload['image_url'] = media_url
                print(f"         Creating IMAGE container...")
            
            container_response = requests.post(container_url, data=container_payload, timeout=60)
            container_data = container_response.json()
            
            print(f"         Container response: {container_data}")
            
            if 'id' not in container_data:
                error_msg = container_data.get('error', {}).get('message', 'Container creation failed')
                return False, error_msg
            
            container_id = container_data['id']
            print(f"         ✓ Container created: {container_id}")
            
            # Step 4: Wait for processing
            wait_time = 60 if is_video else 10
            print(f"         Waiting {wait_time} seconds for processing...")
            time.sleep(wait_time)
            
            # Check status WITH full error details
            status_url = f"https://graph.facebook.com/v18.0/{container_id}?fields=status_code,status,error_message&access_token={access_token}"
            status_response = requests.get(status_url, timeout=30)
            status_data = status_response.json()
            
            print(f"         === FULL STATUS RESPONSE ===")
            print(f"         {status_data}")
            print(f"         ===========================")
            
            status_code = status_data.get('status_code')
            
            if status_code == 'ERROR':
                # Try to get detailed error
                error_message = status_data.get('error_message', 'Unknown error')
                status_obj = status_data.get('status', {})
                
                print(f"         ❌ ERROR DETAILS:")
                print(f"            - Error Message: {error_message}")
                print(f"            - Status Object: {status_obj}")
                
                # Build comprehensive error message
                if error_message and error_message != 'Unknown error':
                    return False, f'Instagram error: {error_message}'
                elif status_obj:
                    return False, f'Instagram error: {status_obj}'
                else:
                    return False, 'Instagram media processing failed (no details available)'
                    
            elif status_code == 'IN_PROGRESS':
                print(f"         Still processing, waiting 30 more seconds...")
                time.sleep(30)
                
                # Check again with full details
                status_response = requests.get(status_url, timeout=30)
                status_data = status_response.json()
                status_code = status_data.get('status_code')
                
                print(f"         === RETRY STATUS ===")
                print(f"         {status_data}")
                print(f"         ===================")
                
                if status_code == 'ERROR':
                    error_message = status_data.get('error_message', 'Processing failed')
                    return False, f'Instagram error: {error_message}'
                elif status_code != 'FINISHED':
                    return False, f'Instagram processing incomplete: {status_code}'
            
            # Step 5: Publish
            publish_url = f"https://graph.facebook.com/v18.0/{business_account_id}/media_publish"
            
            publish_payload = {
                'creation_id': container_id,
                'access_token': access_token
            }
            
            print(f"         Publishing to Instagram...")
            publish_response = requests.post(publish_url, data=publish_payload, timeout=60)
            publish_data = publish_response.json()
            
            print(f"         Publish response: {publish_data}")
            
            if 'id' in publish_data:
                post_id = publish_data['id']
                print(f"         ✅ SUCCESS! Post ID: {post_id}")
                return True, post_id
            else:
                error_msg = publish_data.get('error', {}).get('message', 'Publish failed')
                return False, error_msg
            
        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            print(f"         ❌ {error_msg}")
            return False, error_msg
    
    @staticmethod
    def post_comment(access_token, media_id, text):
        """Post a comment on an Instagram media object (for first-comment hashtags).

        Args:
            access_token: Instagram/Facebook access token
            media_id: The Instagram media ID returned after publishing
            text: Comment text (e.g. hashtags)

        Returns:
            tuple: (success: bool, comment_id_or_error: str)
        """
        try:
            url = f"https://graph.facebook.com/v18.0/{media_id}/comments"
            payload = {
                'message': text,
                'access_token': access_token,
            }
            response = requests.post(url, data=payload, timeout=30)
            data = response.json()

            if 'id' in data:
                return True, data['id']
            else:
                error_msg = data.get('error', {}).get('message', 'Comment failed')
                return False, error_msg
        except Exception as e:
            return False, str(e)

    @staticmethod
    def validate_credentials(access_token, business_account_id):
        """Validate Instagram credentials"""
        try:
            url = f"https://graph.facebook.com/v18.0/{business_account_id}"
            params = {
                'fields': 'username,profile_picture_url',
                'access_token': access_token
            }
            
            response = requests.get(url, params=params)
            result = response.json()
            
            if 'error' in result:
                return False, result['error']['message']
            
            username = f"@{result.get('username', 'instagram')}"
            return True, username
            
        except Exception as e:
            return False, str(e)