# OpenFDA Upgrade Instructions

## What to Replace

You need to replace the entire `/drugs/search` endpoint in [`functions/src/index.ts`](functions/src/index.ts:815) with the OpenFDA implementation.

## Step-by-Step Instructions

### 1. Find the Current Drug Search Endpoint
Look for this section in [`functions/src/index.ts`](functions/src/index.ts:815):

```typescript
// Search for drugs by name using RxNorm API with improved search strategy
app.get('/drugs/search', authenticate, async (req, res) => {
    // ... current implementation ...
});
```

### 2. Replace with OpenFDA Implementation
Replace the ENTIRE function (from the comment to the closing `});`) with the code from [`functions/src/drug-search-openfda.ts`](functions/src/drug-search-openfda.ts:3).

### 3. Key Changes in the New Implementation

**Before (RxNorm + Partial Matching):**
- Complex 3-tier search with custom partial mappings
- Manual fallback strategies
- Extensive partial matching dictionary

**After (OpenFDA + RxNorm Fallback):**
- Native wildcard search: `metf*` → finds "Metformin"
- Clean, simple implementation
- Better results with less code

### 4. What the New Implementation Does

```typescript
// Strategy 1: OpenFDA Brand Search
https://api.fda.gov/drug/label.json?search=openfda.brand_name:metf*&limit=20

// Strategy 2: OpenFDA Generic Search  
https://api.fda.gov/drug/label.json?search=openfda.generic_name:metf*&limit=20

// Strategy 3: RxNorm Fallback (for comprehensive coverage)
https://rxnav.nlm.nih.gov/REST/drugs.json?name=metformin
```

### 5. Deploy the Changes

After making the replacement:

```bash
cd functions
npm run deploy
```

## Expected Results

**Before:**
- `"metf"` → 0 results (required custom partial mapping)
- Complex fallback logic

**After:**
- `"metf"` → "Metformin Hydrochloride" (native wildcard search)
- `"ibu"` → "Ibuprofen" 
- `"tylen"` → "TYLENOL Extra Strength"
- Cleaner, more maintainable code

## Benefits

1. **Native Partial Search**: No more custom mapping dictionaries
2. **Official FDA Data**: More authoritative than RxNorm alone
3. **Better Performance**: Direct wildcard matching
4. **Simpler Code**: Less complexity, easier to maintain
5. **More Reliable**: Less prone to edge cases

## Rollback Plan

If you need to rollback, the current implementation is working fine. Just keep the existing code.

## Files Created for Reference

- [`openfda-drug-search.ts`](openfda-drug-search.ts:1) - Complete implementation
- [`test-alternative-apis.cjs`](test-alternative-apis.cjs:1) - API comparison tests
- [`test-openfda-vs-current.cjs`](test-openfda-vs-current.cjs:1) - Performance comparison

The choice is yours - your current solution works, but OpenFDA is superior for long-term maintainability and performance.