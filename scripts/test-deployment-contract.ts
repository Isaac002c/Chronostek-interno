import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type VercelConfig = {
  framework?: string | null;
  installCommand?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  rewrites?: Array<{ source?: string; destination?: string }>;
  headers?: Array<{
    source?: string;
    headers?: Array<{ key?: string; value?: string }>;
  }>;
};

const root = process.cwd();
const config = JSON.parse(
  readFileSync(join(root, "vercel.json"), "utf8"),
) as VercelConfig;

assert.equal(
  config.framework,
  null,
  "Vercel deve permanecer sem framework/runtime de aplicação.",
);
assert.equal(
  config.installCommand,
  "",
  "Vercel não deve instalar dependências do monólito.",
);
assert.equal(
  config.outputDirectory,
  "vercel-proxy",
  "Vercel deve publicar somente o marcador estático do proxy.",
);
assert.match(
  config.buildCommand ?? "",
  /^node -e /,
  "O build da Vercel deve ser um comando sem dependências.",
);

assert.deepEqual(config.rewrites, [
  {
    source: "/:path*",
    destination: "https://api-interno.chronostek.com.br/:path*",
  },
]);

const apiHeaders = config.headers?.find(
  (entry) => entry.source === "/api/:path*",
)?.headers;
assert(
  apiHeaders?.some(
    ({ key, value }) =>
      key?.toLowerCase() === "cache-control" &&
      value === "private, no-store, max-age=0",
  ),
  "Rotas de API devem desabilitar cache explicitamente.",
);
assert(
  apiHeaders?.some(
    ({ key, value }) =>
      key?.toLowerCase() === "x-vercel-enable-rewrite-caching" && value === "0",
  ),
  "Rewrites de API não podem habilitar cache na CDN.",
);

const ignoreRules = readFileSync(join(root, ".vercelignore"), "utf8")
  .split(/\r?\n/)
  .filter(Boolean);
assert.equal(ignoreRules[0], "*", "O upload da Vercel deve negar tudo por padrão.");
assert(ignoreRules.includes("!vercel.json"));
assert(ignoreRules.includes("!vercel-proxy/"));
assert(ignoreRules.includes("!vercel-proxy/**"));

const proxyFiles = readdirSync(join(root, "vercel-proxy"), {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name));
assert.equal(proxyFiles.length, 1, "O artefato estático deve conter somente um arquivo.");
assert(proxyFiles[0]?.endsWith(join("vercel-proxy", "index.html")));

const serializedConfig = JSON.stringify(config);
for (const forbidden of [
  "DATABASE_URL",
  "AUTH_SECRET",
  "POSTGRES_PASSWORD",
  "SEED_ADMIN_PASSWORD",
]) {
  assert(
    !serializedConfig.includes(forbidden),
    `${forbidden} não pode existir na configuração da Vercel.`,
  );
}

const middleware = readFileSync(join(root, "src", "middleware.ts"), "utf8");
assert(
  middleware.includes("api/health"),
  "O health check deve permanecer fora do middleware Auth.js.",
);

const nginx = readFileSync(
  join(root, "deploy", "nginx", "api-interno.conf"),
  "utf8",
);
assert(
  nginx.includes(
    'proxy_set_header Host chronoshub.chronostek.com.br;',
  ),
  "O backend deve enxergar o host público usado pelo navegador.",
);
assert(
  nginx.includes('"https://chronoshub.chronostek.com.br"'),
  "O CORS deve permitir explicitamente apenas a origem pública.",
);
assert(
  !nginx.includes("Access-Control-Allow-Origin *"),
  "CORS com credenciais nunca pode usar wildcard.",
);

console.log("✓ contrato do proxy Vercel validado; nenhum runtime Prisma será publicado");
