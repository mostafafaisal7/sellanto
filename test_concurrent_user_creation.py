#!/usr/bin/env python
"""
Load Testing Script for Concurrent User Registration

This script simulates concurrent user registrations to test for race conditions
and data leakage issues.

Usage:
    python test_concurrent_user_creation.py --users 10 --concurrent 5
"""

import argparse
import asyncio
import aiohttp
import time
import sys
from datetime import datetime


API_BASE_URL = "http://localhost:8000/api/v1"
REGISTER_ENDPOINT = f"{API_BASE_URL}/auth/register-with-brand/"


async def create_user(session, user_num, results):
    """Create a single user account."""
    user_data = {
        "username": f"testuser_{user_num}_{int(time.time())}",
        "email": f"testuser_{user_num}_{int(time.time())}@example.com",
        "password": "TestPassword123!",
        "password_confirm": "TestPassword123!",
        "phone": f"+1234567{user_num:04d}",
        "brand_name": f"Test Brand {user_num}",
        "industry": "Technology",
        "target_region": "Global",
        "voice_tone": "professional",
    }

    start_time = time.time()

    try:
        async with session.post(REGISTER_ENDPOINT, json=user_data) as response:
            elapsed = time.time() - start_time
            status = response.status
            data = await response.json()

            result = {
                'user_num': user_num,
                'status': status,
                'elapsed': elapsed,
                'success': status == 201,
                'username': user_data['username'],
                'data': data,
            }

            if status == 201:
                # Verify the returned user data matches what we sent
                returned_username = data.get('user', {}).get('username')
                returned_email = data.get('user', {}).get('email')

                if returned_username != user_data['username']:
                    result['data_leakage'] = True
                    result['error'] = f"Username mismatch: sent {user_data['username']}, got {returned_username}"
                elif returned_email != user_data['email']:
                    result['data_leakage'] = True
                    result['error'] = f"Email mismatch: sent {user_data['email']}, got {returned_email}"
                else:
                    result['data_leakage'] = False

                print(f"✅ User {user_num} created successfully in {elapsed:.2f}s")
            else:
                result['error'] = data.get('error') or data.get('message') or 'Unknown error'
                print(f"❌ User {user_num} failed: {result['error']}")

            results.append(result)

    except Exception as e:
        elapsed = time.time() - start_time
        result = {
            'user_num': user_num,
            'status': 'exception',
            'elapsed': elapsed,
            'success': False,
            'error': str(e),
        }
        print(f"💥 User {user_num} exception: {e}")
        results.append(result)


async def run_concurrent_batch(batch_num, batch_size, results):
    """Run a batch of concurrent user creations."""
    print(f"\n🚀 Starting batch {batch_num} with {batch_size} concurrent users...")

    async with aiohttp.ClientSession() as session:
        tasks = [
            create_user(session, batch_num * 100 + i, results)
            for i in range(batch_size)
        ]
        await asyncio.gather(*tasks)


def analyze_results(results):
    """Analyze test results and report issues."""
    print("\n" + "=" * 70)
    print("TEST RESULTS ANALYSIS")
    print("=" * 70)

    total = len(results)
    successful = len([r for r in results if r.get('success')])
    failed = total - successful
    data_leakages = len([r for r in results if r.get('data_leakage')])

    avg_time = sum(r['elapsed'] for r in results) / total if total > 0 else 0

    print(f"\n📊 Summary:")
    print(f"  Total attempts:     {total}")
    print(f"  Successful:         {successful} ({successful/total*100:.1f}%)")
    print(f"  Failed:             {failed} ({failed/total*100:.1f}%)")
    print(f"  Average time:       {avg_time:.2f}s")

    if data_leakages > 0:
        print(f"\n🚨 CRITICAL: {data_leakages} DATA LEAKAGE ISSUES DETECTED!")
        print("\nLeakage Details:")
        for r in results:
            if r.get('data_leakage'):
                print(f"  User {r['user_num']}: {r.get('error')}")
        return False
    else:
        print("\n✅ No data leakage detected - all users received correct data")

    # Check for unusually slow requests (potential deadlock)
    slow_threshold = avg_time * 3
    slow_requests = [r for r in results if r['elapsed'] > slow_threshold]
    if slow_requests:
        print(f"\n⚠️  {len(slow_requests)} requests were unusually slow (>{slow_threshold:.2f}s):")
        for r in slow_requests:
            print(f"  User {r.get('user_num')}: {r['elapsed']:.2f}s")

    # Report failures
    if failed > 0:
        print(f"\n❌ Failed Requests:")
        for r in results:
            if not r.get('success'):
                print(f"  User {r.get('user_num')}: {r.get('error', 'Unknown error')}")

    return data_leakages == 0 and failed == 0


async def main():
    parser = argparse.ArgumentParser(
        description='Test concurrent user registration for race conditions'
    )
    parser.add_argument(
        '--users', type=int, default=10,
        help='Total number of users to create (default: 10)'
    )
    parser.add_argument(
        '--concurrent', type=int, default=5,
        help='Number of concurrent requests per batch (default: 5)'
    )
    parser.add_argument(
        '--batches', type=int, default=None,
        help='Number of batches (default: calculated from users/concurrent)'
    )

    args = parser.parse_args()

    if args.batches:
        num_batches = args.batches
        batch_size = args.concurrent
        total_users = num_batches * batch_size
    else:
        total_users = args.users
        batch_size = args.concurrent
        num_batches = (total_users + batch_size - 1) // batch_size

    print(f"{'='*70}")
    print(f"CONCURRENT USER REGISTRATION TEST")
    print(f"{'='*70}")
    print(f"Total users:       {total_users}")
    print(f"Concurrent:        {batch_size}")
    print(f"Batches:           {num_batches}")
    print(f"Start time:        {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    results = []
    overall_start = time.time()

    for batch_num in range(num_batches):
        await run_concurrent_batch(batch_num, batch_size, results)
        # Small delay between batches to allow server to settle
        await asyncio.sleep(0.5)

    overall_elapsed = time.time() - overall_start

    print(f"\n{'='*70}")
    print(f"All batches completed in {overall_elapsed:.2f}s")
    print(f"{'='*70}")

    success = analyze_results(results)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
