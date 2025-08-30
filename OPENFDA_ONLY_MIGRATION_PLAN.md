# OpenFDA-Only Migration Plan

## 🎯 Goal
Remove all RxNorm API dependencies and make the system purely OpenFDA-based for simplicity and consistency.

## 📊 Current RxNorm Dependencies to Remove

### **Endpoints to Replace**:
1. `/drugs/:rxcui` - Get drug details by RXCUI
2. `/drugs/:rxcui/interactions` - Get drug interactions
3. `/drugs/suggestions/:query` - Get spelling suggestions
4. `/drugs/:rxcui/related` - Get related drugs
5. `/drugs/:rxcui/dosing` - Get dosing info

### **References to Update**:
- All `rxcui` references in search results
- RxNorm API calls in drug search
- Frontend components expecting RXCUI

## ✅ OpenFDA-Only Replacement Strategy

### **New Simplified Endpoints**:
1. `/drugs/search` - Pure OpenFDA search (already updated)
2. `/drugs/:drugName/details` - Get details by name
3. `/drugs/:drugName/similar` - Get similar medications
4. `/drugs/:drugName/dosing` - Get dosing recommendations

### **Benefits of OpenFDA-Only**:
- ✅ **Consistent Data**: All from one authoritative source
- ✅ **Better Partial Search**: Native wildcard support
- ✅ **Rich Metadata**: Dosage forms, routes, instructions
- ✅ **No Confusion**: Single API, single data format
- ✅ **Simpler Code**: Less complexity, easier maintenance

## 🔧 Implementation Steps

### **1. Update Drug Search (Already Done)**
- Removed RxNorm fallback
- Pure OpenFDA with 3 strategies:
  - Brand name search
  - Generic name search  
  - Substance name search

### **2. Replace RXCUI-based Endpoints**
- Change from RXCUI to drug name-based
- Use OpenFDA search for all operations
- Maintain same functionality with cleaner implementation

### **3. Update Frontend**
- Remove RXCUI dependencies
- Use drug names for API calls
- Simplify drug selection logic

### **4. Clean Up Types**
- Remove RxNorm-specific fields
- Simplify DrugConcept interface
- Use OpenFDA data structure

## 📋 Migration Checklist

- [ ] Replace `/drugs/:rxcui` with `/drugs/:drugName/details`
- [ ] Replace `/drugs/:rxcui/interactions` with OpenFDA-based interactions
- [ ] Replace `/drugs/:rxcui/related` with OpenFDA similar drugs
- [ ] Update `/drugs/:rxcui/dosing` to use drug names
- [ ] Remove spelling suggestions (OpenFDA handles this better)
- [ ] Update frontend to use drug names instead of RXCUI
- [ ] Test all endpoints
- [ ] Deploy clean implementation

## 🎯 Expected Results

### **Simplified API Structure**:
```
/drugs/search?q=metf          → OpenFDA search with auto-fill data
/drugs/metformin/details      → Complete drug information
/drugs/metformin/similar      → Similar medications
/drugs/metformin/dosing       → Standard dosing recommendations
```

### **Cleaner Data Format**:
```json
{
  "id": "fda_12345",
  "name": "Metformin Hydrochloride",
  "genericName": "METFORMIN HYDROCHLORIDE", 
  "brandName": "Metformin",
  "type": "Generic",
  "source": "FDA",
  "dosageForm": "tablet",
  "route": "oral",
  "strength": "500 mg",
  "standardDosing": {
    "commonDoses": ["500mg", "850mg"],
    "standardInstructions": ["500mg twice daily with meals"]
  }
}
```

This will eliminate all confusion and provide a much cleaner, more consistent medication search experience!