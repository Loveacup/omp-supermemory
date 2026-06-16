@echo off
echo === OMP Supermemory Install ===
echo.

set "OMP_HOME=%USERPROFILE%\.omp"
set "SRC=%~dp0"

echo [1/5] Copying core scripts...
xcopy /Y /Q "%SRC%supermemory\*" "%OMP_HOME%\supermemory\"

echo [2/5] Copying skills...
xcopy /Y /Q "%SRC%skills\*" "%OMP_HOME%\agent\skills\"

echo [3/5] Copying hook configs...
xcopy /Y /Q "%SRC%hooks\pre\*" "%OMP_HOME%\agent\hooks\pre\"
xcopy /Y /Q "%SRC%hooks\post\*" "%OMP_HOME%\agent\hooks\post\"

echo [4/5] Setting up SDK symlink...
if exist "%OMP_HOME%\supermemory\node_modules\supermemory" (
    echo   SDK already linked.
) else (
    mklink /J "%OMP_HOME%\supermemory\node_modules\supermemory" "%USERPROFILE%\.codex\supermemory\node_modules\supermemory" 2>nul
    if errorlevel 1 (
        echo   Failed to create symlink. Install supermemory manually:
        echo   cd /d "%OMP_HOME%\supermemory" ^&^& npm install supermemory
    ) else (
        echo   SDK symlink created.
    )
)

echo [5/5] Creating tracker directory...
mkdir "%USERPROFILE%\.omp-supermemory\trackers" 2>nul

echo.
echo === Done! ===
echo Next: configure ~/.omp/supermemory.json with your container tags.
pause
