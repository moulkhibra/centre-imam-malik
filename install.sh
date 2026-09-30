#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Centre Imam Malik - Installation (Linux / macOS)
#
#  Equivalent de install.bat. Verifie Node.js 22, genere un secret de session,
#  applique les migrations et cree le compte administrateur.
#
#      ./install.sh            installation interactive
#      ./install.sh --yes      installation silencieuse
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "  =========================================================="
echo "   Installation - Centre Imam Malik"
echo "   Soutien, Formation et Langues"
echo "  =========================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js 22 LTS est introuvable."
  echo
  echo "      Installez Node.js 22 (voir https://nodejs.org), puis relancez."
  echo
  exit 1
fi

node scripts/setup.mjs "$@"
