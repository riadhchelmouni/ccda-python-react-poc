# ═══════════════════════════════════════════════════════════════
# CCDA PoC — Backend Entry Point  (Developer-written code)
#
# All the developer writes here is:
#   1. Data source (Mock or a real database)
#   2. Registering functions with the auto-generated Router
#
# Everything else (Pydantic models, Auth, Routes) is generated from contract.yaml
#
# Run: python -m uvicorn main:app --reload
# ═══════════════════════════════════════════════════════════════
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from generated.routes import (
    router,
    register_products_service,
    register_categories_service,
)

app = FastAPI(
    title="CCDA PoC — Product Catalog API",
    description="Contract-Driven Architecture Proof of Concept",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Developer writes only: data ─────────────────────────────────

MOCK_PRODUCTS = [
    {"id": 1, "title": "Laptop Pro X1",       "price": 1299.99, "in_stock": True,  "category": "Electronics"},
    {"id": 2, "title": "Wireless Mouse",       "price": 29.99,   "in_stock": True,  "category": "Accessories"},
    {"id": 3, "title": "USB-C Hub Pro",        "price": 49.99,   "in_stock": False, "category": "Accessories"},
    {"id": 4, "title": "Mechanical Keyboard",  "price": 149.99,  "in_stock": True,  "category": "Peripherals"},
    {"id": 5, "title": '4K Monitor 27"',       "price": 449.99,  "in_stock": True,  "category": "Electronics"},
]

MOCK_CATEGORIES = [
    {"id": 1, "name": "Electronics",  "product_count": 2},
    {"id": 2, "name": "Accessories",  "product_count": 2},
    {"id": 3, "name": "Peripherals",  "product_count": 1},
]


def fetch_products(role: str) -> List[dict]:
    """Replace with real DB query. Role available for row-level security."""
    return MOCK_PRODUCTS


def fetch_categories() -> List[dict]:
    """Public endpoint — no role parameter needed."""
    return MOCK_CATEGORIES


# ── Register functions with the generated Router ─────────────────
register_products_service(fetch_products)
register_categories_service(fetch_categories)
app.include_router(router)
