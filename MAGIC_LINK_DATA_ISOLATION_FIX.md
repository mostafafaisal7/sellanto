# 🔒 Magic Link Data Isolation Fix - Summary

**Date:** April 13, 2026
**Issue:** New accounts showing pre-filled data from other users in Magic Link
**Root Cause:** localStorage persistence across user sessions
**Severity:** HIGH - User Data Leakage

---

## 🔴 **The Problem**

### **Issue Reported:**

**Bangla:** "new account khulleo data pre-filled thake in Magic link"

**English:** When creating a new account, the Magic Link questionnaire shows data belonging to OTHER users.

### **Scenario:**

1. User A logs in → Uses Magic Link → Creates brand with DNA
2. User A logs out
3. User B registers a new account on the SAME browser
4. User B opens Magic Link → Sees "Use Previous Brand?" popup
5. Popup shows User A's brand data! ❌

**Data Leaked:**
- Brand name
- Website URL
- Industry
- Brand DNA (voice, audiences, platforms, brand voice)
- Previous question answers

---

## 🔍 **Root Cause Analysis**

### **PRIMARY CAUSE: localStorage Persistence**

**File:** `frontend/src/store/magicModeStore.ts` lines 186-204

```typescript
export const useMagicModeStore = create<MagicModeState>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'magic-mode-storage',  // ❌ Stored in localStorage
      partialize: (state) => ({
        brandId: state.brandId,
        websiteUrl: state.websiteUrl,
        answers: state.answers,
        customAnswers: state.customAnswers,
        generatedPosts: state.generatedPosts,
        // ... more user-specific data
      }),
    }
  )
);
```

**The Problem:**
- Zustand's `persist` middleware stores data in `localStorage`
- localStorage is NOT cleared on user logout
- localStorage is SHARED across all users on the same browser
- When User B logs in, they see User A's cached data

### **SECONDARY CAUSE: No Cleanup on Logout**

**File:** `frontend/src/services/authService.ts` lines 16-22 (BEFORE FIX)

```typescript
async logout(): Promise<void> {
  try {
    await api.post('/auth/logout/');
  } finally {
    clearTokens();
    // ❌ localStorage NOT cleared!
  }
}
```

### **VERIFIED: Backend is CORRECT**

**File:** `api/views.py` line 1743

```python
class BrandViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = Brand.objects.filter(user=self.request.user)  # ✅ USER-SCOPED
        # ...
```

The backend API **correctly filters brands by user**. The issue is purely client-side caching.

---

## ✅ **The Fix**

### **Fix 1: Clear localStorage on Logout** ✅

**File:** `frontend/src/services/authService.ts`

```typescript
async logout(): Promise<void> {
  try {
    await api.post('/auth/logout/');
  } finally {
    clearTokens();

    // 🔒 SECURITY: Clear Magic Mode cache to prevent data leakage
    localStorage.removeItem('magic-mode-storage');
    localStorage.removeItem('magic_draft_post_ids');
  }
}
```

**What this does:**
- Removes all cached Magic Mode data when user logs out
- Prevents User B from seeing User A's data
- Ensures clean slate for each new session

### **Fix 2: Add Defensive Validation** ✅

**File:** `frontend/src/pages/magic/MagicModePage.tsx`

```typescript
const handleUsePrevious = useCallback(() => {
  if (!existingBrand) return;

  // 🔒 SECURITY: Verify current user exists
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) {
    console.error('[MagicMode] Security: No current user found');
    handleStartFresh();
    return;
  }

  console.log(`[MagicMode] Using brand from user ${currentUser.id}: ${existingBrand.brand_name}`);

  // Rest of the code...
}, [existingBrand, ...]);
```

**What this does:**
- Validates that a user is actually logged in before using cached data
- Logs the operation for debugging
- Falls back to clean start if validation fails
- Defense-in-depth approach

---

## 📊 **Before vs After**

| Scenario | Before (BUG) | After (FIXED) |
|----------|--------------|---------------|
| User A logs out | ❌ Data stays in localStorage | ✅ Data cleared from localStorage |
| User B logs in (same browser) | ❌ Sees User A's brand | ✅ Clean start, no pre-fill |
| User A logs back in (same browser) | ⚠️ Would see own data (worked) | ✅ Clean start each time |
| User B on different browser | ✅ Clean start (worked) | ✅ Clean start (still works) |

---

## 🧪 **Testing Instructions**

### **Test Case 1: Same Browser, Different Users**

1. **Setup:**
   - Open browser in normal mode
   - Have two user accounts ready: User A and User B

2. **Steps:**
   ```bash
   # As User A:
   1. Login as User A
   2. Go to Magic Link
   3. Complete questions (industry=Digital Marketing, tone=Professional, etc.)
   4. Click "Use Previous Brand" if popup shows, or complete flow
   5. Verify brand data is pre-filled
   6. Logout User A

   # As User B (same browser):
   7. Register/Login as User B
   8. Go to Magic Link
   9. Check if "Use Previous Brand?" popup appears

   Expected: ✅ NO popup, clean start
   Bug (before fix): ❌ Popup shows User A's brand
   ```

3. **Verify:**
   - User B should see empty questions (no pre-fill)
   - No popup about previous brand
   - localStorage should be empty for 'magic-mode-storage'

### **Test Case 2: Same User, Re-login**

1. **Steps:**
   ```bash
   1. Login as User A
   2. Use Magic Link, create brand
   3. Logout
   4. Login again as User A (same browser)
   5. Go to Magic Link

   Expected: ✅ May see popup with OWN brand (from API, not localStorage)
   ```

2. **Verify:**
   - localStorage cleared on logout
   - Data comes from API (backend), not localStorage cache
   - Shows User A's own brand data

### **Test Case 3: Incognito/Private Mode**

1. **Steps:**
   ```bash
   1. Open incognito window
   2. Login as User A
   3. Use Magic Link
   4. Close incognito window
   5. Open new incognito window
   6. Login as User B

   Expected: ✅ Clean start (localStorage cleared when window closed)
   ```

---

## 🔍 **Security Impact**

### **Severity: HIGH**

**Data Exposure Risk:**
- Brand names (could reveal business identity)
- Website URLs (could reveal private/staging URLs)
- Industry classification
- Brand voice preferences
- Target audiences
- Platform preferences
- Previous question answers

**Attack Vector:**
- **Shared Computer:** User A logs out, User B logs in → sees User A's data
- **Public Computer:** Café, library, co-working space
- **Family Computer:** Multiple family members
- **Development Machine:** Developers testing with multiple accounts

**Compliance Implications:**
- ❌ GDPR violation (data minimization, purpose limitation)
- ❌ CCPA violation (unauthorized disclosure)
- ❌ Privacy policy violation

---

## 📋 **Files Modified**

### **Frontend Changes:**

1. **`frontend/src/services/authService.ts`**
   - Added localStorage cleanup on logout
   - Removes `magic-mode-storage` and `magic_draft_post_ids`

2. **`frontend/src/pages/magic/MagicModePage.tsx`**
   - Added defensive user validation in `handleUsePrevious()`
   - Added security logging for debugging

### **Backend Verification:**

3. **`api/views.py` (BrandViewSet)**
   - ✅ Verified: Already correctly filters by `user=request.user`
   - ✅ No changes needed - backend is secure

---

## 🎯 **Additional Improvements Recommended**

### **1. Add User ID to Persisted State (Future Enhancement)**

```typescript
// In magicModeStore.ts
export interface MagicModeState {
  userId?: number;  // Track which user owns this cached data
  // ... rest of state
}

// On login, set userId
// On load, validate userId matches current user
```

### **2. Add Expiry to localStorage Cache**

```typescript
// Add timestamp to cache
export interface MagicModeState {
  cacheTimestamp?: number;
  // ... rest of state
}

// On load, check if cache is stale (e.g., > 24 hours)
// If stale, clear cache automatically
```

### **3. Add Security Logging**

```typescript
// Log when user data is loaded from cache
console.log('[Security] Loading Magic Mode data for user:', currentUserId);

// Log when cache is cleared
console.log('[Security] Clearing Magic Mode cache on logout');
```

---

## ✅ **Issue #2: Button Logic (Already Working)**

### **Status: ✅ NO CHANGES NEEDED**

The "Next" / "Regenerate" button logic was analyzed and found to be **correctly implemented**.

**File:** `frontend/src/pages/magic/AIQuestionsScreen.tsx` lines 264-303

**Logic:**

```typescript
// Case 1: Answers CHANGED from original
if (answersChanged) {
  return <button>Generate Posts →</button>;  // Only option to regenerate
}

// Case 2: Answers SAME as original + has previous generation
if (hasPreviousGeneration && onNext) {
  return (
    <>
      <button onClick={onNext}>Next →</button>
      <button onClick={regenerate}>Regenerate</button>
    </>
  );
}
```

**This matches the requirements:**
- Same answers → Show "Next" + "Regenerate"
- Changed answers → Show only "Generate Posts"
- First time → Show only "Next"

---

## 🚀 **Deployment Checklist**

- [x] Fix implemented: Clear localStorage on logout
- [x] Defensive validation added
- [x] Backend verified: Already secure
- [ ] Test with multiple users on same browser
- [ ] Test logout → login → Magic Link flow
- [ ] Test in incognito mode
- [ ] Verify localStorage is empty after logout
- [ ] Monitor for any security logs in console

---

## 📞 **Support**

If the issue persists after this fix:

1. **Clear browser cache manually:**
   ```
   Open DevTools → Application → Storage → Clear site data
   ```

2. **Check localStorage manually:**
   ```javascript
   // In browser console:
   localStorage.getItem('magic-mode-storage')
   // Should return null after logout
   ```

3. **Check for console errors:**
   - Look for `[MagicMode]` or `[Security]` prefixed logs
   - Check for API errors when loading brands

---

## 🏁 **Conclusion**

The issue was caused by localStorage persistence across user sessions. The fix ensures that all user-specific cached data is cleared on logout, preventing data leakage between users.

**Security Improvements:**
- ✅ localStorage cleared on logout
- ✅ Defensive validation added
- ✅ Backend already secure (user-scoped queries)
- ✅ Button logic already correct

**Next Steps:**
1. Test the fix with multiple users
2. Verify localStorage cleanup works
3. Monitor for any edge cases
4. Consider implementing recommended enhancements

---

**Fixed By:** Development Team
**Date:** April 13, 2026
**Verified:** Pending user testing
