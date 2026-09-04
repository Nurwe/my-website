[CmdletBinding()]
param(
    [string]$SourcePath = 'C:\Users\narag\Desktop\Brasil - Nico',
    [string]$WebsiteRoot,
    [switch]$Watch,
    [ValidateRange(1, 3600)]
    [int]$IntervalSeconds = 3,
    [ValidateRange(0, 300)]
    [int]$StableSeconds = 2,
    [string]$LogPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WebsiteRoot)) {
    $WebsiteRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
}
if ([string]::IsNullOrWhiteSpace($LogPath)) {
    $LogPath = Join-Path $PSScriptRoot 'brazil-sync.log'
}

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$WebsiteRoot = (Resolve-Path -LiteralPath $WebsiteRoot).Path

$script:FingerprintCache = @{}
$script:MissingCache = @{}

function Write-SyncLog {
    param([string]$Message)

    $line = '[{0}] {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    $logDirectory = Split-Path -Parent $LogPath
    if ($logDirectory -and -not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    }
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function New-PublicationMapping {
    param(
        [string]$Source,
        [string]$Destination
    )

    [pscustomobject]@{
        Source = Join-Path $SourcePath $Source
        Destination = $Destination
    }
}

function Get-QuarterIndex {
    param([string]$Period)

    if ($Period -notmatch '^(\d{4})-(?:T|Q)([1-4])$') {
        return $null
    }
    ([int]$Matches[1] * 4) + [int]$Matches[2] - 1
}

function Get-QuarterText {
    param([int]$Index)

    '{0}-T{1}' -f [math]::Floor($Index / 4), (($Index % 4) + 1)
}

function Assert-TwoQuarterForecasts {
    $currentPath = Join-Path $SourcePath 'salidas\nowcasting_pib\nowcast_actual.csv'
    $modelsPath = Join-Path $SourcePath 'salidas\nowcasting_pib\modelos\nowcasts_actuales_todos_modelos.csv'
    if (-not (Test-Path -LiteralPath $currentPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $modelsPath -PathType Leaf)) {
        throw 'The source nowcast files required for the two-quarter publication check are missing.'
    }

    $observed = @(Import-Csv -LiteralPath $currentPath |
        ForEach-Object { Get-QuarterIndex $_.ultimo_pib_observado } |
        Where-Object { $null -ne $_ })
    if (-not $observed.Count) {
        throw 'The latest observed GDP quarter could not be read from nowcast_actual.csv.'
    }

    $latestObserved = ($observed | Measure-Object -Maximum).Maximum
    $expected = @(
        Get-QuarterText ($latestObserved + 1)
        Get-QuarterText ($latestObserved + 2)
    )
    $available = @(Import-Csv -LiteralPath $modelsPath |
        Select-Object -ExpandProperty periodo -Unique)
    $missing = @($expected | Where-Object { $_ -notin $available })
    if ($missing.Count) {
        throw "Website sync stopped: model outputs do not yet contain both next GDP quarters. Missing: $($missing -join ', ')."
    }
}

function Get-PublicationMappings {
    $mappings = @(
        New-PublicationMapping 'Dashboards\Dashboard_Real_Brasil.html' 'brazil\dashboards\real-economy.html'
        New-PublicationMapping 'Dashboards\Dashboard_Fiscal_Brasil.html' 'brazil\dashboards\fiscal.html'
        New-PublicationMapping 'Dashboards\Dashboard_Financiero_Brasil.html' 'brazil\dashboards\financial.html'
        New-PublicationMapping 'Dashboards\Dashboard_Externo_Brasil.html' 'brazil\dashboards\external.html'
        New-PublicationMapping 'Dashboards\Dashboard_Calendario_Brasil.html' 'brazil\dashboards\calendar.html'
        New-PublicationMapping 'salidas\nowcasting_pib\nowcast_actual.csv' 'brazil\data\nowcast-current.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\nowcasts_actuales_todos_modelos.csv' 'brazil\data\model-comparison.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\rendimiento_modelos_todas_muestras.csv' 'brazil\data\model-rmse.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\estado_evaluaciones_modelos.csv' 'brazil\data\model-evaluation-status.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\importancia_variables_todos_modelos.csv' 'brazil\data\model-variable-importance.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\ensamble_rendimiento_variantes.csv' 'brazil\data\ensemble-performance.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\comparacion_variantes_vs_rolling.csv' 'brazil\data\model-variants-vs-rolling.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\comparacion_benchmarks_post_covid.csv' 'brazil\data\model-benchmarks-post-covid.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\predicciones_modelos_actuales.csv' 'brazil\data\component-forecasts.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\variables_mensuales_modelo.csv' 'brazil\data\model-variables.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\pesos_modelos.csv' 'brazil\data\model-weights.csv'
        New-PublicationMapping 'salidas\nowcasting_pib\evaluacion\evaluacion_nowcast.html' 'brazil\research\validation.html'
        New-PublicationMapping 'salidas\nowcasting_pib\modelos\diagnostico_variables\diagnostico_variables_y_errores.html' 'brazil\research\diagnostics.html'
    )

    $testChartDirectory = Join-Path $SourcePath 'salidas\nowcasting_pib\evaluacion\graficos_predicciones_test'
    if (Test-Path -LiteralPath $testChartDirectory -PathType Container) {
        $mappings += Get-ChildItem -LiteralPath $testChartDirectory -File | Sort-Object Name | ForEach-Object {
            [pscustomobject]@{
                Source = $_.FullName
                Destination = Join-Path 'brazil\research\test-predictions' $_.Name
            }
        }
    }

    $mappings
}

function Set-FileAtomically {
    param(
        [string]$TemporaryPath,
        [string]$DestinationPath
    )

    Move-Item -LiteralPath $TemporaryPath -Destination $DestinationPath -Force
}

function Sync-PublishedFile {
    param([pscustomobject]$Mapping)

    $sourceFile = $Mapping.Source
    $destinationFile = Join-Path $WebsiteRoot $Mapping.Destination

    if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
        if (-not $script:MissingCache.ContainsKey($sourceFile)) {
            Write-SyncLog "Waiting for missing output: $sourceFile"
            $script:MissingCache[$sourceFile] = $true
        }
        return $false
    }

    $script:MissingCache.Remove($sourceFile)
    $sourceItem = Get-Item -LiteralPath $sourceFile
    $fingerprint = '{0}:{1}' -f $sourceItem.Length, $sourceItem.LastWriteTimeUtc.Ticks

    if ($script:FingerprintCache[$sourceFile] -eq $fingerprint) {
        return $false
    }

    if (((Get-Date).ToUniversalTime() - $sourceItem.LastWriteTimeUtc).TotalSeconds -lt $StableSeconds) {
        return $false
    }

    $destinationDirectory = Split-Path -Parent $destinationFile
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    $temporaryFile = Join-Path $destinationDirectory ('.{0}.sync-{1}.tmp' -f ([System.IO.Path]::GetFileName($destinationFile)), [guid]::NewGuid().ToString('N'))

    try {
        $sourceHashBefore = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash

        if (Test-Path -LiteralPath $destinationFile -PathType Leaf) {
            $destinationHash = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash
            if ($sourceHashBefore -eq $destinationHash) {
                $script:FingerprintCache[$sourceFile] = $fingerprint
                return $false
            }
        }

        Copy-Item -LiteralPath $sourceFile -Destination $temporaryFile -Force
        $temporaryHash = (Get-FileHash -LiteralPath $temporaryFile -Algorithm SHA256).Hash
        $sourceHashAfter = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash

        if ($sourceHashBefore -ne $temporaryHash -or $sourceHashBefore -ne $sourceHashAfter) {
            throw 'The source changed while it was being copied; it will be retried.'
        }

        Set-FileAtomically -TemporaryPath $temporaryFile -DestinationPath $destinationFile
        $script:FingerprintCache[$sourceFile] = $fingerprint
        Write-SyncLog ('Updated {0}' -f $Mapping.Destination.Replace('\', '/'))
        return $true
    }
    catch {
        Write-SyncLog ('Skipped {0}: {1}' -f $Mapping.Destination.Replace('\', '/'), $_.Exception.Message)
        return $false
    }
    finally {
        if (Test-Path -LiteralPath $temporaryFile -PathType Leaf) {
            Remove-Item -LiteralPath $temporaryFile -Force
        }
    }
}

function Write-SyncManifest {
    param([object[]]$Mappings)

    $latestSourceTime = [datetime]::MinValue
    $files = foreach ($mapping in $Mappings) {
        $destinationFile = Join-Path $WebsiteRoot $mapping.Destination
        if (-not (Test-Path -LiteralPath $destinationFile -PathType Leaf)) {
            continue
        }

        $destinationItem = Get-Item -LiteralPath $destinationFile
        $sourceModified = $null
        if (Test-Path -LiteralPath $mapping.Source -PathType Leaf) {
            $sourceModified = (Get-Item -LiteralPath $mapping.Source).LastWriteTimeUtc
            if ($sourceModified -gt $latestSourceTime) {
                $latestSourceTime = $sourceModified
            }
        }

        [ordered]@{
            path = $mapping.Destination.Replace('\', '/')
            bytes = $destinationItem.Length
            sourceLastModifiedUtc = if ($sourceModified) { $sourceModified.ToString('o') } else { $null }
            sha256 = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    $manifest = [ordered]@{
        schemaVersion = 1
        generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        sourceSnapshotUtc = if ($latestSourceTime -gt [datetime]::MinValue) { $latestSourceTime.ToString('o') } else { $null }
        fileCount = @($files).Count
        files = @($files)
    }

    $manifestPath = Join-Path $WebsiteRoot 'brazil\data\sync-manifest.json'
    $manifestDirectory = Split-Path -Parent $manifestPath
    if (-not (Test-Path -LiteralPath $manifestDirectory)) {
        New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
    }

    $temporaryManifest = Join-Path $manifestDirectory ('.sync-manifest-{0}.tmp' -f [guid]::NewGuid().ToString('N'))
    try {
        $json = $manifest | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($temporaryManifest, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
        Set-FileAtomically -TemporaryPath $temporaryManifest -DestinationPath $manifestPath
    }
    finally {
        if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
            Remove-Item -LiteralPath $temporaryManifest -Force
        }
    }
}

function Invoke-BrazilSync {
    Assert-TwoQuarterForecasts
    $mappings = @(Get-PublicationMappings)
    $updatedCount = 0

    foreach ($mapping in $mappings) {
        if (Sync-PublishedFile -Mapping $mapping) {
            $updatedCount++
        }
    }

    $manifestPath = Join-Path $WebsiteRoot 'brazil\data\sync-manifest.json'
    if ($updatedCount -gt 0 -or -not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Write-SyncManifest -Mappings $mappings
        Write-SyncLog "Published a sync manifest for $($mappings.Count) files."
    }

    $updatedCount
}

Write-SyncLog "Brazil website sync started (one-way source to website)."

if ($Watch) {
    Write-SyncLog "Watching for stable output changes every $IntervalSeconds second(s)."
    while ($true) {
        [void](Invoke-BrazilSync)
        Start-Sleep -Seconds $IntervalSeconds
    }
}
else {
    $updated = Invoke-BrazilSync
    Write-SyncLog "Sync complete: $updated changed file(s)."
}
