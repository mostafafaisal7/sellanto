# api/diamond_views.py
# Diamond Token API endpoints for users and admins

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework import status

from accounts.models import DiamondWallet, DiamondTransaction, GlobalAPIKey
from accounts.api_keys import mask_key
from accounts.services.diamond_service import (
    DIAMOND_COSTS, PLAN_DIAMONDS,
    get_diamond_cost, recharge_diamonds, grant_plan_diamonds, get_usage_summary,
)


# ══════════════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

class DiamondBalanceView(APIView):
    """GET /api/v1/diamond/balance/ — User's diamond wallet info."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, _ = DiamondWallet.objects.get_or_create(user=request.user)
        return Response({
            'balance': wallet.balance,
            'total_recharged': wallet.total_recharged,
            'total_spent': wallet.total_spent,
            'last_recharge_at': wallet.last_recharge_at,
        })


class DiamondUsageView(APIView):
    """GET /api/v1/diamond/usage/ — Breakdown by feature and provider."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        wallet, _ = DiamondWallet.objects.get_or_create(user=request.user)
        usage = get_usage_summary(request.user, days=days)
        return Response({
            'balance': wallet.balance,
            **usage,
        })


class DiamondTransactionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class DiamondTransactionsView(APIView):
    """GET /api/v1/diamond/transactions/ — Paginated transaction history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        txns = DiamondTransaction.objects.filter(user=request.user)

        # Filters
        txn_type = request.query_params.get('type')
        if txn_type:
            txns = txns.filter(transaction_type=txn_type)
        feature = request.query_params.get('feature')
        if feature:
            txns = txns.filter(feature=feature)

        paginator = DiamondTransactionPagination()
        page = paginator.paginate_queryset(txns, request)

        results = []
        for t in page:
            results.append({
                'id': t.id,
                'amount': t.amount,
                'transaction_type': t.transaction_type,
                'balance_after': t.balance_after,
                'feature': t.feature,
                'provider': t.provider,
                'raw_tokens': t.raw_tokens,
                'model_used': t.model_used,
                'note': t.note,
                'created_at': t.created_at,
            })

        return paginator.get_paginated_response(results)


class DiamondCostPreviewView(APIView):
    """GET /api/v1/diamond/cost-preview/?feature=image&quality=hd
    Preview the cost of an operation before executing."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        feature = request.query_params.get('feature', '')
        if not feature:
            return Response({'error': 'feature parameter required'}, status=400)

        kwargs = {}
        if 'quality' in request.query_params:
            kwargs['quality'] = request.query_params['quality']
        if 'duration' in request.query_params:
            kwargs['duration'] = int(request.query_params['duration'])
        if 'characters' in request.query_params:
            kwargs['characters'] = int(request.query_params['characters'])

        cost = get_diamond_cost(feature, **kwargs)
        wallet, _ = DiamondWallet.objects.get_or_create(user=request.user)

        return Response({
            'feature': feature,
            'diamond_cost': cost,
            'balance': wallet.balance,
            'can_afford': wallet.balance >= cost,
        })


class DiamondCostTableView(APIView):
    """GET /api/v1/diamond/costs/ — Full cost table for all features."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'costs': DIAMOND_COSTS,
            'plan_grants': PLAN_DIAMONDS,
        })


class DiamondUsageTimeseriesView(APIView):
    """GET /api/v1/diamond/usage-timeseries/?period=daily|weekly|monthly&days=30

    Returns time-grouped diamond consumption for charts.
    Each bucket has: { date: ISO string, diamonds_spent: int, transaction_count: int }.

    Optional `from`/`to` (YYYY-MM-DD) override the rolling-window `days` param.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import datetime, timedelta
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
        from django.utils import timezone

        period = request.query_params.get('period', 'daily')
        if period not in ('daily', 'weekly', 'monthly'):
            return Response(
                {'error': "period must be one of 'daily', 'weekly', 'monthly'"},
                status=400,
            )

        # Window resolution: explicit from/to wins over rolling `days`.
        from_str = request.query_params.get('from')
        to_str = request.query_params.get('to')
        if from_str and to_str:
            try:
                start = timezone.make_aware(
                    datetime.strptime(from_str, '%Y-%m-%d')
                )
                end = timezone.make_aware(
                    datetime.strptime(to_str, '%Y-%m-%d')
                ) + timedelta(days=1)
            except ValueError:
                return Response(
                    {'error': "from/to must be YYYY-MM-DD"},
                    status=400,
                )
        else:
            try:
                days = int(request.query_params.get('days', 30))
            except (TypeError, ValueError):
                days = 30
            days = max(1, min(days, 365))
            end = timezone.now()
            start = end - timedelta(days=days)

        trunc = {
            'daily': TruncDay,
            'weekly': TruncWeek,
            'monthly': TruncMonth,
        }[period]

        rows = (
            DiamondTransaction.objects
            .filter(
                user=request.user,
                transaction_type='deduction',
                created_at__gte=start,
                created_at__lt=end,
            )
            .annotate(bucket=trunc('created_at'))
            .values('bucket')
            .annotate(
                diamonds_spent=Sum('amount'),
                transaction_count=Count('id'),
            )
            .order_by('bucket')
        )

        series = [
            {
                'date': r['bucket'].date().isoformat(),
                # amount is negative for deductions — flip sign for display.
                'diamonds_spent': abs(r['diamonds_spent'] or 0),
                'transaction_count': r['transaction_count'],
            }
            for r in rows
        ]

        # Totals across the window.
        total_spent = sum(p['diamonds_spent'] for p in series)
        total_txn = sum(p['transaction_count'] for p in series)

        return Response({
            'period': period,
            'from': start.date().isoformat(),
            'to': (end - timedelta(days=1)).date().isoformat(),
            'series': series,
            'total_spent': total_spent,
            'total_transactions': total_txn,
        })


class DiamondPlanHistoryView(APIView):
    """GET /api/v1/diamond/plan-history/ — Past plan grants for this user.

    Derived from DiamondTransaction rows of type 'plan_grant'. Each entry shows
    when a plan was activated and how many diamonds were granted. Useful as a
    lightweight stand-in for a real billing-history table.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        grants = (
            DiamondTransaction.objects
            .filter(user=request.user, transaction_type='plan_grant')
            .order_by('-created_at')[:50]
        )

        results = []
        for g in grants:
            # Try to extract plan name from the note. Notes look like:
            #   "Plan grant: pro (+2500 diamonds)"
            #   "Plan upgrade grant: pro cycle=2026-05-07 (+2500 diamonds)"
            plan_name = ''
            if g.note:
                lower = g.note.lower()
                for plan in ('enterprise', 'business', 'pro', 'starter', 'free'):
                    # check word boundary-ish — plan name appears after a colon or space.
                    if f' {plan} ' in lower or f' {plan}\n' in lower or lower.endswith(plan) or f': {plan}' in lower:
                        plan_name = plan
                        break

            results.append({
                'id': g.id,
                'plan': plan_name,
                'amount': g.amount,
                'balance_after': g.balance_after,
                'note': g.note,
                'created_at': g.created_at,
            })

        return Response({'history': results})


class DiamondForecastView(APIView):
    """GET /api/v1/diamond/forecast/?lookback=14

    Estimates how many days of runway the user has based on their average
    daily spend over the last `lookback` days (default 14, max 90).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Sum
        from django.utils import timezone

        try:
            lookback = int(request.query_params.get('lookback', 14))
        except (TypeError, ValueError):
            lookback = 14
        lookback = max(1, min(lookback, 90))

        cutoff = timezone.now() - timedelta(days=lookback)

        wallet, _ = DiamondWallet.objects.get_or_create(user=request.user)

        # Sum negative deduction amounts → positive number for display.
        spent_window = abs(
            DiamondTransaction.objects.filter(
                user=request.user,
                transaction_type='deduction',
                created_at__gte=cutoff,
            ).aggregate(total=Sum('amount'))['total'] or 0
        )

        avg_daily = spent_window / lookback if lookback > 0 else 0

        if avg_daily <= 0:
            days_remaining = None  # null = infinite / no usage
            depletion_date = None
        else:
            days_remaining = round(wallet.balance / avg_daily, 1)
            depletion_date = (
                timezone.now() + timedelta(days=days_remaining)
            ).date().isoformat()

        return Response({
            'balance': wallet.balance,
            'lookback_days': lookback,
            'spent_in_window': spent_window,
            'avg_daily_spend': round(avg_daily, 2),
            'days_remaining': days_remaining,
            'depletion_date': depletion_date,
        })


# ══════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

class IsOriginalAdmin:
    """Permission check for original admin (superuser)."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


class AdminRechargeView(APIView):
    """POST /api/v1/admin/users/{user_id}/recharge/ — Add diamonds to user wallet."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if not request.user.is_superuser:
            return Response({'error': 'Admin only'}, status=403)

        from django.contrib.auth.models import User
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        amount = request.data.get('amount')
        if not amount or int(amount) <= 0:
            return Response({'error': 'amount must be a positive integer'}, status=400)

        amount = int(amount)
        note = request.data.get('note', '')

        new_balance = recharge_diamonds(
            user=target_user,
            amount=amount,
            recharged_by=request.user,
            note=note,
        )

        return Response({
            'success': True,
            'user_id': user_id,
            'amount_added': amount,
            'new_balance': new_balance,
        })


class AdminGlobalAPIKeysView(APIView):
    """GET/PUT /api/v1/admin/global-api-keys/ — Manage global API keys."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)

        keys_data = {}
        for provider in ['openai', 'gemini', 'claude']:
            try:
                gk = GlobalAPIKey.objects.get(provider=provider)
                decrypted = gk.get_key()
                keys_data[provider] = {
                    'is_set': bool(decrypted),
                    'is_active': gk.is_active,
                    'masked_key': mask_key(decrypted) if decrypted else '',
                    'updated_at': gk.updated_at,
                    'set_by': gk.set_by.username if gk.set_by else None,
                }
            except GlobalAPIKey.DoesNotExist:
                keys_data[provider] = {
                    'is_set': False,
                    'is_active': False,
                    'masked_key': '',
                    'updated_at': None,
                    'set_by': None,
                }

        return Response(keys_data)

    def put(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)

        updated = []
        for provider in ['openai', 'gemini', 'claude']:
            key_field = f'{provider}_api_key'
            if key_field in request.data:
                raw_key = request.data[key_field]
                gk, created = GlobalAPIKey.objects.get_or_create(
                    provider=provider,
                    defaults={'set_by': request.user}
                )
                gk.set_key(raw_key)
                gk.set_by = request.user
                gk.save()
                updated.append(provider)

        return Response({
            'success': True,
            'updated_providers': updated,
        })


class AdminTestAPIKeyView(APIView):
    """POST /api/v1/admin/test-api-key/ — Test if an API key is valid."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)

        provider = request.data.get('provider')
        if provider not in ['openai', 'gemini', 'claude']:
            return Response({'error': 'Invalid provider'}, status=400)

        # Use provided key (pre-save test) or stored key
        raw_key = (request.data.get('api_key', '') or '').strip()
        if not raw_key:
            try:
                gk = GlobalAPIKey.objects.get(provider=provider, is_active=True)
                raw_key = gk.get_key()
            except GlobalAPIKey.DoesNotExist:
                pass

        if not raw_key:
            return Response({
                'success': False,
                'error': f'No {provider} key available to test',
            }, status=400)

        import requests as http_requests

        try:
            if provider == 'openai':
                resp = http_requests.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f'Bearer {raw_key}'},
                    timeout=10,
                )
                if resp.status_code == 200:
                    return Response({'success': True, 'message': 'OpenAI key is valid'})
                return Response({'success': False, 'error': f'OpenAI: {resp.status_code} — {resp.text[:200]}'})

            elif provider == 'gemini':
                resp = http_requests.get(
                    f'https://generativelanguage.googleapis.com/v1beta/models?key={raw_key}',
                    timeout=10,
                )
                if resp.status_code == 200:
                    return Response({'success': True, 'message': 'Gemini key is valid'})
                return Response({'success': False, 'error': f'Gemini: {resp.status_code} — {resp.text[:200]}'})

            elif provider == 'claude':
                resp = http_requests.post(
                    'https://api.anthropic.com/v1/messages',
                    headers={
                        'x-api-key': raw_key,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    json={
                        'model': 'claude-haiku-4-5-20251001',
                        'max_tokens': 1,
                        'messages': [{'role': 'user', 'content': 'Hi'}],
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    return Response({'success': True, 'message': 'Claude key is valid'})
                elif resp.status_code == 401:
                    return Response({'success': False, 'error': 'Invalid Claude API key (401 Unauthorized)'})
                return Response({'success': False, 'error': f'Claude: {resp.status_code} — {resp.text[:200]}'})

        except http_requests.Timeout:
            return Response({'success': False, 'error': f'{provider} API timed out (10s)'})
        except Exception as e:
            return Response({'success': False, 'error': f'Connection error: {str(e)[:200]}'})


class AdminDiamondOverviewView(APIView):
    """GET /api/v1/admin/diamond-overview/ — Platform-wide diamond stats."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser:
            return Response({'error': 'Admin only'}, status=403)

        from django.db.models import Sum, Count

        wallet_stats = DiamondWallet.objects.aggregate(
            total_balance=Sum('balance'),
            total_recharged=Sum('total_recharged'),
            total_spent=Sum('total_spent'),
            wallets_count=Count('id'),
        )

        # Top users by spending
        from django.contrib.auth.models import User
        top_spenders = list(
            DiamondWallet.objects.select_related('user')
            .order_by('-total_spent')[:10]
            .values('user__id', 'user__username', 'balance', 'total_spent', 'total_recharged')
        )

        # Recent transactions
        recent_txns = list(
            DiamondTransaction.objects.select_related('user')
            .order_by('-created_at')[:20]
            .values('user__username', 'amount', 'transaction_type', 'feature', 'provider', 'created_at')
        )

        return Response({
            'total_balance_in_circulation': wallet_stats['total_balance'] or 0,
            'total_diamonds_recharged': wallet_stats['total_recharged'] or 0,
            'total_diamonds_spent': wallet_stats['total_spent'] or 0,
            'total_wallets': wallet_stats['wallets_count'] or 0,
            'top_spenders': top_spenders,
            'recent_transactions': recent_txns,
        })
