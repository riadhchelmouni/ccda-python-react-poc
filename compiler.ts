import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ═══════════════════════════════════════════════════════════════
//  CCDA Compiler v3.0 — Multi-Endpoint Contract-Driven Generator
//  One contract.yaml → synchronized Python + TypeScript for ALL endpoints
// ═══════════════════════════════════════════════════════════════

interface AuthConfig {
  required: boolean;
  roles: string[];
}

interface EndpointDef {
  name: string;
  endpoint: string;
  method: string;
  auth: AuthConfig;
  response: Record<string, string>;
}

interface CCDAContract {
  version?: string;
  info?: { title?: string; description?: string };
  endpoints: EndpointDef[];
}

type LangTarget = 'ts' | 'py';

const CONTRACT_PATH = './contract.yaml';
const GENERATED_ON  = new Date().toLocaleString('en-GB', { hour12: false });

// ── Type mapping ────────────────────────────────────────────────
const TYPE_MAP: Record<string, { ts: string; py: string }> = {
  integer: { ts: 'number',  py: 'int'   },
  int:     { ts: 'number',  py: 'int'   },
  number:  { ts: 'number',  py: 'float' },
  float:   { ts: 'number',  py: 'float' },
  string:  { ts: 'string',  py: 'str'   },
  str:     { ts: 'string',  py: 'str'   },
  boolean: { ts: 'boolean', py: 'bool'  },
  bool:    { ts: 'boolean', py: 'bool'  },
};

function mapType(raw: string, target: LangTarget): string {
  return TYPE_MAP[raw.toLowerCase()]?.[target] ?? (target === 'ts' ? 'unknown' : 'Any');
}

// ── Naming conventions derived from endpoint.name ───────────────
const pascal   = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower    = (s: string) => s.toLowerCase();
const upper    = (s: string) => s.toUpperCase();

const modelName  = (ep: EndpointDef) => `${pascal(ep.name)}Response`;
const authFn     = (ep: EndpointDef) => `verify_${lower(ep.name)}_auth`;
const svcVar     = (ep: EndpointDef) => `_${lower(ep.name)}_service`;
const registerFn = (ep: EndpointDef) => `register_${lower(ep.name)}_service`;
const fetchFn    = (ep: EndpointDef) => `fetch${pascal(ep.name)}`;
const hookFn     = (ep: EndpointDef) => `use${pascal(ep.name)}`;
const roleType   = (ep: EndpointDef) => `${pascal(ep.name)}AllowedRole`;
const rolesConst = (ep: EndpointDef) => `_ROLES_${upper(ep.name)}`;

// ── File helpers ────────────────────────────────────────────────
function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// ── Contract loading & validation ───────────────────────────────
function validate(c: CCDAContract): void {
  if (!Array.isArray(c.endpoints) || c.endpoints.length === 0) {
    throw new Error("'endpoints' must be a non-empty array");
  }
  for (const ep of c.endpoints) {
    if (!ep.name || !ep.endpoint || !ep.method) {
      throw new Error(`Endpoint is missing name, endpoint, or method`);
    }
    if (!ep.response || Object.keys(ep.response).length === 0) {
      throw new Error(`Endpoint '${ep.name}' must have at least one response field`);
    }
  }
}

function getContract(): CCDAContract {
  try {
    if (!fs.existsSync(CONTRACT_PATH)) throw new Error(`Not found: ${CONTRACT_PATH}`);
    const contract = yaml.load(fs.readFileSync(CONTRACT_PATH, 'utf8')) as CCDAContract;
    validate(contract);
    return contract;
  } catch (err) {
    console.error(`✗ Contract error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
//  BACKEND — Python (FastAPI + Pydantic v2)
// ═══════════════════════════════════════════════════════════════

function genSchemaPy(endpoints: EndpointDef[]): string {
  const needsAny = endpoints.some(ep =>
    Object.values(ep.response).some(t => mapType(t, 'py') === 'Any')
  );
  const typingImports = needsAny ? 'List, Any' : 'List';

  // ── Pydantic models ─────────────────────────────────────────
  const models = endpoints.map(ep => {
    const fields = Object.entries(ep.response)
      .map(([k, t]) => `    ${k}: ${mapType(t, 'py')}`)
      .join('\n');

    const example = Object.entries(ep.response)
      .map(([k, t]) => {
        const v = (t === 'string' || t === 'str')   ? '"sample"'
                : (t === 'boolean' || t === 'bool') ? 'True'
                : (t === 'integer' || t === 'int')  ? '1'
                : '0.0';
        return `            "${k}": ${v}`;
      })
      .join(',\n');

    return `class ${modelName(ep)}(BaseModel):
    """${ep.method} ${ep.endpoint} — auto-generated from contract."""
${fields}

    model_config = {
        "json_schema_extra": {"example": {
${example}
        }}
    }`;
  }).join('\n\n\n');

  // ── Auth guards (only for endpoints with auth.required = true) ──
  const authGuards = endpoints
    .filter(ep => ep.auth.required)
    .map(ep => {
      const roles = JSON.stringify(ep.auth.roles);
      return `${rolesConst(ep)}: List[str] = ${roles}

def ${authFn(ep)}(
    x_user_role: str = Header(None, alias="X-User-Role")
) -> str:
    """CCDA security gate for ${ep.method} ${ep.endpoint}."""
    if x_user_role not in ${rolesConst(ep)}:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "CCDA_AUTHORIZATION_DENIED",
                "provided_role": x_user_role,
                "allowed_roles": ${rolesConst(ep)},
                "message": f"Role '{x_user_role}' not authorized for ${ep.endpoint}",
            },
        )
    return x_user_role`;
    })
    .join('\n\n\n');

  return `# ╔══════════════════════════════════════════════════════════╗
# ║  ⚠️  AUTO-GENERATED BY CCDA COMPILER v3.0 — DO NOT EDIT  ║
# ║  Source  : contract.yaml | Generated: ${GENERATED_ON}
# ╚══════════════════════════════════════════════════════════╝
from __future__ import annotations
from typing import ${typingImports}
from pydantic import BaseModel
from fastapi import Header, HTTPException


${models}


# ── CCDA Authorization Guards ────────────────────────────────────
${authGuards || '# All endpoints are public — no auth guards generated.'}
`;
}

function genRoutesPy(endpoints: EndpointDef[]): string {
  const authEndpoints  = endpoints.filter(ep => ep.auth.required);
  const modelImports   = endpoints.map(ep => modelName(ep)).join(', ');
  const authImports    = authEndpoints.map(ep => authFn(ep)).join(', ');
  const schemaImports  = authImports ? `${modelImports}, ${authImports}` : modelImports;

  const serviceVars = endpoints
    .map(ep => `${svcVar(ep)}: Optional[Callable] = None`)
    .join('\n');

  const registerFns = endpoints.map(ep =>
    `def ${registerFn(ep)}(fn: Callable) -> None:
    """Register the data function for ${ep.method} ${ep.endpoint}."""
    global ${svcVar(ep)}
    ${svcVar(ep)} = fn`
  ).join('\n\n\n');

  const routes = endpoints.map(ep => {
    const method   = ep.method.toLowerCase();
    const hasAuth  = ep.auth.required;
    const authDep  = hasAuth ? `current_role: str = Depends(${authFn(ep)}),` : '';
    const callArgs = hasAuth ? 'current_role' : '';

    return `@router.${method}(
    "${ep.endpoint}",
    response_model=List[${modelName(ep)}],
    summary="${ep.method} ${ep.endpoint}",
    tags=["CCDA Auto-generated"],
)
async def handle_${lower(ep.name)}(${authDep}) -> List[${modelName(ep)}]:
    if ${svcVar(ep)} is None:
        raise HTTPException(500, detail="Service not registered. Call ${registerFn(ep)}() in main.py.")
    return ${svcVar(ep)}(${callArgs})`;
  }).join('\n\n\n');

  return `# ╔══════════════════════════════════════════════════════════╗
# ║  ⚠️  AUTO-GENERATED BY CCDA COMPILER v3.0 — DO NOT EDIT  ║
# ║  Source  : contract.yaml | Generated: ${GENERATED_ON}
# ╚══════════════════════════════════════════════════════════╝
from __future__ import annotations
from typing import Callable, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from .schemas import ${schemaImports}

router = APIRouter()


# ── Service Registries ────────────────────────────────────────────
${serviceVars}


${registerFns}


# ── Routes ───────────────────────────────────────────────────────
${routes}
`;
}

// ═══════════════════════════════════════════════════════════════
//  FRONTEND — TypeScript (React)
// ═══════════════════════════════════════════════════════════════

function genTypesTs(endpoints: EndpointDef[]): string {
  const blocks = endpoints.map(ep => {
    const fields = Object.entries(ep.response)
      .map(([k, t]) => `  ${k}: ${mapType(t, 'ts')};`)
      .join('\n');

    const roleUnion = ep.auth.required && ep.auth.roles.length > 0
      ? `\nexport type ${roleType(ep)} = ${ep.auth.roles.map(r => `'${r}'`).join(' | ')};`
      : '';

    return `/** ${ep.method} ${ep.endpoint} */
export interface ${modelName(ep)} {
${fields}
}${roleUnion}`;
  }).join('\n\n\n');

  return `// ╔══════════════════════════════════════════════════════════╗
// ║  ⚠️  AUTO-GENERATED BY CCDA COMPILER v3.0 — DO NOT EDIT  ║
// ║  Source  : contract.yaml | Generated: ${GENERATED_ON}
// ╚══════════════════════════════════════════════════════════╝

/** Generic async state shape for all hooks */
export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}


${blocks}
`;
}

function genApiTs(endpoints: EndpointDef[]): string {
  const typeNames = [
    'ApiState',
    ...endpoints.map(ep => modelName(ep)),
    ...endpoints
      .filter(ep => ep.auth.required && ep.auth.roles.length > 0)
      .map(ep => roleType(ep)),
  ].join(', ');

  const blocks = endpoints.map(ep => {
    const hasAuth    = ep.auth.required && ep.auth.roles.length > 0;
    const param      = hasAuth ? `userRole: ${roleType(ep)} | string` : '';
    const authHeader = hasAuth ? `\n      'X-User-Role': userRole,` : '';
    const callArg    = hasAuth ? 'userRole' : '';
    const deps       = hasAuth ? 'userRole' : '';

    return `// ── ${ep.name} — ${ep.method} ${ep.endpoint} ─────────────────────────────
export async function ${fetchFn(ep)}(${param}): Promise<${modelName(ep)}[]> {
  const res = await fetch(\`\${API_BASE}${ep.endpoint}\`, {
    method: '${ep.method}',
    headers: {
      'Content-Type': 'application/json',${authHeader}
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body?.detail?.message ?? body?.detail ?? \`HTTP \${res.status}\`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return res.json() as Promise<${modelName(ep)}[]>;
}

export function ${hookFn(ep)}(${param}) {
  const [state, setState] = useState<ApiState<${modelName(ep)}[]>>({
    data: null, loading: false, error: null,
  });
  const load = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await ${fetchFn(ep)}(${callArg});
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setState({ data: null, loading: false, error: message });
    }
  }, [${deps}]);
  useEffect(() => { void load(); }, [load]);
  return { ...state, refetch: load };
}`;
  }).join('\n\n\n');

  return `// ╔══════════════════════════════════════════════════════════╗
// ║  ⚠️  AUTO-GENERATED BY CCDA COMPILER v3.0 — DO NOT EDIT  ║
// ║  Source  : contract.yaml | Generated: ${GENERATED_ON}
// ╚══════════════════════════════════════════════════════════╝
import { useState, useEffect, useCallback } from 'react';
import type { ${typeNames} } from './types';

const API_BASE = 'http://127.0.0.1:8000';


${blocks}
`;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

function run(): void {
  const W    = 62;
  const line = '═'.repeat(W);
  const pad  = (s: string) => s.padEnd(W);

  console.log(`\n╔${line}╗`);
  console.log(`║${pad('  CCDA COMPILER v3.0  —  Contract-Driven Code Generator')}║`);
  console.log(`╚${line}╝\n`);

  const contract = getContract();
  const { endpoints, version, info } = contract;

  console.log('✔ Contract loaded');
  console.log(`  Title    : ${info?.title ?? '—'}`);
  console.log(`  Version  : ${version ?? '—'}`);
  console.log(`  Endpoints: ${endpoints.length}`);
  endpoints.forEach(ep => {
    const auth = ep.auth.required ? `🔒 [${ep.auth.roles.join(', ')}]` : '🌐 public';
    console.log(`    ${ep.method.padEnd(6)} ${ep.endpoint.padEnd(18)} ${auth}`);
  });
  console.log('');

  // Backend
  console.log('🐍 Generating Python (FastAPI + Pydantic v2)...');
  write('./backend_app/generated/__init__.py', '');
  write('./backend_app/generated/schemas.py', genSchemaPy(endpoints));
  console.log(`   ✔  schemas.py  — ${endpoints.length} Pydantic models + auth guards`);
  write('./backend_app/generated/routes.py', genRoutesPy(endpoints));
  console.log(`   ✔  routes.py   — ${endpoints.length} FastAPI routes + service registries\n`);

  // Frontend
  console.log('⚛️  Generating TypeScript (React + Vite)...');
  write('./frontend_app/src/generated/types.ts', genTypesTs(endpoints));
  console.log(`   ✔  types.ts  — ${endpoints.length} TypeScript interfaces`);
  write('./frontend_app/src/generated/api.ts', genApiTs(endpoints));
  console.log(`   ✔  api.ts    — ${endpoints.length} fetch functions + ${endpoints.length} React hooks\n`);

  const total = endpoints.length * 2;
  console.log(`╔${line}╗`);
  console.log(`║${pad(`  ✓  ${total} files written. Python & React are 100% synchronized.`)}║`);
  console.log(`╚${line}╝\n`);
  console.log('  Backend  →  cd backend_app && python -m uvicorn main:app --reload');
  console.log('  Frontend →  cd frontend_app && npm run dev');
  console.log('  Shock    →  npm run demo:shock\n');
}

run();
