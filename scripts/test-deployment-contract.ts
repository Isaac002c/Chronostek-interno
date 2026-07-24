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

const apiClient = readFileSync(
  join(root, "src", "lib", "api-client.ts"),
  "utf8",
);
assert(
  apiClient.includes("NEXT_PUBLIC_API_BASE_URL"),
  "O frontend migrado deve aceitar a origem HTTPS da API.",
);
assert(
  apiClient.includes('credentials: "include"'),
  "Chamadas frontend/API devem enviar o cookie HttpOnly compartilhado.",
);

const authConfig = readFileSync(
  join(root, "src", "auth.config.ts"),
  "utf8",
);
assert(
  authConfig.includes("AUTH_COOKIE_DOMAIN"),
  "A sessão deve suportar cookie seguro entre os subdomínios.",
);

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

const officialApiNginx = readFileSync(
  join(root, "deploy", "nginx", "api.conf"),
  "utf8",
);
assert(
  officialApiNginx.includes("server_name api.chronostek.com.br;"),
  "O vhost da API oficial deve estar preparado.",
);
assert(
  officialApiNginx.includes('if ($request_uri !~ "^/(api/|api$)")'),
  "O domínio da API oficial não deve publicar páginas visuais.",
);

const productionComposeOverride = readFileSync(
  join(root, "deploy", "compose", "docker-compose.override.yml"),
  "utf8",
);
assert.match(
  productionComposeOverride,
  /^\s*services:\s*[\s\S]*\bdb:\s*\{\}\s*$/m,
  "O override de produção deve manter o PostgreSQL na rede privada do Compose.",
);
assert(
  !productionComposeOverride.includes("ports:"),
  "O override de produção não pode publicar portas do PostgreSQL.",
);
assert(
  !productionComposeOverride.includes("5432:5432"),
  "A porta PostgreSQL não pode ser vinculada ao host.",
);

console.log(
  "✓ contrato transitório e fronteira frontend/API validados; Prisma e PostgreSQL permanecem fora da edge pública",
);
