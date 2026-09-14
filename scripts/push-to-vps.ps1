#Requires -Version 5.1
<#
.SYNOPSIS
  Đẩy file deploy AIDR lên VPS và chạy bootstrap thư mục.
  Sẽ hỏi mật khẩu root vài lần (scp/ssh).
#>
param(
  [string]$VpsHost = "42.96.2.38",
  [string]$User = "root",
  [string]$LocalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$remote = "${User}@${VpsHost}"

Write-Host "==> Tao thu muc tren VPS..." -ForegroundColor Cyan
ssh $remote "mkdir -p /opt/aidr/fe-dist /opt/aidr/certbot/www /opt/aidr/certbot/conf /opt/aidr/scripts"

Write-Host "==> Upload file..." -ForegroundColor Cyan
scp "$LocalRoot\docker-compose.prod.yml" "${remote}:/opt/aidr/"
scp -r "$LocalRoot\infra" "${remote}:/opt/aidr/"
scp "$LocalRoot\data-new.linux.sql" "${remote}:/opt/aidr/"
scp "$LocalRoot\scripts\vps-remote-bootstrap.sh" "${remote}:/opt/aidr/scripts/"

if (Test-Path "$LocalRoot\infra\env\.env.vps") {
  scp "$LocalRoot\infra\env\.env.vps" "${remote}:/opt/aidr/infra/env/prod.local.env"
}

Write-Host "==> Bootstrap tren VPS..." -ForegroundColor Cyan
ssh $remote "bash /opt/aidr/scripts/vps-remote-bootstrap.sh"

Write-Host "==> Xong upload. Buoc tiep: DNS A -> $VpsHost, roi compose up." -ForegroundColor Green
ssh $remote "ls -la /opt/aidr"
