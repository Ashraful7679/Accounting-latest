# Pre-commit hook for AccaBiz (Windows compatible)
# Install by running: npm run pre-commit-install

Write-Host "Running pre-commit checks..." -ForegroundColor Yellow

$errors = 0

# Check Backend TypeScript
Write-Host "`nChecking Backend TypeScript..." -ForegroundColor Yellow
Set-Location backend
$backendResult = npm run lint 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
    $errors++
}
Set-Location ..

# Check Frontend TypeScript
Write-Host "`nChecking Frontend TypeScript..." -ForegroundColor Yellow
Set-Location frontend
$frontendResult = npm run build 2>&1 | Select-Object -Last 5
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
    $errors++
}
Set-Location ..

# Summary
Write-Host "`n========================================"
if ($errors -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$errors check(s) failed. Please fix errors before committing." -ForegroundColor Red
    exit 1
}