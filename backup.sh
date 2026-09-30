#!/usr/bin/env bash
# Centre Imam Malik - Sauvegarde (Linux / macOS).
#   ./backup.sh            creer une sauvegarde
#   ./backup.sh --list     lister les sauvegardes
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "  [X] Le fichier .env est introuvable. Lancez d'abord ./install.sh" >&2
  exit 1
fi

[ -d node_modules ] || npm install
exec npm run backup -- "$@"
