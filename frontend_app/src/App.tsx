// ═══════════════════════════════════════════════════════════════
// CCDA PoC — Frontend UI  (Developer-written code)
//
// The developer writes only: the UI (display layer)
// All types, fetch functions, and state are generated from contract.yaml
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useProducts, useCategories } from './generated/api';
import type { ProductsAllowedRole } from './generated/types';

const DEMO_ROLES = [
  { value: 'admin',   label: 'Admin',   authorized: true  },
  { value: 'manager', label: 'Manager', authorized: true  },
  { value: 'viewer',  label: 'Viewer',  authorized: false },
] as const;

type Tab = 'products' | 'categories' | 'comparison';

export default function App() {
  const [role, setRole]   = useState<ProductsAllowedRole | string>('admin');
  const [tab,  setTab]    = useState<Tab>('products');

  const products   = useProducts(role);
  const categories = useCategories();

  return (
    <div style={S.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header style={S.header}>
        <h1 style={S.title}>CCDA Architecture — Live Demo</h1>
        <p style={S.subtitle}>
          All code below is auto-generated from{' '}
          <code style={S.code}>contract.yaml</code>
        </p>
      </header>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={S.tabs}>
        {([
          ['products',   '🔒 Products (Auth Required)'],
          ['categories', '🌐 Categories (Public)'],
          ['comparison', '⚖️ Before / After'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ ...S.tab, ...(tab === key ? S.tabActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          Tab 1 — Products (endpoint with auth)
      ════════════════════════════════════════════════════════ */}
      {tab === 'products' && (
        <>
          {/* Security Sandbox */}
          <section style={S.card}>
            <h2 style={S.cardTitle}>Security Scenario — Security Sandbox</h2>
            <p style={S.hint}>
              Change the role to see how the contract automatically rejects the request:
            </p>
            <div style={S.roleRow}>
              {DEMO_ROLES.map(({ value, label, authorized }) => (
                <button
                  key={value}
                  onClick={() => setRole(value)}
                  style={{
                    ...S.roleBtn,
                    borderColor: authorized ? '#22c55e' : '#ef4444',
                    color: role === value ? '#fff'
                         : authorized    ? '#22c55e' : '#ef4444',
                    backgroundColor: role === value
                      ? authorized ? '#166534' : '#7f1d1d'
                      : 'transparent',
                  }}
                >
                  {authorized ? '✓' : '✗'} {label}
                </button>
              ))}
            </div>
            <p style={S.roleStatus}>
              Current role: <code style={S.code}>{role}</code>
              {' → '}
              <span style={{
                fontWeight: 700,
                color: DEMO_ROLES.find(r => r.value === role)?.authorized
                  ? '#4ade80' : '#f87171',
              }}>
                {DEMO_ROLES.find(r => r.value === role)?.authorized
                  ? 'Allowed — authorized by contract'
                  : 'Blocked — blocked by CCDA guard (HTTP 403)'}
              </span>
            </p>
          </section>

          {/* Products Table */}
          <section style={S.card}>
            <div style={S.tableHeader}>
              <h2 style={S.cardTitle}>Products</h2>
              <button onClick={products.refetch} style={S.refreshBtn}
                disabled={products.loading}>
                {products.loading ? '⟳ Loading…' : '↺ Refresh'}
              </button>
            </div>
            {products.loading && <p style={S.loadingText}>Fetching…</p>}
            {products.error && (
              <div style={S.errorBox}>
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                <div>
                  <strong>CCDA Security Enforcement</strong>
                  <p style={{ marginTop: 4, fontSize: '0.875rem', color: '#fca5a5' }}>
                    {products.error}
                  </p>
                </div>
              </div>
            )}
            {products.data && (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>{['ID','Title','Category','Price','Stock'].map(h =>
                      <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {products.data.map(p => (
                      <tr key={p.id} style={S.tr}>
                        <td style={{ ...S.td, color: '#94a3b8' }}>#{p.id}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{p.title}</td>
                        <td style={S.td}><span style={S.badge}>{p.category}</span></td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#a3e635' }}>
                          ${p.price.toFixed(2)}
                        </td>
                        <td style={S.td}>
                          <span style={{
                            ...S.stockBadge,
                            backgroundColor: p.in_stock ? '#14532d' : '#450a0a',
                            color:           p.in_stock ? '#4ade80' : '#f87171',
                          }}>
                            {p.in_stock ? '● In Stock' : '○ Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          Tab 2 — Categories (public endpoint, no auth)
      ════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <section style={S.card}>
          <div style={S.tableHeader}>
            <div>
              <h2 style={S.cardTitle}>Categories</h2>
              <p style={S.hint}>
                This endpoint is public — no authorization required.
                The compiler did not generate an auth guard for it because <code style={S.code}>auth.required: false</code>
              </p>
            </div>
            <button onClick={categories.refetch} style={S.refreshBtn}
              disabled={categories.loading}>
              {categories.loading ? '⟳ Loading…' : '↺ Refresh'}
            </button>
          </div>
          {categories.loading && <p style={S.loadingText}>Fetching…</p>}
          {categories.error  && <p style={{ color: '#f87171' }}>{categories.error}</p>}
          {categories.data && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>{['ID', 'Category Name', 'Products'].map(h =>
                    <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {categories.data.map(c => (
                    <tr key={c.id} style={S.tr}>
                      <td style={{ ...S.td, color: '#94a3b8' }}>#{c.id}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#a3e635' }}>
                        {c.product_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          Tab 3 — Before / After Comparison
      ════════════════════════════════════════════════════════ */}
      {tab === 'comparison' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Before */}
          <section style={{ ...S.card, borderColor: '#7f1d1d' }}>
            <h2 style={{ ...S.cardTitle, color: '#f87171' }}>
              ✗ Traditional Approach
            </h2>
            <p style={S.hint}>What the developer writes manually for each endpoint:</p>
            <pre style={S.codeBlock}>{TRADITIONAL_CODE}</pre>
            <div style={S.statsRow}>
              <Stat label="Manual lines" value="~80" color="#f87171" />
              <Stat label="Files to edit" value="4" color="#f87171" />
              <Stat label="Sync guarantee" value="None" color="#f87171" />
            </div>
          </section>

          {/* After */}
          <section style={{ ...S.card, borderColor: '#166534' }}>
            <h2 style={{ ...S.cardTitle, color: '#4ade80' }}>
              ✓ With CCDA Architecture
            </h2>
            <p style={S.hint}>What the developer actually writes:</p>
            <pre style={S.codeBlock}>{CCDA_CODE}</pre>
            <div style={S.statsRow}>
              <Stat label="Manual lines" value="~8" color="#4ade80" />
              <Stat label="Files to edit" value="1" color="#4ade80" />
              <Stat label="Sync guarantee" value="100%" color="#4ade80" />
            </div>
          </section>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={S.footer}>
        Generated by <strong>CCDA Compiler v3.0</strong> from{' '}
        <code style={S.code}>contract.yaml</code>
        {' — '}
        <span style={{ color: '#64748b' }}>
          {tab === 'products'   && 'Endpoint: GET /products (auth required)'}
          {tab === 'categories' && 'Endpoint: GET /categories (public)'}
          {tab === 'comparison' && 'Comparison scenario: Before vs After'}
        </span>
      </footer>
    </div>
  );
}

// ── Stat component ───────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Code snippets for comparison tab ────────────────────────────
const TRADITIONAL_CODE = `// ❌ frontend/types.ts — manual copy from backend
interface ProductResponse {
  id: number;
  title: string;
  price: number; // If Backend changes this → no error!
  in_stock: boolean;
  category: string;
}

// ❌ frontend/api.ts — everything is manual
function useProducts(role: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setLoading(true);
    fetch('/products', { headers: { 'X-Role': role } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, [role]);
  return { data, loading, error };
}`;

const CCDA_CODE = `// ✅ contract.yaml — single source of truth
endpoints:
  - name: Products
    endpoint: /products
    auth:
      required: true
      roles: [admin, manager]
    response:
      price: number  # Change here → immediate build error

// ✅ App.tsx — what the developer writes only
const { data, error, loading } =
  useProducts(role);
// The rest is auto-generated ✓`;

// ── Styles ───────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: 960,
                margin: '0 auto', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header:     { textAlign: 'center', marginBottom: '1.5rem',
                paddingBottom: '1.5rem', borderBottom: '1px solid #1e293b' },
  title:      { fontSize: '1.875rem', fontWeight: 700, color: '#f8fafc', margin: 0 },
  subtitle:   { marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' },
  tabs:       { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  tab:        { padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
                border: '1px solid #334155', backgroundColor: 'transparent',
                color: '#94a3b8', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 },
  tabActive:  { backgroundColor: '#1e293b', color: '#f8fafc', borderColor: '#475569' },
  card:       { backgroundColor: '#1e293b', border: '1px solid #334155',
                borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle:  { fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.75rem' },
  hint:       { fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.875rem' },
  roleRow:    { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' },
  roleBtn:    { padding: '0.5rem 1.25rem', borderRadius: 9999, border: '2px solid',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
  roleStatus: { fontSize: '0.875rem', color: '#94a3b8' },
  tableHeader:{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: '1rem' },
  refreshBtn: { padding: '0.375rem 1rem', backgroundColor: '#334155',
                border: '1px solid #475569', borderRadius: '0.375rem',
                color: '#cbd5e1', cursor: 'pointer', fontSize: '0.8125rem',
                fontWeight: 500, whiteSpace: 'nowrap' },
  loadingText:{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.875rem' },
  errorBox:   { display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '1rem', backgroundColor: '#1c0a0a',
                border: '1px solid #7f1d1d', borderRadius: '0.5rem', color: '#fca5a5' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th:         { textAlign: 'left', padding: '0.625rem 1rem', backgroundColor: '#0f172a',
                color: '#64748b', fontSize: '0.75rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '1px solid #334155' },
  tr:         { borderBottom: '1px solid #0f172a' },
  td:         { padding: '0.75rem 1rem', color: '#e2e8f0' },
  badge:      { display: 'inline-block', padding: '0.2rem 0.65rem',
                backgroundColor: '#1e3a5f', color: '#93c5fd',
                borderRadius: 9999, fontSize: '0.75rem', fontWeight: 500 },
  stockBadge: { display: 'inline-block', padding: '0.2rem 0.65rem',
                borderRadius: 9999, fontSize: '0.75rem', fontWeight: 500 },
  statsRow:   { display: 'flex', justifyContent: 'space-around',
                marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #334155' },
  codeBlock:  { backgroundColor: '#0f172a', borderRadius: '0.5rem',
                padding: '1rem', fontSize: '0.75rem', color: '#94a3b8',
                overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'monospace',
                lineHeight: 1.6, margin: 0 },
  code:       { fontFamily: 'monospace', backgroundColor: '#0f172a',
                padding: '0.1rem 0.4rem', borderRadius: '0.25rem',
                fontSize: '0.85em', color: '#a3e635' },
  footer:     { textAlign: 'center', paddingTop: '1.5rem',
                borderTop: '1px solid #1e293b', color: '#475569', fontSize: '0.8125rem' },
};
