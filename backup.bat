@echo off
REM ---------------------------------------------------------------------------
REM  Centre Imam Malik - Sauvegarde
REM
REM  Copie coherente de la base de donnees + des documents, meme si
REM  l'application tourne. Les 30 sauvegardes les plus recentes sont conservees.
REM
REM      backup.bat              creer une sauvegarde
REM      backup.bat --list       lister les sauvegardes
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo   [X] Le fichier .env est introuvable. Lancez d'abord install.bat.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   Installation des dependances ^(une seule fois^)...
  call npm install
  if errorlevel 1 (
    echo   [X] L'installation des dependances a echoue.
    echo.
    pause
    exit /b 1
  )
)

call npm run backup -- %*
set EXITCODE=%errorlevel%

echo.
pause
exit /b %EXITCODE%
