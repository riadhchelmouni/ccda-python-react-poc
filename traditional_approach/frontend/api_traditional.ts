// ═══════════════════════════════════════════════════════════════
//  TRADITIONAL APPROACH — Frontend Types & API (Manual, no contract)
//
//  مشكلة هذا الأسلوب:
//   ✗ Interface مكتوب يدوياً — نسخة مستقلة عن Backend
//   ✗ price: number هنا، لكن Backend قد يُغيّره والـ TS لا يعلم
//   ✗ لا أحد يضمن أن هذا الملف متزامن مع Backend في أي وقت
//   ✗ Auth roles مكررة هنا وفي Backend — مصدران للحقيقة
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';

// ── Manual TypeScript interfaces ────────────────────────────────
// ⚠️  These were typed by the frontend developer after reading the
//     backend code (or from an informal Slack message). If the
//     backend team changes Product.price to string, this file
//     stays as `number` until someone notices the bug in production.

export interface Product {
  id: number;
  title: string;
  price: number;       // ← Manual. Backend can silently diverge.
  in_stock: boolean;
  category: string;
}

export interface Category {
  id: number;
  name: string;
  product_count: number;
}

// ── Manual role type ─────────────────────────────────────────────
// ⚠️  Duplicated from Backend. If Backend adds a new role ('viewer'),
//     this type doesn't update → new role always falls through as
//     unauthorized on the frontend, silently.
export type UserRole = 'admin' | 'manager';

const API_BASE = 'http://127.0.0.1:8000';


// ── Manual fetch functions ────────────────────────────────────────
// ⚠️  Headers, error handling, and response casting are all
//     repeated manually for each endpoint. One copy-paste mistake
//     (e.g. forgetting 'X-User-Role' header) = silent auth bypass.

export async function fetchProducts(userRole: UserRole | string): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': userRole,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<Product[]>;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<Category[]>;
}


// ── Manual React hooks ────────────────────────────────────────────
// ⚠️  State shape (data/loading/error) repeated in each hook.
//     No shared ApiState<T> — just copy-pasted boilerplate.

export function useProducts(userRole: UserRole | string) {
  const [data, setData]       = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const result = await fetchProducts(userRole);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, refetch: load };
}

export function useCategories() {
  const [data, setData]       = useState<Category[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const result = await fetchCategories();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, refetch: load };
}
