import type { BadgeTone } from "@/lib/enums";

// Rótulos e tons de UI para os estados do Telun Office. Mantém a linguagem
// visual consistente com o design system (Badge tones).

export function agentStatusMeta(status: string): { tone: BadgeTone; label: string; dot: string } {
  switch (status) {
    case "WORKING":
      return { tone: "info", label: "Trabalhando", dot: "bg-sky-500" };
    case "IDLE":
      return { tone: "success", label: "Disponível", dot: "bg-emerald-500" };
    case "WAITING":
      return { tone: "warning", label: "Aguardando", dot: "bg-amber-500" };
    case "WAITING_APPROVAL":
      return { tone: "warning", label: "Aguardando aprovação", dot: "bg-amber-500" };
    case "ERROR":
      return { tone: "danger", label: "Erro", dot: "bg-red-500" };
    case "OFFLINE":
    default:
      return { tone: "neutral", label: "Offline", dot: "bg-slate-400" };
  }
}

export function taskStatusMeta(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case "RUNNING":
      return { tone: "info", label: "Em execução" };
    case "COMPLETED":
      return { tone: "success", label: "Concluída" };
    case "FAILED":
      return { tone: "danger", label: "Falhou" };
    case "CANCELLED":
      return { tone: "neutral", label: "Cancelada" };
    case "WAITING_APPROVAL":
      return { tone: "warning", label: "Aguardando aprovação" };
    case "QUEUED":
      return { tone: "info", label: "Na fila" };
    case "PENDING":
    default:
      return { tone: "neutral", label: "Pendente" };
  }
}

export function approvalStatusMeta(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case "APPROVED":
      return { tone: "success", label: "Aprovada" };
    case "REJECTED":
      return { tone: "danger", label: "Rejeitada" };
    case "EXPIRED":
      return { tone: "neutral", label: "Expirada" };
    case "PENDING":
    default:
      return { tone: "warning", label: "Pendente" };
  }
}

export function priorityMeta(p: string): { tone: BadgeTone; label: string } {
  switch (p) {
    case "CRITICA":
      return { tone: "danger", label: "Crítica" };
    case "ALTA":
      return { tone: "warning", label: "Alta" };
    case "BAIXA":
      return { tone: "neutral", label: "Baixa" };
    case "MEDIA":
    default:
      return { tone: "info", label: "Média" };
  }
}

export function autonomyLabel(level: number): string {
  const map: Record<number, string> = {
    0: "Nível 0 · Somente leitura",
    1: "Nível 1 · Consulta e recomenda",
    2: "Nível 2 · Executa ações seguras",
    3: "Nível 3 · Executa processos",
    4: "Nível 4 · Autonomia elevada",
  };
  return map[level] ?? `Nível ${level}`;
}

export function activityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    MESSAGE: "Mensagem",
    TOOL_CALL: "Ferramenta",
    TOOL_RESULT: "Resultado",
    TOOL_ERROR: "Erro de ferramenta",
    STATUS_CHANGE: "Status",
    TASK_CREATED: "Tarefa criada",
    TASK_STARTED: "Tarefa iniciada",
    TASK_COMPLETED: "Tarefa concluída",
    TASK_FAILED: "Tarefa falhou",
    APPROVAL_REQUESTED: "Aprovação solicitada",
    APPROVAL_APPROVED: "Aprovação concedida",
    APPROVAL_REJECTED: "Aprovação rejeitada",
    DECISION: "Decisão",
    ERROR: "Erro",
    NOTE: "Nota",
  };
  return map[type] ?? type;
}
