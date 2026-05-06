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

from accounts.models import ExpenseEntry, PaymentRequest


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

        # Expenses (debit side).
        expense_qs = ExpenseEntry.objects.filter(
            incurred_on__gte=window_start.date(),
            incurred_on__lt=window_end.date() + timedelta(days=1),
        )
        expense_total = expense_qs.aggregate(s=Sum('amount_usd'))['s'] or Decimal('0')
        expense_count = expense_qs.count()

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
        for key, entry in month_map.items():
            entry['net'] = str(_decimal(entry['revenue']) - _decimal(entry['expense']))
        by_month = sorted(month_map.values(), key=lambda e: e['month'])

        # Expense breakdown by category.
        cat_rows = (
            expense_qs
            .values('category')
            .annotate(total=Sum('amount_usd'), n=Count('id'))
            .order_by('-total')
        )
        cat_lookup = dict(ExpenseEntry.CATEGORY_CHOICES)
        expense_by_category = [
            {
                'category': r['category'],
                'label': cat_lookup.get(r['category'], r['category']),
                'total': str(r['total'] or 0),
                'count': r['n'],
            }
            for r in cat_rows
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
