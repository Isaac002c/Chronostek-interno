-- Groq passa a ser o provider padrão da V1. Ollama continua disponível por env.
ALTER TABLE "Agent" ALTER COLUMN "aiProvider" SET DEFAULT 'groq';

-- Atualiza apenas os quatro agentes oficiais ainda no default anterior.
UPDATE "Agent"
SET "aiProvider" = 'groq'
WHERE "tenantId" = 'default'
  AND "slug" IN ('clara', 'lucas', 'theo', 'atlas')
  AND "aiProvider" = 'ollama';
