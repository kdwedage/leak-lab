# Waits for the 200bb batch to finish, then re-runs both batches (finished boards are skipped, so only failed ones are solved)
# and publishes both data files. Keeps the PC awake while it works.
Set-Location $PSScriptRoot
while (-not (Select-String -Path "batch200.log" -Pattern 'all done' -Quiet)) { Start-Sleep -Seconds 120 }
Start-Sleep -Seconds 180   # let the 200bb publisher finish its final push
& "$PSScriptRoot\run-batch.ps1" -Depth 100
& "$PSScriptRoot\run-batch.ps1" -Depth 200
$env:LEAK_DEPTH = '100'; node build-data.js 2>&1 | Out-File -Append publish.log
$env:LEAK_DEPTH = '200'; node build-data.js 2>&1 | Out-File -Append publish.log
Push-Location 'C:\Users\kevin\Desktop\Leak Lab'
git add solver-data.json solver-data-200.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -q -m "Solver data: retried failed boards`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git push -q 2>&1 | Out-File -Append "$PSScriptRoot\publish.log"
  "$(Get-Date -Format HH:mm:ss) pushed: retried failed boards" | Out-File -Append "$PSScriptRoot\publish.log"
}
Pop-Location
