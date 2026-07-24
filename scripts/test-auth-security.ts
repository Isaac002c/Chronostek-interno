import { buildLoginThrottleBuckets } from "../src/lib/auth-throttle";
import {
  formatAuditMetadata,
  formatAuditTimestamp,
  parseAuditDate,
  sanitizeAuditMetadata,
} from "../src/lib/audit-view";

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${name}`);
    failed += 1;
  }
}

const secret = "auth-throttle-test-secret-with-sufficient-entropy";
const request = (forwardedFor?: string) =>
  new Request("https://interno.test/api/auth/callback/credentials", {
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
  });

console.log("Segurança de autenticação:");

const normalizedA = buildLoginThrottleBuckets(
  "  USER@Example.COM ",
  request("203.0.113.10"),
  { secret, trustProxy: true },
);
const normalizedB = buildLoginThrottleBuckets(
  "user@example.com",
  request("203.0.113.10"),
  { secret, trustProxy: true },
);
test(
  "normalização de e-mail produz as mesmas chaves",
  normalizedA.every((bucket, index) => bucket.key === normalizedB[index].key),
);
test(
  "e-mail e IP nunca aparecem em texto puro",
  normalizedA.every(
    (bucket) =>
      !bucket.key.includes("user@example.com") &&
      !bucket.key.includes("203.0.113.10"),
  ),
);
test(
  "limites separados por par e identidade",
  normalizedA[0].limit === 5 && normalizedA[1].limit === 20,
);

const untrustedA = buildLoginThrottleBuckets(
  "user@example.com",
  request("203.0.113.10"),
  { secret, trustProxy: false },
);
const untrustedB = buildLoginThrottleBuckets(
  "user@example.com",
  request("198.51.100.20"),
  { secret, trustProxy: false },
);
test(
  "X-Forwarded-For é ignorado sem proxy confiável",
  untrustedA[0].key === untrustedB[0].key,
);

const trustedA = buildLoginThrottleBuckets(
  "user@example.com",
  request("203.0.113.10"),
  { secret, trustProxy: true },
);
const trustedB = buildLoginThrottleBuckets(
  "user@example.com",
  request("198.51.100.20"),
  { secret, trustProxy: true },
);
test(
  "origens confiáveis diferentes usam baldes de par diferentes",
  trustedA[0].key !== trustedB[0].key,
);
test(
  "a identidade global permanece igual entre origens",
  trustedA[1].key === trustedB[1].key,
);

const invalidIp = buildLoginThrottleBuckets(
  "user@example.com",
  request("not-an-ip"),
  { secret, trustProxy: true },
);
const missingIp = buildLoginThrottleBuckets(
  "user@example.com",
  request(),
  { secret, trustProxy: true },
);
test(
  "IP inválido e ausente convergem para origem desconhecida",
  invalidIp[0].key === missingIp[0].key,
);

const otherSecret = buildLoginThrottleBuckets(
  "user@example.com",
  request("203.0.113.10"),
  { secret: `${secret}-rotated`, trustProxy: true },
);
test(
  "rotação do segredo altera todas as chaves",
  trustedA.every(
    (bucket, index) => bucket.key !== otherSecret[index].key,
  ),
);

console.log("\nVisualização segura de auditoria:");

const sanitized = sanitizeAuditMetadata({
  email: "admin@example.com",
  passwordHash: "$2a$12$should-never-appear",
  nested: {
    accessToken: "secret-token",
    status: "ATIVO",
  },
});
const sanitizedText = JSON.stringify(sanitized);
test(
  "segredos são redigidos recursivamente",
  sanitizedText.includes("[redigido]") &&
    !sanitizedText.includes("should-never-appear") &&
    !sanitizedText.includes("secret-token"),
);
test(
  "campos operacionais permanecem disponíveis",
  sanitizedText.includes("admin@example.com") &&
    sanitizedText.includes("ATIVO"),
);

const oversized = formatAuditMetadata({
  description: "x".repeat(500),
  values: Array.from({ length: 30 }, (_, index) => index),
});
test(
  "conteúdo excessivo é truncado de forma explícita",
  Boolean(
    oversized?.includes("…") &&
      oversized.includes("10 item(ns) omitido(s)"),
  ),
);

const start = parseAuditDate("2026-07-23", "start");
const end = parseAuditDate("2026-07-23", "end");
test(
  "datas usam os limites do dia em São Paulo",
  start?.toISOString() === "2026-07-23T03:00:00.000Z" &&
    end?.toISOString() === "2026-07-24T02:59:59.999Z",
);
const formattedTimestamp = formatAuditTimestamp(
  new Date("2026-07-24T02:30:00.000Z"),
);
test(
  "horários são exibidos no fuso de São Paulo",
  formattedTimestamp.includes("23/07/2026") &&
    formattedTimestamp.includes("23:30"),
);
test(
  "datas inválidas não chegam ao filtro do banco",
  parseAuditDate("2026-02-30", "start") === null &&
    parseAuditDate("not-a-date", "end") === null,
);

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exitCode = 1;
