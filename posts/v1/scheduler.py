# """
# Post Scheduler Service
# Automatically posts scheduled posts at their scheduled time
# """

# from django.utils import timezone
# from .models import Post
# from platforms.models import SocialAccount
# from platforms.services.facebook import FacebookService
# from platforms.services.twitter import TwitterService
# from platforms.services.instagram import InstagramService
# from platforms.services.linkedin import LinkedInService
# import logging

# logger = logging.getLogger(__name__)


# def process_scheduled_posts():
#     """
#     Process all posts that are due to be posted
#     Called by scheduler every minute
#     """
    
#     # Get posts due for posting
#     now = timezone.now()
#     due_posts = Post.objects.filter(
#         status='scheduled',
#         scheduled_time__lte=now
#     )
    
#     logger.info(f"Found {due_posts.count()} posts due for posting")
    
#     for post in due_posts:
#         try:
#             post_to_platforms(post)
#         except Exception as e:
#             logger.error(f"Error processing post {post.id}: {str(e)}")


# def post_to_platforms(post):
#     """Post to all selected platforms"""
    
#     logger.info(f"Processing post {post.id} for user {post.user.username}")
    
#     # Mark as posting
#     post.status = 'posting'
#     post.save()
    
#     platforms = post.platforms_list
#     success_count = 0
#     error_count = 0
    
#     for platform in platforms:
#         try:
#             # Get user's account for this platform
#             account = SocialAccount.objects.get(
#                 user=post.user,
#                 platform=platform,
#                 is_active=True
#             )
            
#             # Post to platform
#             success = False
            
#             if platform == 'facebook':
#                 success = post_to_facebook(post, account)
#             elif platform == 'twitter':
#                 success = post_to_twitter(post, account)
#             elif platform == 'instagram':
#                 success = post_to_instagram(post, account)
#             elif platform == 'linkedin':
#                 success = post_to_linkedin(post, account)
            
#             if success:
#                 success_count += 1
#             else:
#                 error_count += 1
                
#         except SocialAccount.DoesNotExist:
#             logger.error(f"No active account for {platform}")
#             error_count += 1
#         except Exception as e:
#             logger.error(f"Error posting to {platform}: {str(e)}")
#             error_count += 1
    
#     # Update post status
#     if success_count > 0 and error_count == 0:
#         post.status = 'posted'
#         post.posted_at = timezone.now()
#     elif success_count > 0 and error_count > 0:
#         post.status = 'posted'  # Partial success
#         post.posted_at = timezone.now()
#     else:
#         post.status = 'failed'
    
#     post.save()
    
#     logger.info(f"Post {post.id} completed: {success_count} success, {error_count} errors")


# def post_to_facebook(post, account):
#     """Post to Facebook"""
#     try:
#         creds = account.get_credentials()
        
#         # Get media URL if exists
#         media_url = None
#         if post.media_files_list:
#             # TODO: Convert local path to public URL
#             pass
        
#         success, result = FacebookService.post_to_facebook(
#             creds['page_id'],
#             creds['access_token'],
#             post.caption,
#             media_url
#         )
        
#         if success:
#             post.facebook_post_id = result
#             post.facebook_error = None
#             post.save()
#             logger.info(f"Posted to Facebook: {result}")
#             return True
#         else:
#             post.facebook_error = result
#             post.save()
#             logger.error(f"Facebook error: {result}")
#             return False
            
#     except Exception as e:
#         post.facebook_error = str(e)
#         post.save()
#         logger.error(f"Facebook exception: {str(e)}")
#         return False


# def post_to_twitter(post, account):
#     """Post to Twitter"""
#     try:
#         creds = account.get_credentials()
        
#         # Twitter has 280 char limit
#         caption = post.caption[:280]
        
#         success, result = TwitterService.post_tweet(
#             creds['api_key'],
#             creds['api_secret'],
#             creds['access_token'],
#             creds['access_token_secret'],
#             caption
#         )
        
#         if success:
#             post.twitter_post_id = result
#             post.twitter_error = None
#             post.save()
#             logger.info(f"Posted to Twitter: {result}")
#             return True
#         else:
#             post.twitter_error = result
#             post.save()
#             logger.error(f"Twitter error: {result}")
#             return False
            
#     except Exception as e:
#         post.twitter_error = str(e)
#         post.save()
#         logger.error(f"Twitter exception: {str(e)}")
#         return False


# def post_to_instagram(post, account):
#     """Post to Instagram"""
#     try:
#         creds = account.get_credentials()
        
#         # Instagram requires image URL
#         if not post.media_files_list:
#             post.instagram_error = "Instagram requires an image"
#             post.save()
#             return False
        
#         # TODO: Convert local media to public URL
#         image_url = "https://placeholder.com/image.jpg"  # Placeholder
        
#         success, result = InstagramService.post_to_instagram(
#             creds['access_token'],
#             creds['business_account_id'],
#             post.caption,
#             image_url
#         )
        
#         if success:
#             post.instagram_post_id = result
#             post.instagram_error = None
#             post.save()
#             logger.info(f"Posted to Instagram: {result}")
#             return True
#         else:
#             post.instagram_error = result
#             post.save()
#             logger.error(f"Instagram error: {result}")
#             return False
            
#     except Exception as e:
#         post.instagram_error = str(e)
#         post.save()
#         logger.error(f"Instagram exception: {str(e)}")
#         return False


# def post_to_linkedin(post, account):
#     """Post to LinkedIn"""
#     try:
#         creds = account.get_credentials()
        
#         success, result = LinkedInService.post_to_linkedin(
#             creds['access_token'],
#             creds['person_urn'],
#             post.caption
#         )
        
#         if success:
#             post.linkedin_post_id = result
#             post.linkedin_error = None
#             post.save()
#             logger.info(f"Posted to LinkedIn: {result}")
#             return True
#         else:
#             post.linkedin_error = result
#             post.save()
#             logger.error(f"LinkedIn error: {result}")
#             return False
            
#     except Exception as e:
#         post.linkedin_error = str(e)
#         post.save()
#         logger.error(f"LinkedIn exception: {str(e)}")
#         return False


# C:\Users\Trust computer\Desktop\Final_version_socialSync\posts\scheduler.py
"""
Auto Scheduler - YOUR main.py logic automated
Runs in background with Django server
"""

from django.utils import timezone
from .models import Post
from platforms.models import SocialAccount
from platforms.services.facebook import FacebookService
from platforms.services.twitter import TwitterService
from platforms.services.linkedin import LinkedInService
from platforms.services.instagram import InstagramService  # ← ADD THIS LINE!
from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings
import os
import pytz


# Global scheduler
scheduler = None


def start_scheduler():
    """Start background scheduler"""
    global scheduler
    
    if scheduler is not None:
        return
    
    scheduler = BackgroundScheduler()
    
    # Check every minute
    scheduler.add_job(
        check_and_post,
        'interval',
        minutes=1,
        id='auto_poster',
        replace_existing=True
    )
    
    scheduler.start()
    print("⏰ Auto-posting scheduler active (checks every 60 seconds)")


def check_and_post():
    """Check for due posts - SIMPLE VERSION"""
    
    from datetime import datetime
    
    # Get current UTC time
    now = timezone.now()
    
    # Debug: Print times
    print(f"\n[CHECK] Current UTC: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get all scheduled posts
    all_scheduled = Post.objects.filter(status='scheduled')
    
    print(f"[CHECK] Total scheduled posts: {all_scheduled.count()}")
    
    # Check each post
    for post in all_scheduled:
        print(f"  Post #{post.id}:")
        print(f"    Scheduled (UTC): {post.scheduled_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"    Current (UTC):   {now.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"    Due? {post.scheduled_time <= now}")
    
    # Get due posts
    due_posts = Post.objects.filter(
        status='scheduled',
        scheduled_time__lte=now
    )
    
    count = due_posts.count()
    
    if count == 0:
        print(f"[CHECK] No posts due yet\n")
        return
    
    print(f"\n📤 POSTING {count} POST(S)...")
    print("="*70)
    
    for post in due_posts:
        publish_post(post)



def post_facebook(post, account, caption, media_files):
    """Post to Facebook with error details"""
    
    page_id = account.facebook_page_id
    access_token = account.facebook_access_token
    
    # Get media path
    media_path = None
    if media_files and len(media_files) > 0:
        media_file = media_files[0]
        full_path = os.path.join(settings.MEDIA_ROOT, media_file)
        
        if os.path.exists(full_path):
            media_path = full_path
    
    try:
        # Call Facebook service
        success, result = FacebookService.post_to_facebook(
            page_id,
            access_token,
            caption,
            media_path
        )
        
        if success:
            post.facebook_post_id = result
            post.facebook_error = None
            post.save()
            return True, None
        else:
            post.facebook_error = result
            post.save()
            return False, result
            
    except Exception as e:
        error_msg = str(e)
        post.facebook_error = error_msg
        post.save()
        return False, error_msg


def post_twitter(post, account, caption, media_files):
    """Post to Twitter with media support"""
    
    consumer_key = account.twitter_api_key
    consumer_secret = account.twitter_api_secret
    access_token = account.twitter_access_token
    access_token_secret = account.twitter_access_token_secret
    
    # Prepare media paths
    media_paths = []
    if media_files:
        for media_file in media_files[:4]:  # Twitter max 4 media
            full_path = os.path.join(settings.MEDIA_ROOT, media_file)
            if os.path.exists(full_path):
                media_paths.append(full_path)
    
    # Truncate caption to 280 characters
    tweet_text = caption[:280] if len(caption) > 280 else caption
    
    try:
        from platforms.services.twitter import TwitterService
        
        success, result = TwitterService.post_to_twitter(
            consumer_key,
            consumer_secret,
            access_token,
            access_token_secret,
            tweet_text,
            media_paths
        )
        
        if success:
            post.twitter_post_id = result
            post.twitter_error = None
            post.save()
            return True, None
        else:
            post.twitter_error = result
            post.save()
            return False, result
            
    except Exception as e:
        error_msg = str(e)
        post.twitter_error = error_msg
        post.save()
        return False, error_msg


def post_linkedin(post, account, caption, media_files=None):
    """Post to LinkedIn with image support"""
    
    # Get media path if exists
    image_path = None
    if media_files and len(media_files) > 0:
        media_file = media_files[0]
        full_path = os.path.join(settings.MEDIA_ROOT, media_file)
        
        # Check if it's an image (LinkedIn supports images, not videos via API)
        ext = os.path.splitext(media_file)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif'] and os.path.exists(full_path):
            image_path = full_path
    
    try:
        success, result = LinkedInService.post_to_linkedin(
            account.linkedin_access_token,
            account.linkedin_person_urn,
            caption,
            image_path
        )
        
        if success:
            post.linkedin_post_id = result
            post.linkedin_error = None
            post.save()
            return True, None
        else:
            post.linkedin_error = result
            post.save()
            return False, result
            
    except Exception as e:
        error_msg = str(e)
        post.linkedin_error = error_msg
        post.save()
        return False, error_msg


def post_instagram(post, account, caption, media_files):
    """Post to Instagram - Image OR Video (REELS)"""
    
    # Instagram requires media
    if not media_files or len(media_files) == 0:
        error = "Instagram requires image or video"
        post.instagram_error = error
        post.save()
        return False, error
    
    # Get Instagram credentials
    access_token = account.instagram_access_token
    business_account_id = account.instagram_business_account_id
    
    # Get Facebook credentials (needed for upload)
    try:
        fb_account = SocialAccount.objects.get(
            user=post.user,
            platform='facebook',
            is_active=True
        )
        
        page_id = fb_account.facebook_page_id
        page_access_token = fb_account.facebook_access_token
        
    except SocialAccount.DoesNotExist:
        error = "Facebook account required for Instagram posting"
        post.instagram_error = error
        post.save()
        return False, error
    
    # Validate Facebook credentials
    if not page_id or not page_access_token:
        error = "Facebook credentials missing"
        post.instagram_error = error
        post.save()
        return False, error
    
    # Get media file
    media_file = media_files[0]
    full_path = os.path.join(settings.MEDIA_ROOT, media_file)
    
    if not os.path.exists(full_path):
        error = f"Media file not found: {media_file}"
        post.instagram_error = error
        post.save()
        return False, error
    
    # Check file type - Instagram supports images AND videos
    ext = os.path.splitext(media_file)[1].lower()
    
    # REMOVED OLD CHECK - Now support both image and video!
    if ext not in ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.avi']:
        error = f"Instagram supports images (.jpg, .png) and videos (.mp4, .mov, .avi)"
        post.instagram_error = error
        post.save()
        return False, error
    
    print(f"      Media type: {'🎥 VIDEO' if ext in ['.mp4', '.mov', '.avi'] else '📸 IMAGE'}")
    print(f"      Using FB Page: {page_id[:20]}...")
    print(f"      Using IG Account: {business_account_id[:20]}...")
    
    try:
        from platforms.services.instagram import InstagramService
        
        # Call Instagram service with BOTH credentials
        success, result = InstagramService.post_to_instagram(
            access_token,
            business_account_id,
            caption,
            full_path,  # Local file path
            page_id,  # Facebook Page ID
            page_access_token  # Facebook token
        )
        
        if success:
            post.instagram_post_id = result
            post.instagram_error = None
            post.save()
            return True, None
        else:
            post.instagram_error = result
            post.save()
            return False, result
            
    except Exception as e:
        error_msg = str(e)
        post.instagram_error = error_msg
        post.save()
        return False, error_msg

def publish_post(post):
    """Publish single post with detailed error logging"""
    
    print(f"\n📝 Post #{post.id}: {post.caption[:50]}...")
    print(f"   Scheduled: {post.scheduled_time.strftime('%Y-%m-%d %H:%M')}")
    print(f"   Platforms: {', '.join(post.platforms_list)}")
    
    # Mark as posting
    post.status = 'posting'
    post.save()
    
    platforms = post.platforms_list
    caption = post.caption
    media_files = post.media_files_list
    
    success = 0
    failed = 0
    
    # Post to each platform
    for platform in platforms:
        print(f"\n   → {platform.upper()}...", end=' ')
        
        try:
            account = SocialAccount.objects.get(
                user=post.user,
                platform=platform,
                is_active=True
            )
            
            result = False
            error_msg = None
            
            if platform == 'facebook':
                result, error_msg = post_facebook(post, account, caption, media_files)
            elif platform == 'twitter':
                result, error_msg = post_twitter(post, account, caption, media_files)
            elif platform == 'linkedin':
                result, error_msg = post_linkedin(post, account, caption, media_files)  # ← ADD media_files!
            elif platform == 'instagram':
                result, error_msg = post_instagram(post, account, caption, media_files)
            
            if result:
                success += 1
                print("✅ SUCCESS")
            else:
                failed += 1
                print(f"❌ FAILED")
                if error_msg:
                    print(f"      Error: {error_msg[:60]}")
                
        except SocialAccount.DoesNotExist:
            print("❌ NO ACCOUNT")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {str(e)[:60]}")
            failed += 1
    
    # Update status
    if success > 0:
        post.status = 'posted'
        post.posted_at = timezone.now()
        status = "POSTED"
    else:
        post.status = 'failed'
        status = "FAILED"
    
    post.save()
    
    print(f"\n   📊 RESULT: {success} success, {failed} failed → {status}")
    print("="*70)