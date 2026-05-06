from django.db import migrations


SEED_ACCOUNTS = [
    {
        'method': 'bkash',
        'display_name': 'Sellanto bKash (Personal)',
        'account_number': '01XXX-XXXXXX',
        'account_holder_name': 'Sellanto Billing',
        'instructions': (
            'Send Money (Personal) to the number above. After sending, paste your bKash '
            'TrxID below and we will verify within an hour during business hours.'
        ),
        'currency': 'BDT',
        'sort_order': 1,
    },
    {
        'method': 'nagad',
        'display_name': 'Sellanto Nagad',
        'account_number': '01XXX-XXXXXX',
        'account_holder_name': 'Sellanto Billing',
        'instructions': (
            'Use Nagad Send Money to the number above and share your TrxID below.'
        ),
        'currency': 'BDT',
        'sort_order': 2,
    },
    {
        'method': 'bank',
        'display_name': 'Dutch-Bangla Bank — Sellanto',
        'account_number': 'XXXXXXXXXXXX',
        'account_holder_name': 'Sellanto Limited',
        'instructions': (
            'Branch: Gulshan · Routing: XXXXXX. International users can use SWIFT '
            'code DBBLBDDH. Drop the bank reference / SWIFT confirmation below.'
        ),
        'currency': 'BDT',
        'sort_order': 3,
    },
    {
        'method': 'card',
        'display_name': 'Card (Demo — no live gateway)',
        'account_number': '',
        'account_holder_name': '',
        'instructions': (
            'Card payments are accepted but the live gateway is not yet wired. '
            'Submit your card last-4 + cardholder name and our billing team will '
            'reach out to complete the charge manually.'
        ),
        'currency': 'USD',
        'sort_order': 4,
    },
]


def seed(apps, schema_editor):
    AdminPayoutAccount = apps.get_model('accounts', 'AdminPayoutAccount')
    # Idempotent: only insert if no payout accounts exist yet.
    if AdminPayoutAccount.objects.exists():
        return
    for spec in SEED_ACCOUNTS:
        AdminPayoutAccount.objects.create(is_active=True, **spec)


def unseed(apps, schema_editor):
    AdminPayoutAccount = apps.get_model('accounts', 'AdminPayoutAccount')
    AdminPayoutAccount.objects.filter(
        display_name__in=[s['display_name'] for s in SEED_ACCOUNTS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0014_adminpayoutaccount_paymentrequest'),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]
