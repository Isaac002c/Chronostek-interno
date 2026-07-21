import {
  Home,
  Briefcase,
  Wallet,
  FolderKanban,
  Megaphone,
  Scale,
  Target,
  CalendarDays,
  CheckSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { canAccessModule, type NavModule } from "./rbac";
import type { Role } from "@prisma/client";

/**
 * Navegação por ÁREAS.
 *
 * A sidebar exibe apenas os MÓDULOS principais (sem submenus permanentemente
 * abertos). Cada módulo tem uma navegação interna própria via ABAS contextuais
 * (MODULE_TABS), renderizadas no cabeçalho do conteúdo conforme a rota ativa.
 */

export type NavTab = {
  label: string;
  href: string;
  /** Módulo exigido para ver/acessar esta aba (RBAC). */
  module: NavModule;
  /** Casamento por prefixo adicional para estado ativo (rotas filhas). */
  match?: string[];
};

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Basta acesso a UM destes módulos para o item aparecer. */
  modules: NavModule[];
  /** Prefixos de rota que marcam este módulo como ativo. */
  match: string[];
  /** Rota exata (ex.: Início) — casa só com igualdade. */
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    key: "inicio",
    label: "Início",
    href: "/dashboard",
    icon: Home,
    modules: ["DASHBOARD"],
    match: ["/dashboard"],
    exact: true,
  },
  {
    key: "comercial",
    label: "Comercial",
    href: "/dashboard/comercial/clientes",
    icon: Briefcase,
    modules: ["COMERCIAL", "LEADS"],
    match: ["/dashboard/comercial", "/dashboard/leads"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    href: "/dashboard/financeiro",
    icon: Wallet,
    modules: ["FINANCEIRO"],
    match: ["/dashboard/financeiro", "/dashboard/centros-custo"],
  },
  {
    key: "projetos",
    label: "Projetos e Tecnologia",
    href: "/dashboard/ti/projetos",
    icon: FolderKanban,
    modules: ["TI"],
    match: ["/dashboard/ti"],
  },
  {
    key: "marketing",
    label: "Marketing",
    href: "/dashboard/marketing",
    icon: Megaphone,
    modules: ["MARKETING"],
    match: ["/dashboard/marketing"],
  },
  {
    key: "juridico",
    label: "Jurídico",
    href: "/dashboard/juridico",
    icon: Scale,
    modules: ["JURIDICO"],
    match: ["/dashboard/juridico"],
  },
  {
    key: "metas",
    label: "Metas e Planejamento",
    href: "/dashboard/metas",
    icon: Target,
    modules: ["METAS"],
    match: ["/dashboard/metas"],
  },
  {
    key: "calendario",
    label: "Calendário",
    href: "/dashboard/calendario",
    icon: CalendarDays,
    modules: ["DASHBOARD"],
    match: ["/dashboard/calendario"],
  },
  {
    key: "tarefas",
    label: "Tarefas",
    href: "/dashboard/tarefas",
    icon: CheckSquare,
    modules: ["TAREFAS"],
    match: ["/dashboard/tarefas"],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    href: "/dashboard/configuracoes/usuarios",
    icon: Settings,
    modules: ["CONFIGURACOES"],
    match: ["/dashboard/configuracoes"],
  },
];

/** Abas internas por módulo (subnavegação contextual). */
export const MODULE_TABS: Record<string, NavTab[]> = {
  comercial: [
    { label: "Leads / CRM", href: "/dashboard/leads", module: "LEADS" },
    { label: "Clientes", href: "/dashboard/comercial/clientes", module: "COMERCIAL" },
    { label: "Propostas", href: "/dashboard/comercial/propostas", module: "COMERCIAL" },
    { label: "Contratos", href: "/dashboard/comercial/contratos", module: "COMERCIAL" },
  ],
  // As 12 visões internas do Financeiro.
  financeiro: [
    { label: "Visão Geral", href: "/dashboard/financeiro", module: "FINANCEIRO" },
    { label: "Lançamentos", href: "/dashboard/financeiro/lancamentos", module: "FINANCEIRO" },
    { label: "Contas a Pagar", href: "/dashboard/financeiro/contas-pagar", module: "FINANCEIRO" },
    { label: "Contas a Receber", href: "/dashboard/financeiro/contas-receber", module: "FINANCEIRO" },
    { label: "Contratos e Recorrências", href: "/dashboard/financeiro/contratos", module: "FINANCEIRO" },
    { label: "Orçamentos", href: "/dashboard/financeiro/orcamentos", module: "FINANCEIRO" },
    { label: "Real × Orçado", href: "/dashboard/financeiro/real-x-orcado", module: "FINANCEIRO" },
    { label: "DRE", href: "/dashboard/financeiro/dre", module: "FINANCEIRO" },
    { label: "Fluxo de Caixa", href: "/dashboard/financeiro/fluxo-caixa", module: "FINANCEIRO" },
    { label: "Projeções", href: "/dashboard/financeiro/projecoes", module: "FINANCEIRO" },
    { label: "Cadastros", href: "/dashboard/financeiro/cadastros", module: "FINANCEIRO" },
    { label: "Fechamento", href: "/dashboard/financeiro/fechamento", module: "FINANCEIRO" },
  ],
  projetos: [
    { label: "Projetos", href: "/dashboard/ti/projetos", module: "TI" },
    { label: "Timesheet", href: "/dashboard/ti/timesheet", module: "TI" },
  ],
  juridico: [
    { label: "Visão Geral", href: "/dashboard/juridico", module: "JURIDICO" },
    { label: "Documentos", href: "/dashboard/juridico/documentos", module: "JURIDICO" },
    { label: "Demandas", href: "/dashboard/juridico/demandas", module: "JURIDICO" },
    { label: "Riscos", href: "/dashboard/juridico/riscos", module: "JURIDICO" },
  ],
  metas: [
    { label: "Visão geral", href: "/dashboard/metas", module: "METAS" },
    { label: "Planejamento", href: "/dashboard/metas/periodos", module: "METAS" },
    { label: "Checklists", href: "/dashboard/metas/checklists", module: "TAREFAS" },
    { label: "Relatórios", href: "/dashboard/metas/relatorios", module: "METAS" },
  ],
  configuracoes: [
    { label: "Empresa", href: "/dashboard/configuracoes/empresa", module: "CONFIGURACOES" },
    { label: "Usuários", href: "/dashboard/configuracoes/usuarios", module: "CONFIGURACOES" },
    { label: "Centros de Custo", href: "/dashboard/configuracoes/centros-custo", module: "CONFIGURACOES" },
    { label: "Indicadores de Meta", href: "/dashboard/configuracoes/indicadores", module: "CONFIGURACOES" },
    { label: "Aprovações", href: "/dashboard/configuracoes/aprovacoes", module: "CONFIGURACOES" },
  ],
};

/** Descobre o módulo ativo a partir do pathname. */
export function getActiveNavItem(pathname: string): NavItem | undefined {
  // Início casa exato; os demais por prefixo mais específico primeiro.
  const byPrefix = [...NAV_ITEMS]
    .filter((i) => !i.exact)
    .find((i) => i.match.some((m) => pathname === m || pathname.startsWith(m + "/")));
  if (byPrefix) return byPrefix;
  return NAV_ITEMS.find((i) => i.exact && pathname === i.href);
}

/** Abas do módulo visíveis para o papel (RBAC). */
export function getVisibleTabs(navKey: string, role: Role): NavTab[] {
  const tabs = MODULE_TABS[navKey] ?? [];
  return tabs.filter((t) => canAccessModule(role, t.module));
}

/** Primeiro destino acessível de um módulo (para o href da sidebar por papel). */
export function firstAccessibleHref(item: NavItem, role: Role): string {
  const tabs = getVisibleTabs(item.key, role);
  if (tabs.length > 0) return tabs[0].href;
  return item.href;
}

/** Itens de navegação visíveis para o papel. */
export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.modules.some((m) => canAccessModule(role, m)));
}
