# Stop Writing the Same Code Twice: How I Built a Compiler That Keeps Your Backend and Frontend in Perfect Sync

> *A deep dive into Contract-Driven Architecture — where a single YAML file generates type-safe Python and TypeScript simultaneously, making runtime type errors a thing of the past.*

---

Every full-stack developer has lived through this moment.

It's 2 AM. Production is down. The error log screams:

```
TypeError: p.price.toFixed is not a function
```

You spend forty minutes tracing the bug. The backend team quietly changed `price` from `float` to `str` three days ago. The frontend TypeScript file still says `price: number`. The type mismatch compiled silently, deployed silently, and detonated in production in front of real users.

This is not a human error story. It is an **architecture error story**. The system had no mechanism to catch it. And that is the problem I set out to solve.

---

## The Fundamental Problem with Traditional Full-Stack Development

In a standard full-stack project, the API contract lives in at least two places simultaneously.

The backend developer writes a Pydantic model:

```python
class Product(BaseModel):
    id: int
    title: str
    price: float       # source of truth #1
    in_stock: bool
    category: str
```

Then the frontend developer — working in a different repository, a different timezone, sometimes a different company — writes a TypeScript interface:

```typescript
export interface Product {
  id: number;
  title: string;
  price: number;       // source of truth #2 (unverified copy)
  in_stock: boolean;
  category: string;
}
```

These two definitions are completely independent. There is no compiler, no linter, no CI check that enforces their relationship. The only thing keeping them in sync is **human communication** — a Slack message, a PR description, a Wiki page that someone remembers to update.

And human communication fails at scale.

### The cost of drift

Consider what happens when a single field changes:

| What changes | Traditional outcome | When discovered |
|---|---|---|
| `price: float` → `price: str` | `toFixed is not a function` crash | Production |
| New field `discount` added to backend | Frontend silently ignores it | QA / never |
| Auth role `viewer` added | Role type union is stale | Silent security gap |
| New endpoint added | Frontend team must be manually notified | Slack / PR review |

In every case, the failure mode is the same: **the two sides diverge silently, and the system has no way to detect it.**

---

## The Idea: One Contract, Two Stacks

The solution I built is called **CCDA — Centralized Contract-Driven Architecture**.

The core principle is simple and radical at the same time:

> **There should be exactly one place in the entire codebase where the API shape is defined. Everything else — Pydantic models, FastAPI routes, TypeScript interfaces, React hooks — should be derived from that single definition automatically.**

That single place is `contract.yaml`.

```
                    ┌─────────────────────┐
                    │    contract.yaml     │
                    │  (single source of   │
                    │      truth)          │
                    └──────────┬──────────┘
                               │
                    npm run compile
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
   ┌───────────────────────┐       ┌───────────────────────┐
   │  Python (FastAPI)     │       │  TypeScript (React)   │
   │  schemas.py           │       │  types.ts             │
   │  routes.py            │       │  api.ts               │
   └───────────────────────┘       └───────────────────────┘
```

If you change `price: number` to `price: string` in `contract.yaml`, the compiler regenerates both sides. The generated TypeScript interface now says `price: string`. TypeScript immediately flags every `price.toFixed(2)` call in your UI as a compile error. **The build fails. Deployment is blocked. The bug never reaches production.**

This is not a runtime check. This is not a test. This is the type system itself enforcing the contract — at build time.

---

## The Architecture in Practice

Let me show you what this looks like end-to-end with the actual project I built.

### The Contract

Here is the complete `contract.yaml` for a product catalog API:

```yaml
version: "2.0.0"

info:
  title: Product Catalog API
  description: CCDA PoC — multi-endpoint demonstration

endpoints:

  - name: Products
    endpoint: /products
    method: GET
    auth:
      required: true
      roles:
        - admin
        - manager
    response:
      id: integer
      title: string
      price: number
      in_stock: boolean
      category: string

  - name: Categories
    endpoint: /categories
    method: GET
    auth:
      required: false
      roles: []
    response:
      id: integer
      name: string
      product_count: integer
```

This is the **only** file a developer touches to define the API. It specifies:
- The endpoint path and HTTP method
- Whether authentication is required, and which roles are authorized
- The exact shape of the response, with explicit types

Everything else is generated.

### What the Compiler Produces

Running `npm run compile` reads this file and produces **four synchronized files** — two for the backend, two for the frontend.

**Backend: `schemas.py`**

```python
class ProductsResponse(BaseModel):
    """GET /products — auto-generated from contract."""
    id: int
    title: str
    price: float        # ← derived from contract: number → float
    in_stock: bool
    category: str

class CategoriesResponse(BaseModel):
    """GET /categories — auto-generated from contract."""
    id: int
    name: str
    product_count: int

# Auth guard — only generated because auth.required: true
_ROLES_PRODUCTS: List[str] = ["admin", "manager"]

def verify_products_auth(
    x_user_role: str = Header(None, alias="X-User-Role")
) -> str:
    if x_user_role not in _ROLES_PRODUCTS:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "CCDA_AUTHORIZATION_DENIED",
                "provided_role": x_user_role,
                "allowed_roles": _ROLES_PRODUCTS,
                "message": f"Role '{x_user_role}' not authorized for /products",
            },
        )
    return x_user_role
```

**Backend: `routes.py`**

```python
# Service registry — the only interface between generated code and developer code
_products_service: Optional[Callable] = None
_categories_service: Optional[Callable] = None

def register_products_service(fn: Callable) -> None:
    global _products_service
    _products_service = fn

def register_categories_service(fn: Callable) -> None:
    global _categories_service
    _categories_service = fn

@router.get("/products", response_model=List[ProductsResponse])
async def handle_products(
    current_role: str = Depends(verify_products_auth)  # ← auth injected automatically
) -> List[ProductsResponse]:
    return _products_service(current_role)

@router.get("/categories", response_model=List[CategoriesResponse])
async def handle_categories() -> List[CategoriesResponse]:
    return _categories_service()  # ← no auth, because contract says auth.required: false
```

**Frontend: `types.ts`**

```typescript
export interface ProductsResponse {
  id: number;
  title: string;
  price: number;        // ← synchronized with contract
  in_stock: boolean;
  category: string;
}

// Generated only because auth.required: true and roles are defined
export type ProductsAllowedRole = 'admin' | 'manager';

export interface CategoriesResponse {
  id: number;
  name: string;
  product_count: number;
}
```

**Frontend: `api.ts`**

```typescript
// Auth-aware hook — userRole parameter generated because auth.required: true
export function useProducts(userRole: ProductsAllowedRole | string) {
  const [state, setState] = useState<ApiState<ProductsResponse[]>>({
    data: null, loading: false, error: null,
  });
  const load = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await fetchProducts(userRole);
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setState({ data: null, loading: false, error: message });
    }
  }, [userRole]);
  useEffect(() => { void load(); }, [load]);
  return { ...state, refetch: load };
}

// No auth parameter — because contract says auth.required: false
export function useCategories() {
  // ... same pattern, no userRole
}
```

Notice what the developer **did not write**: Pydantic models, auth guards, role validation, fetch functions, React state management boilerplate. All of that was derived from 40 lines of YAML.

### What the Developer Actually Writes

With CCDA, the developer's code is reduced to two responsibilities:

**Backend `main.py` — provide the data:**

```python
from generated.routes import (
    router,
    register_products_service,
    register_categories_service,
)

def fetch_products(role: str) -> List[dict]:
    # Replace with a real database query
    return MOCK_PRODUCTS

def fetch_categories() -> List[dict]:
    return MOCK_CATEGORIES

# Register with the generated router
register_products_service(fetch_products)
register_categories_service(fetch_categories)
app.include_router(router)
```

**Frontend `App.tsx` — build the UI:**

```tsx
import { useProducts, useCategories } from './generated/api';

export default function App() {
  const [role, setRole] = useState<ProductsAllowedRole>('admin');
  const products   = useProducts(role);
  const categories = useCategories();

  // Build UI with typed data — TypeScript enforces the contract here
  return (
    <table>
      {products.data?.map(p => (
        <tr key={p.id}>
          <td>{p.title}</td>
          <td>${p.price.toFixed(2)}</td>  {/* ← TypeScript knows price is number */}
        </tr>
      ))}
    </table>
  );
}
```

The developer is now working at a higher level of abstraction. They describe **what** the data looks like and **what** the UI shows — not the infrastructure that connects them.

---

## Inside the Compiler

The compiler (`compiler.ts`) is a ~390-line TypeScript program. It reads `contract.yaml`, validates it, and produces the four output files using template string generation. There is no reflection, no runtime code generation, no framework magic. It runs once at build time and produces plain Python and TypeScript.

The core architecture is a pipeline:

```
getContract()          → loads and validates contract.yaml
  │
  ├── genSchemaPy()    → Pydantic models + per-endpoint auth guards
  ├── genRoutesPy()    → FastAPI routes + service registries
  ├── genTypesTs()     → TypeScript interfaces + AllowedRole union types
  └── genApiTs()       → fetch functions + React hooks (auth-aware)
```

One design decision worth explaining: the **service registry pattern** in `routes.py`.

The generated routes cannot directly import from `main.py` — that would be a circular import. Instead, the compiler generates a registration function for each endpoint:

```python
_products_service: Optional[Callable] = None

def register_products_service(fn: Callable) -> None:
    global _products_service
    _products_service = fn
```

The developer calls this in `main.py` before starting the server. The generated route handler then calls the registered function at request time. This design decouples the generated infrastructure from the developer's business logic completely — the generated code never needs to know anything about `main.py`.

### Type Mapping

The compiler maintains a bidirectional type table:

| contract.yaml | Python (Pydantic) | TypeScript |
|---|---|---|
| `integer` / `int` | `int` | `number` |
| `number` / `float` | `float` | `number` |
| `string` / `str` | `str` | `string` |
| `boolean` / `bool` | `bool` | `boolean` |

This table is the single place in the entire system where language-level type semantics are decided. If you want to add `uuid` support, you add one line to this table and every endpoint that uses it gets correct types in both languages.

---

## The Shock Test: Catching Breaking Changes at Build Time

This is the most important demonstration of why CCDA exists.

I created a second contract file called `contract.shock.yaml`. It is identical to `contract.yaml` with one change:

```yaml
response:
  price: string      # ← was: number
```

Running `npm run demo:shock` copies this file over `contract.yaml` and recompiles. The generated `types.ts` now contains:

```typescript
export interface ProductsResponse {
  price: string;   // ← was: number
}
```

Immediately, TypeScript produces this error:

```
src/App.tsx:135:14 — error TS2339:
Property 'toFixed' does not exist on type 'string'.

  ${p.price.toFixed(2)}
            ~~~~~~~
```

The build fails. The frontend application cannot be compiled. No Docker image is built. No deployment proceeds.

**The bug that would have reached production in a traditional project was caught at the moment the contract changed — before a single line of application code was written.**

This is the CCDA guarantee in its purest form.

---

## Adding a New Endpoint: The 10-Line Expansion

The second major benefit of CCDA is expansion velocity. Adding a new endpoint to a traditional project requires changes across at least four files. With CCDA, it requires adding one block to `contract.yaml`.

Suppose we want to add a `/reviews` endpoint. Here is the entire change required:

```yaml
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

After running `npm run compile`:

- `schemas.py` gains a `ReviewsResponse` Pydantic model
- `routes.py` gains a `register_reviews_service()` function and a `GET /reviews` route
- `types.ts` gains a `ReviewsResponse` TypeScript interface
- `api.ts` gains a `fetchReviews()` function and a `useReviews()` hook

The developer's only remaining task is registering the data function in `main.py` (3 lines) and consuming `useReviews()` in the UI. The infrastructure — validation, error handling, response modeling, state management boilerplate — is already there.

Compare this with the traditional workflow:

| Step | Traditional | CCDA |
|---|---|---|
| Define response shape | Write Pydantic model manually | Add to contract.yaml |
| Create route | Write FastAPI route manually | Automatic |
| Write TypeScript interface | Write manually, coordinate with backend | Automatic |
| Write fetch function | Write manually | Automatic |
| Write React hook | Write manually | Automatic |
| **Total files touched** | **4** | **1** |
| **Lines written** | **~80** | **~10** |
| **Sync guaranteed** | **No** | **Yes** |

---

## The Security Model

Authentication in CCDA is not a feature you add to a route — it is a **property of the contract**.

When `auth.required: true` appears in `contract.yaml`, the compiler generates a complete FastAPI dependency injection guard for that endpoint. The guard validates the `X-User-Role` header against the allowed roles list and returns a structured 403 response on failure:

```json
{
  "error": "CCDA_AUTHORIZATION_DENIED",
  "provided_role": "viewer",
  "allowed_roles": ["admin", "manager"],
  "message": "Role 'viewer' not authorized for /products"
}
```

When `auth.required: false`, no guard is generated. The route has no authentication surface at all — there is nothing to misconfigure, no dependency to forget.

This is the critical property: **you cannot accidentally deploy an unprotected route**. The contract either says it is protected (and the guard is always there) or it says it is public (and there is no guard to forget). The decision lives in `contract.yaml` and is enforced structurally, not by convention.

The frontend receives the same information. The compiler generates a typed role union:

```typescript
export type ProductsAllowedRole = 'admin' | 'manager';
```

The `useProducts` hook accepts only `ProductsAllowedRole | string`. TypeScript will warn you at compile time if you pass a role that is not in the contract.

---

## The Two-Zone Development Model

CCDA introduces a clean boundary between two types of code:

**Zone 1 — The Contract Layer** (single file)
- `contract.yaml` — the only place API shape decisions are made

**Zone 2 — The Generated Layer** (never edited manually)
- `backend/generated/schemas.py`
- `backend/generated/routes.py`
- `frontend/generated/types.ts`
- `frontend/generated/api.ts`

**Zone 3 — The Developer Layer** (what you actually write)
- `backend/main.py` — business logic and data
- `frontend/App.tsx` — UI components

This separation has a powerful consequence: **generated files are deleted from version control**. The `.gitignore` excludes `generated/` entirely. The repository contains only the contract and the developer-written code. The generated files are build artifacts — as ephemeral as compiled bytecode.

```
# .gitignore
backend_app/generated/*.py
frontend_app/src/generated/*.ts
```

This means the repository tells the complete story of developer intent without the noise of framework boilerplate. A code review on a new endpoint shows 10 lines of YAML and 3 lines of business logic — not 80 lines of scaffolding.

---

## Comparing the Approaches

Let me make this concrete with a side-by-side comparison of the same feature implemented both ways.

### Traditional: Adding a protected endpoint with two response types

**Files changed: 4. Lines written: ~80. Sync: not guaranteed.**

```python
# 1. backend/models.py — write manually
class ProductDetail(BaseModel):
    id: int
    title: str
    price: float
    in_stock: bool
    category: str

# 2. backend/main.py — write manually
ALLOWED_ROLES = ["admin", "manager"]  # duplicated somewhere else too

def check_auth(x_user_role: str = Header(None)):
    if x_user_role not in ALLOWED_ROLES:
        raise HTTPException(403, detail="Unauthorized")
    return x_user_role

@app.get("/products", response_model=List[ProductDetail])
async def get_products(role: str = Depends(check_auth)):
    return db.query_products()
```

```typescript
// 3. frontend/types.ts — write manually, hope it matches backend
export interface ProductDetail {
  id: number;
  title: string;
  price: number;    // if backend changes this, no error here
  in_stock: boolean;
  category: string;
}

// 4. frontend/api.ts — write manually
export function useProductDetail(role: string) {
  const [data, setData] = useState<ProductDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/products', { headers: { 'X-User-Role': role } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [role]);

  return { data, loading, error };
}
```

### CCDA: The same feature

**Files changed: 1. Lines written: ~10. Sync: compile-time guaranteed.**

```yaml
# contract.yaml — the only change
- name: Products
  endpoint: /products
  method: GET
  auth:
    required: true
    roles: [admin, manager]
  response:
    id: integer
    title: string
    price: number
    in_stock: boolean
    category: string
```

```bash
npm run compile
# → schemas.py, routes.py, types.ts, api.ts all updated
```

```tsx
// App.tsx — consume the generated hook
const { data, loading, error } = useProducts(role);
// TypeScript knows the exact shape. No guessing.
```

---

## What This Architecture Enables

Beyond the immediate benefits of type safety and reduced boilerplate, CCDA changes the nature of how teams collaborate.

**Parallel development becomes safe.** The backend team and the frontend team can work simultaneously once the contract is agreed upon. The contract is a formal, machine-verifiable specification. Neither team needs to wait for the other's implementation — they both code against the same generated types.

**Contract review replaces API review.** Instead of reviewing a 200-line PR that adds a new endpoint, the reviewer checks a 10-line YAML block. The question "does this match the frontend's expectations?" is answered by the compiler, not by the reviewer.

**Onboarding becomes trivial.** A new developer joining the project reads `contract.yaml` and understands the entire API surface in minutes. They do not need to trace through FastAPI routes, find the Pydantic models, compare them against TypeScript interfaces, and hope nothing has drifted.

**Experimentation is cheap.** Want to try adding a field to a response? Add it to the contract, recompile, and see what breaks. The compiler tells you immediately what UI components need to be updated. You can explore the design space without touching any generated code.

---

## The Limits and What Comes Next

CCDA in its current form is a proof of concept, and there are real limitations worth acknowledging.

**It handles GET requests with list responses.** The current compiler generates response models for list endpoints. POST, PUT, and PATCH endpoints — with request body validation — require extending the contract schema and the compiler's generation logic.

**It does not yet handle nested objects.** A response field of type `object` with its own sub-fields requires a richer type system in the contract. The current implementation handles flat response shapes.

**It assumes a single backend.** The architecture works cleanly for a single FastAPI service. A microservices setup where multiple backends contribute to a single frontend would require contract composition — merging multiple YAML files before compilation.

These are all solvable problems. The foundation is the important part: **establish the contract as the single source of truth, enforce it at compile time, and let the developer focus on what only humans can write — business logic and user interfaces.**

---

## The Full Picture

Here is the complete developer workflow with CCDA:

```
1. Agree on the API shape
      ↓
2. Write it in contract.yaml  (10 lines per endpoint)
      ↓
3. npm run compile            (generates 4 files automatically)
      ↓
4. Backend team: write data logic in main.py
   Frontend team: build UI in App.tsx
   (both teams work in parallel, against guaranteed-sync types)
      ↓
5. Change the contract?
   → npm run compile
   → TypeScript immediately shows every affected line in the UI
   → Fix the UI before the build can proceed
   → Deploy with confidence
```

The 2 AM production crash at the beginning of this article would not have happened. The moment someone changed `price` from `number` to `string` in the contract and ran the compiler, every `toFixed` call in the codebase would have been flagged — before a single git commit.

That is what architecture is supposed to do. Not catch bugs after they reach users. Catch them before they can be written.

---

## Getting Started

The complete proof of concept is available on GitHub:

**[github.com/riadhchelmouni/ccda-python-react-poc](https://github.com/riadhchelmouni/ccda-python-react-poc)**

```bash
git clone https://github.com/riadhchelmouni/ccda-python-react-poc.git
cd ccda-python-react-poc
npm install
npm run compile

# Backend
cd backend_app && pip install -r requirements.txt
python -m uvicorn main:app --reload

# Frontend (new terminal)
cd frontend_app && npm install && npm run dev
```

To see the shock test in action:

```bash
npm run demo:shock    # breaks the build with a type change
npm run demo:reset    # restores the original contract
```

---

## Conclusion

The problem of backend-frontend type drift is not a new problem. OpenAPI, GraphQL, tRPC, and JSON Schema have all attacked it from different angles. What CCDA offers is a different philosophy: rather than describing an existing API so that clients can consume it, the contract **comes first** and the API is a consequence of it.

The contract is not documentation. It is not a schema registry. It is the source code from which all other code is derived. Edit it, compile, and both stacks move together — atomically, verifiably, with no human coordination required.

In a world where most full-stack teams still rely on Slack messages and "you should update your TypeScript types" code review comments to keep two codebases in sync, that is a meaningful step forward.

---

*Built with TypeScript, Python, FastAPI, Pydantic v2, React 18, and Vite.*

*The CCDA architecture concept was conceived and designed by **Riadh Chelmouni**.*
