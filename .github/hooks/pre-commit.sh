#!/usr/bin/env bash

# Pre-commit hook: TypeScript and Prisma validation for AccaBiz
# Install: cp .github/hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "🔍 Running pre-commit validation..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# 1. Check if backend/prisma/schema.prisma has syntax errors
echo -e "${YELLOW}Checking Prisma schema syntax...${NC}"
if cd backend > /dev/null 2>&1; then
  if npx prisma validate > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Prisma schema valid${NC}"
  else
    echo -e "${RED}✗ Prisma schema has errors${NC}"
    npx prisma validate
    FAILED=1
  fi
  cd - > /dev/null
else
  echo -e "${YELLOW}⚠ Backend directory not found, skipping Prisma check${NC}"
fi

# 2. Run TypeScript compiler on backend
echo -e "${YELLOW}Checking backend TypeScript...${NC}"
if cd backend > /dev/null 2>&1; then
  if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗ Backend TypeScript errors found:${NC}"
    npx tsc --noEmit
    FAILED=1
  else
    echo -e "${GREEN}✓ Backend TypeScript OK${NC}"
  fi
  cd - > /dev/null
else
  echo -e "${YELLOW}⚠ Backend directory not found, skipping TS check${NC}"
fi

# 3. Run TypeScript compiler on frontend
echo -e "${YELLOW}Checking frontend TypeScript...${NC}"
if cd frontend > /dev/null 2>&1; then
  if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗ Frontend TypeScript errors found:${NC}"
    npx tsc --noEmit
    FAILED=1
  else
    echo -e "${GREEN}✓ Frontend TypeScript OK${NC}"
  fi
  cd - > /dev/null
else
  echo -e "${YELLOW}⚠ Frontend directory not found, skipping TS check${NC}"
fi

# 4. Check for console.logs in production code (optional warning)
echo -e "${YELLOW}Checking for debug logs...${NC}"
CONSOLE_LOGS=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs grep -l 'console\.\(log\|warn\|error\)' 2>/dev/null || true)
if [ -n "$CONSOLE_LOGS" ]; then
  echo -e "${YELLOW}⚠ Warning: console.log found in:${NC}"
  echo "$CONSOLE_LOGS"
  echo -e "${YELLOW}(Proceeding with commit)${NC}"
fi

# 5. Summary
echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Pre-commit validation failed. Fix errors and try again.${NC}"
  exit 1
fi
