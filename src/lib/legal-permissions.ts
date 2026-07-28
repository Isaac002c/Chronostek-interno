import type { Prisma, Role } from "@prisma/client";
import { canAccessModule, isAdmin } from "@/lib/rbac";

export type LegalPermission =
  | "VIEW_LEGAL"
  | "VIEW_CONTRACTS"
  | "CREATE_CONTRACT"
  | "EDIT_CONTRACT"
  | "RENEW_CONTRACT"
  | "TERMINATE_CONTRACT"
  | "ARCHIVE_CONTRACT"
  | "GENERATE_CONTRACT_FROM_PROPOSAL"
  | "VIEW_DOCUMENTS"
  | "UPLOAD_DOCUMENT"
  | "EDIT_DOCUMENT"
  | "CREATE_DOCUMENT_VERSION"
  | "DELETE_DOCUMENT"
  | "DOWNLOAD_DOCUMENT"
  | "VIEW_CONFIDENTIAL_DOCUMENT"
  | "MANAGE_DOCUMENT_TYPES"
  | "MANAGE_DOCUMENT_TAGS"
  | "VIEW_HISTORY";

const LEGAL_TEAM = new Set<LegalPermission>([
  "VIEW_LEGAL",
  "VIEW_CONTRACTS",
  "CREATE_CONTRACT",
  "EDIT_CONTRACT",
  "RENEW_CONTRACT",
  "TERMINATE_CONTRACT",
  "ARCHIVE_CONTRACT",
  "GENERATE_CONTRACT_FROM_PROPOSAL",
  "VIEW_DOCUMENTS",
  "UPLOAD_DOCUMENT",
  "EDIT_DOCUMENT",
  "CREATE_DOCUMENT_VERSION",
  "DELETE_DOCUMENT",
  "DOWNLOAD_DOCUMENT",
  "VIEW_CONFIDENTIAL_DOCUMENT",
  "MANAGE_DOCUMENT_TYPES",
  "MANAGE_DOCUMENT_TAGS",
  "VIEW_HISTORY",
]);

const COMMERCIAL_TEAM = new Set<LegalPermission>([
  "VIEW_CONTRACTS",
  "GENERATE_CONTRACT_FROM_PROPOSAL",
  "VIEW_DOCUMENTS",
  "UPLOAD_DOCUMENT",
  "EDIT_DOCUMENT",
  "CREATE_DOCUMENT_VERSION",
  "DOWNLOAD_DOCUMENT",
  "VIEW_HISTORY",
]);

const READ_ONLY = new Set<LegalPermission>([
  "VIEW_LEGAL",
  "VIEW_CONTRACTS",
  "VIEW_DOCUMENTS",
  "DOWNLOAD_DOCUMENT",
  "VIEW_HISTORY",
]);

export function canLegal(role: Role, permission: LegalPermission): boolean {
  if (isAdmin(role)) return true;
  if (role === "JURIDICO") return LEGAL_TEAM.has(permission);
  if (role === "COMERCIAL") return COMMERCIAL_TEAM.has(permission);
  if (role === "VIEWER") return READ_ONLY.has(permission);
  if (permission === "VIEW_CONTRACTS") {
    return canAccessModule(role, "FINANCEIRO");
  }
  return false;
}

export function visibleDocumentWhere(
  role: Role,
  userId: string,
): Prisma.DocumentWhereInput {
  const base: Prisma.DocumentWhereInput = {
    tenantId: "default",
    deletedAt: null,
  };
  if (isAdmin(role) || role === "JURIDICO") return base;
  return {
    ...base,
    OR: [
      { privacy: "INTERNO" },
      {
        privacy: "PRIVADO",
        OR: [{ uploadedById: userId }, { responsibleId: userId }],
      },
    ],
  };
}

export function canAccessDocument(
  role: Role,
  userId: string,
  document: {
    privacy: "INTERNO" | "PRIVADO" | "CONFIDENCIAL";
    uploadedById: string | null;
    responsibleId: string | null;
  },
): boolean {
  if (document.privacy === "CONFIDENCIAL") {
    return canLegal(role, "VIEW_CONFIDENTIAL_DOCUMENT");
  }
  if (document.privacy === "PRIVADO") {
    return (
      canLegal(role, "VIEW_CONFIDENTIAL_DOCUMENT") ||
      document.uploadedById === userId ||
      document.responsibleId === userId
    );
  }
  return canLegal(role, "VIEW_DOCUMENTS");
}
