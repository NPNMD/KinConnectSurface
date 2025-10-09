# Migration Script: Trigger medication data migration via API
# This script calls the deployed Cloud Function to migrate medications from legacy to unified system

Write-Host "Starting Medication Migration to Unified System" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_URL = "https://us-central1-claritystream-uldp9.cloudfunctions.net/api"
$MIGRATION_ENDPOINT = "$API_URL/unified-medication/medication-commands/migrate-from-legacy"

Write-Host "Please provide your Firebase authentication token" -ForegroundColor Yellow
Write-Host "You can get this from your browser developer tools:" -ForegroundColor Gray
Write-Host "1. Open https://claritystream-uldp9.web.app" -ForegroundColor Gray
Write-Host "2. Open Developer Tools (F12)" -ForegroundColor Gray
Write-Host "3. Go to Application > Local Storage" -ForegroundColor Gray
Write-Host "4. Look for a key containing firebase:authUser" -ForegroundColor Gray
Write-Host "5. Copy the stsTokenManager.accessToken value" -ForegroundColor Gray
Write-Host ""

$TOKEN = Read-Host "Enter your auth token"

if ([string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "No token provided. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Token received" -ForegroundColor Green
Write-Host ""

# Ask for dry run
$dryRunResponse = Read-Host "Run in DRY RUN mode first? (Y/n)"
$DRY_RUN = if ($dryRunResponse -eq "" -or $dryRunResponse -match "^[Yy]") { $true } else { $false }

if ($DRY_RUN -eq $false) {
    Write-Host "Running in PRODUCTION mode (changes will be applied)" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to proceed? (y/N)"
    if ($confirm -notmatch "^[Yy]") {
        Write-Host "Migration cancelled" -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "Running in DRY RUN mode (no changes will be made)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Calling migration endpoint..." -ForegroundColor Cyan
Write-Host "URL: $MIGRATION_ENDPOINT" -ForegroundColor Gray
Write-Host ""

# Prepare request body
$body = @{
    dryRun = $DRY_RUN
} | ConvertTo-Json

# Call the migration endpoint
try {
    $response = Invoke-RestMethod -Uri $MIGRATION_ENDPOINT -Method Post -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } -Body $body -ErrorAction Stop

    Write-Host "Migration Response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    
    Write-Host ""
    if ($response.success) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "Total: $($response.data.totalMedications)" -ForegroundColor White
        Write-Host "Successful: $($response.data.successful)" -ForegroundColor Green
        Write-Host "Skipped: $($response.data.skipped)" -ForegroundColor Yellow
        Write-Host "Failed: $($response.data.failed)" -ForegroundColor Red
        
        if ($response.data.errors.Count -gt 0) {
            Write-Host ""
            Write-Host "Errors encountered:" -ForegroundColor Red
            foreach ($error in $response.data.errors) {
                Write-Host "- $($error.medicationId): $($error.error)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Migration failed: $($response.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Failed to call migration endpoint" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""
Write-Host "Migration script completed" -ForegroundColor Green