/**
 * Contrato serializável compartilhado entre formulários cliente e Server
 * Actions. Este módulo não pode importar autenticação, Prisma ou APIs Node.
 */
export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = {};
