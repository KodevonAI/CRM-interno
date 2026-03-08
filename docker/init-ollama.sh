#!/bin/sh
# Ejecutar una sola vez después del primer despliegue:
#   docker exec <ollama_container_name> sh /init-ollama.sh
#
# El modelo se toma de la variable de entorno OLLAMA_MODEL (default: llama3.2:3b).
# Puedes cambiarlo desde EasyPanel → Environment → OLLAMA_MODEL=<modelo>

set -e

MODEL="${OLLAMA_MODEL:-llama3.2:3b}"

echo "[ollama] Pulling ${MODEL} (puede tardar varios minutos)..."
ollama pull "${MODEL}"

echo "[ollama] Verificando modelo..."
ollama list

echo "[ollama] Listo. El modelo ${MODEL} esta disponible para scoring de leads."
