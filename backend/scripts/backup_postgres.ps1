# ==============================================================================
# PARKWISE POSTGRESQL AUTOMATED BACKUP SCRIPT (WINDOWS POWERSHELL)
# ==============================================================================

param (
    [string]$BackupDir = ".\backups",
    [string]$PostgresHost = "localhost",
    [string]$PostgresPort = "5432",
    [string]$PostgresUser = "parkwise",
    [string]$PostgresDb = "parkwise_db",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "${PostgresDb}_backup_${Timestamp}.sql"

Write-Host "[$(Get-Date -Format s)] Starting PostgreSQL backup for ${PostgresDb} on ${PostgresHost}:${PostgresPort}..." -ForegroundColor Cyan

# Execute pg_dump
& pg_dump -h $PostgresHost -p $PostgresPort -U $PostgresUser -d $PostgresDb -F c -f $BackupFile

if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupFile)) {
    $Size = (Get-Item $BackupFile).Length / 1MB
    Write-Host "[$(Get-Date -Format s)] Backup completed successfully: $BackupFile ($([math]::Round($Size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}

# Retention Pruning
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "${PostgresDb}_backup_*.sql" | Where-Object { $_.LastWriteTime -lt $Cutoff } | ForEach-Object {
    Write-Host "Pruning expired backup: $($_.FullName)" -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Write-Host "[$(Get-Date -Format s)] Backup cycle completed." -ForegroundColor Cyan
