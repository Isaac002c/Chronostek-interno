import { buildLoginThrottleBuckets } from "../src/lib/auth-throttle";

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

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exitCode = 1;
