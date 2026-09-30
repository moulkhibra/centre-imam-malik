@echo off
REM ---------------------------------------------------------------------------
REM  Centre Imam Malik - Installation
REM
REM  Double-cliquez sur ce fichier. Il verifie Node.js, genere un secret de
REM  session, applique les migrations et cree le compte administrateur.
REM
REM  Pour une installation silencieuse (sans questions) :
REM      install.bat --yes
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo   ==========================================================
echo    Installation - Centre Imam Malik
echo    Soutien, Formation et Langues
echo   ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js 22 LTS est introuvable.
  echo.
  echo       1. Ouvrez https://nodejs.org
  echo       2. Téléchargez la version 22.x LTS ^(Windows Installer .msi^)
  echo       3. Redemarrez l'ordinateur
  echo       4. Relancez install.bat
  echo.
  pause
  exit /b 1
)

node scripts/setup.mjs %*
set EXITCODE=%errorlevel%

echo.
if not "%EXITCODE%"=="0" (
  echo   [X] L'installation a echoue ^(code %EXITCODE%^).
  echo       Lisez les messages ci-dessus, corrigez, puis relancez install.bat.
) else (
  echo   [OK] Installation terminee.
  echo.
  echo     Demarrage  : start.bat
  echo     Arret      : stop.bat
  echo     Sauvegarde : backup.bat
)
echo.
pause
exit /b %EXITCODE%
