// Refresh openapi.json from the backend.
//   OAKLY_BACKEND_DIR=../backend pnpm api:sync      (dumps the spec with the backend's Poetry env, no server needed)
//   OAKLY_OPENAPI_URL=http://localhost:8000/api/v1/openapi.json pnpm api:sync   (from a running server)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../openapi.json");
const backendDir = process.env.OAKLY_BACKEND_DIR;
let spec;
if (backendDir) {
  const py = [
    "import json, os",
    "from cryptography.fernet import Fernet",
    "os.environ.setdefault('DATABASE_URL', 'postgresql://x:x@127.0.0.1:1/x')",
    "os.environ.setdefault('SECRET_KEY', 'spec-dump')",
    "os.environ.setdefault('VITALS_ENCRYPTION_KEY', Fernet.generate_key().decode())",
    "os.environ['OAKLY_ENV_FILE'] = ''",
    "from app.main import app",
    "print(json.dumps(app.openapi()))",
  ].join("\n");
  // Resolve relative to where the command was run (pnpm runs scripts from the package dir).
  const cwd = resolve(process.env.INIT_CWD ?? process.cwd(), backendDir);
  const raw = execFileSync("poetry", ["run", "python", "-c", py], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 << 20,
    env: { ...process.env, PYTHONWARNINGS: "ignore" },
    stdio: ["ignore", "pipe", "ignore"],
  });
  spec = JSON.parse(raw.trim().split("\n").pop());
} else {
  const url = process.env.OAKLY_OPENAPI_URL ?? "http://localhost:8000/api/v1/openapi.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  spec = await res.json();
}
writeFileSync(out, JSON.stringify(spec, null, 2) + "\n");
console.log(`openapi.json: ${Object.keys(spec.paths).length} paths`);
