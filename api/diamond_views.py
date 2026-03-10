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
        if not request.user.is_superuser:
            return Response({'error': 'Admin only'}, status=403)

        keys_data = {}
        for provider in ['openai', 'gemini', 'claude']:
            try:
                gk = GlobalAPIKey.objects.get(provider=provider)
                keys_data[provider] = {
                    'is_set': bool(gk.api_key),
                    'is_active': gk.is_active,
                    'masked_key': mask_key(gk.api_key) if gk.api_key else '',
                    'updated_at': gk.updated_at,
                }
            except GlobalAPIKey.DoesNotExist:
                keys_data[provider] = {
                    'is_set': False,
                    'is_active': False,
                    'masked_key': '',
                    'updated_at': None,
                }

        return Response(keys_data)

    def put(self, request):
        if not request.user.is_superuser:
            return Response({'error': 'Admin only'}, status=403)

        updated = []
        for provider in ['openai', 'gemini', 'claude']:
            key_field = f'{provider}_api_key'
            if key_field in request.data:
                raw_key = request.data[key_field]
                gk, created = GlobalAPIKey.objects.update_or_create(
                    provider=provider,
                    defaults={
                        'api_key': raw_key,
                        'is_active': bool(raw_key),
                        'set_by': request.user,
                    }
                )
                updated.append(provider)

        return Response({
            'success': True,
            'updated_providers': updated,
        })


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
