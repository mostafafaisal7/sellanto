"""
Auto Scheduler - YOUR main.py logic automated
Runs in background with Django server
"""

from django.utils import timezone
from .models import Post, ScheduledPostPlatform, PostHashtag
from platforms.models import SocialAccount
from platforms.services.facebook import FacebookService
from platforms.services.twitter import TwitterService
from platforms.services.linkedin import LinkedInService
from platforms.services.instagram import InstagramService  # ← ADD THIS LINE!
from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings
import os
import pytz
from accounts.services.notification_service import notify_post_published, notify_publish_failed


# Global scheduler
scheduler = None


def start_scheduler():
    """Start background scheduler"""
    global scheduler

    if scheduler is not None:
        return

    scheduler = BackgroundScheduler()

    # Check every minute for due posts
    scheduler.add_job(
        check_and_post,
        'interval',
        minutes=1,
        id='auto_poster',
        replace_existing=True
    )

    # V1.2.1: Check approval SLA every 30 minutes
    scheduler.add_job(
        run_sla_check,
        'interval',
        minutes=30,
        id='sla_checker',
        replace_existing=True
    )

    # V1.2.1: Sync analytics every 6 hours
    scheduler.add_job(
        run_analytics_sync,
        'interval',
        hours=6,
        id='analytics_sync',
        replace_existing=True
    )

    # V1.2.1: Generate weekly reports every Sunday at midnight UTC
    scheduler.add_job(
        run_weekly_report,
        'cron',
        day_of_week='sun',
        hour=0,
        minute=0,
        id='weekly_report',
        replace_existing=True
    )

    # V1.2.1: Sync comments every 15 minutes
    scheduler.add_job(
        run_comment_sync,
        'interval',
        minutes=15,
        id='comment_sync',
        replace_existing=True
    )

    # V1.2.1: Check token health daily at 6:00 AM UTC
    scheduler.add_job(
        run_token_health_check,
        'cron',
        hour=6,
        minute=0,
        id='token_health',
        replace_existing=True
    )

    # V1.2.1: Fetch trending topics every 6 hours
    scheduler.add_job(
        run_trending_fetch,
        'interval',
        hours=6,
        id='trending_fetch',
        replace_existing=True
    )

    scheduler.start()
    print("[SCHEDULER] Auto-posting scheduler active (checks every 60 seconds)")
    print("[SCHEDULER] SLA checker active (checks every 30 minutes)")
    print("[SCHEDULER] Analytics sync active (every 6 hours)")
    print("[SCHEDULER] Weekly report generator active (Sunday midnight UTC)")
    print("[SCHEDULER] Comment sync active (every 15 minutes)")
    print("[SCHEDULER] Token health check active (daily 6:00 AM UTC)")
    print("[SCHEDULER] Trending topics fetch active (every 6 hours)")


def run_sla_check():
    """Run SLA escalation check for pending approvals"""
    try:
        from django.core.management import call_command
        call_command('check_sla')
    except Exception as e:
        print(f"[SLA CHECK] Error: {e}")


def run_analytics_sync():
    """Sync post analytics from platforms"""
    try:
        from django.core.management import call_command
        call_command('sync_analytics')
    except Exception as e:
        print(f"[ANALYTICS SYNC] Error: {e}")


def run_weekly_report():
    """Generate weekly performance reports"""
    try:
        from django.core.management import call_command
        call_command('generate_weekly_report')
    except Exception as e:
        print(f"[WEEKLY REPORT] Error: {e}")


def run_comment_sync():
    """Sync comments from platform APIs"""
    try:
        from django.core.management import call_command
        call_command('sync_comments')
    except Exception as e:
        print(f"[COMMENT SYNC] Error: {e}")


def run_token_health_check():
    """Check for expiring platform tokens"""
    try:
        from django.core.management import call_command
        call_command('check_token_health')
    except Exception as e:
        print(f"[TOKEN HEALTH] Error: {e}")


def run_trending_fetch():
    """Fetch trending topics for Ideas Hub"""
    try:
        from django.core.management import call_command
        call_command('fetch_trending')
    except Exception as e:
        print(f"[TRENDING] Error: {e}")


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
    
    print(f"\n[POSTING] {count} POST(S)...")
    print("="*70)
    
    for post in due_posts:
        publish_post(post)

    # V1.2.1: Also process per-platform scheduled posts
    process_v121_scheduled_posts()



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

        # Ensure it's a Page token, not User token
        from platforms.services.facebook import FacebookService
        page_access_token = FacebookService._get_page_token(page_id, page_access_token)

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
    
    print(f"      Media type: {'VIDEO' if ext in ['.mp4', '.mov', '.avi'] else 'IMAGE'}")
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
    
    print(f"\n[POST] Post #{post.id}: {post.caption[:50]}...")
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
                print("[OK] SUCCESS")
            else:
                failed += 1
                print(f"[FAIL] FAILED")
                if error_msg:
                    print(f"      Error: {error_msg[:60]}")
                
        except SocialAccount.DoesNotExist:
            print("[FAIL] NO ACCOUNT")
            failed += 1
        except Exception as e:
            print(f"[ERROR] {str(e)[:60]}")
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
    
    print(f"\n   [RESULT] {success} success, {failed} failed -> {status}")
    print("="*70)


def process_v121_scheduled_posts():
    """
    V1.2.1 Per-Platform Scheduler
    Processes ScheduledPostPlatform records that are due for publishing.
    Each platform entry can have its own caption, hashtags, and schedule.
    """
    import logging
    from collections import defaultdict

    logger = logging.getLogger(__name__)
    now = timezone.now()

    due_entries = ScheduledPostPlatform.objects.filter(
        scheduled_at__lte=now,
        status='scheduled',
    ).select_related('post', 'caption', 'post__user')

    count = due_entries.count()
    if count == 0:
        return

    print(f"\n[V1.2.1] {count} per-platform post(s) due for publishing")
    logger.info(f"[V1.2.1] Processing {count} ScheduledPostPlatform entries")

    # Group entries by post so we can update the parent Post status afterwards
    post_entries = defaultdict(list)

    for spp in due_entries:
        post_entries[spp.post_id].append(spp)

        # Mark as publishing
        spp.status = 'publishing'
        spp.save(update_fields=['status'])

        post = spp.post
        platform = spp.platform

        print(f"  [V1.2.1] Post #{post.id} -> {platform.upper()}")

        # -------------------------------------------------------
        # 1. Build caption text
        # -------------------------------------------------------
        # Use the per-platform caption if linked, otherwise fall back to post.caption
        if spp.caption and spp.caption.body:
            caption_text = spp.caption.body
        else:
            caption_text = post.caption

        # -------------------------------------------------------
        # 2. Gather selected hashtags for this platform
        # -------------------------------------------------------
        selected_hashtags = PostHashtag.objects.filter(
            post=post,
            platform=platform,
            is_selected=True,
        )
        hashtag_string = ' '.join(f'#{ht.tag.lstrip("#")}' for ht in selected_hashtags)

        first_comment_hashtags = None

        if spp.hashtag_placement == 'end_of_caption' and hashtag_string:
            caption_text = f"{caption_text}\n\n{hashtag_string}"
        elif spp.hashtag_placement == 'inline':
            # Hashtags are assumed to be already embedded in the caption body
            pass
        elif spp.hashtag_placement == 'first_comment' and hashtag_string:
            # Store hashtags to post as the first comment after publishing
            first_comment_hashtags = hashtag_string

        # -------------------------------------------------------
        # 3. Get media files from the parent Post
        # -------------------------------------------------------
        media_files = post.media_files_list

        # -------------------------------------------------------
        # 4. Resolve the SocialAccount for this platform
        # -------------------------------------------------------
        try:
            account = SocialAccount.objects.get(
                user=post.user,
                platform=platform,
                is_active=True,
            )
        except SocialAccount.DoesNotExist:
            error_msg = f"No active {platform} account for user {post.user.username}"
            logger.error(f"[V1.2.1] {error_msg}")
            print(f"    [FAIL] {error_msg}")
            _handle_spp_failure(spp, error_msg, now)
            continue

        # -------------------------------------------------------
        # 5. Call the platform-specific publish function
        # -------------------------------------------------------
        try:
            result_ok = False
            error_msg = None

            if platform == 'facebook':
                result_ok, error_msg = post_facebook(post, account, caption_text, media_files)
            elif platform == 'twitter':
                result_ok, error_msg = post_twitter(post, account, caption_text, media_files)
            elif platform == 'linkedin':
                result_ok, error_msg = post_linkedin(post, account, caption_text, media_files)
            elif platform == 'instagram':
                result_ok, error_msg = post_instagram(post, account, caption_text, media_files)
            else:
                error_msg = f"Unsupported platform: {platform}"
                logger.warning(f"[V1.2.1] {error_msg}")

            if result_ok:
                # --- Success ---
                spp.status = 'published'
                spp.published_at = now
                spp.publish_result_json = {'success': True, 'published_at': now.isoformat()}
                spp.save(update_fields=['status', 'published_at', 'publish_result_json'])
                print(f"    [OK] Published successfully")
                logger.info(f"[V1.2.1] Post #{post.id} published to {platform}")

                # Handle first-comment hashtags for Instagram
                if platform == 'instagram' and first_comment_hashtags:
                    ig_media_id = error_msg  # On success, error_msg holds the Instagram post ID
                    if ig_media_id:
                        try:
                            comment_ok, comment_result = InstagramService.post_comment(
                                access_token=account.instagram_access_token,
                                media_id=ig_media_id,
                                text=first_comment_hashtags,
                            )
                            if comment_ok:
                                logger.info(
                                    f"[V1.2.1] First-comment hashtags posted on Instagram "
                                    f"for Post #{post.id}, comment_id={comment_result}"
                                )
                                print(f"    [OK] First-comment hashtags posted: {first_comment_hashtags[:60]}")
                            else:
                                logger.warning(
                                    f"[V1.2.1] First-comment failed for Post #{post.id}: {comment_result}"
                                )
                                print(f"    [WARN] First-comment failed: {comment_result}")
                        except Exception as fc_err:
                            logger.warning(f"[V1.2.1] First-comment exception: {fc_err}")
                            print(f"    [WARN] First-comment exception: {fc_err}")
            else:
                _handle_spp_failure(spp, error_msg or 'Unknown error', now)

        except Exception as e:
            error_msg = str(e)
            logger.exception(f"[V1.2.1] Exception publishing Post #{post.id} to {platform}")
            _handle_spp_failure(spp, error_msg, now)

    # -------------------------------------------------------
    # 6. After processing all entries, update parent Post status
    # -------------------------------------------------------
    for post_id, entries in post_entries.items():
        _update_parent_post_status(post_id, entries, now)

    print(f"[V1.2.1] Finished processing {count} per-platform entries\n")


def _handle_spp_failure(spp, error_msg, now):
    """
    Handle a failed ScheduledPostPlatform publish attempt.
    Increments retry_count; if under max_retries keeps it scheduled,
    otherwise marks it as failed.
    """
    import logging
    logger = logging.getLogger(__name__)

    spp.retry_count += 1
    spp.publish_result_json = {
        'success': False,
        'error': error_msg,
        'retry_count': spp.retry_count,
        'failed_at': now.isoformat(),
    }

    if spp.retry_count < spp.max_retries:
        # Keep as scheduled so the next scheduler run will retry
        spp.status = 'scheduled'
        print(f"    [RETRY] Attempt {spp.retry_count}/{spp.max_retries} - will retry. Error: {error_msg[:80]}")
        logger.warning(
            f"[V1.2.1] Post #{spp.post_id} -> {spp.platform} failed (attempt "
            f"{spp.retry_count}/{spp.max_retries}): {error_msg}"
        )
    else:
        spp.status = 'failed'
        print(f"    [FAIL] Max retries reached ({spp.max_retries}). Error: {error_msg[:80]}")
        logger.error(
            f"[V1.2.1] Post #{spp.post_id} -> {spp.platform} permanently failed "
            f"after {spp.max_retries} attempts: {error_msg}"
        )

    spp.save(update_fields=['status', 'retry_count', 'publish_result_json'])


def _update_parent_post_status(post_id, spp_entries, now):
    """
    After all ScheduledPostPlatform entries for a Post have been processed,
    update the parent Post status and send notifications.

    Rules:
      - If ALL platforms are published   -> post.status = 'posted'
      - If ANY platform is failed        -> post.status = 'failed'
      - Otherwise (some still scheduled due to retries) -> leave as-is
    """
    import logging
    logger = logging.getLogger(__name__)

    # Refresh statuses from DB in case of concurrent updates
    all_platforms = ScheduledPostPlatform.objects.filter(post_id=post_id)
    statuses = set(all_platforms.values_list('status', flat=True))

    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        logger.error(f"[V1.2.1] Post #{post_id} not found when updating parent status")
        return

    if statuses == {'published'}:
        # All platforms published successfully
        post.status = 'posted'
        post.posted_at = now
        post.save(update_fields=['status', 'posted_at'])
        print(f"  [V1.2.1] Post #{post_id} -> ALL platforms published. Status: POSTED")
        logger.info(f"[V1.2.1] Post #{post_id} fully published across all platforms")
        notify_post_published(post)

    elif 'failed' in statuses:
        # At least one platform permanently failed
        # Only mark the post as failed if no platforms are still pending retry
        if 'scheduled' not in statuses and 'publishing' not in statuses:
            post.status = 'failed'
            post.save(update_fields=['status'])
            # Build error summary from failed platforms
            failed_platforms = all_platforms.filter(status='failed')
            error_summary = "; ".join(
                f"{fp.platform}: {fp.publish_result_json.get('error', 'unknown')}"
                for fp in failed_platforms
            )
            print(f"  [V1.2.1] Post #{post_id} -> Some platforms FAILED. Status: FAILED")
            logger.error(f"[V1.2.1] Post #{post_id} failed: {error_summary}")
            notify_publish_failed(post, error_summary)
        else:
            # Some platforms still have retries pending - do not change post status yet
            print(f"  [V1.2.1] Post #{post_id} -> Mixed statuses {statuses}. Waiting for retries.")
            logger.info(f"[V1.2.1] Post #{post_id} has mixed statuses: {statuses}. Deferring status update.")
    else:
        # All are still scheduled (retries pending) or a mix of published + scheduled
        print(f"  [V1.2.1] Post #{post_id} -> Statuses: {statuses}. No final status yet.")
        logger.info(f"[V1.2.1] Post #{post_id} platform statuses: {statuses}")
