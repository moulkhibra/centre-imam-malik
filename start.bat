@echo off
REM ---------------------------------------------------------------------------
REM  Centre Imam Malik - Demarrage
REM
REM  Lance le serveur de production sur l'adresse et le port choisis lors de
REM  l'installation ^(fichier .env^).
REM
REM  Laissez cette fenetre ouverte : la fermer arrete l'application.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo   [X] Le fichier .env est introuvable.
  echo       Lancez d'abord install.bat.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   Installation des dependances ^(une seule fois^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo   [X] L'installation des dependances a echoue.
    echo.
    pause
    exit /b 1
  )
)

if not exist ".next" goto build
if not exist ".next\BUILD_ID" goto build
goto serve

:build
echo.
echo   Premiere demarrage : compilation de l'application...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo   [X] La compilation a echoue.
  echo.
  pause
  exit /b 1
)

:serve
echo.
call npm start
echo.
echo   Application arretee.
echo.
pause
