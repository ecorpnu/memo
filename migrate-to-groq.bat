@echo off
REM Memoria App - Groq Migration Script (Windows)
REM This script creates a new branch and migrates your app from Gemini to Groq API

echo ========================================
echo Memoria - Groq Migration Script
echo ========================================
echo.

REM Step 1: Check if we're in a git repository
if not exist .git (
    echo Error: Not in a git repository!
    echo Please run this script from your memo-github project root.
    pause
    exit /b 1
)

echo Step 1: Checking current branch...
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo Current branch: %CURRENT_BRANCH%
echo.

REM Step 2: Check for uncommitted changes
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo Warning: You have uncommitted changes.
    set /p STASH="Do you want to stash them? (y/n): "
    if /i "%STASH%"=="y" (
        git stash save "Pre-Groq migration stash"
        echo Changes stashed
    ) else (
        echo Error: Please commit or stash your changes first.
        pause
        exit /b 1
    )
)
echo.

REM Step 3: Update main branch
echo Step 2: Updating main branch...
git checkout main
git pull origin main
echo Main branch updated
echo.

REM Step 4: Create new branch
set BRANCH_NAME=groq-migration
git rev-parse --verify %BRANCH_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo Warning: Branch '%BRANCH_NAME%' already exists.
    set /p DELETE="Do you want to delete it and create a fresh one? (y/n): "
    if /i "%DELETE%"=="y" (
        git branch -D %BRANCH_NAME%
        echo Deleted existing branch
    ) else (
        git checkout %BRANCH_NAME%
        goto :skip_create
    )
)

echo Step 3: Creating new branch '%BRANCH_NAME%'...
git checkout -b %BRANCH_NAME%
echo Branch created and checked out
:skip_create
echo.

REM Step 5: Check if ZIP file exists
if not exist memo-github-groq.zip (
    echo Error: memo-github-groq.zip not found!
    echo Please place the memo-github-groq.zip file in your project root.
    pause
    exit /b 1
)

REM Step 6: Extract files
echo Step 4: Extracting updated files...
powershell -command "Expand-Archive -Path memo-github-groq.zip -DestinationPath temp-extract -Force"
echo Files extracted
echo.

REM Step 7: Create backup
echo Step 5: Creating backup of current files...
set BACKUP_DIR=backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir %BACKUP_DIR%
copy package.json %BACKUP_DIR%\ >nul 2>&1
copy App.tsx %BACKUP_DIR%\ >nul 2>&1
copy hooks\useLiveSession.ts %BACKUP_DIR%\ >nul 2>&1
copy components\Recorder.tsx %BACKUP_DIR%\ >nul 2>&1
echo Backup created in %BACKUP_DIR%\
echo.

REM Step 8: Copy modified files
echo Step 6: Copying modified files...
copy temp-extract\memo-github-groq\package.json .
copy temp-extract\memo-github-groq\App.tsx .
copy temp-extract\memo-github-groq\hooks\useLiveSession.ts hooks\
copy temp-extract\memo-github-groq\components\Recorder.tsx components\
copy temp-extract\memo-github-groq\README.md .
copy temp-extract\memo-github-groq\MIGRATION.md .
copy temp-extract\memo-github-groq\QUICKSTART.md .
copy temp-extract\memo-github-groq\.env.example .
echo Files copied successfully
echo.

REM Step 9: Clean up
rmdir /s /q temp-extract

REM Step 10: Show changes
echo Step 7: Files modified:
git status --short
echo.

REM Step 11: Set up API key
echo Step 8: Setting up environment...
set /p HAS_KEY="Do you have a Groq API key? (y/n): "
if /i "%HAS_KEY%"=="y" (
    set /p GROQ_KEY="Enter your Groq API key: "
    echo VITE_GROQ_API_KEY=%GROQ_KEY%> .env
    echo .env file created
    
    REM Add .env to .gitignore
    findstr /C:".env" .gitignore >nul 2>&1
    if %errorlevel% neq 0 (
        echo .env>> .gitignore
        echo Added .env to .gitignore
    )
) else (
    echo Note: You can add your API key later by creating a .env file
    echo Template: .env.example has been created
)
echo.

REM Step 12: Install dependencies
echo Step 9: Installing dependencies...
set /p INSTALL="Install npm dependencies now? (y/n): "
if /i "%INSTALL%"=="y" (
    call npm install
    echo Dependencies installed
) else (
    echo Note: Run 'npm install' before testing
)
echo.

REM Step 13: Commit changes
echo Step 10: Committing changes...
git add .
git commit -m "Migrate from Gemini AI Studio to Groq API - Replace @google/genai with groq-sdk - Update useLiveSession hook for Groq API - Add chunk-based transcription with Whisper - Add LLaMA 3.3 70B for AI responses - Update documentation and guides"
echo Changes committed
echo.

REM Step 14: Push to GitHub
echo Step 11: Pushing to GitHub...
set /p PUSH="Push branch to GitHub now? (y/n): "
if /i "%PUSH%"=="y" (
    git push -u origin %BRANCH_NAME%
    echo Branch pushed to GitHub
    echo.
    echo ========================================
    echo Migration Complete!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Go to your GitHub repository
    echo 2. You'll see a 'Compare ^& pull request' button
    echo 3. Create a pull request to review changes
    echo.
    echo To test locally: npm run dev
) else (
    echo Branch created locally (not pushed)
    echo.
    echo ========================================
    echo Migration Complete (Local Only)
    echo ========================================
    echo.
    echo To push later, run: git push -u origin %BRANCH_NAME%
)
echo.

REM Step 15: Offer to test
set /p TEST="Would you like to start the development server? (y/n): "
if /i "%TEST%"=="y" (
    echo.
    echo Starting development server...
    echo Press Ctrl+C to stop
    timeout /t 2 /nobreak >nul
    call npm run dev
)

echo.
echo Done!
echo Your original code is backed up in: %BACKUP_DIR%\
echo To revert: git checkout main
pause
