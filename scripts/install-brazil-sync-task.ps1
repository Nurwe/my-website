[CmdletBinding()]
param(
    [string]$SourcePath = 'C:\Users\narag\Desktop\Brasil - Nico',
    [string]$WebsiteRoot,
    [string]$TaskName = 'Nicolas Aragona - Sync Brazil website',
    [ValidateSet('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')]
    [string]$DayOfWeek = 'Sunday',
    [datetime]$At = [datetime]::Today.AddHours(9),
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WebsiteRoot)) {
    $WebsiteRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$WebsiteRoot = (Resolve-Path -LiteralPath $WebsiteRoot).Path
$syncScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'sync-brazil.ps1')).Path
$powerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -SourcePath "{1}" -WebsiteRoot "{2}"' -f $syncScript, $SourcePath, $WebsiteRoot
$action = New-ScheduledTaskAction -Execute $powerShellExe -Argument $arguments -WorkingDirectory $WebsiteRoot
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek $DayOfWeek -At $At
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $TaskName
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description 'Once a week, safely mirrors the published Brasil - Nico dashboards and GDP nowcast outputs into the portfolio website.' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

if ($StartNow) {
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
}

$task = Get-ScheduledTask -TaskName $TaskName
Write-Output ('Installed task: {0}' -f $task.TaskName)
Write-Output ('State: {0}' -f $task.State)
Write-Output ('Schedule: every {0} at {1}' -f $DayOfWeek, $At.ToString('HH:mm'))
Write-Output ('Source: {0}' -f $SourcePath)
Write-Output ('Website: {0}' -f $WebsiteRoot)
