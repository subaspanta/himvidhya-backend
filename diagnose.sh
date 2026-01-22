#!/bin/bash

# Chat Backend - Diagnostic & Testing Guide

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CHAT BACKEND - DIAGNOSTIC & SETUP GUIDE                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Checking Environment...${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm installed: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Checking MongoDB...${NC}"
echo ""

# Check MongoDB
if command -v mongod &> /dev/null; then
    echo -e "${GREEN}✓${NC} MongoDB CLI tools installed"
    MONGO_VERSION=$(mongod --version | head -1)
    echo "  $MONGO_VERSION"
else
    echo -e "${RED}✗${NC} MongoDB not installed locally"
    echo "  You need to install MongoDB or run it via Docker"
    echo ""
    echo -e "${YELLOW}Option 1: Install MongoDB (macOS)${NC}"
    echo "  brew tap mongodb/brew"
    echo "  brew install mongodb-community"
    echo "  brew services start mongodb-community"
    echo ""
    echo -e "${YELLOW}Option 2: Use Docker${NC}"
    echo "  docker run -d -p 27017:27017 --name mongodb mongo:latest"
    echo ""
fi

# Check if MongoDB is running
if nc -z localhost 27017 2>/dev/null; then
    echo -e "${GREEN}✓${NC} MongoDB is running on localhost:27017"
else
    echo -e "${RED}✗${NC} MongoDB is NOT running on localhost:27017"
    echo -e "${YELLOW}  Start MongoDB with one of these commands:${NC}"
    echo "    brew services start mongodb-community  # macOS"
    echo "    sudo systemctl start mongod            # Linux"
    echo "    docker run -d -p 27017:27017 --name mongodb mongo"
    echo ""
fi

echo ""
echo -e "${BLUE}Step 3: Checking Project Files...${NC}"
echo ""

# Check required files
REQUIRED_FILES=(
    "server.js"
    "package.json"
    ".env"
    "config/database.js"
    "models/User.js"
    "models/Message.js"
    "models/Conversation.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
    fi
done

echo ""
echo -e "${BLUE}Step 4: Checking npm Dependencies...${NC}"
echo ""

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
    MODULE_COUNT=$(ls -1 node_modules | wc -l)
    echo "  $MODULE_COUNT packages installed"
else
    echo -e "${RED}✗${NC} node_modules not found"
    echo "  Run: npm install"
fi

echo ""
echo -e "${BLUE}Step 5: Checking Port Availability...${NC}"
echo ""

if nc -z localhost 5000 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} Port 5000 is already in use"
    echo "  Is the server already running?"
else
    echo -e "${GREEN}✓${NC} Port 5000 is available"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  NEXT STEPS                                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Make sure MongoDB is running:"
echo "   - Check status above"
echo "   - Start with: docker run -d -p 27017:27017 mongo"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:5000/health"
echo ""
echo "4. Run comprehensive tests:"
echo "   node test-communication.js"
echo ""
echo "5. View the documentation:"
echo "   cat GETTING_STARTED.md"
echo ""
