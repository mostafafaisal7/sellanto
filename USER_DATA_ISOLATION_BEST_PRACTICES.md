# 🔒 User Data Isolation - Best Practices for Developers

## Quick Reference Card

This document provides guidelines for maintaining strict user data isolation in the codebase.

---

## ⚠️ NEVER DO THIS

### ❌ Bad: Using `get_or_create()` in Signal Handlers
```python
@receiver(post_save, sender=User)
def my_signal(sender, instance, **kwargs):
    UserProfile.objects.get_or_create(user=instance)  # ❌ RACE CONDITION!
```

**Why bad:** Runs on EVERY save, can retrieve another user's data during concurrent operations.

**Fix:** Only use `.create()` when `created=True`:
```python
@receiver(post_save, sender=User)
def my_signal(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)  # ✅ SAFE
```

---

### ❌ Bad: Financial Operations Without Locking
```python
def deduct_credits(user, amount):
    wallet = Wallet.objects.get(user=user)  # ❌ NO LOCK!
    wallet.balance -= amount
    wallet.save()
```

**Why bad:** Two simultaneous operations can double-spend credits.

**Fix:** Use `select_for_update()`:
```python
def deduct_credits(user, amount):
    from django.db import transaction

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=user)  # ✅ ROW LOCK
        if wallet.balance < amount:
            raise InsufficientFundsError()
        wallet.balance -= amount
        wallet.save()
```

---

### ❌ Bad: Queries Without User Filtering
```python
def get_posts(request):
    posts = Post.objects.all()  # ❌ RETURNS ALL USERS' POSTS!
    return JsonResponse({'posts': list(posts.values())})
```

**Why bad:** Returns data from ALL users, not just the current user.

**Fix:** ALWAYS filter by user:
```python
def get_posts(request):
    posts = Post.objects.filter(user=request.user)  # ✅ USER-SCOPED
    return JsonResponse({'posts': list(posts.values())})
```

---

### ❌ Bad: Using Primary Keys from URL Without Validation
```python
def get_post(request, post_id):
    post = Post.objects.get(id=post_id)  # ❌ ANY USER CAN ACCESS ANY POST!
    return JsonResponse({'post': serialize(post)})
```

**Why bad:** User A can access User B's post by changing the URL.

**Fix:** Validate ownership:
```python
def get_post(request, post_id):
    post = Post.objects.get(id=post_id, user=request.user)  # ✅ OWNERSHIP CHECK
    return JsonResponse({'post': serialize(post)})
```

---

## ✅ ALWAYS DO THIS

### ✅ Good: Filter Querysets by User
```python
# In views
posts = Post.objects.filter(user=request.user)

# In viewsets
def get_queryset(self):
    return Post.objects.filter(user=self.request.user)
```

### ✅ Good: Use Atomic Transactions for Multi-Step Operations
```python
from django.db import transaction

@transaction.atomic
def create_order(user, items):
    order = Order.objects.create(user=user)
    for item in items:
        OrderItem.objects.create(order=order, item=item)
    deduct_balance(user, order.total)
    return order
```

### ✅ Good: Use Select For Update on Financial Data
```python
with transaction.atomic():
    wallet = DiamondWallet.objects.select_for_update().get(user=user)
    wallet.balance -= cost
    wallet.save()
```

### ✅ Good: Validate Ownership Before Modifications
```python
def update_post(request, post_id):
    try:
        post = Post.objects.get(id=post_id, user=request.user)
    except Post.DoesNotExist:
        return JsonResponse({'error': 'Not found or access denied'}, status=404)

    post.caption = request.POST.get('caption')
    post.save()
    return JsonResponse({'success': True})
```

---

## 🛡️ Security Checklist for New Features

When adding a new feature that handles user data, verify:

- [ ] **All queries filter by user**
  ```python
  Model.objects.filter(user=request.user)
  ```

- [ ] **Ownership validation on all updates/deletes**
  ```python
  obj = Model.objects.get(id=pk, user=request.user)
  ```

- [ ] **No `get_or_create()` in signal handlers**
  ```python
  if created:
      RelatedModel.objects.create(user=instance)
  ```

- [ ] **Financial operations use row locking**
  ```python
  with transaction.atomic():
      wallet = Wallet.objects.select_for_update().get(user=user)
  ```

- [ ] **Foreign key relationships enforce user isolation**
  ```python
  class Post(models.Model):
      user = models.ForeignKey(User, on_delete=models.CASCADE)
      brand = models.ForeignKey(Brand, on_delete=models.CASCADE)

      def save(self, *args, **kwargs):
          # Verify brand belongs to user
          if self.brand.workspace.owner != self.user:
              raise PermissionDenied()
          super().save(*args, **kwargs)
  ```

- [ ] **API serializers don't leak sensitive data**
  ```python
  class PostSerializer(serializers.ModelSerializer):
      class Meta:
          model = Post
          fields = ['id', 'caption', 'created_at']  # ✅ No user_id exposed
          read_only_fields = ['id', 'created_at']
  ```

---

## 🔍 Code Review Checklist

When reviewing code that touches user data:

### Red Flags 🚩
- `objects.all()` without user filter
- `objects.get(id=...)` without user validation
- `get_or_create()` in signal handlers
- Financial operations without `select_for_update()`
- API endpoints that don't check `request.user`
- Serializers that expose other users' IDs

### Green Flags ✅
- All queries filtered by `user=request.user`
- Ownership validation on all CRUD operations
- `transaction.atomic()` on multi-step operations
- `select_for_update()` on financial/critical data
- Comprehensive unit tests for access control
- Security logging for sensitive operations

---

## 📝 Testing Guidelines

### Unit Tests for User Isolation
```python
def test_user_cannot_access_other_users_post(self):
    user1 = User.objects.create_user('user1', 'user1@test.com', 'pass')
    user2 = User.objects.create_user('user2', 'user2@test.com', 'pass')

    post = Post.objects.create(user=user1, caption='User 1 post')

    # User 2 should not be able to access User 1's post
    self.client.force_login(user2)
    response = self.client.get(f'/api/posts/{post.id}/')

    self.assertEqual(response.status_code, 404)  # ✅ Access denied
```

### Integration Tests for Concurrent Operations
```python
import threading

def test_concurrent_diamond_deduction(self):
    user = User.objects.create_user('test', 'test@test.com', 'pass')
    wallet = DiamondWallet.objects.create(user=user, balance=100)

    results = []

    def deduct():
        try:
            deduct_diamonds(user, 'caption', 50)
            results.append('success')
        except InsufficientDiamondsError:
            results.append('insufficient')

    # Try to deduct 50 diamonds twice simultaneously
    t1 = threading.Thread(target=deduct)
    t2 = threading.Thread(target=deduct)

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # One should succeed, one should fail
    self.assertEqual(results.count('success'), 1)
    self.assertEqual(results.count('insufficient'), 1)

    # Balance should be exactly 50 (not 0 or 100)
    wallet.refresh_from_db()
    self.assertEqual(wallet.balance, 50)  # ✅ No double-spend
```

---

## 🚨 Common Pitfalls

### Pitfall 1: Trusting Request Data
```python
# ❌ BAD
def transfer_diamonds(request):
    from_user_id = request.POST.get('from_user')  # ❌ User can forge this!
    to_user_id = request.POST.get('to_user')
    amount = int(request.POST.get('amount'))

    from_wallet = DiamondWallet.objects.get(user_id=from_user_id)
    # ... transfer logic

# ✅ GOOD
def transfer_diamonds(request):
    to_user_id = request.POST.get('to_user')
    amount = int(request.POST.get('amount'))

    # ALWAYS use authenticated user, never trust client input
    from_wallet = DiamondWallet.objects.select_for_update().get(
        user=request.user  # ✅ Authenticated user only
    )
    # ... transfer logic
```

### Pitfall 2: Implicit User Relationships
```python
# ❌ BAD: Assuming brand belongs to current user
def update_brand(request, brand_id):
    brand = Brand.objects.get(id=brand_id)  # ❌ No ownership check!
    brand.name = request.POST.get('name')
    brand.save()

# ✅ GOOD: Explicit ownership validation
def update_brand(request, brand_id):
    brand = Brand.objects.get(
        id=brand_id,
        workspace__owner=request.user  # ✅ Verify ownership via relationship
    )
    brand.name = request.POST.get('name')
    brand.save()
```

### Pitfall 3: Aggregate Queries Without User Filter
```python
# ❌ BAD: Returns stats across ALL users
def get_stats(request):
    return {
        'total_posts': Post.objects.count(),  # ❌ ALL USERS!
        'total_diamonds': DiamondWallet.objects.aggregate(Sum('balance'))['balance__sum']
    }

# ✅ GOOD: User-scoped stats
def get_stats(request):
    return {
        'total_posts': Post.objects.filter(user=request.user).count(),  # ✅ USER-SCOPED
        'diamond_balance': request.user.diamond_wallet.balance
    }
```

---

## 📚 Reference

### Django ORM Patterns
```python
# ALWAYS filter by user
Model.objects.filter(user=request.user)

# NEVER use these without user filter
Model.objects.all()  # ❌ Returns ALL users' data
Model.objects.get(id=pk)  # ❌ No ownership check

# Financial operations
with transaction.atomic():
    obj = Model.objects.select_for_update().get(user=request.user)
    # ... modify obj
    obj.save()

# Complex relationships
Model.objects.filter(
    related__user=request.user,  # ✅ Filter through relationship
    is_active=True
)
```

### DRF ViewSet Patterns
```python
class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer

    def get_queryset(self):
        # ✅ ALWAYS override get_queryset to filter by user
        return Post.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # ✅ ALWAYS set user on creation
        serializer.save(user=self.request.user)
```

---

## 🎓 Learning Resources

- [Django Security Best Practices](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Django select_for_update Documentation](https://docs.djangoproject.com/en/stable/ref/models/querysets/#select-for-update)

---

**Remember:** When in doubt, ask yourself:

> "If User A changes this URL/ID to something else, could they access User B's data?"

If the answer is YES, you have a security vulnerability.

---

**Last Updated:** April 13, 2026
**Version:** 1.0
