[CmdletBinding()]
param(
    [string]$TaskName = 'Nicolas Aragona - Sync Brazil website'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Output "Scheduled task is not installed: $TaskName"
    exit 0
}

if ($task.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $TaskName
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output "Removed scheduled task: $TaskName"
