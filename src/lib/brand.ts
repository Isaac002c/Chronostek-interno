/**
 * Identidade da marca — fonte única de verdade.
 *
 * "Marca exibida" (brandName) é sempre Telun. Razão social e nome fantasia são
 * dados jurídicos, mantidos separados e configuráveis (ver OrganizationSettings /
 * Configurações › Empresa). Os valores abaixo são os PADRÕES de fallback usados
 * quando ainda não há configuração persistida no banco.
 *
 * Nunca escreva "Chronostek"/"Telun" cravado em componentes — importe daqui.
 */
export const BRAND = {
  /** Marca exibida na interface. */
  name: "Telun",
  /** Assinatura curta usada em rodapés/menus. */
  tagline: "Sistema Interno",
  /** Slogan conceitual da marca. */
  motto: "Propósito · Direção · Evolução",
  /** Domínio institucional padrão (e-mails/seed). Configurável via env. */
  emailDomain: process.env.SEED_EMAIL_DOMAIN?.trim() || "telun.com.br",
  /** Razão social padrão (dado jurídico — sobrescrito por OrganizationSettings). */
  legalName: "Telun Tecnologia LTDA",
  /** Nome fantasia padrão (dado jurídico — sobrescrito por OrganizationSettings). */
  tradeName: "Telun",
} as const;

export const APP_TITLE = `${BRAND.name} · ${BRAND.tagline}`;
export const APP_TITLE_TEMPLATE = `%s · ${BRAND.name}`;
export const APP_DESCRIPTION =
  "Plataforma interna da Telun — gestão financeira, comercial, projetos e tecnologia, marketing, jurídico, metas e tarefas em um só lugar.";
