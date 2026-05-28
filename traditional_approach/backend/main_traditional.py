# ═══════════════════════════════════════════════════════════════
#  TRADITIONAL APPROACH — Backend (Manual, no contract)
#
#  مشكلة هذا الأسلوب:
#   ✗ النوع price: float — هنا يدوي، والـ Frontend لا يعلم
#   ✗ إذا غيّر Backend النوع إلى str → Frontend يكسر في Runtime
#   ✗ لا sync تلقائي — كل تعديل يحتاج تعديل يدوي في الطرفين
#   ✗ Auth logic مكتوب يدوياً ويمكن نسيانه
# ═══════════════════════════════════════════════════════════════
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic model — written manually ──────────────────────────
# ⚠️  Developer wrote this by hand. Frontend team writes their
#     own TypeScript interface separately. No guarantee they match.
class Product(BaseModel):
    id: int
    title: str
    price: float       # ← Manual. If you change this to str here,
    in_stock: bool     #   the Frontend TypeScript won't know until
    category: str      #   runtime crash or manual PR review.

class Category(BaseModel):
    id: int
    name: str
    product_count: int


ALLOWED_ROLES = ["admin", "manager"]   # ← Manual, easy to forget in new routes

MOCK_PRODUCTS = [
    {"id": 1, "title": "Laptop Pro X1",      "price": 1299.99, "in_stock": True,  "category": "Electronics"},
    {"id": 2, "title": "Wireless Mouse",      "price": 29.99,   "in_stock": True,  "category": "Accessories"},
    {"id": 3, "title": "USB-C Hub Pro",       "price": 49.99,   "in_stock": False, "category": "Accessories"},
    {"id": 4, "title": "Mechanical Keyboard", "price": 149.99,  "in_stock": True,  "category": "Peripherals"},
    {"id": 5, "title": '4K Monitor 27"',      "price": 449.99,  "in_stock": True,  "category": "Electronics"},
]

MOCK_CATEGORIES = [
    {"id": 1, "name": "Electronics",  "product_count": 2},
    {"id": 2, "name": "Accessories",  "product_count": 2},
    {"id": 3, "name": "Peripherals",  "product_count": 1},
]


# ── Auth guard — written manually for each route ───────────────
# ⚠️  If someone adds a new route and forgets to add this
#     dependency, the endpoint is silently unprotected.
def check_auth(x_user_role: str = Header(None, alias="X-User-Role")) -> str:
    if x_user_role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{x_user_role}' is not authorized",
        )
    return x_user_role


@app.get("/products", response_model=List[Product])
async def get_products(role: str = check_auth):   # type: ignore[assignment]
    return MOCK_PRODUCTS


@app.get("/categories", response_model=List[Category])
async def get_categories():
    return MOCK_CATEGORIES
