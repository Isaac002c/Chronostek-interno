#!/usr/bin/env bash
# setup-ai — instala/configura o runtime de IA local (Ollama) e baixa o modelo
# do Telun Office (§28). Idempotente. Rode no HOST DE IA (VPS dedicada, máquina
# interna ou workstation) — NUNCA exponha o Ollama direto ao navegador.
#
# Uso:
#   OLLAMA_MODEL=qwen2.5:3b-instruct bash scripts/setup-ai.sh
set -euo pipefail

MODEL="${OLLAMA_MODEL:-qwen2.5:3b-instruct}"
BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

echo "== Telun Office — setup de IA local =="
echo "   Modelo alvo: $MODEL"
echo "   Endpoint:    $BASE_URL"

# 1) Ollama instalado?
if ! command -v ollama >/dev/null 2>&1; then
  echo "-> Ollama não encontrado."
  if [ "${AUTO_INSTALL:-false}" = "true" ]; then
    echo "-> Instalando via script oficial (AUTO_INSTALL=true)..."
    curl -fsSL https://ollama.com/install.sh | sh
  else
    echo "!! Instale o Ollama primeiro: https://ollama.com/download"
    echo "   (ou rode com AUTO_INSTALL=true para instalar automaticamente em Linux)"
    exit 1
  fi
fi
echo "-> Ollama: $(ollama --version 2>/dev/null || echo 'ok')"

# 2) Serviço no ar? (sobe em background se necessário)
if ! curl -fsS "$BASE_URL/api/tags" >/dev/null 2>&1; then
  echo "-> Iniciando 'ollama serve' em background..."
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  for i in $(seq 1 30); do
    curl -fsS "$BASE_URL/api/tags" >/dev/null 2>&1 && break
    sleep 1
  done
fi

# 3) Modelo baixado?
if ollama list 2>/dev/null | awk '{print $1}' | grep -q "^${MODEL}$"; then
  echo "-> Modelo $MODEL já está instalado."
else
  echo "-> Baixando modelo $MODEL (pode levar alguns minutos)..."
  ollama pull "$MODEL"
fi

# 4) Teste real de geração.
echo "-> Testando geração..."
ollama run "$MODEL" "Responda apenas: OK" --keepalive 30s || true

echo ""
echo "OK — configure no .env do Telun:"
echo "  AI_ENABLED=true"
echo "  OLLAMA_BASE_URL=$BASE_URL   (use o IP/host acessível pelo backend, não localhost se for outra máquina)"
echo "  OLLAMA_MODEL=$MODEL"
