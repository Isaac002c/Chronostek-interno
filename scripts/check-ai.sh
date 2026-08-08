#!/usr/bin/env bash
# check-ai — verifica a configuração do provider sem consumir inferência.
set -euo pipefail

PROVIDER="${AI_PROVIDER:-groq}"

if [[ "$PROVIDER" == "groq" ]]; then
  MODEL="${GROQ_MODEL:-qwen/qwen3.6-27b}"
  echo "== check-ai =="
  echo "   Provider: Groq"
  echo "   Modelo:   $MODEL"
  if [[ -z "${GROQ_API_KEY:-}" ]]; then
    echo "STATUS: OFFLINE — GROQ_API_KEY não configurada no backend."
    exit 1
  fi
  echo "STATUS: DEGRADED — configuração presente; uma inferência real confirmará ONLINE."
  exit 0
fi

BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
MODEL="${OLLAMA_MODEL:-qwen2.5:3b-instruct}"

echo "== check-ai =="
echo "   Provider: Ollama"
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
