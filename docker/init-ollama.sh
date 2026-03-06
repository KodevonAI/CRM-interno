#!/bin/sh
# Ejecutar una sola vez después del primer despliegue:
#   docker exec <ollama_container_name> sh /init-ollama.sh
#
# O directamente:
#   docker compose -f docker/docker-compose.prod.yml exec ollama ollama pull llama3.2:3b

set -e

echo "[ollama] Pulling llama3.2:3b (~2GB, puede tardar varios minutos)..."
ollama pull llama3.2:3b

echo "[ollama] Verificando modelo..."
ollama list

echo "[ollama] Listo. El modelo esta disponible para scoring de leads."
