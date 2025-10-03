# Wait for Firestore index to build and check logs
Write-Host "⏳ Waiting 2 minutes for Firestore index to build..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 120

Write-Host "✅ Wait complete. Checking Firebase logs..." -ForegroundColor Green
Write-Host ""

firebase functions:log