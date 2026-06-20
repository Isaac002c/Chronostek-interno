// RBAC — controle de acesso por papel (role) e por módulo.
// Mantido simples e declarativo: cada role enxerga um conjunto de módulos.
// VIEWER tem acesso de leitura a tudo; escrita é negada.

import type { Role } from "@prisma/client";

export type NavModule =
  | "DASHBOARD"
  | "CENTROS_CUSTO"
  | "LEADS"
  | "COMERCIAL"
  | "FINANCEIRO"
  | "MARKETING"
  | "TI"
  | "JURIDICO"
  | "METAS"
  | "TAREFAS"
  | "CONFIGURACOES";

const ALL: NavModule[] = [
  "DASHBOARD",
  "CENTROS_CUSTO",
  "LEADS",
  "COMERCIAL",
  "FINANCEIRO",
  "MARKETING",
  "TI",
  "JURIDICO",
  "METAS",
  "TAREFAS",
  "CONFIGURACOES",
];

const MODULE_ACCESS: Record<Role, NavModule[]> = {
  SUPER_ADMIN: ALL,
  SOCIO_ADMIN: ALL,
  FINANCEIRO: ["DASHBOARD", "CENTROS_CUSTO", "COMERCIAL", "FINANCEIRO", "METAS", "TAREFAS"],
  COMERCIAL: ["DASHBOARD", "CENTROS_CUSTO", "LEADS", "COMERCIAL", "METAS", "TAREFAS"],
  MARKETING: ["DASHBOARD", "CENTROS_CUSTO", "LEADS", "MARKETING", "METAS", "TAREFAS"],
  TI: ["DASHBOARD", "CENTROS_CUSTO", "TI", "METAS", "TAREFAS"],
  JURIDICO: ["DASHBOARD", "CENTROS_CUSTO", "JURIDICO", "COMERCIAL", "METAS", "TAREFAS"],
  BDR: ["DASHBOARD", "LEADS", "TAREFAS"],
  // VIEWER vê tudo, mas só leitura (ver canWrite()).
  VIEWER: ALL,
};

export function isAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "SOCIO_ADMIN";
}

export function canWrite(role: Role): boolean {
  return role !== "VIEWER";
}

export function canAccessModule(role: Role, module: NavModule): boolean {
  if (module === "CONFIGURACOES") return isAdmin(role);
  return MODULE_ACCESS[role]?.includes(module) ?? false;
}

/** BDR só enxerga os próprios leads/tarefas. */
export function isRestrictedToOwn(role: Role): boolean {
  return role === "BDR";
}

/** Lança um erro padrão de acesso negado (usado em server actions/loaders). */
export class ForbiddenError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
