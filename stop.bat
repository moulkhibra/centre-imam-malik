@echo off
REM ---------------------------------------------------------------------------
REM  Centre Imam Malik - Arret
REM
REM  Arrete le serveur s'il est encore tourne. La fenetre "start.bat" peut
REM  simplement etre fermee ; ce script sert quand le terminal a ete perdu.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo   Arret de Centre Imam Malik...

REM Le port est lu dans .env pour cibler le bon processus.
set PORT=3000
for /f "tokens=1,* delims==" %%A in ('findstr /b "PORT=" .env 2^>nul') do set PORT=%%B

set FOUND=0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  echo   Arret du processus %%P ^(port %PORT%^)
  taskkill /f /pid %%P >nul 2>nul
  set FOUND=1
)

echo.
if "%FOUND%"=="1" (
  echo   [OK] Application arretee.
) else (
  echo   [i] Aucune application ne tourne sur le port %PORT%.
)
echo.
pause
