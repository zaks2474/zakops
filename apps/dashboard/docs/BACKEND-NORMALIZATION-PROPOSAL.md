# Backend API Normalization Proposal

## Problem

The backend API returns inconsistent types for numeric fields:
- `asking_price` and `ebitda` can be:
  - Numbers: `1000000`
  - Strings: `"1000000"`, `"$1,000,000"`, `"TBD"`
  - Null: `null`

The frontend currently handles this with Zod coercion, but this is a safety net, not best practice.

## Proposed Backend Changes

### 1. Normalize Numeric Fields

In the deal serialization logic (likely in `deal_lifecycle_api.py` or `deal_registry.py`):

```python
def serialize_deal_metadata(metadata: dict) -> dict:
    """Normalize metadata fields for API response."""
    def to_number_or_null(val):
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return val
        if isinstance(val, str):
            # Strip currency symbols and commas
            cleaned = val.replace('$', '').replace(',', '').strip()
            if cleaned.lower() in ('', '-', 'tbd', 'n/a', 'unknown'):
                return None
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    return {
        **metadata,
        'asking_price': to_number_or_null(metadata.get('asking_price')),
        'ebitda': to_number_or_null(metadata.get('ebitda')),
        'revenue': to_number_or_null(metadata.get('revenue')),
    }
```

### 2. API Response Schema

Define explicit response schemas:

```python
from pydantic import BaseModel
from typing import Optional

class DealMetadata(BaseModel):
    priority: Optional[str] = None
    asking_price: Optional[float] = None  # Always number or null
    ebitda: Optional[float] = None        # Always number or null
    revenue: Optional[float] = None       # Always number or null
    nda_status: Optional[str] = None
    cim_received: Optional[bool] = None
```

### 3. Migration Path

1. Add normalization to API serialization (backward compatible)
2. Frontend coercion remains as safety net
3. Monitor logs for coercion events (should drop to zero)
4. After 1 week stable, consider removing frontend coercion

## Files to Modify

Backend files (estimated):
- `/home/zaks/scripts/deal_lifecycle_api.py` - API endpoint handlers
- `/home/zaks/scripts/deal_registry.py` - Deal data access layer (if applicable)

## Impact

- **Low risk**: Normalization is additive, doesn't break existing clients
- **Benefit**: Cleaner API contract, reduced frontend complexity
- **Monitoring**: Frontend logs will show if coercion is still needed

## Status

**Proposed** - Ready for implementation when convenient. Frontend safety net is sufficient for now.
