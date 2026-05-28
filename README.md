# CCDA — Centralized Contract-Driven Architecture

> **One YAML file. Two synchronized stacks. Zero drift.**

A production-grade proof-of-concept demonstrating **Contract-Driven Architecture** — an approach where a single `contract.yaml` file is the **sole source of truth** that drives automatic, type-safe code generation for both the Python (FastAPI) backend and the React (TypeScript) frontend simultaneously.

---

## Table of Contents

- [The Problem This Solves](#the-problem-this-solves)
- [Core Concept](#core-concept)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [The Contract File](#the-contract-file)
- [What Gets Generated](#what-gets-generated)
- [Demo Scenarios](#demo-scenarios)
  - [Shock Test — Breaking Change Detection](#1-shock-test--breaking-change-detection)
  - [Adding a New Endpoint](#2-adding-a-new-endpoint)
  - [Before / After Comparison](#3-before--after-comparison)
- [Security Model](#security-model)
- [Developer Workflow](#developer-workflow)
- [Traditional vs CCDA](#traditional-vs-ccda)
- [Scripts Reference](#scripts-reference)
- [How the Compiler Works](#how-the-compiler-works)
- [Contributing](#contributing)

---

## The Problem This Solves

In traditional full-stack development, the backend and frontend teams each maintain their own copy of the data contract:

```
Backend team writes:          Frontend team writes (separately):

class Product(BaseModel):     interface Product {
    id: int                     id: number;
    title: str                  title: string;
    price: float    ──────✗──▶  price: number;  ← nobody enforces this matches
    in_stock: bool              in_stock: boolean;
    category: str               category: string;
}                             }
```

**What goes wrong:**

| Scenario | Traditional outcome | When discovered |
|---|---|---|
| Backend changes `price: float` → `price: str` | Frontend crashes on `price.toFixed(2)` | Runtime / Production |
| New endpoint added on Backend | Frontend team must be notified manually | Code review / Slack |
| Auth role added (`viewer`) | Frontend role union type is stale | Never — silent bug |
| New field added to response | Frontend misses it until someone notices | PR review / QA |

**CCDA eliminates every one of these failure modes at compile time.**

---

## Core Concept

```
                    ┌─────────────────────┐
                    │    contract.yaml     │  ← The ONLY file both
                    │  (single source of   │    teams touch to agree
                    │      truth)          │    on the API shape
                    └──────────┬──────────┘
                               │
                    npm run compile
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
   ┌───────────────────────┐       ┌───────────────────────┐
   │  Python (FastAPI)     │       │  TypeScript (React)   │
   │                       │       │                       │
   │  schemas.py           │       │  types.ts             │
   │  ├─ Pydantic models   │       │  ├─ Interfaces        │
   │  └─ Auth guards       │       │  └─ Role union types  │
   │                       │       │                       │
   │  routes.py            │       │  api.ts               │
   │  ├─ FastAPI routes    │       │  ├─ fetch functions    │
   │  └─ Service registry  │       │  └─ React hooks       │
   └───────────────────────┘       └───────────────────────┘
           ▲                                   ▲
           │                                   │
   Developer writes only:            Developer writes only:
   business logic in main.py         UI components in App.tsx
```

**The guarantee:** If you change a field type in `contract.yaml`, both sides break at compile time — not at runtime.

---

## Architecture Overview

```
ccda-python-react-poc/
│
│  contract.yaml          ← YOU EDIT THIS
│  compiler.ts            ← Reads contract, generates everything
│
├─ backend_app/
│   │  main.py            ← YOU EDIT THIS (data + business logic)
│   └─ generated/         ← DO NOT EDIT (auto-generated)
│       ├─ schemas.py     ← Pydantic models + auth guards
│       └─ routes.py      ← FastAPI routes + service registry
│
├─ frontend_app/src/
│   │  App.tsx            ← YOU EDIT THIS (UI components)
│   └─ generated/         ← DO NOT EDIT (auto-generated)
│       ├─ types.ts       ← TypeScript interfaces + role types
│       └─ api.ts         ← fetch functions + React hooks
│
└─ traditional_approach/  ← Annotated comparison (reference only)
```

**The two-zone rule:**
- **Developer zone** — `contract.yaml`, `main.py`, `App.tsx`
- **Generated zone** — everything inside `generated/` (never edit manually)

---

## Project Structure

```
ccda-python-react-poc/
├── contract.yaml                    # API contract — single source of truth
├── contract.shock.yaml              # Shock test variant (price: string)
├── compiler.ts                      # CCDA Compiler v3.0
├── tsconfig.json                    # Compiler TypeScript config
├── package.json                     # Compiler dependencies + demo scripts
│
├── backend_app/
│   ├── main.py                      # Developer-written: data + service registration
│   ├── requirements.txt             # Python dependencies
│   └── generated/
│       ├── __init__.py
│       ├── schemas.py               # Auto-generated: Pydantic models + auth guards
│       └── routes.py                # Auto-generated: FastAPI routes + registries
│
├── frontend_app/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json                 # React dependencies
│   └── src/
│       ├── App.tsx                  # Developer-written: UI components
│       ├── main.tsx
│       ├── index.css
│       ├── vite-env.d.ts
│       └── generated/
│           ├── types.ts             # Auto-generated: TypeScript interfaces
│           └── api.ts               # Auto-generated: fetch + React hooks
│
└── traditional_approach/            # Reference: manual coding comparison
    ├── COMPARISON.md
    ├── backend/main_traditional.py
    └── frontend/api_traditional.ts
```

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| **Compiler** | TypeScript + ts-node | 5.5 / 10.9 | Reads contract, generates code |
| **Contract** | YAML (js-yaml) | 4.1 | API definition language |
| **Backend** | Python + FastAPI | 3.10+ / 0.115 | REST API server |
| **Backend validation** | Pydantic v2 | 2.8 | Request/response models |
| **Backend server** | Uvicorn | 0.30 | ASGI server |
| **Frontend** | React 18 + TypeScript | 18.3 / 5.5 | UI |
| **Frontend build** | Vite | 5.3 | Dev server + bundler |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **pip**

### 1. Clone and install compiler dependencies

```bash
git clone https://github.com/riadhchelmouni/ccda-python-react-poc.git
cd ccda-python-react-poc
npm install
```

### 2. Generate backend + frontend code from the contract

```bash
npm run compile
```

Expected output:
```
╔══════════════════════════════════════════════════════════════╗
║  CCDA COMPILER v3.0  —  Contract-Driven Code Generator       ║
╚══════════════════════════════════════════════════════════════╝

✔ Contract loaded
  Title    : Product Catalog API
  Version  : 2.0.0
  Endpoints: 2
    GET    /products          🔒 [admin, manager]
    GET    /categories        🌐 public

🐍 Generating Python (FastAPI + Pydantic v2)...
   ✔  schemas.py  — 2 Pydantic models + auth guards
   ✔  routes.py   — 2 FastAPI routes + service registries

⚛️  Generating TypeScript (React + Vite)...
   ✔  types.ts  — 2 TypeScript interfaces
   ✔  api.ts    — 2 fetch functions + 2 React hooks

╔══════════════════════════════════════════════════════════════╗
║  ✓  4 files written. Python & React are 100% synchronized.   ║
╚══════════════════════════════════════════════════════════════╝
```

### 3. Start the backend

```bash
cd backend_app
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend runs at: `http://127.0.0.1:8000`
Interactive API docs: `http://127.0.0.1:8000/docs`

### 4. Start the frontend (new terminal)

```bash
cd frontend_app
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## The Contract File

`contract.yaml` is the only file that defines your entire API surface. Both teams read it — neither team diverges from it.

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
      required: true          # ← compiler generates auth guard
      roles:
        - admin
        - manager             # ← compiler generates role union type
    response:
      id: integer
      title: string
      price: number           # ← change this → both sides break immediately
      in_stock: boolean
      category: string

  - name: Categories
    endpoint: /categories
    method: GET
    auth:
      required: false         # ← compiler generates NO auth guard
      roles: []
    response:
      id: integer
      name: string
      product_count: integer
```

### Supported field types

| Contract type | Python (Pydantic) | TypeScript |
|---|---|---|
| `integer` / `int` | `int` | `number` |
| `number` / `float` | `float` | `number` |
| `string` / `str` | `str` | `string` |
| `boolean` / `bool` | `bool` | `boolean` |

---

## What Gets Generated

Running `npm run compile` produces **4 files** synchronized to the contract.

### `backend_app/generated/schemas.py`

```python
class ProductsResponse(BaseModel):
    """GET /products — auto-generated from contract."""
    id: int
    title: str
    price: float
    in_stock: bool
    category: str

class CategoriesResponse(BaseModel):
    """GET /categories — auto-generated from contract."""
    id: int
    name: str
    product_count: int

# Auth guard — only generated for auth.required: true endpoints
_ROLES_PRODUCTS: List[str] = ["admin", "manager"]

def verify_products_auth(
    x_user_role: str = Header(None, alias="X-User-Role")
) -> str:
    if x_user_role not in _ROLES_PRODUCTS:
        raise HTTPException(status_code=403, detail={...})
    return x_user_role
```

### `backend_app/generated/routes.py`

```python
# Service registry — decouples routes from business logic
_products_service: Optional[Callable] = None
_categories_service: Optional[Callable] = None

def register_products_service(fn: Callable) -> None: ...
def register_categories_service(fn: Callable) -> None: ...

@router.get("/products", response_model=List[ProductsResponse])
async def handle_products(
    current_role: str = Depends(verify_products_auth)
) -> List[ProductsResponse]:
    return _products_service(current_role)

@router.get("/categories", response_model=List[CategoriesResponse])
async def handle_categories() -> List[CategoriesResponse]:
    return _categories_service()
```

### `frontend_app/src/generated/types.ts`

```typescript
export interface ProductsResponse {
  id: number;
  title: string;
  price: number;        // ← synchronized with contract
  in_stock: boolean;
  category: string;
}

export type ProductsAllowedRole = 'admin' | 'manager';  // ← from contract.auth.roles

export interface CategoriesResponse {
  id: number;
  name: string;
  product_count: number;
}
```

### `frontend_app/src/generated/api.ts`

```typescript
// Typed fetch + React hook — auth-aware, generated per endpoint
export async function fetchProducts(
  userRole: ProductsAllowedRole | string
): Promise<ProductsResponse[]> { ... }

export function useProducts(userRole: ProductsAllowedRole | string) {
  // useState + useEffect + useCallback — all generated
  return { data, loading, error, refetch };
}

// Public endpoint — no auth parameter
export async function fetchCategories(): Promise<CategoriesResponse[]> { ... }
export function useCategories() { ... }
```

---

## Demo Scenarios

### 1. Shock Test — Breaking Change Detection

**Scenario:** A backend developer changes `price` from `number` to `string`. How fast does the system catch it?

**Run:**
```bash
npm run demo:shock
```

This copies `contract.shock.yaml` (which has `price: string`) over `contract.yaml` and runs the compiler. The generated `types.ts` now contains:

```typescript
export interface ProductsResponse {
  price: string;   // ← was number
}
```

Immediately, TypeScript flags the UI:

```
src/App.tsx:135:14 — error TS2339:
Property 'toFixed' does not exist on type 'string'.

  ${p.price.toFixed(2)}
            ~~~~~~~
```

**The build fails. No deployment is possible until the UI is fixed.**

This is the CCDA guarantee: **type contract violations are caught at compile time, not in production.**

**Reset to the original contract:**
```bash
npm run demo:reset
```

---

### 2. Adding a New Endpoint

**Scenario:** Add a `/reviews` endpoint — rated product reviews. All you touch is `contract.yaml`.

**Step 1 — Add one block to `contract.yaml`:**

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

**Step 2 — Recompile:**
```bash
npm run compile
```

**What gets created automatically:**

| File | What was added |
|---|---|
| `schemas.py` | `CategoriesResponse` Pydantic model |
| `routes.py` | `register_reviews_service()` + `GET /reviews` route |
| `types.ts` | `ReviewsResponse` TypeScript interface |
| `api.ts` | `fetchReviews()` + `useReviews()` hook |

**Step 3 — Register data in `main.py`** (the only manual step):

```python
from generated.routes import register_reviews_service

def fetch_reviews() -> List[dict]:
    return MOCK_REVIEWS

register_reviews_service(fetch_reviews)
```

**Step 4 — Use in `App.tsx`:**

```tsx
import { useReviews } from './generated/api';
// useReviews() is ready — no other changes needed
```

**Total changes:** 10 lines in `contract.yaml` + 3 lines in `main.py` + consume the hook in UI.

---

### 3. Before / After Comparison

The live UI (Tab 3: **⚖️ Before / After**) shows a side-by-side comparison directly in the browser. The `traditional_approach/` folder contains fully annotated files showing what the same functionality looks like without CCDA:

| Metric | Traditional | CCDA |
|---|---|---|
| Lines written manually per endpoint | ~80 | ~8 |
| Files to edit | 4 | 1 (`contract.yaml`) |
| Sync guarantee | None | Compile-time enforcement |
| Breaking change detection | Runtime crash | Build failure |
| Auth defined in | 2 places (BE + FE) | 1 place |
| Role type consistency | Manual, can diverge | Generated from same source |

---

## Security Model

The CCDA compiler generates a **per-endpoint auth guard** for every endpoint where `auth.required: true`.

```
HTTP Request
     │
     ▼
FastAPI Route
     │
     ▼
verify_products_auth()          ← generated from contract.auth
     │
     ├─ X-User-Role: admin    → ✓ pass → fetch_products("admin")
     ├─ X-User-Role: manager  → ✓ pass → fetch_products("manager")
     └─ X-User-Role: viewer   → ✗ HTTP 403 CCDA_AUTHORIZATION_DENIED
```

**403 response shape:**
```json
{
  "error": "CCDA_AUTHORIZATION_DENIED",
  "provided_role": "viewer",
  "allowed_roles": ["admin", "manager"],
  "message": "Role 'viewer' not authorized for /products"
}
```

**Key property:** Auth guards are not written by the developer and cannot be forgotten. If `auth.required: true` is in the contract, the guard is always there.

---

## Developer Workflow

### Day-to-day

```
1. Edit contract.yaml      (API designer)
         │
         ▼
2. npm run compile         (generates 4 files)
         │
         ▼
3. Edit main.py            (backend dev — data/logic only)
   Edit App.tsx            (frontend dev — UI only)
         │
         ▼
4. Both teams work independently — types are guaranteed to match
```

### Watch mode (auto-recompile on contract change)

```bash
npm run compile:watch
```

Any save to `contract.yaml` triggers an immediate recompile. Combine with backend `--reload` and Vite HMR for a fully live development loop.

---

## Traditional vs CCDA

### Adding a new endpoint — step count

**Traditional (4 files, ~80 lines):**

```
1. backend/models.py      ← add Pydantic model manually
2. backend/main.py        ← add route + auth dependency manually
3. frontend/types.ts      ← add TypeScript interface manually
4. frontend/api.ts        ← add fetch function + hook manually
```

**CCDA (1 file, ~10 lines):**

```
1. contract.yaml          ← add endpoint block
   npm run compile        ← all 4 files generated automatically
```

### Type safety under change

```
Backend changes price: float → str

Traditional:
  schemas.py   ← updated (developer wrote it)
  types.ts     ← NOT updated (separate file, separate team)
  App.tsx      ← price.toFixed(2) compiles fine, crashes at runtime
  Detected:    RUNTIME / PRODUCTION

CCDA:
  contract.yaml  ← developer changes price: number → string
  npm run compile
  types.ts       ← auto-updated: price: string
  App.tsx        ← TypeScript immediately: "toFixed does not exist on string"
  Detected:      BUILD TIME — deployment blocked
```

---

## Scripts Reference

All scripts are run from the **project root** (`ccda-python-react-poc/`).

| Script | Command | Description |
|---|---|---|
| **Compile** | `npm run compile` | Generate all code from `contract.yaml` |
| **Watch** | `npm run compile:watch` | Auto-recompile on contract change |
| **Shock test** | `npm run demo:shock` | Apply breaking type change and recompile |
| **Reset** | `npm run demo:reset` | Restore original contract and recompile |

Backend and frontend have their own scripts run from their respective folders:

```bash
# Backend
cd backend_app
python -m uvicorn main:app --reload     # development server

# Frontend
cd frontend_app
npm run dev                              # development server (port 5173)
npm run build                           # production build (tsc + vite)
npm run preview                         # preview production build
```

---

## How the Compiler Works

`compiler.ts` is a **single-pass code generator** (~390 lines) with no runtime dependencies beyond `js-yaml`.

```
compiler.ts
│
├── getContract()              Loads & validates contract.yaml
│     ├── validate()           Checks required fields, non-empty endpoints
│     └── process.exit(1)      Fails hard on invalid contract
│
├── genSchemaPy(endpoints)     → backend_app/generated/schemas.py
│     ├── Pydantic models      One per endpoint, fields from response
│     └── Auth guards          Only for auth.required: true
│
├── genRoutesPy(endpoints)     → backend_app/generated/routes.py
│     ├── Service registries   register_<name>_service(fn)
│     └── FastAPI routes       With/without Depends() per auth config
│
├── genTypesTs(endpoints)      → frontend_app/src/generated/types.ts
│     ├── Interfaces           One per endpoint
│     └── Role union types     Only for auth.required: true
│
└── genApiTs(endpoints)        → frontend_app/src/generated/api.ts
      ├── fetch functions      With/without userRole param per auth config
      └── React hooks          useState + useEffect + useCallback
```

**Naming conventions** (all derived from `endpoint.name`):

| Pattern | Example (`name: Products`) |
|---|---|
| Pydantic model | `ProductsResponse` |
| Auth guard fn | `verify_products_auth` |
| Service registry | `register_products_service` |
| TS interface | `ProductsResponse` |
| Role type | `ProductsAllowedRole` |
| Fetch function | `fetchProducts` |
| React hook | `useProducts` |

---

## Contributing

### Adding a new field type

Edit the `TYPE_MAP` in `compiler.ts`:

```typescript
const TYPE_MAP: Record<string, { ts: string; py: string }> = {
  integer: { ts: 'number',  py: 'int'   },
  number:  { ts: 'number',  py: 'float' },
  string:  { ts: 'string',  py: 'str'   },
  boolean: { ts: 'boolean', py: 'bool'  },
  // Add here:
  uuid:    { ts: 'string',  py: 'UUID'  },
  date:    { ts: 'string',  py: 'date'  },
};
```

### Adding a new HTTP method

The compiler already reads `endpoint.method` from the contract and passes it to the router generator:

```typescript
const method = ep.method.toLowerCase();  // get, post, put, delete, patch
return `@router.${method}("${ep.endpoint}", ...)`;
```

Adding `method: POST` to an endpoint in `contract.yaml` works immediately without changing the compiler.

### Project principles

- **One source of truth** — `contract.yaml` is authoritative; generated files are outputs, not inputs
- **Fail at compile time** — type errors must be caught before `git push`, not in production
- **Developer writes minimum** — business logic and UI only; everything structural is generated
- **No runtime magic** — the compiler is a build-time tool; generated code is plain Python and TypeScript with no framework lock-in

---

<div align="center">

**CCDA Architecture** — Invented and designed by **Riadh Chelmouni**

*Contract-Driven. Type-Safe. Zero Drift.*

</div>
