#!/usr/bin/env bash
# Centre Imam Malik - Demarrage (Linux / macOS).
# Lance le serveur sur l'adresse et le port choisis a l'installation (.env).
# Arret avec Ctrl+C.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "  [X] Le fichier .env est introuvable. Lancez d'abord ./install.sh" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Installation des dependances (une seule fois)..."
  npm install
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "  Premiere demarrage : compilation de l'application..."
  npm run build
fi

exec npm start
