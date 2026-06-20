import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  Wallet,
  Megaphone,
  Code2,
  Scale,
  Target,
  CheckSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { NavModule } from "./rbac";

export type NavChild = { label: string; href: string };

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  module: NavModule;
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "DASHBOARD",
  },
  {
    label: "Centros de Custo",
    href: "/dashboard/centros-custo",
    icon: Building2,
    module: "CENTROS_CUSTO",
  },
  {
    label: "Leads / CRM",
    href: "/dashboard/leads",
    icon: Users,
    module: "LEADS",
  },
  {
    label: "Comercial",
    href: "/dashboard/comercial/clientes",
    icon: Briefcase,
    module: "COMERCIAL",
    children: [
      { label: "Clientes", href: "/dashboard/comercial/clientes" },
      { label: "Propostas", href: "/dashboard/comercial/propostas" },
      { label: "Contratos", href: "/dashboard/comercial/contratos" },
    ],
  },
  {
    label: "Financeiro",
    href: "/dashboard/financeiro",
    icon: Wallet,
    module: "FINANCEIRO",
    children: [
      { label: "Visão Geral", href: "/dashboard/financeiro" },
      { label: "Lançamentos", href: "/dashboard/financeiro/lancamentos" },
      { label: "Orçamentos", href: "/dashboard/financeiro/orcamentos" },
      { label: "Real × Orçado", href: "/dashboard/financeiro/real-x-orcado" },
      { label: "DRE Mensal", href: "/dashboard/financeiro/dre" },
      { label: "Fluxo de Caixa", href: "/dashboard/financeiro/fluxo-caixa" },
    ],
  },
  {
    label: "Inovação / TI",
    href: "/dashboard/ti/projetos",
    icon: Code2,
    module: "TI",
    children: [
      { label: "Projetos", href: "/dashboard/ti/projetos" },
      { label: "Timesheet", href: "/dashboard/ti/timesheet" },
    ],
  },
  {
    label: "Marketing",
    href: "/dashboard/marketing",
    icon: Megaphone,
    module: "MARKETING",
  },
  {
    label: "Jurídico",
    href: "/dashboard/juridico",
    icon: Scale,
    module: "JURIDICO",
    children: [
      { label: "Visão Geral", href: "/dashboard/juridico" },
      { label: "Documentos", href: "/dashboard/juridico/documentos" },
      { label: "Demandas", href: "/dashboard/juridico/demandas" },
      { label: "Riscos", href: "/dashboard/juridico/riscos" },
    ],
  },
  {
    label: "Metas",
    href: "/dashboard/metas",
    icon: Target,
    module: "METAS",
  },
  {
    label: "Tarefas",
    href: "/dashboard/tarefas",
    icon: CheckSquare,
    module: "TAREFAS",
  },
  {
    label: "Configurações",
    href: "/dashboard/configuracoes/usuarios",
    icon: Settings,
    module: "CONFIGURACOES",
    children: [
      { label: "Usuários", href: "/dashboard/configuracoes/usuarios" },
      { label: "Centros de Custo", href: "/dashboard/configuracoes/centros-custo" },
      { label: "Aprovações", href: "/dashboard/configuracoes/aprovacoes" },
    ],
  },
];
