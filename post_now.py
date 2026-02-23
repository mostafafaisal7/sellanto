"""
Manual Post Script - YOUR main.py logic
For immediate posting
"""

import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'socialsync.settings')
django.setup()

from posts.models import Post
from platforms.models import SocialAccount
from platforms.services.facebook import FacebookService
from platforms.services.twitter import TwitterService
from platforms.services.linkedin import LinkedInService
from django.utils import timezone
from django.conf import settings


def main():
    """Main - YOUR main.py style"""
    
    print("\n" + "="*80)
    print(" "*30 + "SOCIALSYNC")
    print(" "*25 + "Manual Posting Tool")
    print("="*80)
    
    posts = Post.objects.filter(status='scheduled').order_by('scheduled_time')
    
    if not posts.exists():
        print("\n❌ No scheduled posts found!")
        print("\n💡 Create a post at: http://127.0.0.1:8000/posts/create/\n")
        return
    
    print(f"\n📋 {posts.count()} Scheduled Post(s):\n")
    
    for idx, post in enumerate(posts, 1):
        print(f"{idx}. {post.caption[:60]}...")
        print(f"   User: {post.user.username}")
        print(f"   Time: {post.scheduled_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Platforms: {', '.join(post.platforms_list)}")
        
        # Check for media
        if post.media_files_list:
            print(f"   Media: {post.media_files_list[0]}")
        
        print()
    
    try:
        choice = input("Select post number (0 to exit): ").strip()
        
        if choice == '0':
            print("\n✅ Cancelled\n")
            return
        
        idx = int(choice) - 1
        if idx < 0 or idx >= len(posts):
            print("\n❌ Invalid!\n")
            return
        
        post = posts[idx]
        
    except (ValueError, KeyboardInterrupt):
        print("\n❌ Invalid!\n")
        return
    
    print("\n" + "="*80)
    print(f"POSTING: {post.caption[:70]}...")
    print("="*80 + "\n")
    
    publish(post)
    
    print("\n" + "="*80)
    print(" "*35 + "✅ DONE!")
    print("="*80)
    print(f"\n🔗 View: http://127.0.0.1:8000/posts/my-posts/\n")


def publish(post):
    """Publish post - YOUR main.py logic"""
    
    post.status = 'posting'
    post.save()
    print("📤 Status: posting\n")
    
    platforms = post.platforms_list
    caption = post.caption
    media_files = post.media_files_list
    
    success = 0
    failed = 0
    
    for platform in platforms:
        print("─"*80)
        print(f"📱 {platform.upper()}")
        print("─"*80)
        
        try:
            account = SocialAccount.objects.get(
                user=post.user,
                platform=platform,
                is_active=True
            )
            
            print(f"Account: {account.account_name}")
            
            result = False
            
            if platform == 'facebook':
                result = publish_facebook(post, account, caption, media_files)
            elif platform == 'twitter':
                result = publish_twitter(post, account, caption, media_files)
            elif platform == 'linkedin':
                result = publish_linkedin(post, account, caption)
            
            if result:
                success += 1
                print(f"✅ {platform.upper()}: SUCCESS\n")
            else:
                failed += 1
                print(f"❌ {platform.upper()}: FAILED\n")
                
        except SocialAccount.DoesNotExist:
            print(f"❌ No account\n")
            failed += 1
        except Exception as e:
            print(f"❌ Error: {str(e)}\n")
            failed += 1
    
    print("─"*80)
    print(f"📊 {success} success, {failed} failed")
    print("─"*80)
    
    if success > 0:
        post.status = 'posted'
        post.posted_at = timezone.now()
        print("\n✅ POSTED")
    else:
        post.status = 'failed'
        print("\n❌ FAILED")
    
    post.save()


def publish_facebook(post, account, caption, media_files):
    """Publish to Facebook"""
    
    page_id = account.facebook_page_id
    token = account.facebook_access_token
    
    print(f"Page ID: {page_id}")
    print(f"Token: {token[:30]}...")
    
    # Get media
    media_path = None
    if media_files:
        media_path = os.path.join(settings.MEDIA_ROOT, media_files[0])
        print(f"Media: {media_files[0]}")
        
        if os.path.exists(media_path):
            print(f"File: ✅ Found")
        else:
            print(f"File: ❌ Not found")
            media_path = None
    
    print(f"\n⏳ Posting...")
    
    success, result = FacebookService.post_to_facebook(
        page_id, token, caption, media_path
    )
    
    if success:
        post.facebook_post_id = result
        post.facebook_error = None
        post.save()
        
        print(f"✅ Posted!")
        print(f"   ID: {result}")
        print(f"   URL: https://facebook.com/{result}")
        return True
    else:
        post.facebook_error = result
        post.save()
        
        print(f"❌ Failed: {result}")
        return False


def publish_twitter(post, account, caption, media_files):
    """Publish to Twitter"""
    
    tweet = caption[:280]
    
    print(f"Tweet: {tweet[:50]}...")
    print(f"\n⏳ Posting...")
    
    success, result = TwitterService.post_to_twitter(
        account.twitter_api_key,
        account.twitter_api_secret,
        account.twitter_access_token,
        account.twitter_access_token_secret,
        tweet
    )
    
    if success:
        post.twitter_post_id = result
        post.twitter_error = None
        post.save()
        
        print(f"✅ Posted!")
        print(f"   ID: {result}")
        return True
    else:
        post.twitter_error = result
        post.save()
        
        print(f"❌ Failed: {result}")
        return False


def publish_linkedin(post, account, caption):
    """Publish to LinkedIn"""
    
    print(f"URN: {account.linkedin_person_urn}")
    print(f"\n⏳ Posting...")
    
    success, result = LinkedInService.post_to_linkedin(
        account.linkedin_access_token,
        account.linkedin_person_urn,
        caption
    )
    
    if success:
        post.linkedin_post_id = result
        post.linkedin_error = None
        post.save()
        
        print(f"✅ Posted!")
        print(f"   ID: {result}")
        return True
    else:
        post.linkedin_error = result
        post.save()
        
        print(f"❌ Failed: {result}")
        return False


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled\n")