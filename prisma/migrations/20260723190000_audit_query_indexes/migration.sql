-- Índices para filtros e paginação cronológica da visão administrativa.
CREATE INDEX "AuditLog_entity_createdAt_idx"
  ON "AuditLog"("entity", "createdAt");

CREATE INDEX "AuditLog_action_createdAt_idx"
  ON "AuditLog"("action", "createdAt");

CREATE INDEX "AuditLog_userId_createdAt_idx"
  ON "AuditLog"("userId", "createdAt");
