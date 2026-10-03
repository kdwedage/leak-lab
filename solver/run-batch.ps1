param([int]$Depth = 100)
$env:LEAK_DEPTH = "$Depth"
$Suf = if ($Depth -eq 100) { "" } else { "$Depth" }
# Runs the solver batch and asks Windows not to idle-sleep until it finishes
# (the same request a video player makes; no power settings are changed, and it ends with this script).
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]'0x80000000'; $ES_SYSTEM_REQUIRED = [uint32]'0x00000001'
[Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED) | Out-Null
try {
  Set-Location $PSScriptRoot
  node batch.js
} finally {
  [Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
}
