#!/bin/bash

# ============================================================================
# McServer Easy Launcher for macOS/Linux
# Run: chmod +x start.sh && ./start.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}███╗   ███╗ ██████╗███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗${NC}  ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗${NC} ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}██╔████╔██║██║     ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝${NC} ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}██║╚██╔╝██║██║     ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗${NC} ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}██║ ╚═╝ ██║╚██████╗███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║${NC} ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${GREEN}╚═╝     ╚═╝ ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝${NC} ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}           ${YELLOW}Minecraft Server Hosting Made Easy${NC}                 ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        echo -e "${RED}[ERROR]${NC} Please run this script from the McServer directory."
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        OS="unknown"
    fi
}

# Install Node.js
install_node() {
    echo ""
    echo -e "  ${YELLOW}Node.js is not installed!${NC}"
    echo ""
    echo "  Would you like to install it automatically?"
    echo "  [1] Yes, install Node.js for me"
    echo "  [2] No, I'll install it myself"
    echo ""
    read -p "  Enter choice (1 or 2): " choice

    if [ "$choice" = "1" ]; then
        echo ""
        echo "  Installing Node.js..."
        
        if [ "$OS" = "macos" ]; then
            # Check for Homebrew
            if ! command -v brew &> /dev/null; then
                echo "  Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install node
        else
            # Linux - use nvm
            echo "  Installing via nvm..."
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            nvm install 20
            nvm use 20
        fi
        
        echo ""
        echo -e "  ${GREEN}Node.js installed!${NC} Please restart this script."
        exit 0
    else
        echo ""
        echo "  Please install Node.js from: https://nodejs.org"
        echo "  Then run this script again."
        exit 1
    fi
}

# Install Git
install_git() {
    echo ""
    echo -e "  ${YELLOW}Git is not installed!${NC}"
    echo ""
    echo "  Would you like to install it automatically?"
    echo "  [1] Yes, install Git for me"
    echo "  [2] No, I'll install it myself"
    echo ""
    read -p "  Enter choice (1 or 2): " choice

    if [ "$choice" = "1" ]; then
        echo ""
        echo "  Installing Git..."
        
        if [ "$OS" = "macos" ]; then
            if ! command -v brew &> /dev/null; then
                echo "  Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install git
        else
            # Linux
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y git
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y git
            elif command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm git
            else
                echo "  Could not determine package manager. Please install git manually."
                exit 1
            fi
        fi
        
        echo ""
        echo -e "  ${GREEN}Git installed!${NC}"
    else
        echo ""
        echo "  Please install Git from: https://git-scm.com"
        echo "  Then run this script again."
        exit 1
    fi
}

# Main script
print_banner
check_directory
detect_os

# Step 1: Check Node.js
echo -e "[1/4] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    install_node
else
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js found: $NODE_VERSION"
fi

# Step 2: Check Git
echo -e "[2/4] Checking for Git..."
if ! command -v git &> /dev/null; then
    install_git
else
    GIT_VERSION=$(git --version)
    echo -e "  ${GREEN}✓${NC} Git found: $GIT_VERSION"
fi

# Step 3: Install dependencies
echo -e "[3/4] Installing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  Installing npm packages (this may take a minute)..."
    npm install --silent
fi
echo -e "  ${GREEN}✓${NC} Dependencies installed"

if [ ! -d "dashboard/node_modules" ]; then
    echo "  Installing dashboard packages..."
    cd dashboard && npm install --silent && cd ..
fi
echo -e "  ${GREEN}✓${NC} Dashboard dependencies installed"

# Step 4: Build
echo -e "[4/4] Building McServer..."
if [ ! -d "dist" ]; then
    npm run build --silent
fi
echo -e "  ${GREEN}✓${NC} Build complete"

# Launch Dashboard directly - wizard is built into the web UI!
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}                    ${GREEN}McServer Ready!${NC}                           ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Starting McServer Dashboard..."
echo "  Opening http://localhost:3847 in your browser..."
echo ""
echo "  (The setup wizard will appear automatically on first run)"
echo "  (Press Ctrl+C to stop the server)"
echo ""

# Open browser after a short delay
(sleep 2 && {
    if [ "$OS" = "macos" ]; then
        open http://localhost:3847
    else
        xdg-open http://localhost:3847 2>/dev/null || echo "Open http://localhost:3847 in your browser"
    fi
}) &

# Start the web server
node dist/cli/index.js serve

echo ""
echo "  Thank you for using McServer!"
echo ""