# admin_panel/views.py
"""
SocialSync Admin Panel - Complete User Analytics & Management
Includes: User management, API Settings management, Token tracking
"""

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import json


def is_admin(user):
    return user.is_staff or user.is_superuser


def dictfetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def dictfetchone(cursor):
    columns = [col[0] for col in cursor.description]
    row = cursor.fetchone()
    return dict(zip(columns, row)) if row else {}


def safe_query(query, params=None):
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or [])
            return dictfetchall(cursor)
    except Exception as e:
        print(f"Query error: {e}")
        return []


def safe_query_one(query, params=None):
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or [])
            return dictfetchone(cursor)
    except Exception as e:
        print(f"Query error: {e}")
        return {}


def safe_count(query, params=None):
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or [])
            result = cursor.fetchone()
            return result[0] if result else 0
    except:
        return 0


def to_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


TOKEN_COSTS = {
    'gpt-4o': 0.000005,
    'gpt-4-turbo': 0.00001,
    'gpt-4': 0.00003,
    'gpt-3.5-turbo': 0.000002,
    'whisper': 0.006,
}


def estimate_cost(tokens, model='gpt-4o'):
    tokens_float = to_float(tokens)
    rate = TOKEN_COSTS.get(model, 0.000005)
    return round(tokens_float * rate, 4)


# ==================== DASHBOARD ====================

@login_required
@user_passes_test(is_admin)
def admin_dashboard(request):
    total_users = safe_count("SELECT COUNT(*) FROM auth_user")
    pending_users = safe_count("SELECT COUNT(*) FROM user_profiles WHERE is_approved = 0")
    approved_users = safe_count("SELECT COUNT(*) FROM user_profiles WHERE is_approved = 1")
    total_posts = safe_count("SELECT COUNT(*) FROM posts")
    total_social_accounts = safe_count("SELECT COUNT(*) FROM social_accounts")
    total_captions = safe_count("SELECT COUNT(*) FROM ai_caption_captiongeneration")
    total_images = safe_count("SELECT COUNT(*) FROM ai_image_imagegeneration")
    total_videos = safe_count("SELECT COUNT(*) FROM ai_video_videogeneration")
    total_connections = safe_count("SELECT COUNT(*) FROM messenger_connections")
    total_conversations = safe_count("SELECT COUNT(*) FROM conversations")
    total_messages = safe_count("SELECT COUNT(*) FROM messages")
    
    caption_tokens = safe_query_one("SELECT COALESCE(SUM(tokens_used), 0) as total FROM ai_caption_captiongeneration")
    caption_token_total = to_float(caption_tokens.get('total', 0))
    
    message_tokens = safe_query_one("SELECT COALESCE(SUM(tokens_used), 0) as total FROM messages WHERE sender = 'bot'")
    message_token_total = to_float(message_tokens.get('total', 0))
    
    total_tokens = caption_token_total + message_token_total
    estimated_cost = estimate_cost(total_tokens)
    
    pending_approvals = safe_query("""
        SELECT u.id, u.username, u.email, u.date_joined, p.company, p.phone
        FROM auth_user u
        JOIN user_profiles p ON u.id = p.user_id
        WHERE p.is_approved = 0
        ORDER BY u.date_joined DESC LIMIT 10
    """)
    
    top_users = safe_query("""
        SELECT u.id, u.username, p.subscription_plan,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
            (SELECT COALESCE(SUM(tokens_used), 0) FROM ai_caption_captiongeneration WHERE user_id = u.id) as caption_tokens,
            (SELECT COUNT(*) FROM social_accounts WHERE user_id = u.id) as account_count
        FROM auth_user u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ORDER BY caption_tokens DESC LIMIT 10
    """)
    for u in top_users:
        u['caption_tokens'] = to_float(u.get('caption_tokens', 0))
    
    plan_distribution = safe_query("""
        SELECT COALESCE(subscription_plan, 'free') as plan, COUNT(*) as count
        FROM user_profiles GROUP BY subscription_plan
    """)
    
    recent_posts = safe_query("""
        SELECT p.id, p.caption, p.status, p.platforms, p.created_at, u.username
        FROM posts p JOIN auth_user u ON p.user_id = u.id
        ORDER BY p.created_at DESC LIMIT 5
    """)
    
    return render(request, 'admin_panel/dashboard.html', {
        'total_users': total_users,
        'pending_users': pending_users,
        'approved_users': approved_users,
        'total_posts': total_posts,
        'total_social_accounts': total_social_accounts,
        'total_captions': total_captions,
        'total_images': total_images,
        'total_videos': total_videos,
        'total_connections': total_connections,
        'total_conversations': total_conversations,
        'total_messages': total_messages,
        'total_tokens': int(total_tokens),
        'estimated_cost': estimated_cost,
        'pending_approvals': pending_approvals,
        'top_users': top_users,
        'plan_distribution': plan_distribution,
        'recent_posts': recent_posts,
    })


# ==================== USER LIST ====================

@login_required
@user_passes_test(is_admin)
def user_list(request):
    status = request.GET.get('status', '')
    search = request.GET.get('search', '')
    plan = request.GET.get('plan', '')
    
    query = """
        SELECT 
            u.id, u.username, u.email, u.date_joined, u.last_login, u.is_active,
            COALESCE(p.is_approved, 0) as is_approved,
            COALESCE(p.subscription_plan, 'free') as plan,
            COALESCE(p.company, '') as company,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
            (SELECT COUNT(*) FROM social_accounts WHERE user_id = u.id) as account_count,
            (SELECT COALESCE(SUM(tokens_used), 0) FROM ai_caption_captiongeneration WHERE user_id = u.id) as caption_tokens
        FROM auth_user u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE 1=1
    """
    params = []
    
    if status == 'pending':
        query += " AND p.is_approved = 0"
    elif status == 'approved':
        query += " AND p.is_approved = 1"
    
    if plan:
        query += " AND p.subscription_plan = %s"
        params.append(plan)
    
    if search:
        query += " AND (u.username LIKE %s OR u.email LIKE %s OR p.company LIKE %s)"
        params.extend([f'%{search}%'] * 3)
    
    query += " ORDER BY u.date_joined DESC"
    
    users = safe_query(query, params)
    
    for user in users:
        tokens = to_float(user.get('caption_tokens', 0))
        user['total_tokens'] = int(tokens)
        user['estimated_cost'] = estimate_cost(tokens)
    
    return render(request, 'admin_panel/user_list.html', {
        'users': users,
        'status': status,
        'search': search,
        'plan_filter': plan,
    })


# ==================== USER DETAIL ====================

@login_required
@user_passes_test(is_admin)
def user_detail(request, user_id):
    user = get_object_or_404(User, id=user_id)
    tab = request.GET.get('tab', 'overview')
    
    profile = safe_query_one("SELECT * FROM user_profiles WHERE user_id = %s", [user_id])
    
    stats = {
        'posts': safe_count("SELECT COUNT(*) FROM posts WHERE user_id = %s", [user_id]),
        'accounts': safe_count("SELECT COUNT(*) FROM social_accounts WHERE user_id = %s", [user_id]),
        'captions': safe_count("SELECT COUNT(*) FROM ai_caption_captiongeneration WHERE user_id = %s", [user_id]),
        'images': safe_count("SELECT COUNT(*) FROM ai_image_imagegeneration WHERE user_id = %s", [user_id]),
        'videos': safe_count("SELECT COUNT(*) FROM ai_video_videogeneration WHERE user_id = %s", [user_id]),
    }
    
    messenger_conn = safe_query_one("SELECT id, page_name FROM messenger_connections WHERE user_id = %s LIMIT 1", [user_id])
    
    if messenger_conn and messenger_conn.get('id'):
        stats['conversations'] = safe_count("SELECT COUNT(*) FROM conversations WHERE connection_id = %s", [messenger_conn.get('id')])
        stats['messages'] = safe_count("SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.connection_id = %s", [messenger_conn.get('id')])
    else:
        stats['conversations'] = 0
        stats['messages'] = 0
    
    caption_tokens = safe_query_one("SELECT COALESCE(SUM(tokens_used), 0) as total FROM ai_caption_captiongeneration WHERE user_id = %s", [user_id])
    caption_token_total = to_float(caption_tokens.get('total', 0))
    
    message_tokens = 0
    if messenger_conn and messenger_conn.get('id'):
        msg_tokens = safe_query_one("SELECT COALESCE(SUM(m.tokens_used), 0) as total FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.connection_id = %s AND m.sender = 'bot'", [messenger_conn.get('id')])
        message_tokens = to_float(msg_tokens.get('total', 0))
    
    tokens = {
        'caption': int(caption_token_total),
        'messenger': int(message_tokens),
        'total': int(caption_token_total + message_tokens),
        'cost': estimate_cost(caption_token_total + message_tokens),
    }
    
    return render(request, 'admin_panel/user_detail.html', {
        'target_user': user,
        'profile': profile,
        'stats': stats,
        'tokens': tokens,
        'tab': tab,
        'messenger_conn': messenger_conn,
    })


# ==================== API ENDPOINTS ====================

@login_required
@user_passes_test(is_admin)
def user_posts(request, user_id):
    posts = safe_query("""
        SELECT id, caption, status, platforms, media_files, ai_generated, created_at, scheduled_time, posted_at
        FROM posts WHERE user_id = %s ORDER BY created_at DESC
    """, [user_id])
    for p in posts:
        for k in ['created_at', 'scheduled_time', 'posted_at']:
            if p.get(k): p[k] = str(p[k])
    return JsonResponse({'posts': posts})


@login_required
@user_passes_test(is_admin)
def user_accounts(request, user_id):
    accounts = safe_query("""
        SELECT id, platform, account_name, status, is_active, is_validated, connected_at
        FROM social_accounts WHERE user_id = %s ORDER BY connected_at DESC
    """, [user_id])
    for a in accounts:
        if a.get('connected_at'): a['connected_at'] = str(a['connected_at'])
    return JsonResponse({'accounts': accounts})


@login_required
@user_passes_test(is_admin)
def user_captions(request, user_id):
    captions = safe_query("""
        SELECT id, input_text, generated_caption, platform, status, tokens_used, model_used, created_at
        FROM ai_caption_captiongeneration WHERE user_id = %s ORDER BY created_at DESC
    """, [user_id])
    total_tokens = sum(to_float(c.get('tokens_used', 0)) for c in captions)
    completed = len([c for c in captions if c.get('status') == 'completed'])
    for c in captions:
        c['tokens_used'] = int(to_float(c.get('tokens_used', 0)))
        if c.get('created_at'): c['created_at'] = str(c['created_at'])
    return JsonResponse({'captions': captions, 'stats': {'total': len(captions), 'completed': completed, 'tokens': int(total_tokens), 'cost': estimate_cost(total_tokens)}})


@login_required
@user_passes_test(is_admin)
def user_images(request, user_id):
    images = safe_query("""
        SELECT id, title, prompt, style, size, status, created_at
        FROM ai_image_imagegeneration WHERE user_id = %s ORDER BY created_at DESC
    """, [user_id])
    for i in images:
        if i.get('created_at'): i['created_at'] = str(i['created_at'])
    return JsonResponse({'images': images})


@login_required
@user_passes_test(is_admin)
def user_videos(request, user_id):
    videos = safe_query("""
        SELECT id, title, prompt, style, duration, status, created_at
        FROM ai_video_videogeneration WHERE user_id = %s ORDER BY created_at DESC
    """, [user_id])
    for v in videos:
        if v.get('created_at'): v['created_at'] = str(v['created_at'])
    return JsonResponse({'videos': videos})


@login_required
@user_passes_test(is_admin)
def user_messenger(request, user_id):
    """Get messenger connections and conversations for a user"""
    connections = safe_query("SELECT id, page_id, page_name, is_active, connected_at FROM messenger_connections WHERE user_id = %s", [user_id])
    for c in connections:
        if c.get('connected_at'): c['connected_at'] = str(c['connected_at'])
    
    conversations = []
    for conn in connections:
        convs = safe_query("""
            SELECT c.id, c.sender_id, c.sender_name, c.sender_profile_pic, c.started_at as created_at, c.last_message_at as updated_at,
                   (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
                   (SELECT COALESCE(SUM(tokens_used), 0) FROM messages WHERE conversation_id = c.id AND sender = 'bot') as total_tokens
            FROM conversations c WHERE c.connection_id = %s ORDER BY c.last_message_at DESC
        """, [conn['id']])
        for cv in convs:
            cv['total_tokens'] = int(to_float(cv.get('total_tokens', 0)))
            cv['connection_id'] = conn['id']
            if cv.get('created_at'): cv['created_at'] = str(cv['created_at'])
            if cv.get('updated_at'): cv['updated_at'] = str(cv['updated_at'])
        conversations.extend(convs)
    
    return JsonResponse({'connections': connections, 'conversations': conversations})


@login_required
@user_passes_test(is_admin)
def conversation_messages(request, conv_id):
    """Get all messages in a conversation"""
    messages = safe_query("""
        SELECT id, message_type, sender, text, image_url, file_url, 
               model_used, tokens_used, processing_time, timestamp
        FROM messages WHERE conversation_id = %s ORDER BY timestamp ASC
    """, [conv_id])
    
    total_messages = len(messages)
    bot_messages = len([m for m in messages if m.get('sender') == 'bot'])
    user_messages = total_messages - bot_messages
    total_tokens = sum(to_float(m.get('tokens_used', 0)) for m in messages if m.get('sender') == 'bot')
    
    for m in messages:
        m['tokens_used'] = int(to_float(m.get('tokens_used', 0)))
        m['processing_time'] = round(to_float(m.get('processing_time', 0)), 2)
        if m.get('timestamp'): m['timestamp'] = str(m['timestamp'])
    
    return JsonResponse({
        'messages': messages,
        'stats': {
            'total': total_messages,
            'user': user_messages,
            'bot': bot_messages,
            'tokens': int(total_tokens),
            'cost': estimate_cost(total_tokens)
        }
    })


# ==================== API SETTINGS ====================

@login_required
@user_passes_test(is_admin)
def user_api_settings(request, user_id):
    """Get user's current API settings"""
    caption = safe_query_one("SELECT openai_api_key, default_model, total_tokens_used FROM ai_caption_userapisettings WHERE user_id = %s", [user_id])
    image = safe_query_one("SELECT gemini_api_key, default_style FROM ai_image_userimagesettings WHERE user_id = %s", [user_id])
    video = safe_query_one("SELECT gemini_api_key, default_style FROM ai_video_uservideosettings WHERE user_id = %s", [user_id])
    
    messenger = safe_query_one("""
        SELECT ac.openai_api_key, ac.openai_model, mc.page_name
        FROM ai_configurations ac
        JOIN messenger_connections mc ON ac.connection_id = mc.id
        WHERE mc.user_id = %s LIMIT 1
    """, [user_id])
    
    profile = safe_query_one("SELECT api_mode, admin_openai_key, admin_gemini_key FROM user_profiles WHERE user_id = %s", [user_id])

    def mask_key(key):
        if not key: return None
        return key[:8] + '****' + key[-4:] if len(key) > 12 else '****'

    return JsonResponse({
        'caption': {
            'has_key': bool(caption.get('openai_api_key')),
            'key_preview': mask_key(caption.get('openai_api_key')),
            'model': caption.get('default_model', 'gpt-4o'),
            'tokens': int(to_float(caption.get('total_tokens_used', 0)))
        } if caption else {},
        'image': {
            'has_key': bool(image.get('gemini_api_key')),
            'key_preview': mask_key(image.get('gemini_api_key')),
            'style': image.get('default_style', 'vivid')
        } if image else {},
        'video': {
            'has_key': bool(video.get('gemini_api_key')),
            'key_preview': mask_key(video.get('gemini_api_key')),
            'style': video.get('default_style', 'cinematic')
        } if video else {},
        'messenger': {
            'page': messenger.get('page_name'),
            'has_key': bool(messenger.get('openai_api_key')),
            'key_preview': mask_key(messenger.get('openai_api_key')),
            'model': messenger.get('openai_model', 'gpt-4-turbo')
        } if messenger else {},
        'admin_managed': (profile.get('api_mode') == 'admin') if profile else False,
        'admin_openai': mask_key(profile.get('admin_openai_key')) if profile else None,
        'admin_gemini': mask_key(profile.get('admin_gemini_key')) if profile else None
    })


@login_required
@user_passes_test(is_admin)
def update_api_settings(request, user_id):
    """Admin updates user's API settings"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)
    
    admin_managed = request.POST.get('admin_managed') == 'true'
    openai_key = request.POST.get('openai_key', '').strip()
    gemini_key = request.POST.get('gemini_key', '').strip()
    
    try:
        with connection.cursor() as cursor:
            # Update user_profiles with admin managed settings
            cursor.execute("""
                UPDATE user_profiles
                SET api_mode = %s, admin_openai_key = %s, admin_gemini_key = %s
                WHERE user_id = %s
            """, ['admin' if admin_managed else 'user', openai_key or None, gemini_key or None, user_id])
            
            # If admin provides keys, update all user's API settings
            if openai_key:
                # Update caption settings
                cursor.execute("SELECT id FROM ai_caption_userapisettings WHERE user_id = %s", [user_id])
                if cursor.fetchone():
                    cursor.execute("UPDATE ai_caption_userapisettings SET openai_api_key = %s WHERE user_id = %s", [openai_key, user_id])
                else:
                    cursor.execute("INSERT INTO ai_caption_userapisettings (user_id, openai_api_key, default_model, total_tokens_used, total_generations) VALUES (%s, %s, 'gpt-4o', 0, 0)", [user_id, openai_key])
                
                # Update messenger config
                cursor.execute("""
                    UPDATE ai_configurations ac
                    JOIN messenger_connections mc ON ac.connection_id = mc.id
                    SET ac.openai_api_key = %s
                    WHERE mc.user_id = %s
                """, [openai_key, user_id])
            
            if gemini_key:
                # Update image settings
                cursor.execute("SELECT id FROM ai_image_userimagesettings WHERE user_id = %s", [user_id])
                if cursor.fetchone():
                    cursor.execute("UPDATE ai_image_userimagesettings SET gemini_api_key = %s WHERE user_id = %s", [gemini_key, user_id])
                else:
                    cursor.execute("INSERT INTO ai_image_userimagesettings (user_id, gemini_api_key, default_style, default_size, total_images_generated) VALUES (%s, %s, 'vivid', '1024x1024', 0)", [user_id, gemini_key])
                
                # Update video settings
                cursor.execute("SELECT id FROM ai_video_uservideosettings WHERE user_id = %s", [user_id])
                if cursor.fetchone():
                    cursor.execute("UPDATE ai_video_uservideosettings SET gemini_api_key = %s WHERE user_id = %s", [gemini_key, user_id])
                else:
                    cursor.execute("INSERT INTO ai_video_uservideosettings (user_id, gemini_api_key, default_style, default_duration, total_videos_generated) VALUES (%s, %s, 'cinematic', 5, 0)", [user_id, gemini_key])
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ==================== USER ACTIONS ====================

@login_required
@user_passes_test(is_admin)
def approve_user(request, user_id):
    if request.method == 'POST':
        try:
            with connection.cursor() as cursor:
                cursor.execute("UPDATE user_profiles SET is_approved = 1 WHERE user_id = %s", [user_id])
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


@login_required
@user_passes_test(is_admin)
def reject_user(request, user_id):
    if request.method == 'POST':
        try:
            with connection.cursor() as cursor:
                cursor.execute("UPDATE user_profiles SET is_approved = 0 WHERE user_id = %s", [user_id])
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


@login_required
@user_passes_test(is_admin)
def update_user_plan(request, user_id):
    if request.method == 'POST':
        plan = request.POST.get('plan', 'free')
        max_posts = request.POST.get('max_posts', 30)
        max_accounts = request.POST.get('max_accounts', 3)
        try:
            with connection.cursor() as cursor:
                cursor.execute("UPDATE user_profiles SET subscription_plan = %s, max_posts_per_month = %s, max_social_accounts = %s WHERE user_id = %s", [plan, max_posts, max_accounts, user_id])
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


@login_required
@user_passes_test(is_admin)
def bulk_approve(request):
    if request.method == 'POST':
        user_ids = request.POST.getlist('user_ids')
        if not user_ids:
            return JsonResponse({'error': 'No users'}, status=400)
        try:
            with connection.cursor() as cursor:
                placeholders = ','.join(['%s'] * len(user_ids))
                cursor.execute(f"UPDATE user_profiles SET is_approved = 1 WHERE user_id IN ({placeholders})", user_ids)
            return JsonResponse({'success': True, 'count': len(user_ids)})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


# ==================== ANALYTICS ====================

@login_required
@user_passes_test(is_admin)
def analytics(request):
    days = int(request.GET.get('days', 30))
    
    daily_posts = safe_query("SELECT DATE(created_at) as date, COUNT(*) as count FROM posts WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY) GROUP BY DATE(created_at) ORDER BY date", [days])
    for d in daily_posts:
        if d.get('date'): d['date'] = str(d['date'])
    
    daily_captions = safe_query("SELECT DATE(created_at) as date, COUNT(*) as count, SUM(tokens_used) as tokens FROM ai_caption_captiongeneration WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY) GROUP BY DATE(created_at) ORDER BY date", [days])
    for d in daily_captions:
        d['tokens'] = int(to_float(d.get('tokens', 0)))
        if d.get('date'): d['date'] = str(d['date'])
    
    top_users = safe_query("""
        SELECT u.id, u.username,
            (SELECT COALESCE(SUM(tokens_used), 0) FROM ai_caption_captiongeneration WHERE user_id = u.id) as caption_tokens,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts,
            (SELECT COUNT(*) FROM ai_caption_captiongeneration WHERE user_id = u.id) as captions
        FROM auth_user u ORDER BY caption_tokens DESC LIMIT 20
    """)
    for u in top_users:
        u['caption_tokens'] = int(to_float(u.get('caption_tokens', 0)))
    
    platform_stats = safe_query("""
        SELECT 
            SUM(CASE WHEN platforms LIKE '%%facebook%%' THEN 1 ELSE 0 END) as facebook,
            SUM(CASE WHEN platforms LIKE '%%instagram%%' THEN 1 ELSE 0 END) as instagram,
            SUM(CASE WHEN platforms LIKE '%%twitter%%' THEN 1 ELSE 0 END) as twitter,
            SUM(CASE WHEN platforms LIKE '%%linkedin%%' THEN 1 ELSE 0 END) as linkedin
        FROM posts
    """)
    
    return render(request, 'admin_panel/analytics.html', {
        'days': days,
        'daily_posts': daily_posts,
        'daily_captions': daily_captions,
        'top_users': top_users,
        'platform_stats': platform_stats[0] if platform_stats else {},
    })


# ==================== CHECK ADMIN MANAGED (API for user settings pages) ====================

def check_admin_managed(request):
    """API endpoint for user settings pages to check if admin manages their APIs"""
    if not request.user.is_authenticated:
        return JsonResponse({'admin_managed': False})
    
    profile = safe_query_one("SELECT api_mode, admin_openai_key, admin_gemini_key FROM user_profiles WHERE user_id = %s", [request.user.id])

    return JsonResponse({
        'admin_managed': (profile.get('api_mode') == 'admin') if profile else False,
        'has_openai': bool(profile.get('admin_openai_key')) if profile else False,
        'has_gemini': bool(profile.get('admin_gemini_key')) if profile else False
    })
