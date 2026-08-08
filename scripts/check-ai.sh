#!/usr/bin/env bash
# check-ai — verifica a saúde do runtime de IA do Telun Office (§32).
# Uso: OLLAMA_BASE_URL=http://host:11434 OLLAMA_MODEL=qwen2.5:3b-instruct bash scripts/check-ai.sh
set -euo pipefail

BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
MODEL="${OLLAMA_MODEL:-qwen2.5:3b-instruct}"

echo "== check-ai =="
echo "   Endpoint: $BASE_URL"
echo "   Modelo:   $MODEL"

if ! curl -fsS "$BASE_URL/api/tags" >/dev/null 2>&1; then
  echo "STATUS: OFFLINE — runtime inacessível em $BASE_URL"
  exit 1
fi

if curl -fsS "$BASE_URL/api/tags" | grep -q "\"$MODEL\""; then
  echo "STATUS: ONLINE — runtime no ar e modelo $MODEL instalado."
else
  echo "STATUS: DEGRADED — runtime no ar, mas o modelo $MODEL NÃO está instalado."
  echo "  Rode: ollama pull $MODEL"
  exit 2
fi

echo "-> Teste de tool-calling / geração curta:"
curl -fsS "$BASE_URL/api/chat" \
  -H 'content-type: application/json' \
  -d "{\"model\":\"$MODEL\",\"stream\":false,\"messages\":[{\"role\":\"user\",\"content\":\"Diga apenas: pronto\"}]}" \
  | sed -n 's/.*"content":"\([^"]*\)".*/resposta: \1/p' | head -1
echo "OK"
