# Free Medication APIs Research

## Current Options for Better Drug Search APIs

### 1. OpenFDA Drug API (FDA.gov)
**URL**: `https://api.fda.gov/drug/label.json`
**Pros**:
- Official FDA data
- Free, no API key required
- Good search capabilities
- JSON format
**Cons**:
- More focused on drug labels than search
- Limited autocomplete functionality

**Test URL**: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:metf*&limit=10`

### 2. DrugBank API (Free Tier)
**URL**: `https://go.drugbank.com/releases/latest#open-data`
**Pros**:
- Comprehensive drug database
- Good search capabilities
- Free tier available
**Cons**:
- Requires registration
- Limited requests on free tier

### 3. RxNav REST API (Alternative Endpoints)
**URL**: `https://rxnav.nlm.nih.gov/REST/`
**Alternative endpoints we haven't tried**:
- `/REST/Prescribe` - Prescribable drugs
- `/REST/allconcepts` - All concepts search
- `/REST/findRxcuiByString` - String-based search

### 4. NCBI E-utilities (PubChem)
**URL**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
**Pros**:
- Free government API
- Good search capabilities
- Chemical and drug data
**Cons**:
- More complex to use
- Focused on chemical compounds

### 5. OpenMedicine API
**URL**: Various open-source projects
**Pros**:
- Community-driven
- Often better UX-focused
**Cons**:
- May not be as comprehensive
- Reliability concerns

## Best Alternative: Enhanced RxNorm Strategy

Actually, let me test some RxNorm endpoints we haven't tried yet that might work better for partial search.