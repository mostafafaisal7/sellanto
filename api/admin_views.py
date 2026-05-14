"""
Admin Panel REST API Views
Provides JSON endpoints for the React-based admin panel
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.db import connection as db_connection
from django.utils import timezone
from datetime import timedelta
import json

from accounts.models import SiteConfiguration


# ==================== Helpers ====================

def dictfetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def dictfetchone(cursor):
    columns = [col[0] for col in cursor.description]
    row = cursor.fetchone()
    return dict(zip(columns, row)) if row else {}


def safe_query(query, params=None):
    try:
        with db_connection.cursor() as cursor:
            cursor.execute(query, params or [])
            return dictfetchall(cursor)
    except Exception as e:
        print(f"Query error: {e}")
        return []


def safe_query_one(query, params=None):
    try:
        with db_connection.cursor() as cursor:
            cursor.execute(query, params or [])
            return dictfetchone(cursor)
    except Exception as e:
        print(f"Query error: {e}")
        return {}


def safe_count(query, params=None):
    try:
        with db_connection.cursor() as cursor:
            cursor.execute(query, params or [])
            result = cursor.fetchone()
            return result[0] if result else 0
    except Exception:
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


def mask_key(key):
    if not key:
        return None
    return key[:8] + '****' + key[-4:] if len(key) > 12 else '****'


# ==================== Admin Permission ====================

class IsOriginalAdmin(IsAdminUser):
    """Check if the ORIGINAL user (before impersonation) is admin"""
    def has_permission(self, request, view):
        original_user = getattr(request, '_original_user', request.user)
        return bool(original_user and (original_user.is_staff or original_user.is_superuser))


# ==================== Dashboard ====================

class AdminDashboardView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request):
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

        # ── Accurate cost: pull every DiamondTransaction deduction and apply
        # the rate table from docs/apiModelCost.md (Anthropic / Google / OpenAI
        # verified rates). This replaces the old hardcoded gpt-4o estimate.
        from accounts.models import DiamondTransaction
        from accounts.services.cost_calculator import calculate_transaction_cost
        from decimal import Decimal as _D

        _accurate_total = _D('0')
        _ledger_tokens = 0
        for _tx in DiamondTransaction.objects.filter(transaction_type='deduction').iterator():
            _accurate_total += calculate_transaction_cost(_tx)
            _ledger_tokens += _tx.raw_tokens or 0

        # Layer in image and video costs that may not yet be in the ledger.
        # ImageGeneration and VideoGeneration tables are the source of truth
        # for media counts — older rows may pre-date diamond tracking.
        from ai_image.models import ImageGeneration
        from ai_video.models import VideoGeneration
        from accounts.services.cost_calculator import (
            calculate_image_cost, calculate_video_cost,
        )

        # Count completed media that have NO matching DiamondTransaction
        # (legacy rows). Approximate per-image / per-second cost for them.
        ledger_image_count = DiamondTransaction.objects.filter(
            transaction_type='deduction',
            feature__in=['image', 'image_standard', 'image_hd'],
        ).count()
        completed_image_count = ImageGeneration.objects.filter(status='completed').count()
        legacy_image_count = max(0, completed_image_count - ledger_image_count)
        if legacy_image_count > 0:
            _accurate_total += calculate_image_cost('image', 'gemini', '') * legacy_image_count

        ledger_video_count = DiamondTransaction.objects.filter(
            transaction_type='deduction',
            feature__startswith='video_',
        ).count()
        completed_videos = VideoGeneration.objects.filter(status='completed')
        legacy_videos = completed_videos[ledger_video_count:]
        for _v in legacy_videos:
            duration = getattr(_v, 'duration', 0) or 5
            _accurate_total += calculate_video_cost(
                f'video_{duration}s', 'veo-3.1-generate-preview',
                duration_override=duration,
            )

        total_tokens = caption_token_total + message_token_total
        # Show the accurate auto-calculated total instead of the legacy estimate.
        estimated_cost_val = float(_accurate_total)

        pending_approvals = safe_query("""
            SELECT u.id, u.username, u.email, u.date_joined, p.company, p.phone
            FROM auth_user u
            JOIN user_profiles p ON u.id = p.user_id
            WHERE p.is_approved = 0
            ORDER BY u.date_joined DESC LIMIT 10
        """)
        for p in pending_approvals:
            if p.get('date_joined'):
                p['date_joined'] = str(p['date_joined'])

        top_users = safe_query("""
            SELECT u.id, u.username, p.subscription_plan as plan,
                (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
                (SELECT COALESCE(SUM(tokens_used), 0) FROM ai_caption_captiongeneration WHERE user_id = u.id) as caption_tokens,
                (SELECT COUNT(*) FROM social_accounts WHERE user_id = u.id) as account_count
            FROM auth_user u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            ORDER BY caption_tokens DESC LIMIT 10
        """)
        for u in top_users:
            u['caption_tokens'] = int(to_float(u.get('caption_tokens', 0)))

        plan_distribution = safe_query("""
            SELECT COALESCE(subscription_plan, 'free') as plan, COUNT(*) as count
            FROM user_profiles GROUP BY subscription_plan
        """)

        recent_posts = safe_query("""
            SELECT p.id, p.caption, p.status, p.platforms, p.created_at, u.username
            FROM posts p JOIN auth_user u ON p.user_id = u.id
            ORDER BY p.created_at DESC LIMIT 5
        """)
        for rp in recent_posts:
            if rp.get('created_at'):
                rp['created_at'] = str(rp['created_at'])

        # V1.2.1 — Content Pipeline Status
        pipeline_status = {
            'draft': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'draft'"),
            'pending_approval': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'pending_approval'"),
            'approved': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'approved'"),
            'scheduled': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'scheduled'"),
            'posted': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'posted'"),
            'failed': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'failed'"),
            'rejected': safe_count("SELECT COUNT(*) FROM posts WHERE status = 'rejected'"),
        }

        # V1.2.1 — Pending Approval SLA (drafts pending > 24h)
        pending_approval_posts = safe_query("""
            SELECT p.id, p.caption, p.submitted_at, u.username as author
            FROM posts p JOIN auth_user u ON p.user_id = u.id
            WHERE p.status = 'pending_approval'
            ORDER BY p.submitted_at ASC LIMIT 20
        """)
        for pa in pending_approval_posts:
            if pa.get('submitted_at'):
                pa['submitted_at'] = str(pa['submitted_at'])

        # V1.2.1 — Queue Health (image/video generation jobs)
        queue_health = {
            'images_pending': safe_count("SELECT COUNT(*) FROM ai_image_imagegeneration WHERE status = 'pending'"),
            'images_processing': safe_count("SELECT COUNT(*) FROM ai_image_imagegeneration WHERE status = 'processing'"),
            'images_failed': safe_count("SELECT COUNT(*) FROM ai_image_imagegeneration WHERE status = 'failed'"),
            'videos_pending': safe_count("SELECT COUNT(*) FROM ai_video_videogeneration WHERE status = 'pending'"),
            'videos_processing': safe_count("SELECT COUNT(*) FROM ai_video_videogeneration WHERE status = 'processing'"),
            'videos_failed': safe_count("SELECT COUNT(*) FROM ai_video_videogeneration WHERE status = 'failed'"),
        }

        # V1.2.1 — Platform Token Health
        token_health = safe_query("""
            SELECT sa.platform, sa.is_active,
                   COUNT(*) as count
            FROM social_accounts sa
            GROUP BY sa.platform, sa.is_active
        """)

        # V1.2.1 — Content Pillar Compliance
        pillar_compliance = []
        try:
            from brands.models import ContentPillar
            from posts.models import Post as PostModel
            for pillar in ContentPillar.objects.filter(is_active=True).select_related('brand'):
                total_brand_posts = PostModel.objects.filter(
                    brand=pillar.brand,
                    posted_at__isnull=False,
                ).count()
                pillar_posts = PostModel.objects.filter(
                    brand=pillar.brand,
                    pillar=pillar,
                    posted_at__isnull=False,
                ).count()
                actual_pct = round((pillar_posts / total_brand_posts * 100), 1) if total_brand_posts > 0 else 0
                pillar_compliance.append({
                    'brand': pillar.brand.brand_name,
                    'pillar': pillar.name,
                    'target_pct': pillar.target_percentage,
                    'actual_pct': actual_pct,
                    'post_count': pillar_posts,
                    'total_posts': total_brand_posts,
                    'compliant': abs(actual_pct - pillar.target_percentage) <= 15,
                })
        except Exception:
            pass

        return Response({
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
            'estimated_cost': estimated_cost_val,
            'pending_approvals': pending_approvals,
            'top_users': top_users,
            'plan_distribution': plan_distribution,
            'recent_posts': recent_posts,
            # V1.2.1 additions
            'pipeline_status': pipeline_status,
            'pending_approval_posts': pending_approval_posts,
            'queue_health': queue_health,
            'token_health': token_health,
            'pillar_compliance': pillar_compliance,
        })


# ==================== User List ====================

class AdminUserListView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request):
        status_filter = request.GET.get('status', '')
        search = request.GET.get('search', '')
        plan = request.GET.get('plan', '')

        query = """
            SELECT
                u.id, u.username, u.email, u.date_joined, u.last_login, u.is_active,
                COALESCE(p.is_approved, 0) as is_approved,
                COALESCE(p.subscription_plan, 'free') as plan,
                COALESCE(p.company, '') as company,
                COALESCE(p.api_mode, 'user') as api_mode,
                (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
                (SELECT COUNT(*) FROM social_accounts WHERE user_id = u.id) as account_count,
                (SELECT COALESCE(SUM(tokens_used), 0) FROM ai_caption_captiongeneration WHERE user_id = u.id) as caption_tokens
            FROM auth_user u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE 1=1
        """
        params = []

        if status_filter == 'pending':
            query += " AND p.is_approved = 0"
        elif status_filter == 'approved':
            query += " AND p.is_approved = 1"

        if plan:
            query += " AND p.subscription_plan = %s"
            params.append(plan)

        if search:
            query += " AND (u.username LIKE %s OR u.email LIKE %s OR p.company LIKE %s)"
            params.extend([f'%{search}%'] * 3)

        query += " ORDER BY u.date_joined DESC"

        users = safe_query(query, params)

        # Build diamond balance lookup
        from accounts.models import DiamondWallet
        wallet_map = {}
        for w in DiamondWallet.objects.values('user_id', 'balance'):
            wallet_map[w['user_id']] = w['balance']

        for user in users:
            tokens = to_float(user.get('caption_tokens', 0))
            user['total_tokens'] = int(tokens)
            user['estimated_cost'] = estimate_cost(tokens)
            user['diamond_balance'] = wallet_map.get(user['id'], 0)
            if user.get('date_joined'):
                user['date_joined'] = str(user['date_joined'])
            if user.get('last_login'):
                user['last_login'] = str(user['last_login'])

        return Response({'users': users})


# ==================== User Detail ====================

class AdminUserDetailView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

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

        # Serialize profile dates
        for key in list(profile.keys()):
            val = profile[key]
            if hasattr(val, 'isoformat'):
                profile[key] = str(val)

        # Diamond wallet info
        from accounts.models import DiamondWallet
        wallet, _ = DiamondWallet.objects.get_or_create(user=user)
        diamond = {
            'balance': wallet.balance,
            'total_recharged': wallet.total_recharged,
            'total_spent': wallet.total_spent,
        }

        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'date_joined': str(user.date_joined),
                'last_login': str(user.last_login) if user.last_login else None,
            },
            'profile': profile,
            'stats': stats,
            'tokens': tokens,
            'diamond': diamond,
        })


# ==================== User Actions ====================

class AdminApproveUserView(APIView):
    permission_classes = [IsOriginalAdmin]

    def post(self, request, user_id):
        try:
            with db_connection.cursor() as cursor:
                cursor.execute("UPDATE user_profiles SET is_approved = 1 WHERE user_id = %s", [user_id])
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminRejectUserView(APIView):
    permission_classes = [IsOriginalAdmin]

    def post(self, request, user_id):
        try:
            with db_connection.cursor() as cursor:
                cursor.execute("UPDATE user_profiles SET is_approved = 0 WHERE user_id = %s", [user_id])
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUpdatePlanView(APIView):
    permission_classes = [IsOriginalAdmin]

    def put(self, request, user_id):
        plan = request.data.get('plan', 'free')
        max_posts = request.data.get('max_posts', 30)
        max_accounts = request.data.get('max_accounts', 3)
        try:
            with db_connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE user_profiles SET subscription_plan = %s, max_posts_per_month = %s, max_social_accounts = %s WHERE user_id = %s",
                    [plan, max_posts, max_accounts, user_id]
                )
            # Auto-grant diamond tokens for the new plan
            from accounts.services.diamond_service import grant_plan_diamonds
            target_user = User.objects.get(id=user_id)
            grant_plan_diamonds(target_user, plan)
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminBulkApproveView(APIView):
    permission_classes = [IsOriginalAdmin]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        if not user_ids:
            return Response({'error': 'No users'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with db_connection.cursor() as cursor:
                placeholders = ','.join(['%s'] * len(user_ids))
                cursor.execute(f"UPDATE user_profiles SET is_approved = 1 WHERE user_id IN ({placeholders})", user_ids)
            return Response({'success': True, 'count': len(user_ids)})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== API Settings ====================

class AdminAPISettingsView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
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

        return Response({
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

    def put(self, request, user_id):
        admin_managed = request.data.get('admin_managed', False)
        openai_key = request.data.get('openai_key', '').strip()
        gemini_key = request.data.get('gemini_key', '').strip()

        try:
            with db_connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE user_profiles
                    SET api_mode = %s, admin_openai_key = %s, admin_gemini_key = %s
                    WHERE user_id = %s
                """, ['admin' if admin_managed else 'user', openai_key or None, gemini_key or None, user_id])

                if openai_key:
                    # Caption/text AI now uses Claude (global admin key) — skip caption sync.
                    # Only sync to messenger bot (for embeddings) and image/voice services.
                    cursor.execute("""
                        UPDATE ai_configurations ac
                        JOIN messenger_connections mc ON ac.connection_id = mc.id
                        SET ac.openai_api_key = %s
                        WHERE mc.user_id = %s
                    """, [openai_key, user_id])

                if gemini_key:
                    cursor.execute("SELECT id FROM ai_image_userimagesettings WHERE user_id = %s", [user_id])
                    if cursor.fetchone():
                        cursor.execute("UPDATE ai_image_userimagesettings SET gemini_api_key = %s WHERE user_id = %s", [gemini_key, user_id])
                    else:
                        cursor.execute("INSERT INTO ai_image_userimagesettings (user_id, gemini_api_key, default_style, default_size, total_images_generated) VALUES (%s, %s, 'vivid', '1024x1024', 0)", [user_id, gemini_key])

                    cursor.execute("SELECT id FROM ai_video_uservideosettings WHERE user_id = %s", [user_id])
                    if cursor.fetchone():
                        cursor.execute("UPDATE ai_video_uservideosettings SET gemini_api_key = %s WHERE user_id = %s", [gemini_key, user_id])
                    else:
                        cursor.execute("INSERT INTO ai_video_uservideosettings (user_id, gemini_api_key, default_style, default_duration, total_videos_generated) VALUES (%s, %s, 'cinematic', 5, 0)", [user_id, gemini_key])

            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== User Data Endpoints ====================

class AdminUserPostsView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        posts = safe_query("""
            SELECT id, caption, status, platforms, media_files, ai_generated, created_at, scheduled_time, posted_at
            FROM posts WHERE user_id = %s ORDER BY created_at DESC
        """, [user_id])
        for p in posts:
            for k in ['created_at', 'scheduled_time', 'posted_at']:
                if p.get(k):
                    p[k] = str(p[k])
        return Response({'posts': posts})


class AdminUserAccountsView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        accounts = safe_query("""
            SELECT id, platform, account_name, status, is_active, is_validated, connected_at
            FROM social_accounts WHERE user_id = %s ORDER BY connected_at DESC
        """, [user_id])
        for a in accounts:
            if a.get('connected_at'):
                a['connected_at'] = str(a['connected_at'])
        return Response({'accounts': accounts})


class AdminUserCaptionsView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        captions = safe_query("""
            SELECT id, input_text, generated_caption, platform, status, tokens_used, model_used, created_at
            FROM ai_caption_captiongeneration WHERE user_id = %s ORDER BY created_at DESC
        """, [user_id])
        total_tokens = sum(to_float(c.get('tokens_used', 0)) for c in captions)
        completed = len([c for c in captions if c.get('status') == 'completed'])
        for c in captions:
            c['tokens_used'] = int(to_float(c.get('tokens_used', 0)))
            if c.get('created_at'):
                c['created_at'] = str(c['created_at'])
        return Response({
            'captions': captions,
            'stats': {
                'total': len(captions),
                'completed': completed,
                'tokens': int(total_tokens),
                'cost': estimate_cost(total_tokens)
            }
        })


class AdminUserImagesView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        images = safe_query("""
            SELECT id, title, prompt, style, size, status, created_at
            FROM ai_image_imagegeneration WHERE user_id = %s ORDER BY created_at DESC
        """, [user_id])
        for i in images:
            if i.get('created_at'):
                i['created_at'] = str(i['created_at'])
        return Response({'images': images})


class AdminUserMessengerView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        connections = safe_query("SELECT id, page_id, page_name, is_active, connected_at FROM messenger_connections WHERE user_id = %s", [user_id])
        for c in connections:
            if c.get('connected_at'):
                c['connected_at'] = str(c['connected_at'])

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
                if cv.get('created_at'):
                    cv['created_at'] = str(cv['created_at'])
                if cv.get('updated_at'):
                    cv['updated_at'] = str(cv['updated_at'])
            conversations.extend(convs)

        return Response({'connections': connections, 'conversations': conversations})


class AdminConversationMessagesView(APIView):
    permission_classes = [IsOriginalAdmin]

    def get(self, request, conv_id):
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
            if m.get('timestamp'):
                m['timestamp'] = str(m['timestamp'])

        return Response({
            'messages': messages,
            'stats': {
                'total': total_messages,
                'user': user_messages,
                'bot': bot_messages,
                'tokens': int(total_tokens),
                'cost': estimate_cost(total_tokens)
            }
        })


# ==================== Analytics ====================


# ══════════════════════════════════════════════════════════════════════════════
# Facebook OAuth Settings (Admin only)
# ══════════════════════════════════════════════════════════════════════════════

class FacebookSettingsView(APIView):
    """
    GET  /api/v1/admin/facebook-settings/  → read current FB OAuth config + webhook info
    POST /api/v1/admin/facebook-settings/  → save FB OAuth config to SiteConfiguration
                                             auto-generates messenger_verify_token on first save
                                             pass regenerate_verify_token=true to get a new one

    Values are stored in the SiteConfiguration DB table so the admin can
    update them at any time without touching server files or restarting.

    The App Secret is masked in GET responses (last 6 chars shown only).
    """
    permission_classes = [IsAdminUser]

    # Keys stored in SiteConfiguration
    KEYS = {
        'facebook_app_id':       'Facebook App ID (from Meta Developer Console → Settings → Basic)',
        'facebook_app_secret':   'Facebook App Secret (keep this private)',
        'facebook_redirect_uri': 'OAuth Redirect URI (must match Meta Dashboard exactly)',
        'frontend_url':          'Frontend URL (your React app URL, used for popup security)',
    }

    def _get_webhook_info(self, request):
        """Build the single app-level webhook URL and return verify token from DB."""
        import secrets as _secrets
        verify_token = SiteConfiguration.get('messenger_verify_token', '')
        # Auto-generate if missing (first time admin loads this page after upgrade)
        if not verify_token:
            verify_token = _secrets.token_urlsafe(32)
            SiteConfiguration.set(
                'messenger_verify_token',
                verify_token,
                'App-level Facebook Messenger webhook verify token. Copy this into Meta Developer Console.'
            )
        backend_base = request.build_absolute_uri('/').rstrip('/')
        webhook_url  = f"{backend_base}/messenger/webhook/"
        return verify_token, webhook_url

    def get(self, request):
        """Return current Facebook OAuth settings + Messenger webhook info."""
        data = {}
        for key, description in self.KEYS.items():
            raw = SiteConfiguration.get(key, '')
            if key == 'facebook_app_secret' and raw:
                display = '•' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '••••••'
            else:
                display = raw
            data[key] = {
                'value':       display,
                'is_set':      bool(raw),
                'description': description,
            }

        app_id       = SiteConfiguration.get('facebook_app_id', '')
        app_secret   = SiteConfiguration.get('facebook_app_secret', '')
        redirect_uri = SiteConfiguration.get('facebook_redirect_uri', '')
        frontend_url = SiteConfiguration.get('frontend_url', '')

        is_configured = bool(app_id and app_secret and redirect_uri)
        missing = []
        if not app_id:      missing.append('App ID')
        if not app_secret:  missing.append('App Secret')
        if not redirect_uri: missing.append('Redirect URI')
        if not frontend_url: missing.append('Frontend URL (optional but recommended)')

        verify_token, webhook_url = self._get_webhook_info(request)

        return Response({
            'settings':      data,
            'is_configured': is_configured,
            'missing':       missing,
            # ── Messenger Webhook (copy these into Meta Developer Console) ──────
            'messenger_webhook': {
                'webhook_url':    webhook_url,
                'verify_token':   verify_token,
                'fields':         'messages, messaging_postbacks, messaging_optins',
                'note': (
                    'Set this ONE webhook URL in Meta Developer Console → '
                    'Your App → Messenger → Webhooks. '
                    'All users\' pages will send messages to this single URL automatically.'
                ),
            },
            'messenger_feature_enabled': SiteConfiguration.get('messenger_feature_enabled', 'true') == 'true',
            'help': {
                'where_to_find': 'https://developers.facebook.com → Your App → Settings → Basic',
                'redirect_uri_note': (
                    'The Redirect URI here MUST match exactly what you add in Meta Dashboard → '
                    'Facebook Login → Settings → Valid OAuth Redirect URIs'
                ),
                'frontend_url_note': (
                    'Used to validate postMessage origin in the popup. '
                    'Set to your React app domain, e.g. https://abedintechllc.com'
                ),
            },
        })

    def post(self, request):
        """
        Save Facebook OAuth settings.
        Only updates keys that are provided and non-empty.
        Pass regenerate_verify_token=true to generate a new Messenger webhook token.
        """
        import secrets as _secrets
        updated = []
        errors  = []

        # ── Messenger feature toggle ───────────────────────────────────────────
        if 'messenger_feature_enabled' in request.data:
            enabled = str(request.data['messenger_feature_enabled']).lower() in ('true', '1', 'yes')
            SiteConfiguration.set(
                'messenger_feature_enabled',
                'true' if enabled else 'false',
                'Master kill switch for the Messenger Bot feature. Set to false to fully disable.'
            )
            updated.append('messenger_feature_enabled')

        # ── Optionally regenerate the Messenger verify token ─────────────────
        if request.data.get('regenerate_verify_token'):
            new_token = _secrets.token_urlsafe(32)
            SiteConfiguration.set(
                'messenger_verify_token',
                new_token,
                'App-level Facebook Messenger webhook verify token. Copy this into Meta Developer Console.'
            )
            updated.append('messenger_verify_token')

        for key in self.KEYS:
            if key not in request.data:
                continue

            value = str(request.data[key]).strip()

            if key == 'facebook_redirect_uri' and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append('facebook_redirect_uri must start with http:// or https://')
                    continue

            if key == 'frontend_url' and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append('frontend_url must start with http:// or https://')
                    continue

            try:
                SiteConfiguration.set(key, value, self.KEYS[key])
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response(
                {'error': 'Failed to save settings.', 'details': errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Auto-generate verify token on first save if it doesn't exist yet
        verify_token = SiteConfiguration.get('messenger_verify_token', '')
        if not verify_token:
            verify_token = _secrets.token_urlsafe(32)
            SiteConfiguration.set(
                'messenger_verify_token',
                verify_token,
                'App-level Facebook Messenger webhook verify token. Copy this into Meta Developer Console.'
            )
            updated.append('messenger_verify_token (auto-generated)')

        app_id       = SiteConfiguration.get('facebook_app_id', '')
        app_secret   = SiteConfiguration.get('facebook_app_secret', '')
        redirect_uri = SiteConfiguration.get('facebook_redirect_uri', '')
        is_configured = bool(app_id and app_secret and redirect_uri)

        verify_token, webhook_url = self._get_webhook_info(request)

        response = {
            'success':       True,
            'updated_keys':  updated,
            'is_configured': is_configured,
            'message': (
                'Facebook OAuth is now fully configured. Users can connect their Facebook Pages.'
                if is_configured else
                'Settings saved. Some required fields are still missing — see is_configured=false.'
            ),
            'messenger_webhook': {
                'webhook_url':  webhook_url,
                'verify_token': verify_token,
                'fields':       'messages, messaging_postbacks, messaging_optins',
            },
            'messenger_feature_enabled': SiteConfiguration.get('messenger_feature_enabled', 'true') == 'true',
        }
        if errors:
            response['warnings'] = errors

        return Response(response)


class AdminFacebookAccountsView(APIView):
    """
    GET /api/v1/admin/facebook-accounts/
    Returns all users' Facebook SocialAccounts so admin can see
    who connected and trigger Messenger setup manually.
    Add ?refresh=1 to force live re-validation of all tokens.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        from platforms.services.facebook import FacebookService
        from messenger_bot.models import MessengerConnection
        from django.utils import timezone
        from datetime import timedelta
        import logging
        logger = logging.getLogger(__name__)

        force_refresh = request.GET.get('refresh') == '1'
        stale_cutoff  = timezone.now() - timedelta(hours=6)

        accounts = SocialAccount.objects.filter(
            platform='facebook'
        ).select_related('user').order_by('user__username', '-connected_at')

        # Re-validate stale tokens so admin sees accurate status
        for a in accounts:
            needs_check = (
                force_refresh
                or a.last_validated_at is None
                or a.last_validated_at < stale_cutoff
            )
            if needs_check and a.facebook_page_id and a.facebook_access_token:
                try:
                    valid, result = FacebookService.validate_credentials(
                        a.facebook_page_id, a.facebook_access_token
                    )
                    if valid:
                        a.mark_as_active()
                    else:
                        a.mark_as_invalid(result)
                except Exception as e:
                    logger.warning(f'[Admin FB] Re-validation failed for {a.account_name}: {e}')

        # Refresh from DB after potential updates
        accounts = SocialAccount.objects.filter(
            platform='facebook'
        ).select_related('user').order_by('user__username', '-connected_at')

        # Get user IDs that have messenger connections
        messenger_user_ids = set(
            MessengerConnection.objects.values_list('user_id', flat=True)
        )

        data = []
        for a in accounts:
            data.append({
                'account_id':          a.id,
                'user_id':             a.user.id,
                'username':            a.user.username,
                'page_id':             a.facebook_page_id,
                'page_name':           a.account_name,
                'status':              a.status,
                'has_token':           bool(a.facebook_access_token),
                'has_messenger':       a.user.id in messenger_user_ids,
                'connected_at':        str(a.connected_at) if a.connected_at else None,
                'last_validated_at':   str(a.last_validated_at) if a.last_validated_at else None,
            })

        return Response({'accounts': data, 'total': len(data)})


class AdminMessengerWebhooksView(APIView):
    """
    GET /api/v1/admin/messenger-webhooks/
    Returns app-level webhook info and all messenger connections across users.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        import secrets as _secrets

        # App-level webhook info
        verify_token = SiteConfiguration.get('messenger_verify_token', '')
        if not verify_token:
            verify_token = _secrets.token_urlsafe(32)
            SiteConfiguration.set(
                'messenger_verify_token',
                verify_token,
                'App-level Facebook Messenger webhook verify token.'
            )

        backend_base = request.build_absolute_uri('/').rstrip('/')
        webhook_url = f"{backend_base}/messenger/webhook/"

        app_webhook = {
            'webhook_url': webhook_url,
            'verify_token': verify_token,
            'fields': 'messages, messaging_postbacks, messaging_optins',
            'is_token_set': bool(verify_token),
            'note': (
                'Set this ONE webhook URL in Meta Developer Console → '
                'Your App → Messenger → Webhooks. '
                'All users\' pages will send messages to this single URL automatically.'
            ),
        }

        # All messenger connections
        from messenger_bot.models import MessengerConnection
        connections_qs = MessengerConnection.objects.select_related('user').order_by('-connected_at')
        connections = []
        for c in connections_qs:
            has_ai = hasattr(c, 'ai_config')
            connections.append({
                'id': c.id,
                'username': c.user.username,
                'page_id': c.page_id,
                'page_name': c.page_name,
                'is_webhook_verified': c.is_webhook_verified,
                'is_active': c.is_active,
                'auto_reply_enabled': c.auto_reply_enabled,
                'connected_at': str(c.connected_at) if c.connected_at else None,
            })

        return Response({
            'app_webhook': app_webhook,
            'connections': connections,
            'total': len(connections),
        })


class AdminSetupMessengerView(APIView):
    """
    POST /api/v1/admin/setup-messenger/
    Manually set up Messenger for a Facebook SocialAccount.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from platforms.models import SocialAccount
        from messenger_bot.models import MessengerConnection
        import logging
        logger = logging.getLogger(__name__)

        account_id = request.data.get('account_id')
        if not account_id:
            return Response({'error': 'account_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = SocialAccount.objects.get(id=account_id, platform='facebook')
        except SocialAccount.DoesNotExist:
            return Response({'error': 'Facebook account not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not account.facebook_access_token:
            return Response({'error': 'Account has no page access token.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create or update MessengerConnection
        conn, created = MessengerConnection.objects.update_or_create(
            user=account.user,
            defaults={
                'page_id': account.facebook_page_id,
                'page_name': account.account_name,
                'page_access_token': account.facebook_access_token,
                'is_active': True,
            }
        )

        # Auto-generate verify token and webhook URL
        backend_base = request.build_absolute_uri('/').rstrip('/')
        webhook_url = f"{backend_base}/messenger/webhook/"
        conn.webhook_url = webhook_url
        conn.save()

        logger.info(f'[Admin] Messenger setup for {account.account_name} (user: {account.user.username})')

        return Response({
            'success': True,
            'page_name': account.account_name,
            'webhook_verified': conn.is_webhook_verified,
            'verify_token': conn.verify_token,
            'webhook_url': webhook_url,
        })


class AdminCheckSubscriptionView(APIView):
    """
    POST /api/v1/admin/check-subscription/
    Check webhook subscription status for a messenger connection.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from messenger_bot.models import MessengerConnection
        import requests as http_requests

        connection_id = request.data.get('connection_id')
        resubscribe = request.data.get('resubscribe', False)

        if not connection_id:
            return Response({'error': 'connection_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            conn = MessengerConnection.objects.get(id=connection_id)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found.'}, status=status.HTTP_404_NOT_FOUND)

        app_id = SiteConfiguration.get('facebook_app_id', '')
        app_secret = SiteConfiguration.get('facebook_app_secret', '')

        if not app_id or not app_secret:
            return Response({
                'is_subscribed': False,
                'subscribed_fields': [],
                'missing_fields': ['messages', 'messaging_postbacks', 'messaging_optins'],
                'diagnosis': 'Facebook App ID or Secret not configured. Cannot check subscription.',
            })

        required_fields = {'messages', 'messaging_postbacks', 'messaging_optins'}
        subscribed_fields = []
        missing_fields = list(required_fields)
        is_subscribed = False
        diagnosis = 'Could not check subscription status.'
        app_mode_info = None
        resubscribe_result = None

        try:
            # Get app access token
            token_url = f'https://graph.facebook.com/oauth/access_token?client_id={app_id}&client_secret={app_secret}&grant_type=client_credentials'
            token_resp = http_requests.get(token_url, timeout=10)
            if token_resp.status_code == 200:
                app_token = token_resp.json().get('access_token')

                # Check subscribed apps for this page
                sub_url = f'https://graph.facebook.com/v19.0/{conn.page_id}/subscribed_apps?access_token={conn.page_access_token}'
                sub_resp = http_requests.get(sub_url, timeout=10)

                if sub_resp.status_code == 200:
                    sub_data = sub_resp.json().get('data', [])
                    for app in sub_data:
                        if str(app.get('id')) == str(app_id):
                            subscribed_fields = app.get('subscribed_fields', [])
                            break

                    found = set(subscribed_fields)
                    missing_fields = list(required_fields - found)
                    is_subscribed = len(missing_fields) == 0

                    if is_subscribed:
                        diagnosis = 'Page is fully subscribed to all required webhook fields.'
                    else:
                        diagnosis = f'Page subscription is incomplete. Missing: {", ".join(missing_fields)}'
                else:
                    diagnosis = f'Facebook API returned {sub_resp.status_code} when checking subscriptions.'

                # Check app mode
                try:
                    app_url = f'https://graph.facebook.com/v19.0/{app_id}?fields=name,status&access_token={app_token}'
                    app_resp = http_requests.get(app_url, timeout=10)
                    if app_resp.status_code == 200:
                        app_data = app_resp.json()
                        is_live = app_data.get('status') == 'live'
                        app_mode_info = {
                            'name': app_data.get('name', ''),
                            'status': app_data.get('status', 'unknown'),
                            'is_live': is_live,
                            'note': '' if is_live else 'App is in Development mode. Only test users can interact with the bot.',
                        }
                except Exception:
                    pass

                # Resubscribe if requested
                if resubscribe and not is_subscribed:
                    try:
                        resub_url = f'https://graph.facebook.com/v19.0/{conn.page_id}/subscribed_apps'
                        resub_resp = http_requests.post(resub_url, data={
                            'subscribed_fields': ','.join(required_fields),
                            'access_token': conn.page_access_token,
                        }, timeout=10)
                        if resub_resp.status_code == 200 and resub_resp.json().get('success'):
                            resubscribe_result = {'attempted': True, 'success': True}
                            is_subscribed = True
                            missing_fields = []
                            subscribed_fields = list(required_fields)
                            diagnosis = 'Successfully re-subscribed to all required fields.'
                        else:
                            error_msg = resub_resp.json().get('error', {}).get('message', 'Unknown error')
                            resubscribe_result = {'attempted': True, 'success': False, 'error': error_msg}
                    except Exception as e:
                        resubscribe_result = {'attempted': True, 'success': False, 'error': str(e)}

            else:
                diagnosis = 'Could not get Facebook app access token. Check App ID and Secret.'

        except Exception as e:
            diagnosis = f'Error checking subscription: {str(e)}'

        result = {
            'is_subscribed': is_subscribed,
            'subscribed_fields': subscribed_fields,
            'missing_fields': missing_fields,
            'diagnosis': diagnosis,
        }
        if app_mode_info:
            result['app_mode'] = app_mode_info
        if resubscribe_result:
            result['resubscribe_result'] = resubscribe_result

        return Response(result)


class AdminTestWebhookView(APIView):
    """
    POST /api/v1/admin/test-webhook/
    Test the full webhook pipeline for a messenger connection.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from messenger_bot.models import MessengerConnection, Conversation

        connection_id = request.data.get('connection_id')
        if not connection_id:
            return Response({'error': 'connection_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            conn = MessengerConnection.objects.get(id=connection_id)
        except MessengerConnection.DoesNotExist:
            return Response({'error': 'Connection not found.'}, status=status.HTTP_404_NOT_FOUND)

        has_ai_config = hasattr(conn, 'ai_config')
        before_count = Conversation.objects.filter(connection=conn).count()

        # Get recent conversations
        recent_convos = Conversation.objects.filter(connection=conn).order_by('-last_message_at')[:5]
        recent = [{
            'id': c.id,
            'sender_id': c.sender_id,
            'sender_name': c.sender_name,
            'message_count': c.message_count,
            'last_message_at': str(c.last_message_at),
        } for c in recent_convos]

        after_count = before_count
        new_conversation = False
        diagnosis = (
            'Pipeline test completed. Check conversations count to verify webhook delivery. '
            'Note: actual message delivery test requires sending a message via Facebook Messenger.'
        )

        if not has_ai_config:
            diagnosis += ' Warning: No AI configuration found — user needs to configure AI settings.'

        return Response({
            'connection': {
                'id': conn.id,
                'page_id': conn.page_id,
                'page_name': conn.page_name,
                'user': conn.user.username,
                'is_active': conn.is_active,
                'is_webhook_verified': conn.is_webhook_verified,
                'has_ai_config': has_ai_config,
            },
            'conversations': {
                'before_test': before_count,
                'after_test': after_count,
                'new_conversation': new_conversation,
                'recent': recent,
            },
            'diagnosis': diagnosis,
        })


# ==================== Per-User Magic Mode Prompt Overrides ====================

PROMPT_TYPE_META = [
    # Ideas
    {'type': 'idea_system',         'display_name': 'Idea Generator — System',              'stage': 'Magic Mode · Idea generation (system role)'},
    {'type': 'idea_user',           'display_name': 'Idea Generator — User Context',         'stage': 'Magic Mode · Idea generation (user message)'},
    {'type': 'idea_regenerate',     'display_name': 'Idea Regenerator — System',             'stage': 'Magic Mode · Idea regeneration with feedback'},
    # Captions
    {'type': 'caption_system',      'display_name': 'Caption Generator — System',            'stage': 'Magic Mode · Caption generation (system role)'},
    {'type': 'caption_user',        'display_name': 'Caption Generator — User Context',      'stage': 'Magic Mode · Caption generation (user message)'},
    {'type': 'caption_regenerate',  'display_name': 'Caption Regenerator — System',          'stage': 'Magic Mode · Caption regeneration with feedback'},
    {'type': 'caption_adapt',       'display_name': 'Caption Cross-Platform Adapter',        'stage': 'Magic Mode · Caption adaptation to other platforms'},
    # Images
    {'type': 'image_refiner',       'display_name': 'Image Prompt Refiner',                 'stage': 'Magic Mode · Image prompt refinement'},
    {'type': 'image_product_bg',    'display_name': 'Product Background Prompt',             'stage': 'Magic Mode · Product image background generation'},
    {'type': 'image_product_smart', 'display_name': 'Style-Matched Background Prompt',      'stage': 'Magic Mode · Smart style-matched background'},
    # Video
    {'type': 'video_prompt',        'display_name': 'Video Prompt Builder',                 'stage': 'Magic Mode · Video generation (Veo)'},
    # Brand DNA
    {'type': 'brand_dna',           'display_name': 'Brand DNA — Registration Enrichment',  'stage': 'Brand profile · Registration DNA enrichment'},
    {'type': 'brand_dna_website',   'display_name': 'Brand DNA — Website Extraction',       'stage': 'Brand profile · Full website DNA extraction'},
    {'type': 'brand_dna_manual',    'display_name': 'Brand DNA — Manual Enhancement',       'stage': 'Brand profile · Manual input DNA enhancement'},
    # Trending
    {'type': 'trending_filter',     'display_name': 'Trending Topics Filter — System',      'stage': 'Magic Mode · Google Trends Claude filter'},
    # Competitors
    {'type': 'competitor_analyze',  'display_name': 'Competitor Crawler — Analysis',        'stage': 'Competitor intel · Crawl & analyse posts'},
    {'type': 'competitor_suggest',  'display_name': 'Competitor Suggester — System',        'stage': 'Competitor intel · Suggest new competitors'},
    # Pillars
    {'type': 'pillars_generate',    'display_name': 'Content Pillars Generator — System',   'stage': 'Strategy · Content pillar generation'},
    # Support
    {'type': 'support_chat',        'display_name': 'Support Chat — System Prompt',         'stage': 'Support bot · Chat system instructions'},
]
_VALID_PROMPT_TYPES = {p['type'] for p in PROMPT_TYPE_META}


def _serialize_override(o):
    return {
        'id': o.id,
        'prompt_type': o.prompt_type,
        'prompt_text': o.prompt_text,
        'is_active': o.is_active,
        'updated_at': o.updated_at.isoformat() if o.updated_at else None,
        'updated_by': o.updated_by.username if o.updated_by else None,
        'created_at': o.created_at.isoformat() if o.created_at else None,
        'created_by': o.created_by.username if o.created_by else None,
    }


class AdminPromptOverridesListView(APIView):
    """GET /api/v1/admin/users/<user_id>/prompt-overrides/

    Returns metadata for all 6 prompt types, the user's existing overrides
    (if any), the variable schema, and a default-preview snippet for each
    type — everything the admin UI needs to render the editor.
    """
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        from accounts.models import UserPromptOverride, PromptExecution
        from accounts.services.prompt_resolver import (
            PROMPT_SCHEMA, get_default_preview, get_default_full,
        )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        existing = {
            o.prompt_type: o
            for o in UserPromptOverride.objects.filter(user=target_user)
        }

        # Bulk-fetch the most recent execution per prompt_type for this user
        # so the admin UI can show "what actually got sent last time" with
        # all dynamic variables already filled in.
        last_exec_map = {}
        for prompt_type in _VALID_PROMPT_TYPES:
            last = (
                PromptExecution.objects
                .filter(user=target_user, prompt_type=prompt_type)
                .order_by('-created_at')
                .first()
            )
            if last is not None:
                last_exec_map[prompt_type] = last

        prompts = []
        for meta in PROMPT_TYPE_META:
            t = meta['type']
            o = existing.get(t)
            last = last_exec_map.get(t)
            prompts.append({
                **meta,
                'variables': PROMPT_SCHEMA.get(t, []),
                'default_preview': get_default_preview(t),
                'default_full': get_default_full(t),
                'override': _serialize_override(o) if o else None,
                'last_execution': {
                    'id': last.id,
                    'created_at': last.created_at.isoformat(),
                    'was_override': last.was_override,
                    'model_used': last.model_used,
                    'tokens_in': last.tokens_in,
                    'tokens_out': last.tokens_out,
                    'success': last.success,
                    'prompt_sent': last.prompt_sent,
                    'response_received': last.response_received,
                    'brand_name': last.brand_name,
                } if last else None,
            })

        return Response({
            'target_user': {
                'id': target_user.id,
                'username': target_user.username,
                'email': target_user.email,
            },
            'prompts': prompts,
        })


class AdminPromptOverrideDetailView(APIView):
    """PUT/DELETE /api/v1/admin/users/<user_id>/prompt-overrides/<prompt_type>/

    PUT body: { prompt_text: str, is_active?: bool }
    Creates or updates the override and writes an audit row.
    DELETE removes the override (hard delete) and writes an audit row.
    """
    permission_classes = [IsOriginalAdmin]

    def put(self, request, user_id, prompt_type):
        from accounts.models import UserPromptOverride, PromptOverrideAuditLog

        if prompt_type not in _VALID_PROMPT_TYPES:
            return Response(
                {'error': f'Unknown prompt_type: {prompt_type!r}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt_text = request.data.get('prompt_text', '')
        is_active = request.data.get('is_active', True)
        if not isinstance(prompt_text, str) or not prompt_text.strip():
            return Response(
                {'error': 'prompt_text is required and must be a non-empty string.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        admin_user = getattr(request, '_original_user', request.user)

        existing = UserPromptOverride.objects.filter(
            user=target_user, prompt_type=prompt_type,
        ).first()
        previous_text = existing.prompt_text if existing else ''
        action = 'update' if existing else 'create'

        if existing:
            existing.prompt_text = prompt_text
            existing.is_active = bool(is_active)
            existing.updated_by = admin_user
            existing.save()
            override = existing
        else:
            override = UserPromptOverride.objects.create(
                user=target_user,
                prompt_type=prompt_type,
                prompt_text=prompt_text,
                is_active=bool(is_active),
                created_by=admin_user,
                updated_by=admin_user,
            )

        PromptOverrideAuditLog.objects.create(
            override=override,
            target_user=target_user,
            prompt_type=prompt_type,
            action=action,
            admin=admin_user,
            previous_text=previous_text,
            new_text=prompt_text,
        )

        return Response({'ok': True, 'override': _serialize_override(override)})

    def delete(self, request, user_id, prompt_type):
        from accounts.models import UserPromptOverride, PromptOverrideAuditLog

        if prompt_type not in _VALID_PROMPT_TYPES:
            return Response(
                {'error': f'Unknown prompt_type: {prompt_type!r}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        admin_user = getattr(request, '_original_user', request.user)
        existing = UserPromptOverride.objects.filter(
            user=target_user, prompt_type=prompt_type,
        ).first()
        if not existing:
            return Response({'ok': True, 'message': 'No override to delete.'})

        previous_text = existing.prompt_text
        existing.delete()

        PromptOverrideAuditLog.objects.create(
            override=None,
            target_user=target_user,
            prompt_type=prompt_type,
            action='delete',
            admin=admin_user,
            previous_text=previous_text,
            new_text='',
        )

        return Response({'ok': True})


class AdminPromptOverrideAuditView(APIView):
    """GET /api/v1/admin/users/<user_id>/prompt-overrides/<prompt_type>/audit/

    Returns the last 50 audit entries for a (user, prompt_type) pair.
    """
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id, prompt_type):
        from accounts.models import PromptOverrideAuditLog

        if prompt_type not in _VALID_PROMPT_TYPES:
            return Response(
                {'error': f'Unknown prompt_type: {prompt_type!r}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        rows = PromptOverrideAuditLog.objects.filter(
            target_user=target_user, prompt_type=prompt_type,
        ).order_by('-created_at')[:50]

        return Response({
            'audit': [
                {
                    'id': r.id,
                    'action': r.action,
                    'admin': r.admin.username if r.admin else None,
                    'admin_id': r.admin.id if r.admin else None,
                    'previous_text': r.previous_text,
                    'new_text': r.new_text,
                    'created_at': r.created_at.isoformat(),
                }
                for r in rows
            ],
        })


class AdminPromptExecutionHistoryView(APIView):
    """GET /api/v1/admin/users/<user_id>/prompt-executions/

    Query params:
      prompt_type  — filter to a specific prompt type (optional)
      page         — 1-based page number (default 1)
      page_size    — records per page, max 100 (default 20)

    Returns a paginated list of PromptExecution records for the user, newest
    first, including the full prompt sent, the AI response, model used, token
    count, latency, and whether an admin override was active.
    """
    permission_classes = [IsOriginalAdmin]

    def get(self, request, user_id):
        from accounts.models import PromptExecution

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        prompt_type = request.GET.get('prompt_type', '').strip()
        try:
            page = max(1, int(request.GET.get('page', 1)))
            page_size = min(100, max(1, int(request.GET.get('page_size', 20))))
        except (ValueError, TypeError):
            page, page_size = 1, 20

        qs = PromptExecution.objects.filter(user=target_user)
        if prompt_type:
            qs = qs.filter(prompt_type=prompt_type)

        total = qs.count()
        offset = (page - 1) * page_size
        rows = qs.select_related()[offset: offset + page_size]

        executions = [
            {
                'id': r.id,
                'prompt_type': r.prompt_type,
                'was_override': r.was_override,
                'model_used': r.model_used,
                'tokens_in': r.tokens_in,
                'tokens_out': r.tokens_out,
                'latency_ms': r.latency_ms,
                'success': r.success,
                'error_message': r.error_message,
                'brand_id': r.brand_id,
                'brand_name': r.brand_name,
                'prompt_sent': r.prompt_sent,
                'response_received': r.response_received,
                'created_at': r.created_at.isoformat(),
            }
            for r in rows
        ]

        return Response({
            'target_user': {
                'id': target_user.id,
                'username': target_user.username,
                'email': target_user.email,
            },
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
            'executions': executions,
        })


# ============================================================
# STRIPE SETTINGS
# ============================================================

class AdminStripeSettingsView(APIView):
    """
    GET  /api/v1/admin/stripe-settings/  → read current Stripe config + status
    POST /api/v1/admin/stripe-settings/  → save Stripe keys + price IDs

    Values are stored in the SiteConfiguration table so the admin can
    rotate keys without touching env files or restarting the server.

    Env-based settings remain as a fallback for first-boot / CI. A
    field's `source` field tells the admin where the active value is
    coming from ('db' or 'env').

    Secret values (Secret Key, Webhook Secret) are masked on GET.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from accounts.services import stripe_config

        fields = stripe_config.describe_for_admin()

        # Compute setup status for the UI's progress checklist.
        by_key = {f['key']: f for f in fields}
        plan_ready = all(by_key[k]['is_set'] for k in (
            'price_pro_monthly', 'price_pro_yearly',
            'price_business_monthly', 'price_business_yearly',
        ))
        topup_ready = all(by_key[k]['is_set'] for k in (
            'price_topup_1k', 'price_topup_5k',
            'price_topup_10k', 'price_topup_25k',
        ))
        keys_ready = all(by_key[k]['is_set'] for k in (
            'publishable_key', 'secret_key', 'webhook_secret',
        ))

        # Detect mode (test vs live) from the publishable key prefix when present.
        pk_value = stripe_config.publishable_key()
        if pk_value.startswith('pk_live_'):
            mode = 'live'
        elif pk_value.startswith('pk_test_'):
            mode = 'test'
        else:
            mode = 'unknown'

        # Build the live webhook URL the admin should register in the Stripe Dashboard.
        backend_base = request.build_absolute_uri('/').rstrip('/')
        webhook_url = f'{backend_base}/api/v1/billing/stripe/webhook/'

        return Response({
            'fields': fields,
            'status': {
                'keys_ready':        keys_ready,
                'plan_prices_ready': plan_ready,
                'topup_prices_ready': topup_ready,
                'fully_configured':  stripe_config.is_fully_configured(),
                'mode':              mode,
            },
            'webhook': {
                'url': webhook_url,
                'events_to_subscribe': [
                    'checkout.session.completed',
                    'customer.subscription.created',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'invoice.paid',
                    'invoice.payment_failed',
                    'payment_intent.succeeded',
                    'payment_intent.payment_failed',
                    'payment_method.attached',
                    'payment_method.detached',
                ],
                'note': (
                    'Register this URL at Stripe Dashboard → Developers → Webhooks. '
                    'Subscribe to the events above, then copy the signing secret '
                    '(whsec_…) into the Webhook Secret field on this page.'
                ),
            },
            'help': {
                'dashboard_url': 'https://dashboard.stripe.com/apikeys',
                'mode_note': (
                    'Test mode uses sk_test_/pk_test_ keys; live mode uses '
                    'sk_live_/pk_live_. Test & live each have their own catalog '
                    'of Products/Prices and a separate webhook signing secret.'
                ),
            },
        })

    def post(self, request):
        from accounts.services import stripe_config

        # Filter the payload to only the fields we recognise; ignore the rest
        # so callers can POST whole-form payloads safely.
        accepted_keys = {f['key'] for f in stripe_config.ADMIN_FIELDS}
        payload = {k: v for k, v in request.data.items() if k in accepted_keys}

        result = stripe_config.update_from_admin(payload)

        if result['errors'] and not result['updated']:
            return Response(
                {'error': 'Failed to save Stripe settings.',
                 'details': result['errors']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Re-read fresh state so the UI immediately reflects new sources.
        return Response({
            'updated': result['updated'],
            'errors':  result['errors'],
            'fields':  stripe_config.describe_for_admin(),
            'fully_configured': stripe_config.is_fully_configured(),
        })


class AdminStripeSettingsTestView(APIView):
    """
    GET /api/v1/admin/stripe-settings/test/

    Verify the configured secret_key + webhook_secret actually work by
    calling `stripe.Account.retrieve()` (no side effects). Lets admins
    confirm the keys before relying on them for real charges.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from accounts.services import stripe_config, stripe_service
        import stripe as _stripe

        if not stripe_config.secret_key():
            return Response({
                'ok': False,
                'error': 'Secret key is not set. Configure it on this page first.',
            })

        try:
            stripe_mod = stripe_service._client()
            account = stripe_mod.Account.retrieve()
        except _stripe.error.AuthenticationError as exc:
            return Response({
                'ok': False,
                'error': f'Stripe rejected the secret key: {exc}',
            })
        except _stripe.error.StripeError as exc:
            return Response({
                'ok': False,
                'error': f'Stripe API error: {exc}',
            })
        except Exception as exc:  # noqa: BLE001
            return Response({
                'ok': False,
                'error': f'Unexpected error: {exc}',
            })

        # Detect test vs live mode from the publishable key prefix.
        pk = stripe_config.publishable_key()
        if pk.startswith('pk_live_'):
            mode = 'live'
        elif pk.startswith('pk_test_'):
            mode = 'test'
        else:
            mode = 'unknown'

        return Response({
            'ok':            True,
            'account_id':    account.id,
            'mode':          mode,
            'email':         getattr(account, 'email', '') or '',
            'business_name': (getattr(account, 'business_profile', None) or {}).get('name', '') if hasattr(account, 'business_profile') else '',
            'country':       getattr(account, 'country', '') or '',
            'charges_enabled': getattr(account, 'charges_enabled', False),
            'payouts_enabled': getattr(account, 'payouts_enabled', False),
        })


# ============================================================
# REFUNDS
# ============================================================

class AdminRefundListView(APIView):
    """
    GET /api/v1/admin/refunds/?status=requested|approved|rejected|processing|refunded|failed&page=1

    List PaymentRequest rows that are in some stage of the refund flow.
    Default filter: status='requested' (pending admin review).
    """
    permission_classes = [IsAdminUser]
    PAGE_SIZE = 30

    def get(self, request):
        from accounts.models import PaymentRequest

        filter_status = request.query_params.get('status', 'requested')
        try:
            page = max(1, int(request.query_params.get('page', '1')))
        except (TypeError, ValueError):
            page = 1
        start = (page - 1) * self.PAGE_SIZE
        end = start + self.PAGE_SIZE

        qs = PaymentRequest.objects.select_related('user').exclude(refund_status='')
        if filter_status:
            qs = qs.filter(refund_status=filter_status)
        qs = qs.order_by('-refund_requested_at', '-created_at')

        total = qs.count()
        rows = list(qs[start:end])

        items = [_serialize_refund_for_admin(p) for p in rows]
        return Response({
            'items': items,
            'total': total,
            'page': page,
            'page_size': self.PAGE_SIZE,
            'total_pages': max(1, (total + self.PAGE_SIZE - 1) // self.PAGE_SIZE),
            'filter_status': filter_status,
        })


def _serialize_refund_for_admin(pr) -> dict:
    return {
        'id': pr.id,
        'user': {
            'id': pr.user_id,
            'username': pr.user.username,
            'email': pr.user.email,
        },
        'created_at': pr.created_at.isoformat(),
        'plan': pr.plan,
        'purpose': pr.purpose,
        'amount_usd': str(pr.amount_usd),
        'revenue_usd': str(pr.revenue_usd),
        'payment_provider': pr.payment_provider,
        'payment_method': pr.payment_method,
        'stripe_payment_intent_id': pr.stripe_payment_intent_id,
        'stripe_refund_id': pr.stripe_refund_id,
        'diamonds_granted': pr.diamonds_granted,
        'diamonds_topped_up': pr.diamonds_topped_up,
        'refund_status': pr.refund_status,
        'refund_amount_usd': str(pr.refund_amount_usd),
        'refund_reason': pr.refund_reason,
        'refund_admin_notes': pr.refund_admin_notes,
        'refund_requested_at': pr.refund_requested_at.isoformat() if pr.refund_requested_at else None,
        'refund_reviewed_at': pr.refund_reviewed_at.isoformat() if pr.refund_reviewed_at else None,
        'refund_reviewed_by': (
            pr.refund_reviewed_by.username if pr.refund_reviewed_by_id else None
        ),
        'refund_processed_at': pr.refund_processed_at.isoformat() if pr.refund_processed_at else None,
    }


class AdminRefundActionView(APIView):
    """
    POST /api/v1/admin/refunds/<pr_id>/approve/   body: { admin_notes? }
    POST /api/v1/admin/refunds/<pr_id>/reject/    body: { admin_notes }   (required)

    Approve fires Stripe.Refund.create; success arrives via webhook.
    Reject is a local-only state change with a required reason that's
    emailed to the user.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pr_id: int, action: str):
        from accounts.models import PaymentRequest
        from accounts.services import refund_service

        try:
            pr = PaymentRequest.objects.get(pk=pr_id)
        except PaymentRequest.DoesNotExist:
            return Response({'error': 'Refund request not found'},
                            status=status.HTTP_404_NOT_FOUND)

        admin_notes = (request.data.get('admin_notes') or '').strip()

        if action == 'approve':
            result = refund_service.approve_refund(
                payment_request=pr, admin_user=request.user, admin_notes=admin_notes,
            )
        elif action == 'reject':
            result = refund_service.reject_refund(
                payment_request=pr, admin_user=request.user, admin_notes=admin_notes,
            )
        else:
            return Response({'error': f'Unknown action: {action}'},
                            status=status.HTTP_400_BAD_REQUEST)

        if not result.get('ok'):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        # Return refreshed row so the UI updates without a separate fetch.
        pr.refresh_from_db()
        return Response({
            **result,
            'item': _serialize_refund_for_admin(pr),
        })

class LinkedInSettingsView(APIView):
    """
    GET  /api/v1/admin/linkedin-settings/  → read current LinkedIn OAuth config (both apps)
    POST /api/v1/admin/linkedin-settings/  → save LinkedIn OAuth config to SiteConfiguration

    Manages two independent LinkedIn apps:
      Personal App  — Sign In with LinkedIn + Share on LinkedIn
      Community App — Community Management API only (company page posting)
    """
    permission_classes = [IsAdminUser]

    PERSONAL_KEYS = {
        'linkedin_client_id':     'Personal App — Client ID (Sign In with LinkedIn + Share on LinkedIn)',
        'linkedin_client_secret': 'Personal App — Client Secret (keep private)',
        'linkedin_redirect_uri':  'Personal App — OAuth Redirect URI (must match LinkedIn portal exactly)',
    }

    COMMUNITY_KEYS = {
        'linkedin_community_client_id':     'Community App — Client ID (Community Management API only)',
        'linkedin_community_client_secret': 'Community App — Client Secret (keep private)',
        'linkedin_community_redirect_uri':  'Community App — OAuth Redirect URI',
    }

    SHARED_KEYS = {
        'frontend_url': 'Frontend URL (React app URL, used for popup security)',
    }

    SECRET_KEYS = {'linkedin_client_secret', 'linkedin_community_client_secret'}
    URI_KEYS    = {'linkedin_redirect_uri', 'linkedin_community_redirect_uri', 'frontend_url'}

    def _mask(self, key, raw):
        if key in self.SECRET_KEYS and raw:
            return '\u2022' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '\u2022' * 6
        return raw

    def _build_section(self, keys):
        data = {}
        for key, description in keys.items():
            raw = SiteConfiguration.get(key, '')
            data[key] = {
                'value':       self._mask(key, raw),
                'is_set':      bool(raw),
                'description': description,
            }
        return data

    def get(self, request):
        personal_data  = self._build_section(self.PERSONAL_KEYS)
        community_data = self._build_section(self.COMMUNITY_KEYS)
        shared_data    = self._build_section(self.SHARED_KEYS)

        p_id  = SiteConfiguration.get('linkedin_client_id', '')
        p_sec = SiteConfiguration.get('linkedin_client_secret', '')
        p_uri = SiteConfiguration.get('linkedin_redirect_uri', '')
        personal_configured = bool(p_id and p_sec and p_uri)

        c_id  = SiteConfiguration.get('linkedin_community_client_id', '')
        c_sec = SiteConfiguration.get('linkedin_community_client_secret', '')
        c_uri = SiteConfiguration.get('linkedin_community_redirect_uri', '')
        community_configured = bool(c_id and c_sec and c_uri)

        personal_missing  = [k for k, v in {'Client ID': p_id, 'Client Secret': p_sec, 'Redirect URI': p_uri}.items() if not v]
        community_missing = [k for k, v in {'Client ID': c_id, 'Client Secret': c_sec, 'Redirect URI': c_uri}.items() if not v]

        return Response({
            'personal': {
                'settings':      personal_data,
                'is_configured': personal_configured,
                'missing':       personal_missing,
            },
            'community': {
                'settings':      community_data,
                'is_configured': community_configured,
                'missing':       community_missing,
            },
            'shared': shared_data,
            'help': {
                'personal_note': (
                    'Personal App needs "Sign In with LinkedIn using OpenID Connect" '
                    'and "Share on LinkedIn" products. Redirect URI: '
                    '.../api/v1/platforms/linkedin/callback/'
                ),
                'community_note': (
                    'Community App needs ONLY "Community Management API" product — '
                    'no other products or they conflict. Redirect URI: '
                    '.../api/v1/platforms/linkedin/community/callback/'
                ),
                'frontend_url_note': (
                    'Used to validate postMessage origin in popups. '
                    'Set to your React app domain e.g. https://yourdomain.com'
                ),
            },
        })

    def post(self, request):
        updated = []
        errors  = []
        all_keys = {**self.PERSONAL_KEYS, **self.COMMUNITY_KEYS, **self.SHARED_KEYS}

        for key, description in all_keys.items():
            if key not in request.data:
                continue
            value = str(request.data[key]).strip()
            if not value:
                continue

            if key in self.URI_KEYS:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append(f'{key} must start with http:// or https://')
                    continue

            try:
                SiteConfiguration.set(key, value, description)
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response(
                {'error': 'Failed to save settings.', 'details': errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        personal_configured  = bool(
            SiteConfiguration.get('linkedin_client_id', '') and
            SiteConfiguration.get('linkedin_client_secret', '') and
            SiteConfiguration.get('linkedin_redirect_uri', '')
        )
        community_configured = bool(
            SiteConfiguration.get('linkedin_community_client_id', '') and
            SiteConfiguration.get('linkedin_community_client_secret', '') and
            SiteConfiguration.get('linkedin_community_redirect_uri', '')
        )

        response = {
            'success':              True,
            'updated_keys':         updated,
            'personal_configured':  personal_configured,
            'community_configured': community_configured,
            'message':              'Settings saved successfully.',
        }
        if errors:
            response['warnings'] = errors

        return Response(response)


class AdminLinkedInAccountsView(APIView):
    """
    GET /api/v1/admin/linkedin-accounts/
    Returns all users' LinkedIn SocialAccounts for admin overview.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        accounts = SocialAccount.objects.filter(platform='linkedin').select_related('user').order_by('-connected_at')

        rows = []
        for acc in accounts:
            rows.append({
                'account_id':      acc.id,
                'user_id':         acc.user_id,
                'username':        acc.user.username,
                'account_name':    acc.account_name,
                'type':            'organization' if acc.linkedin_organization_urn else 'personal',
                'person_urn':      acc.linkedin_person_urn,
                'org_urn':         acc.linkedin_organization_urn,
                'status':          acc.status,
                'has_token':       bool(acc.linkedin_access_token),
                'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
                'connected_at':    acc.connected_at.isoformat() if acc.connected_at else None,
                'last_validated_at': acc.last_validated_at.isoformat() if acc.last_validated_at else None,
            })

        return Response({'accounts': rows, 'total': len(rows)})


class YouTubeSettingsView(APIView):
    """GET/POST /api/v1/admin/youtube-settings/ — YouTube/Google OAuth config."""
    permission_classes = [IsAdminUser]

    KEYS = {
        'youtube_client_id':     'Google Client ID (from Google Cloud Console → Credentials)',
        'youtube_client_secret': 'Google Client Secret (keep this private)',
        'youtube_redirect_uri':  'OAuth Redirect URI (must match Google Cloud Console exactly)',
        'frontend_url':          'Frontend URL (your React app URL)',
    }

    def get(self, request):
        data = {}
        for key, description in self.KEYS.items():
            raw = SiteConfiguration.get(key, '')
            if key == 'youtube_client_secret' and raw:
                display = '\u2022' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '\u2022' * 6
            else:
                display = raw
            data[key] = {'value': display, 'is_set': bool(raw), 'description': description}

        client_id     = SiteConfiguration.get('youtube_client_id', '')
        client_secret = SiteConfiguration.get('youtube_client_secret', '')
        redirect_uri  = SiteConfiguration.get('youtube_redirect_uri', '')

        is_configured = bool(client_id and client_secret and redirect_uri)
        missing = []
        if not client_id:      missing.append('Client ID')
        if not client_secret:  missing.append('Client Secret')
        if not redirect_uri:   missing.append('Redirect URI')

        return Response({
            'settings': data, 'is_configured': is_configured, 'missing': missing,
            'help': {
                'where_to_find': 'https://console.cloud.google.com → APIs & Services → Credentials',
                'redirect_uri_note': 'Must match exactly what you set in Google Cloud Console → Authorized redirect URIs',
                'frontend_url_note': 'Used for popup postMessage security.',
                'quota_note': 'Default: 10,000 units/day. Upload = 1,600 units (~6 uploads/day). Request increase via Cloud Console.',
            },
        })

    def post(self, request):
        updated = []
        errors  = []
        for key in self.KEYS:
            if key not in request.data:
                continue
            value = str(request.data[key]).strip()
            if key in ('youtube_redirect_uri', 'frontend_url') and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append(f'{key} must start with http:// or https://')
                    continue
            try:
                SiteConfiguration.set(key, value, self.KEYS[key])
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response({'error': 'Failed to save.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        client_id     = SiteConfiguration.get('youtube_client_id', '')
        client_secret = SiteConfiguration.get('youtube_client_secret', '')
        redirect_uri  = SiteConfiguration.get('youtube_redirect_uri', '')
        is_configured = bool(client_id and client_secret and redirect_uri)

        response = {
            'success': True, 'updated_keys': updated, 'is_configured': is_configured,
            'message': 'YouTube OAuth is now configured.' if is_configured else 'Settings saved. Some fields still missing.',
        }
        if errors:
            response['warnings'] = errors
        return Response(response)


class AdminYouTubeAccountsView(APIView):
    """GET /api/v1/admin/youtube-accounts/ — all users' YouTube accounts."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        accounts = SocialAccount.objects.filter(platform='youtube').select_related('user').order_by('-connected_at')
        rows = []
        for acc in accounts:
            rows.append({
                'account_id':   acc.id, 'user_id': acc.user_id, 'username': acc.user.username,
                'account_name': acc.account_name, 'channel_id': acc.youtube_channel_id,
                'status': acc.status, 'has_token': bool(acc.youtube_access_token),
                'has_refresh': bool(acc.youtube_refresh_token),
                'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
                'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            })
        return Response({'accounts': rows, 'total': len(rows)})


class PinterestSettingsView(APIView):
    """
    GET  /api/v1/admin/pinterest-settings/  → read current Pinterest OAuth config
    POST /api/v1/admin/pinterest-settings/  → save Pinterest OAuth config
    """
    permission_classes = [IsAdminUser]

    KEYS = {
        'pinterest_client_id':     'Pinterest App ID (from Pinterest Developer Portal)',
        'pinterest_client_secret': 'Pinterest App Secret (keep this private)',
        'pinterest_redirect_uri':  'OAuth Redirect URI (must match Pinterest Developer Portal exactly)',
        'frontend_url':            'Frontend URL (your React app URL, used for popup security)',
    }

    def get(self, request):
        data = {}
        for key, description in self.KEYS.items():
            raw = SiteConfiguration.get(key, '')
            if key == 'pinterest_client_secret' and raw:
                display = '\u2022' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '\u2022' * 6
            else:
                display = raw
            data[key] = {'value': display, 'is_set': bool(raw), 'description': description}

        client_id     = SiteConfiguration.get('pinterest_client_id', '')
        client_secret = SiteConfiguration.get('pinterest_client_secret', '')
        redirect_uri  = SiteConfiguration.get('pinterest_redirect_uri', '')

        is_configured = bool(client_id and client_secret and redirect_uri)
        missing = []
        if not client_id:      missing.append('App ID')
        if not client_secret:  missing.append('App Secret')
        if not redirect_uri:   missing.append('Redirect URI')

        return Response({
            'settings':       data,
            'is_configured':  is_configured,
            'missing':        missing,
            'help': {
                'where_to_find': 'https://developers.pinterest.com/apps/ → Your App',
                'redirect_uri_note': 'Must match exactly what you set in Pinterest Developer Portal → Your App → Redirect URIs',
                'frontend_url_note': 'Used for popup postMessage security. Set to your React app domain.',
            },
        })

    def post(self, request):
        updated = []
        errors  = []

        for key in self.KEYS:
            if key not in request.data:
                continue
            value = str(request.data[key]).strip()
            if key in ('pinterest_redirect_uri', 'frontend_url') and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append(f'{key} must start with http:// or https://')
                    continue
            try:
                SiteConfiguration.set(key, value, self.KEYS[key])
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response({'error': 'Failed to save.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        client_id     = SiteConfiguration.get('pinterest_client_id', '')
        client_secret = SiteConfiguration.get('pinterest_client_secret', '')
        redirect_uri  = SiteConfiguration.get('pinterest_redirect_uri', '')
        is_configured = bool(client_id and client_secret and redirect_uri)

        response = {
            'success': True, 'updated_keys': updated, 'is_configured': is_configured,
            'message': 'Pinterest OAuth is now configured.' if is_configured else 'Settings saved. Some fields still missing.',
        }
        if errors:
            response['warnings'] = errors
        return Response(response)


class AdminPinterestAccountsView(APIView):
    """GET /api/v1/admin/pinterest-accounts/ — all users' Pinterest accounts."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        accounts = SocialAccount.objects.filter(platform='pinterest').select_related('user').order_by('-connected_at')
        rows = []
        for acc in accounts:
            rows.append({
                'account_id':   acc.id,
                'user_id':      acc.user_id,
                'username':     acc.user.username,
                'account_name': acc.account_name,
                'board_id':     acc.pinterest_board_id,
                'status':       acc.status,
                'has_token':    bool(acc.pinterest_access_token),
                'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
                'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            })
        return Response({'accounts': rows, 'total': len(rows)})



class RedditSettingsView(APIView):
    """GET/POST /api/v1/admin/reddit-settings/ — Reddit OAuth config."""
    permission_classes = [IsAdminUser]

    KEYS = {
        'reddit_client_id':     'Reddit App Client ID (under app name at reddit.com/prefs/apps)',
        'reddit_client_secret': 'Reddit App Secret (keep this private)',
        'reddit_redirect_uri':  'OAuth Redirect URI (must match Reddit app settings exactly)',
        'frontend_url':         'Frontend URL (your React app URL)',
    }

    def get(self, request):
        data = {}
        for key, description in self.KEYS.items():
            raw = SiteConfiguration.get(key, '')
            if key == 'reddit_client_secret' and raw:
                display = '\u2022' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '\u2022' * 6
            else:
                display = raw
            data[key] = {'value': display, 'is_set': bool(raw), 'description': description}

        client_id     = SiteConfiguration.get('reddit_client_id', '')
        client_secret = SiteConfiguration.get('reddit_client_secret', '')
        redirect_uri  = SiteConfiguration.get('reddit_redirect_uri', '')

        is_configured = bool(client_id and client_secret and redirect_uri)
        missing = []
        if not client_id:      missing.append('Client ID')
        if not client_secret:  missing.append('Client Secret')
        if not redirect_uri:   missing.append('Redirect URI')

        return Response({
            'settings': data, 'is_configured': is_configured, 'missing': missing,
            'help': {
                'where_to_find': 'https://www.reddit.com/prefs/apps → Create/Edit App',
                'redirect_uri_note': 'Must match exactly what you set in your Reddit app settings.',
                'frontend_url_note': 'Used for popup postMessage security.',
            },
        })

    def post(self, request):
        updated = []
        errors  = []
        for key in self.KEYS:
            if key not in request.data:
                continue
            value = str(request.data[key]).strip()
            if key in ('reddit_redirect_uri', 'frontend_url') and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append(f'{key} must start with http:// or https://')
                    continue
            try:
                SiteConfiguration.set(key, value, self.KEYS[key])
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response({'error': 'Failed to save.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        client_id     = SiteConfiguration.get('reddit_client_id', '')
        client_secret = SiteConfiguration.get('reddit_client_secret', '')
        redirect_uri  = SiteConfiguration.get('reddit_redirect_uri', '')
        is_configured = bool(client_id and client_secret and redirect_uri)

        response = {
            'success': True, 'updated_keys': updated, 'is_configured': is_configured,
            'message': 'Reddit OAuth is now configured.' if is_configured else 'Settings saved. Some fields still missing.',
        }
        if errors:
            response['warnings'] = errors
        return Response(response)


class AdminRedditAccountsView(APIView):
    """GET /api/v1/admin/reddit-accounts/ — all users' Reddit accounts."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        accounts = SocialAccount.objects.filter(platform='reddit').select_related('user').order_by('-connected_at')
        rows = []
        for acc in accounts:
            rows.append({
                'account_id':   acc.id, 'user_id': acc.user_id, 'username': acc.user.username,
                'account_name': acc.account_name, 'reddit_username': acc.reddit_username,
                'status': acc.status, 'has_token': bool(acc.reddit_access_token),
                'has_refresh': bool(acc.reddit_refresh_token),
                'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
                'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            })
        return Response({'accounts': rows, 'total': len(rows)})


# ══════════════════════════════════════════════════════════════════════════════
# TikTok OAuth Admin Settings
# ══════════════════════════════════════════════════════════════════════════════

class TikTokSettingsView(APIView):
    """GET/POST /api/v1/admin/tiktok-settings/ — TikTok OAuth config."""
    permission_classes = [IsAdminUser]

    KEYS = {
        'tiktok_client_key':    'TikTok Client Key (from TikTok Developer Portal)',
        'tiktok_client_secret': 'TikTok Client Secret (keep this private)',
        'tiktok_redirect_uri':  'OAuth Redirect URI (must match TikTok app settings exactly)',
        'frontend_url':         'Frontend URL (your React app URL)',
    }

    def get(self, request):
        data = {}
        for key, description in self.KEYS.items():
            raw = SiteConfiguration.get(key, '')
            if key == 'tiktok_client_secret' and raw:
                display = '\u2022' * (len(raw) - 6) + raw[-6:] if len(raw) > 6 else '\u2022' * 6
            else:
                display = raw
            data[key] = {'value': display, 'is_set': bool(raw), 'description': description}

        client_key    = SiteConfiguration.get('tiktok_client_key', '')
        client_secret = SiteConfiguration.get('tiktok_client_secret', '')
        redirect_uri  = SiteConfiguration.get('tiktok_redirect_uri', '')

        is_configured = bool(client_key and client_secret and redirect_uri)
        missing = []
        if not client_key:     missing.append('Client Key')
        if not client_secret:  missing.append('Client Secret')
        if not redirect_uri:   missing.append('Redirect URI')

        return Response({
            'settings': data, 'is_configured': is_configured, 'missing': missing,
            'help': {
                'where_to_find': 'https://developers.tiktok.com/ → Manage Apps',
                'redirect_uri_note': 'Must match exactly what you set in TikTok Developer Portal.',
                'frontend_url_note': 'Used for popup postMessage security.',
            },
        })

    def post(self, request):
        updated = []
        errors  = []
        for key in self.KEYS:
            if key not in request.data:
                continue
            value = str(request.data[key]).strip()
            if key in ('tiktok_redirect_uri', 'frontend_url') and value:
                if not (value.startswith('http://') or value.startswith('https://')):
                    errors.append(f'{key} must start with http:// or https://')
                    continue
            try:
                SiteConfiguration.set(key, value, self.KEYS[key])
                updated.append(key)
            except Exception as e:
                errors.append(f'Could not save {key}: {str(e)}')

        if errors and not updated:
            return Response({'error': 'Failed to save.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        client_key    = SiteConfiguration.get('tiktok_client_key', '')
        client_secret = SiteConfiguration.get('tiktok_client_secret', '')
        redirect_uri  = SiteConfiguration.get('tiktok_redirect_uri', '')
        is_configured = bool(client_key and client_secret and redirect_uri)

        response = {
            'success': True, 'updated_keys': updated, 'is_configured': is_configured,
            'message': 'TikTok OAuth is now configured.' if is_configured else 'Settings saved. Some fields still missing.',
        }
        if errors:
            response['warnings'] = errors
        return Response(response)


class AdminTikTokAccountsView(APIView):
    """GET /api/v1/admin/tiktok-accounts/ — all users' TikTok accounts."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from platforms.models import SocialAccount
        accounts = SocialAccount.objects.filter(platform='tiktok').select_related('user').order_by('-connected_at')
        rows = []
        for acc in accounts:
            rows.append({
                'account_id':   acc.id, 'user_id': acc.user_id, 'username': acc.user.username,
                'account_name': acc.account_name,
                'status': acc.status, 'has_token': bool(acc.tiktok_access_token),
                'has_refresh': bool(acc.tiktok_refresh_token),
                'token_expires_at': acc.token_expires_at.isoformat() if acc.token_expires_at else None,
                'connected_at': acc.connected_at.isoformat() if acc.connected_at else None,
            })
        return Response({'accounts': rows, 'total': len(rows)})
