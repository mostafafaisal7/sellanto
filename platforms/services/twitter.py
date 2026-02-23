# """
# Twitter/X Platform Integration
# Using your working code from test.py with tweepy
# """
# import tweepy

# class TwitterService:
#     """Twitter API Integration using tweepy"""
    
#     @staticmethod
#     def validate_credentials(api_key, api_secret, access_token, access_token_secret):
#         """
#         Validate Twitter credentials
#         Your exact code from test.py
        
#         Returns: (success: bool, username: str or error: str)
#         """
#         try:
#             client = tweepy.Client(
#                 consumer_key=api_key,
#                 consumer_secret=api_secret,
#                 access_token=access_token,
#                 access_token_secret=access_token_secret
#             )
            
#             # Get authenticated user
#             me = client.get_me()
            
#             if me.data:
#                 username = f"@{me.data.username}"
#                 return True, username
#             else:
#                 return False, "Failed to authenticate"
                
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def post_tweet(api_key, api_secret, access_token, access_token_secret, text, media_path=None):
#         """
#         Post tweet to Twitter/X
        
#         Args:
#             api_key: Twitter API Key
#             api_secret: Twitter API Secret
#             access_token: Twitter Access Token
#             access_token_secret: Twitter Access Token Secret
#             text: Tweet text (max 280 characters)
#             media_path: Optional local image path
        
#         Returns:
#             (success: bool, tweet_id: str or error: str)
#         """
#         try:
#             # Initialize client
#             client = tweepy.Client(
#                 consumer_key=api_key,
#                 consumer_secret=api_secret,
#                 access_token=access_token,
#                 access_token_secret=access_token_secret
#             )
            
#             # Post tweet
#             if media_path:
#                 # For media upload, need API v1.1
#                 auth = tweepy.OAuth1UserHandler(
#                     api_key, api_secret, 
#                     access_token, access_token_secret
#                 )
#                 api = tweepy.API(auth)
                
#                 # Upload media
#                 media = api.media_upload(media_path)
                
#                 # Post with media
#                 response = client.create_tweet(text=text, media_ids=[media.media_id])
#             else:
#                 # Text only
#                 response = client.create_tweet(text=text)
            
#             if response.data:
#                 tweet_id = response.data['id']
#                 return True, str(tweet_id)
#             else:
#                 return False, "Tweet creation failed"
                
#         except Exception as e:
#             return False, str(e)
    
#     @staticmethod
#     def get_tweet_url(username, tweet_id):
#         """Generate tweet URL"""
#         clean_username = username.replace('@', '')
#         return f"https://twitter.com/{clean_username}/status/{tweet_id}"

# C:\Users\Trust computer\Desktop\Final_version_socialSync\platforms\services\twitter.py
"""
Twitter Service - Text + Media Support
"""
import tweepy
import os


class TwitterService:
    
    @staticmethod
    def post_to_twitter(consumer_key, consumer_secret, access_token, access_token_secret, text, media_paths=None):
        """
        Post to Twitter with optional media
        
        Args:
            consumer_key: Twitter API key
            consumer_secret: Twitter API secret
            access_token: Twitter access token
            access_token_secret: Twitter access token secret
            text: Tweet text (max 280 characters)
            media_paths: List of local file paths (max 4 images or 1 video)
        """
        try:
            # Initialize Twitter client (v2)
            client = tweepy.Client(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )
            
            # Initialize API v1.1 for media upload
            auth = tweepy.OAuth1UserHandler(
                consumer_key,
                consumer_secret,
                access_token,
                access_token_secret
            )
            api = tweepy.API(auth)
            
            media_ids = []
            
            # Upload media if provided
            if media_paths and len(media_paths) > 0:
                for media_path in media_paths[:4]:  # Max 4 media files
                    if not os.path.exists(media_path):
                        continue
                    
                    try:
                        # Check if video or image
                        ext = os.path.splitext(media_path)[1].lower()
                        is_video = ext in ['.mp4', '.mov', '.avi']
                        
                        if is_video:
                            print(f"         Uploading video to Twitter...")
                            media = api.media_upload(
                                media_path,
                                media_category='tweet_video',
                                chunked=True
                            )
                        else:
                            print(f"         Uploading image to Twitter...")
                            media = api.media_upload(media_path)
                        
                        media_ids.append(media.media_id)
                        print(f"         ✓ Media uploaded: {media.media_id}")
                        
                    except Exception as e:
                        print(f"         ⚠️ Media upload failed: {str(e)}")
                        continue
            
            # Post tweet
            print(f"         Posting tweet...")
            
            if media_ids:
                response = client.create_tweet(text=text, media_ids=media_ids)
            else:
                response = client.create_tweet(text=text)
            
            if response.data:
                tweet_id = response.data['id']
                print(f"         ✅ Tweet posted: {tweet_id}")
                return True, tweet_id
            else:
                return False, 'No response from Twitter'
            
        except Exception as e:
            error_msg = str(e)
            print(f"         ❌ Twitter error: {error_msg}")
            return False, error_msg
    
    @staticmethod
    def validate_credentials(consumer_key, consumer_secret, access_token, access_token_secret):
        """Validate Twitter credentials"""
        try:
            client = tweepy.Client(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )
            
            # Get authenticated user
            me = client.get_me()
            
            if me.data:
                username = f"@{me.data.username}"
                return True, username
            else:
                return False, 'Could not verify credentials'
            
        except Exception as e:
            return False, str(e)