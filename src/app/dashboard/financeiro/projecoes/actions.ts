"use server";

import { ProjectionScenarioType } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  optEnum,
  optInt,
  optStr,
  requireFinancePermission,
  str,
  type ActionState,
} from "@/lib/actions";
import {
  createProjection,
  duplicateProjection,
  restoreProjectionAutomatic,
  refreshProjectionAutomatic,
  setProjectionStatus,
  updateProjectionValuesBatch,
  updateProjectionLineLinks,
  type ProjectionSeedKind,
} from "@/lib/finance-projections";

function revalidateProjection(id?: string) {
  revalidatePath("/dashboard/financeiro/projecoes");
  if (id) revalidatePath(`/dashboard/financeiro/projecoes/${id}`);
}

export async function createProjectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return auth;
  const year = optInt(formData, "year") ?? new Date().getFullYear();
  const scenarioType = (optEnum(formData, "scenarioType") ??
    "PERSONALIZADO") as ProjectionScenarioType;
  const seedKind = (optEnum(formData, "seedKind") ??
    "VAZIA") as ProjectionSeedKind;
  if (!(scenarioType in ProjectionScenarioType)) {
    return { error: "Tipo de cenário inválido." };
  }
  if (
    ![
      "VAZIA",
      "AUTOMATICA",
      "ORCAMENTO",
      "REALIZADO_ANTERIOR",
      "CONTRATOS_ATIVOS",
      "OUTRA_PROJECAO",
    ].includes(seedKind)
  ) {
    return { error: "Origem da projeção inválida." };
  }
  let projectionId: string;
  try {
    const projection = await createProjection(
      {
        name: str(formData, "name"),
        description: optStr(formData, "description"),
        year,
        periodStartMonth: optInt(formData, "periodStartMonth") ?? 1,
        periodEndMonth: optInt(formData, "periodEndMonth") ?? 12,
        scenarioType,
        responsibleId: optStr(formData, "responsibleId"),
        notes: optStr(formData, "notes"),
        seedKind,
        sourceProjectionId: optStr(formData, "sourceProjectionId"),
      },
      auth.user.id,
    );
    projectionId = projection.id;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível criar a projeção.",
    };
  }
  revalidateProjection();
  redirect(`/dashboard/financeiro/projecoes/${projectionId}`);
}

export async function saveProjectionValuesAction(
  projectionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return auth;
  try {
    const raw = str(formData, "changes");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { error: "Alterações inválidas." };
    const changes = parsed.map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("valueId" in item) ||
        !("value" in item)
      ) {
        throw new Error("Alteração inválida.");
      }
      return {
        valueId: String(item.valueId),
        value: Number(item.value),
        reason:
          "reason" in item && item.reason !== null
            ? String(item.reason)
            : null,
      };
    });
    const affected = await updateProjectionValuesBatch({
      projectionId,
      changes,
      userId: auth.user.id,
    });
    revalidateProjection(projectionId);
    void affected;
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao salvar valores.",
    };
  }
}

export async function restoreProjectionValueAction(
  projectionId: string,
  valueId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return auth;
  try {
    await restoreProjectionAutomatic(
      valueId,
      auth.user.id,
      "Restauração manual pelo usuário",
      projectionId,
    );
    revalidateProjection(projectionId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao restaurar valor.",
    };
  }
}

export async function refreshProjectionAutomaticAction(
  projectionId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return auth;
  try {
    await refreshProjectionAutomatic(projectionId, auth.user.id);
    revalidateProjection(projectionId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao recalcular.",
    };
  }
}

export async function saveProjectionLineLinksAction(
  projectionId: string,
  lineId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return auth;
  try {
    await updateProjectionLineLinks({
      projectionId,
      lineId,
      categoryId: optStr(formData, "categoryId"),
      costCenterId: optStr(formData, "costCenterId"),
      projectId: optStr(formData, "projectId"),
      productId: optStr(formData, "productId"),
      clientId: optStr(formData, "clientId"),
      supplierId: optStr(formData, "supplierId"),
      contractId: optStr(formData, "contractId"),
      userId: auth.user.id,
    });
    revalidateProjection(projectionId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao vincular a linha.",
    };
  }
}

export async function duplicateProjectionAction(
  projectionId: string,
  formData: FormData,
): Promise<void> {
  const auth = await requireFinancePermission("EDIT_PROJECTION");
  if ("error" in auth) return;
  const copy = await duplicateProjection(projectionId, auth.user.id, {
    name: str(formData, "name"),
  });
  revalidateProjection();
  redirect(`/dashboard/financeiro/projecoes/${copy.id}`);
}

export async function publishProjectionAction(
  projectionId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("PUBLISH_PROJECTION");
  if ("error" in auth) return auth;
  try {
    await setProjectionStatus(
      projectionId,
      "PUBLICADA",
      auth.user.id,
      "Publicação confirmada",
    );
    revalidateProjection(projectionId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao publicar." };
  }
}

export async function archiveProjectionAction(
  projectionId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("PUBLISH_PROJECTION");
  if ("error" in auth) return auth;
  try {
    await setProjectionStatus(
      projectionId,
      "ARQUIVADA",
      auth.user.id,
      "Arquivamento confirmado",
    );
    revalidateProjection(projectionId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao arquivar." };
  }
}
