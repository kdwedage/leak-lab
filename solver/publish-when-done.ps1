param([int]$Depth = 100)
$env:LEAK_DEPTH = "$Depth"
$Suf = if ($Depth -eq 100) { "" } else { "$Depth" }
# Waits for the solver batch to finish, then rebuilds solver-data.json and pushes it to GitHub Pages.
# Also republishes every 20 new solves, so the live app picks up results during the night.
Set-Location $PSScriptRoot
$repo = 'C:\Users\kevin\Desktop\Leak Lab'
$published = 0
function Publish($msg) {
  node build-data.js | Out-File -Append publish.log
  Push-Location $repo
  git add "solver-data$(if ($Suf) { '-' + $Suf }).json"
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -q -m "$msg`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
    git push -q 2>&1 | Out-File -Append "$PSScriptRoot\publish.log"
    "$(Get-Date -Format HH:mm:ss) pushed: $msg" | Out-File -Append "$PSScriptRoot\publish.log"
  }
  Pop-Location
}
while ($true) {
  $done = (Get-ChildItem "out$Suf" -Filter *.json).Count
  $finished = Select-String -Path "batch$Suf.log" -Pattern 'all done' -Quiet
  if ($finished) { Publish "Solver data ${Depth}bb: all $done boards"; break }
  if ($done -ge $published + 20) { Publish "Solver data ${Depth}bb: $done boards"; $published = $done }
  Start-Sleep -Seconds 120
}
