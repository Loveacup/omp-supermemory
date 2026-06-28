@echo off
echo ========================================
echo   omp-supermemory v2.0.0 — Install
echo ========================================
echo.

REM Install dependencies
echo [1/2] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed
    exit /b 1
)

REM Link plugin
echo [2/2] Linking OMP plugin...
omp plugin link %~dp0
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: omp plugin link returned error code %ERRORLEVEL%
    echo You may need to run this from an OMP-enabled terminal.
)

echo.
echo Done! Run "omp plugin list" to verify.
echo If not already logged in, run "node src\login.js" to authenticate.
