# Runs the full flop/turn/river batch at 100bb, then at 200bb, in one window (keeps the PC awake throughout).
Set-Location $PSScriptRoot
& "$PSScriptRoot\run-batch.ps1" -Depth 100
& "$PSScriptRoot\run-batch.ps1" -Depth 200
