@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: McServer Easy Launcher for Windows
:: Double-click this file to start!
:: ============================================================================

title McServer - Minecraft Server Manager
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║   ███╗   ███╗ ██████╗███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗  ║
echo  ║   ████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗ ║
echo  ║   ██╔████╔██║██║     ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝ ║
echo  ║   ██║╚██╔╝██║██║     ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗ ║
echo  ║   ██║ ╚═╝ ██║╚██████╗███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║ ║
echo  ║   ╚═╝     ╚═╝ ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ ║
echo  ║                                                              ║
echo  ║           Minecraft Server Hosting Made Easy                 ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check if running from correct directory
if not exist "package.json" (
    echo [ERROR] Please run this script from the McServer directory.
    echo.
    pause
    exit /b 1
)

:: ============================================================================
:: Step 1: Check for Node.js
:: ============================================================================
echo [1/4] Checking for Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Node.js is not installed!
    echo.
    echo  Would you like to install it automatically?
    echo  [1] Yes, install Node.js for me
    echo  [2] No, I'll install it myself
    echo.
    set /p choice="Enter choice (1 or 2): "
    
    if "!choice!"=="1" (
        echo.
        echo  Downloading Node.js installer...
        
        :: Download Node.js installer
        powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node_installer.msi'}"
        
        if exist "%TEMP%\node_installer.msi" (
            echo  Running Node.js installer...
            echo  Please follow the installation wizard.
            echo.
            start /wait msiexec /i "%TEMP%\node_installer.msi"
            del "%TEMP%\node_installer.msi"
            
            :: Refresh PATH
            call refreshenv >nul 2>&1
            
            echo.
            echo  Node.js installed! Please restart this script.
            pause
            exit /b 0
        ) else (
            echo  [ERROR] Failed to download Node.js installer.
            echo  Please install Node.js manually from: https://nodejs.org
            pause
            exit /b 1
        )
    ) else (
        echo.
        echo  Please install Node.js from: https://nodejs.org
        echo  Then run this script again.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo  ✓ Node.js found: !NODE_VERSION!
)

:: ============================================================================
:: Step 2: Check for Git
:: ============================================================================
echo [2/4] Checking for Git...

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Git is not installed!
    echo.
    echo  Would you like to install it automatically?
    echo  [1] Yes, install Git for me
    echo  [2] No, I'll install it myself
    echo.
    set /p choice="Enter choice (1 or 2): "
    
    if "!choice!"=="1" (
        echo.
        echo  Downloading Git installer...
        
        powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe' -OutFile '%TEMP%\git_installer.exe'}"
        
        if exist "%TEMP%\git_installer.exe" (
            echo  Running Git installer...
            echo  Please follow the installation wizard (defaults are fine).
            echo.
            start /wait "%TEMP%\git_installer.exe"
            del "%TEMP%\git_installer.exe"
            
            echo.
            echo  Git installed! Please restart this script.
            pause
            exit /b 0
        ) else (
            echo  [ERROR] Failed to download Git installer.
            echo  Please install Git manually from: https://git-scm.com
            pause
            exit /b 1
        )
    ) else (
        echo.
        echo  Please install Git from: https://git-scm.com
        echo  Then run this script again.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('git --version') do set GIT_VERSION=%%i
    echo  ✓ Git found: !GIT_VERSION!
)

:: ============================================================================
:: Step 3: Install dependencies
:: ============================================================================
echo [3/4] Installing dependencies...

if not exist "node_modules" (
    echo  Installing npm packages (this may take a minute)...
    call npm install --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)
echo  ✓ Dependencies installed

if not exist "dashboard\node_modules" (
    echo  Installing dashboard packages...
    cd dashboard
    call npm install --silent
    cd ..
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install dashboard dependencies.
        pause
        exit /b 1
    )
)
echo  ✓ Dashboard dependencies installed

:: ============================================================================
:: Step 4: Build
:: ============================================================================
echo [4/4] Building McServer...

if not exist "dist" (
    call npm run build --silent
    if %errorlevel% neq 0 (
        echo  [ERROR] Build failed.
        pause
        exit /b 1
    )
)
echo  ✓ Build complete

:: ============================================================================
:: Launch Dashboard - The wizard is now built into the web UI!
:: ============================================================================
echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                    McServer Ready!                           ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  Starting McServer Dashboard...
echo  Opening http://localhost:3847 in your browser...
echo.
echo  (The setup wizard will appear automatically on first run)
echo  (Press Ctrl+C to stop the server)
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3847"

:: Start the web server (dashboard command)
node dist/cli/index.js dashboard

echo.
echo  Thank you for using McServer!
echo.
pause
