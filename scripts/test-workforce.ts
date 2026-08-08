import assert from "node:assert/strict";
import { scoreProspect } from "../src/lib/prospecting/score";
import { normalizeCnpj, normalizeCompanyName, normalizeDomain, normalizeEmail, normalizePhone } from "../src/lib/prospecting/normalize";
import { safeHttpGet } from "../src/lib/network/safe-http";
import { InfinitePayProvider } from "../src/lib/payment/infinitepay";
import { isGlobalKillSwitchEnabled } from "../src/lib/workforce/worker";
import { runSafeCommand } from "../src/lib/workforce/command-catalog";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) { await fn(); passed += 1; console.log(`PASS ${name}`); }

async function main() {
  await test("normalização de CNPJ, telefone, e-mail, domínio e nome", () => {
    assert.equal(normalizeCnpj("12.345.678/0001-90"), "12345678000190");
    assert.equal(normalizePhone("(11) 99999-8888"), "5511999998888");
    assert.equal(normalizeEmail(" COMERCIAL@EMPRESA.COM.BR "), "comercial@empresa.com.br");
    assert.equal(normalizeDomain("https://www.Empresa.com.br/pagina"), "empresa.com.br");
    assert.equal(normalizeCompanyName("Empresa Serviços LTDA"), "empresa");
  });
  await test("score classifica Telun M+", () => {
    const result = scoreProspect({ segment: "Clínica", commercialPhone: "1", commercialWhatsApp: "2", commercialEmail: "a@b.com", marketingSignals: ["instagram abandonado", "branding inconsistente"], painPoints: ["baixa demanda", "site ruim"] });
    assert.equal(result.businessFit, "TELUN_M_PLUS"); assert(result.marketingFitScore >= 65); assert(result.technologyFitScore < 65);
  });
  await test("score classifica Telun Tecnologia", () => {
    const result = scoreProspect({ segment: "Contabilidade", website: "https://example.com", commercialPhone: "1", commercialEmail: "a@b.com", instagram: "i", linkedin: "l", technologySignals: ["planilhas", "processos manuais"], painPoints: ["retrabalho", "sem integração"] });
    assert.equal(result.businessFit, "TELUN_TECHNOLOGY"); assert(result.technologyFitScore >= 65); assert(result.marketingFitScore < 65);
  });
  await test("score classifica ambas as verticais", () => {
    const result = scoreProspect({ segment: "Clínica", commercialPhone: "1", commercialEmail: "a@b.com", marketingSignals: ["sem conteúdo", "comunicação ruim"], technologySignals: ["agendamento manual", "sem CRM"], painPoints: ["baixa demanda"] });
    assert.equal(result.businessFit, "BOTH"); assert(result.overallScore >= 65);
  });
  await test("SSRF bloqueia localhost mesmo presente na allowlist", async () => {
    await assert.rejects(() => safeHttpGet("http://localhost:3000/admin", { allowedDomains: ["localhost"] }), /HTTP_HOST_BLOCKED/);
  });
  await test("SSRF bloqueia metadata e domínio fora da allowlist", async () => {
    await assert.rejects(() => safeHttpGet("http://169.254.169.254/latest/meta-data", { allowedDomains: ["169.254.169.254"] }), /HTTP_SSRF_BLOCKED/);
    await assert.rejects(() => safeHttpGet("https://example.com", { allowedDomains: ["telun.com.br"] }), /HTTP_DOMAIN_NOT_ALLOWED/);
  });
  await test("InfinitePay não cria cobrança sem feature flag", async () => {
    delete process.env.INFINITEPAY_CREATE_LINKS_ENABLED;
    const provider = new InfinitePayProvider("fixture-handle");
    await assert.rejects(() => provider.createPaymentLink({ orderId: "fixture", redirectUrl: "https://example.com/ok", webhookUrl: "https://example.com/hook", description: "fixture", amountCents: 100 }), /DISABLED/);
  });
  await test("kill switch global é imposto pelo runtime", () => {
    process.env.GLOBAL_AGENT_KILL_SWITCH = "true"; assert.equal(isGlobalKillSwitchEnabled(), true);
    process.env.GLOBAL_AGENT_KILL_SWITCH = "false"; assert.equal(isGlobalKillSwitchEnabled(), false);
  });
  await test("command runner rejeita comando fora do catálogo", async () => {
    await assert.rejects(() => runSafeCommand("rm -rf" as never), /COMMAND_NOT_ALLOWED/);
  });
  console.log(`\nWorkforce: ${passed} testes aprovados.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
