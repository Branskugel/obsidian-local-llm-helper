@echo off
echo Building Obsidian Local LLM Helper plugin...

REM Run the build process
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Build completed successfully!

REM Define source and destination directories
set "SOURCE_DIR=%~dp0"
set "OUTPUT_DIR=%~dp0output\obsidian-local-llm-helper_dev"

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Force delete existing files to ensure fresh copy
if exist "%OUTPUT_DIR%\main.js" del "%OUTPUT_DIR%\main.js" /Q
if exist "%OUTPUT_DIR%\styles.css" del "%OUTPUT_DIR%\styles.css" /Q
if exist "%OUTPUT_DIR%\manifest.json" del "%OUTPUT_DIR%\manifest.json" /Q

REM Copy built files to output directory with forced overwrite
echo Copying files to output directory...
copy "%SOURCE_DIR%main.js" "%OUTPUT_DIR%\main.js" /Y /V
copy "%SOURCE_DIR%styles.css" "%OUTPUT_DIR%\styles.css" /Y /V
copy "%SOURCE_DIR%manifest.json" "%OUTPUT_DIR%\manifest.json" /Y /V

REM Skip copying source files to avoid build conflicts
echo Skipping source files copy to prevent build conflicts...

echo Publishing completed!
echo Plugin files are now in: %OUTPUT_DIR%
pause