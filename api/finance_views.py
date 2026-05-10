# api/finance_views.py
"""
Admin Finance / Accounting endpoints.

A simple double-sided ledger:
  - Credit (revenue) = approved PaymentRequest.revenue_usd
  - Debit  (expense) = ExpenseEntry.amount_usd
  - Net profit       = revenue - expenses

All values are in USD. PaymentRequest.revenue_usd is populated at approval
time via the FX service so a payment in BDT/INR/etc converts correctly.

Endpoints (all admin-only):
    GET    /api/v1/admin/finance/summary/
    GET    /api/v1/admin/finance/revenue/
    GET    /api/v1/admin/finance/expenses/
    POST   /api/v1/admin/finance/expenses/
    PUT    /api/v1/admin/finance/expenses/<id>/
    DELETE /api/v1/admin/finance/expenses/<id>/
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import DiamondTransaction, ExpenseEntry, PaymentRequest
from accounts.services.cost_calculator import (
    calculate_transaction_cost,
    cost_type_for_feature,
    map_feature_to_provider_category,
)


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _require_admin(request):
    if not (request.user and request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)):
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _serialize_expense(e: ExpenseEntry) -> dict:
    return {
        'id': e.id,
        'category': e.category,
        'category_label': e.get_category_display(),
        'amount_usd': str(e.amount_usd),
        'description': e.description,
        'incurred_on': e.incurred_on.isoformat() if e.incurred_on else None,
        'created_by': e.created_by.username if e.created_by else None,
        'created_at': e.created_at,
        'updated_at': e.updated_at,
    }


def _serialize_revenue_entry(p: PaymentRequest) -> dict:
    return {
        'id': p.id,
        'user': {
            'id': p.user.id,
            'username': p.user.username,
            'email': p.user.email,
        } if p.user_id else None,
        'plan': p.plan,
        'billing_cycle': p.billing_cycle,
        'amount_local': str(p.amount_local),
        'local_currency': p.local_currency,
        'revenue_usd': str(p.revenue_usd),
        'fx_rate_used': str(p.fx_rate_used),
        'payment_method': p.payment_method,
        'payment_method_label': p.get_payment_method_display(),
        'transaction_reference': p.transaction_reference,
        'reviewed_at': p.reviewed_at,
        'created_at': p.created_at,
    }


def _decimal(value, default=Decimal('0')) -> Decimal:
    try:
        return Decimal(str(value)) if value not in (None, '') else default
    except (InvalidOperation, TypeError):
        return default


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────

class FinanceSummaryView(APIView):
    """GET /api/v1/admin/finance/summary/?from=YYYY-MM-DD&to=YYYY-MM-DD&months=12

    Returns:
      {
        revenue_usd, expense_usd, net_profit_usd,
        revenue_count, expense_count,
        by_month: [{month, revenue, expense, net}],
        expense_by_category: [{category, label, total}],
        recent_revenue: [...],
        recent_expenses: [...],
      }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        # Date window: explicit from/to, else last N months.
        from_date = _parse_date(request.query_params.get('from'))
        to_date = _parse_date(request.query_params.get('to'))
        try:
            months = max(1, min(int(request.query_params.get('months', 12)), 36))
        except (TypeError, ValueError):
            months = 12

        if from_date and to_date:
            window_start = datetime.combine(from_date, datetime.min.time())
            window_end = datetime.combine(to_date, datetime.max.time()) + timedelta(seconds=1)
        else:
            today = timezone.now()
            window_end = today
            # Roughly N months back, normalised to start of that month.
            year = today.year
            month = today.month - (months - 1)
            while month <= 0:
                month += 12
                year -= 1
            window_start = today.replace(
                year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0,
            )

        # Make naive datetimes timezone-aware so DB comparisons are correct.
        if window_start and timezone.is_naive(window_start):
            window_start = timezone.make_aware(window_start)
        if window_end and timezone.is_naive(window_end):
            window_end = timezone.make_aware(window_end)

        # Revenue (credit side): only approved payments count.
        revenue_qs = PaymentRequest.objects.filter(
            status='approved',
            reviewed_at__gte=window_start,
            reviewed_at__lt=window_end,
        )
        revenue_total = revenue_qs.aggregate(s=Sum('revenue_usd'))['s'] or Decimal('0')
        revenue_count = revenue_qs.count()

        # Expenses (debit side) — manual entries.
        expense_qs = ExpenseEntry.objects.filter(
            incurred_on__gte=window_start.date(),
            incurred_on__lt=window_end.date() + timedelta(days=1),
        )
        manual_expense_total = expense_qs.aggregate(s=Sum('amount_usd'))['s'] or Decimal('0')
        expense_count = expense_qs.count()

        # Auto-calculated API costs (from DiamondTransaction + apiModelCost.md rates).
        auto_expense_total = Decimal('0')
        auto_by_category: dict[str, Decimal] = {}
        auto_by_month: dict[str, Decimal] = {}
        tx_qs = DiamondTransaction.objects.filter(
            transaction_type='deduction',
            created_at__gte=window_start,
            created_at__lt=window_end,
        )
        for tx in tx_qs.iterator():
            cost = calculate_transaction_cost(tx)
            if cost <= 0:
                continue
            auto_expense_total += cost
            cat = map_feature_to_provider_category(
                (tx.feature or '').lower(),
                (tx.provider or '').lower(),
            )
            auto_by_category[cat] = auto_by_category.get(cat, Decimal('0')) + cost
            mkey = tx.created_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date().isoformat()
            auto_by_month[mkey] = auto_by_month.get(mkey, Decimal('0')) + cost

        expense_total = manual_expense_total + auto_expense_total
        net = revenue_total - expense_total

        # By-month breakdown (revenue + expense)
        revenue_by_month = (
            revenue_qs
            .annotate(bucket=TruncMonth('reviewed_at'))
            .values('bucket')
            .annotate(total=Sum('revenue_usd'))
            .order_by('bucket')
        )
        expense_by_month = (
            expense_qs
            .annotate(bucket=TruncMonth('incurred_on'))
            .values('bucket')
            .annotate(total=Sum('amount_usd'))
            .order_by('bucket')
        )
        # Merge into a single list keyed by month.
        month_map: dict[str, dict] = {}
        for row in revenue_by_month:
            key = row['bucket'].date().replace(day=1).isoformat()
            month_map.setdefault(key, {'month': key, 'revenue': '0', 'expense': '0', 'net': '0'})
            month_map[key]['revenue'] = str(row['total'] or 0)
        for row in expense_by_month:
            key = row['bucket'].replace(day=1).isoformat() if hasattr(row['bucket'], 'replace') else row['bucket'].isoformat()
            month_map.setdefault(key, {'month': key, 'revenue': '0', 'expense': '0', 'net': '0'})
            month_map[key]['expense'] = str(row['total'] or 0)
        # Layer in auto-calculated API costs by month
        for key, auto_total in auto_by_month.items():
            month_map.setdefault(key, {'month': key, 'revenue': '0', 'expense': '0', 'net': '0'})
            current_expense = _decimal(month_map[key]['expense'])
            month_map[key]['expense'] = str(current_expense + auto_total)
        for key, entry in month_map.items():
            entry['net'] = str(_decimal(entry['revenue']) - _decimal(entry['expense']))
        by_month = sorted(month_map.values(), key=lambda e: e['month'])

        # Expense breakdown by category — merge manual + auto-calculated.
        cat_lookup = dict(ExpenseEntry.CATEGORY_CHOICES)
        cat_totals: dict[str, dict] = {}

        # Start with manual expenses (preserves count for those).
        for r in (
            expense_qs
            .values('category')
            .annotate(total=Sum('amount_usd'), n=Count('id'))
        ):
            cat_totals[r['category']] = {
                'category': r['category'],
                'label': cat_lookup.get(r['category'], r['category']),
                'total': r['total'] or Decimal('0'),
                'count': r['n'],
                'auto_total': Decimal('0'),
            }

        # Layer in auto-calculated API costs per category.
        for cat, auto_total in auto_by_category.items():
            entry = cat_totals.setdefault(cat, {
                'category': cat,
                'label': cat_lookup.get(cat, cat),
                'total': Decimal('0'),
                'count': 0,
                'auto_total': Decimal('0'),
            })
            entry['total'] += auto_total
            entry['auto_total'] += auto_total

        expense_by_category = [
            {
                'category': e['category'],
                'label': e['label'],
                'total': str(e['total']),
                'auto_total': str(e['auto_total']),
                'count': e['count'],
            }
            for e in sorted(cat_totals.values(), key=lambda x: x['total'], reverse=True)
        ]

        # Recent activity feeds.
        recent_revenue = [
            _serialize_revenue_entry(p)
            for p in (
                revenue_qs
                .select_related('user')
                .order_by('-reviewed_at')[:8]
            )
        ]
        recent_expenses = [
            _serialize_expense(e)
            for e in expense_qs.select_related('created_by').order_by('-incurred_on', '-id')[:8]
        ]

        return Response({
            'window': {
                'from': window_start.date().isoformat(),
                'to': (window_end - timedelta(seconds=1)).date().isoformat(),
            },
            'revenue_usd': str(revenue_total),
            'expense_usd': str(expense_total),
            'manual_expense_usd': str(manual_expense_total),
            'auto_expense_usd': str(auto_expense_total),
            'net_profit_usd': str(net),
            'revenue_count': revenue_count,
            'expense_count': expense_count,
            'by_month': by_month,
            'expense_by_category': expense_by_category,
            'recent_revenue': recent_revenue,
            'recent_expenses': recent_expenses,
        })


# ─────────────────────────────────────────────────────────────────────
# Revenue list (read-only, derived from approved PaymentRequest)
# ─────────────────────────────────────────────────────────────────────

class RevenueListView(APIView):
    """GET /api/v1/admin/finance/revenue/?limit=200"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        try:
            limit = max(1, min(int(request.query_params.get('limit', 200)), 1000))
        except (TypeError, ValueError):
            limit = 200

        qs = (
            PaymentRequest.objects
            .filter(status='approved')
            .select_related('user')
            .order_by('-reviewed_at')[:limit]
        )
        return Response({
            'revenue': [_serialize_revenue_entry(p) for p in qs],
        })


# ─────────────────────────────────────────────────────────────────────
# Expenses CRUD
# ─────────────────────────────────────────────────────────────────────

class ExpenseListView(APIView):
    """GET / POST /api/v1/admin/finance/expenses/

    GET supports filters: ?category=server&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
    POST body: { category, amount_usd, description?, incurred_on? }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        qs = ExpenseEntry.objects.select_related('created_by')
        cat = request.query_params.get('category')
        if cat:
            qs = qs.filter(category=cat)
        from_d = _parse_date(request.query_params.get('from'))
        if from_d:
            qs = qs.filter(incurred_on__gte=from_d)
        to_d = _parse_date(request.query_params.get('to'))
        if to_d:
            qs = qs.filter(incurred_on__lte=to_d)

        try:
            limit = max(1, min(int(request.query_params.get('limit', 200)), 1000))
        except (TypeError, ValueError):
            limit = 200

        rows = list(qs.order_by('-incurred_on', '-id')[:limit])
        total = qs.aggregate(s=Sum('amount_usd'))['s'] or Decimal('0')
        return Response({
            'expenses': [_serialize_expense(e) for e in rows],
            'total_in_filter_usd': str(total),
            'categories': [
                {'value': k, 'label': v}
                for k, v in ExpenseEntry.CATEGORY_CHOICES
            ],
        })

    def post(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        data = request.data or {}
        category = data.get('category')
        valid = {c for c, _ in ExpenseEntry.CATEGORY_CHOICES}
        if category not in valid:
            return Response(
                {'error': f'category must be one of {sorted(valid)}'},
                status=400,
            )

        amount = _decimal(data.get('amount_usd'), default=None)
        if amount is None or amount <= 0:
            return Response({'error': 'amount_usd must be a positive number'}, status=400)

        incurred_on = _parse_date(data.get('incurred_on')) or timezone.now().date()

        e = ExpenseEntry.objects.create(
            category=category,
            amount_usd=amount,
            description=(data.get('description') or '').strip()[:255],
            incurred_on=incurred_on,
            created_by=request.user,
        )
        return Response({'expense': _serialize_expense(e)}, status=status.HTTP_201_CREATED)


class ExpenseDetailView(APIView):
    """PUT / DELETE /api/v1/admin/finance/expenses/<id>/"""
    permission_classes = [IsAuthenticated]

    def put(self, request, expense_id):
        denied = _require_admin(request)
        if denied:
            return denied
        try:
            e = ExpenseEntry.objects.get(id=expense_id)
        except ExpenseEntry.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        data = request.data or {}
        valid = {c for c, _ in ExpenseEntry.CATEGORY_CHOICES}
        if 'category' in data:
            if data['category'] not in valid:
                return Response(
                    {'error': f'category must be one of {sorted(valid)}'},
                    status=400,
                )
            e.category = data['category']
        if 'amount_usd' in data:
            amount = _decimal(data['amount_usd'], default=None)
            if amount is None or amount <= 0:
                return Response({'error': 'amount_usd must be a positive number'}, status=400)
            e.amount_usd = amount
        if 'description' in data:
            e.description = (data['description'] or '').strip()[:255]
        if 'incurred_on' in data:
            d = _parse_date(data['incurred_on'])
            if d is None:
                return Response({'error': 'incurred_on must be YYYY-MM-DD'}, status=400)
            e.incurred_on = d
        e.save()
        return Response({'expense': _serialize_expense(e)})

    def delete(self, request, expense_id):
        denied = _require_admin(request)
        if denied:
            return denied
        try:
            e = ExpenseEntry.objects.get(id=expense_id)
        except ExpenseEntry.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        e.delete()
        return Response({'ok': True})


# ─────────────────────────────────────────────────────────────────────
# Auto-calculated API costs (dynamic, derived from DiamondTransaction)
# ─────────────────────────────────────────────────────────────────────

class AutoExpensesView(APIView):
    """GET /api/v1/admin/finance/auto-expenses/?from=YYYY-MM-DD&to=YYYY-MM-DD&months=12

    Reads every DiamondTransaction deduction and applies the rate table from
    docs/apiModelCost.md to compute the actual USD cost. Returns the full
    breakdown by month, provider category, feature, and cost type — for both
    old and new users alike (no backfill needed).

    Returns:
      {
        window: { from, to },
        total_usd,
        deduction_count,
        by_month:           [{month, total, by_category: {...}}],
        by_category:        [{category, label, total, count}],
        by_feature:         [{feature, cost_type, category, total, count, tokens}],
        by_cost_type:       [{cost_type, total, count}],
        top_users:          [{user_id, username, total, count}],
        recent:             [...last 50 deductions with computed cost...],
      }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        # Date window — same logic as FinanceSummaryView
        from_date = _parse_date(request.query_params.get('from'))
        to_date = _parse_date(request.query_params.get('to'))
        try:
            months = max(1, min(int(request.query_params.get('months', 12)), 36))
        except (TypeError, ValueError):
            months = 12

        if from_date and to_date:
            window_start = datetime.combine(from_date, datetime.min.time())
            window_end = datetime.combine(to_date, datetime.max.time()) + timedelta(seconds=1)
        else:
            today = timezone.now()
            window_end = today
            year = today.year
            month = today.month - (months - 1)
            while month <= 0:
                month += 12
                year -= 1
            window_start = today.replace(
                year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0,
            )

        if window_start and timezone.is_naive(window_start):
            window_start = timezone.make_aware(window_start)
        if window_end and timezone.is_naive(window_end):
            window_end = timezone.make_aware(window_end)

        # Pull all deductions in the window
        qs = (
            DiamondTransaction.objects
            .filter(
                transaction_type='deduction',
                created_at__gte=window_start,
                created_at__lt=window_end,
            )
            .select_related('user')
            .order_by('-created_at')
        )

        category_lookup = dict(ExpenseEntry.CATEGORY_CHOICES)

        total = Decimal('0')
        deduction_count = 0

        by_month_map: dict[str, dict] = {}
        by_category_map: dict[str, dict] = {}
        by_feature_map: dict[tuple, dict] = {}
        by_cost_type_map: dict[str, dict] = {}
        by_user_map: dict[int, dict] = {}

        recent = []
        recent_limit = 50

        for tx in qs.iterator():
            cost = calculate_transaction_cost(tx)
            if cost <= 0:
                # Still count the call (for stats) but skip dollar aggregation
                deduction_count += 1
                continue

            feature = (tx.feature or 'unknown').strip().lower() or 'unknown'
            provider = (tx.provider or '').strip().lower()
            cost_type = cost_type_for_feature(feature)
            category = map_feature_to_provider_category(feature, provider)

            total += cost
            deduction_count += 1

            # Month bucket
            month_key = tx.created_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date().isoformat()
            mb = by_month_map.setdefault(month_key, {
                'month': month_key,
                'total': Decimal('0'),
                'count': 0,
                'by_category': {'openai': Decimal('0'), 'gemini': Decimal('0'), 'claude': Decimal('0'), 'other_api': Decimal('0')},
            })
            mb['total'] += cost
            mb['count'] += 1
            if category in mb['by_category']:
                mb['by_category'][category] += cost
            else:
                mb['by_category']['other_api'] += cost

            # Category bucket
            cb = by_category_map.setdefault(category, {
                'category': category,
                'label': category_lookup.get(category, category),
                'total': Decimal('0'),
                'count': 0,
            })
            cb['total'] += cost
            cb['count'] += 1

            # Feature bucket
            fkey = (feature, cost_type, category)
            fb = by_feature_map.setdefault(fkey, {
                'feature': feature,
                'cost_type': cost_type,
                'category': category,
                'total': Decimal('0'),
                'count': 0,
                'tokens': 0,
            })
            fb['total'] += cost
            fb['count'] += 1
            fb['tokens'] += tx.raw_tokens or 0

            # Cost type bucket
            ctb = by_cost_type_map.setdefault(cost_type, {
                'cost_type': cost_type,
                'total': Decimal('0'),
                'count': 0,
            })
            ctb['total'] += cost
            ctb['count'] += 1

            # User bucket
            if tx.user_id:
                ub = by_user_map.setdefault(tx.user_id, {
                    'user_id': tx.user_id,
                    'username': tx.user.username if tx.user else f'user_{tx.user_id}',
                    'total': Decimal('0'),
                    'count': 0,
                })
                ub['total'] += cost
                ub['count'] += 1

            # Recent feed
            if len(recent) < recent_limit:
                recent.append({
                    'id': tx.id,
                    'created_at': tx.created_at.isoformat(),
                    'user': tx.user.username if tx.user else None,
                    'feature': feature,
                    'cost_type': cost_type,
                    'provider': provider,
                    'model': tx.model_used or '',
                    'category': category,
                    'category_label': category_lookup.get(category, category),
                    'tokens': tx.raw_tokens or 0,
                    'diamonds': abs(tx.amount),
                    'cost_usd': str(cost),
                })

        # Stringify decimals + sort
        by_month = []
        for key in sorted(by_month_map.keys()):
            entry = by_month_map[key]
            by_month.append({
                'month': entry['month'],
                'total': str(entry['total']),
                'count': entry['count'],
                'by_category': {k: str(v) for k, v in entry['by_category'].items()},
            })

        by_category = sorted(
            (
                {**c, 'total': str(c['total'])}
                for c in by_category_map.values()
            ),
            key=lambda x: Decimal(x['total']),
            reverse=True,
        )

        by_feature = sorted(
            (
                {**f, 'total': str(f['total'])}
                for f in by_feature_map.values()
            ),
            key=lambda x: Decimal(x['total']),
            reverse=True,
        )

        by_cost_type = sorted(
            (
                {**c, 'total': str(c['total'])}
                for c in by_cost_type_map.values()
            ),
            key=lambda x: Decimal(x['total']),
            reverse=True,
        )

        top_users = sorted(
            (
                {**u, 'total': str(u['total'])}
                for u in by_user_map.values()
            ),
            key=lambda x: Decimal(x['total']),
            reverse=True,
        )[:20]

        return Response({
            'window': {
                'from': window_start.date().isoformat(),
                'to': (window_end - timedelta(seconds=1)).date().isoformat(),
            },
            'total_usd': str(total),
            'deduction_count': deduction_count,
            'by_month': by_month,
            'by_category': by_category,
            'by_feature': by_feature,
            'by_cost_type': by_cost_type,
            'top_users': top_users,
            'recent': recent,
            'rate_source': 'docs/apiModelCost.md (verified May 2026)',
        })
