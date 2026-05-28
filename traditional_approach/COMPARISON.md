# Traditional vs CCDA — Side-by-Side Comparison

## The Core Problem

When a backend developer changes `price: float` to `price: str`, how long before the frontend breaks?

| Metric                       | Traditional              | CCDA                          |
|------------------------------|--------------------------|-------------------------------|
| Type sync guarantee          | ✗ None (manual effort)   | ✓ Compile-time error          |
| Auth defined in              | 2 places (BE + FE)       | 1 place (contract.yaml)       |
| New endpoint requires        | 4 manual files           | 1 new block in contract.yaml  |
| "Does FE match BE?" question | Ask a human              | Run `npm run compile`         |
| Breaking change detection    | Production crash / PR    | Build fails immediately       |

---

## Adding a New Endpoint

### Traditional: 4 manual steps

**Step 1 — Backend: add Pydantic model**
```python
# backend/models.py  ← must open and edit manually
class Review(BaseModel):
    id: int
    product_id: int
    rating: int
    comment: str
```

**Step 2 — Backend: add route**
```python
# backend/main.py  ← must open and edit manually
@app.get("/reviews", response_model=List[Review])
async def get_reviews():
    return MOCK_REVIEWS
```

**Step 3 — Frontend: add TypeScript interface**
```typescript
// frontend/types.ts  ← must open and edit manually
export interface Review {
  id: number;
  product_id: number;
  rating: number;
  comment: string;
}
```

**Step 4 — Frontend: add fetch + hook**
```typescript
// frontend/api.ts  ← must open and edit manually
export async function fetchReviews(): Promise<Review[]> { ... }
export function useReviews() { ... }
```

Total: ~60 lines across 4 files, by hand, with no enforcement.

---

### CCDA: 1 block in contract.yaml

```yaml
# contract.yaml  ← only file to touch
- name: Reviews
  endpoint: /reviews
  method: GET
  auth:
    required: false
    roles: []
  response:
    id: integer
    product_id: integer
    rating: integer
    comment: string
```

Then: `npm run compile` → all 4 files generated automatically, guaranteed in sync.

Total: ~10 lines in 1 file.

---

## The Shock Test

Change `price: float` → `price: str` in backend.

### Traditional outcome
1. Backend returns `"1299.99"` (string) instead of `1299.99` (number)
2. Frontend TypeScript still says `price: number`
3. `price.toFixed(2)` compiles fine, crashes at runtime: *"toFixed is not a function"*
4. Gets caught in QA, production, or user report — **not at build time**

### CCDA outcome
1. Change `price: number` → `price: string` in `contract.yaml`
2. Run `npm run compile` (or `npm run demo:shock`)
3. Generated `types.ts` now has `price: string`
4. TypeScript compiler immediately flags `price.toFixed(2)` as an error in `App.tsx`
5. **Build fails — no deployment possible until the UI is fixed**

This is the CCDA guarantee: **type contract violations are caught at compile time, not runtime.**
