"""
Backfill PaymentRequest.revenue_usd for approved payments that were
approved before the FX-conversion logic was wired (or where revenue_usd
ended up at 0 for any reason).

Usage:
    python manage.py backfill_revenue_usd            # update all that are 0
    python manage.py backfill_revenue_usd --force    # also re-convert
                                                     # already-set rows using
                                                     # the latest rates
    python manage.py backfill_revenue_usd --dry-run  # show what would change
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from accounts.models import PaymentRequest
from accounts.services.fx_service import convert_to_usd


class Command(BaseCommand):
    help = (
        'Convert amount_local -> revenue_usd for approved PaymentRequest rows. '
        'Skips rows already converted unless --force is passed.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help='Re-convert rows even if revenue_usd is already set')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print changes but do not save')

    def handle(self, *args, **options):
        force = options['force']
        dry = options['dry_run']

        qs = PaymentRequest.objects.filter(status='approved')
        if not force:
            qs = qs.filter(revenue_usd=Decimal('0'))

        rows = list(qs.order_by('id'))
        if not rows:
            self.stdout.write(self.style.WARNING(
                'No approved payments to backfill. '
                '(Use --force to re-convert already-set rows.)'
            ))
            return

        self.stdout.write(self.style.NOTICE(
            f'Backfilling {len(rows)} approved payment(s){" (DRY-RUN)" if dry else ""}…'
        ))
        self.stdout.write('')

        total_before = Decimal('0')
        total_after = Decimal('0')

        for r in rows:
            usd, rate, source = convert_to_usd(r.amount_local, r.local_currency)

            old_rev = Decimal(r.revenue_usd or 0)
            old_rate = Decimal(r.fx_rate_used or 0)
            total_before += old_rev
            total_after += usd

            self.stdout.write(
                f'  #{r.id:>3} {r.user.username:<20} '
                f'{r.amount_local} {r.local_currency} -> '
                f'${usd}  (rate={rate}, src={source})  '
                f'[was: ${old_rev} rate={old_rate}]'
            )

            if not dry:
                r.revenue_usd = usd
                r.fx_rate_used = rate
                r.save(update_fields=['revenue_usd', 'fx_rate_used'])

        delta = total_after - total_before
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Total revenue_usd: ${total_before} -> ${total_after}  '
            f'(delta {"+" if delta >= 0 else ""}${delta})'
        ))
        if dry:
            self.stdout.write(self.style.WARNING('Dry-run — nothing was saved.'))
