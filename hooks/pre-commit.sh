#!/bin/bash
# Pre-commit hook for AccaBiz
# Run this before committing to catch errors early

echo "🔍 Running pre-commit checks..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check TypeScript for backend
echo -e "\n${YELLOW}Checking Backend TypeScript...${NC}"
cd backend
if npx tsc --noEmit 2>/dev/null; then
  echo -e "${GREEN}✅ Backend TypeScript OK${NC}"
else
  echo -e "${RED}❌ Backend TypeScript errors found${NC}"
  ERRORS=$((ERRORS+1))
fi
cd ..

# Check TypeScript for frontend
echo -e "\n${YELLOW}Checking Frontend TypeScript...${NC}"
cd frontend
if npx tsc --noEmit 2>/dev/null; then
  echo -e "${GREEN}✅ Frontend TypeScript OK${NC}"
else
  echo -e "${RED}❌ Frontend TypeScript errors found${NC}"
  ERRORS=$((ERRORS+1))
fi
cd ..

# Summary
echo -e "\n========================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $ERRORS check(s) failed. Please fix errors before committing.${NC}"
  exit 1
fi