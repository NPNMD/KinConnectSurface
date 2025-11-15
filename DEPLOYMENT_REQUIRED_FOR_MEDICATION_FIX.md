# ⚠️ DEPLOYMENT REQUIRED: Medication Query Fix

## Status

The code fix has been applied to `functions/src/services/unified/MedicationCommandService.ts`, but **the Firebase Functions need to be redeployed** for the fix to take effect.

## What Was Fixed

The query logic now properly handles Firestore composite index requirements:

1. **Detects multiple where clauses** (e.g., `patientId` + `status.isActive`)
2. **Skips Firestore orderBy** when multiple filters are present (to avoid index requirement)
3. **Sorts in memory** instead, preserving the requested sort order

## Deployment Steps

1. **Navigate to functions directory:**
   ```bash
   cd functions
   ```

2. **Build the TypeScript code:**
   ```bash
   npm run build
   ```
   (Or use your build command if different)

3. **Deploy Firebase Functions:**
   ```bash
   firebase deploy --only functions
   ```

   OR deploy just the specific function:
   ```bash
   firebase deploy --only functions:api
   ```

## Expected Result After Deployment

- ✅ Queries with `patientId` + `isActive=.true` will work without requiring an index
- ✅ Medications will be sorted in memory by `createdAt` (or requested field)
- ✅ No more "FAILED_PRECONDITION: The query requires an index" errors

## Verification

After deployment, test by:
1. Loading the medications page
2. Checking that medications load successfully
3. Verifying no index errors in console

## Code Changes Summary

**File**: `functions/src/services/unified/MedicationCommandService.ts`

**Key Change**: Added logic to detect multiple where clauses and skip Firestore orderBy, sorting in memory instead:

```typescript
// Count where clauses
const hasMultipleFilters = whereClauseCount > 1;

// Skip Firestore orderBy when multiple filters exist
if (hasMultipleFilters && firestoreOrderBy && !needsInMemorySort) {
  needsInMemorySort = true;
  firestoreOrderBy = null; // Don't add to Firestore query
}
```

This avoids the need for composite indexes while maintaining correct sorting behavior.

