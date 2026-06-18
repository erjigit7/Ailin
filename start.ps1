# ============================================================
#  Ailin - кинотеатр. Одно-кликовый запуск с авто-обновлением.
#  Логика: проверяем интернет -> есть: тянем обновления из git и
#  пересобираем -> нет: работаем на текущей версии. Затем запускаем
#  программу (один процесс отдаёт и сервер, и интерфейс) и открываем браузер.
# ============================================================

# Намеренно НЕ ставим ErrorActionPreference='Stop': внешние команды (npm, git)
# пишут заметки в stderr, что в PowerShell 5.1 иначе валит скрипт. Контролируем
# ошибки через $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$ApiPort = 3000

function Say($m) { Write-Host "  $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "  ОШИБКА: $m" -ForegroundColor Red; Read-Host 'Нажмите Enter для выхода'; exit 1 }

function Test-Online {
  try { [void][System.Net.Dns]::GetHostAddresses('github.com'); return $true } catch { return $false }
}
function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host ''
Write-Host '  ==============================' -ForegroundColor Green
Write-Host '   Кинотеатр - запуск программы' -ForegroundColor Green
Write-Host '  ==============================' -ForegroundColor Green
Write-Host ''

if (-not (Has 'node')) { Die 'Не установлен Node.js. Установите его с nodejs.org и запустите снова.' }
if (-not (Has 'npm')) { Die 'Не найден npm (входит в Node.js).' }

$updated = $false
$firstRun = -not (Test-Path 'node_modules')

# 1) Первый запуск - установка зависимостей
if ($firstRun) {
  Say 'Первый запуск: устанавливаю зависимости (разовая операция, подождите)...'
  cmd /c "npm install"
  if ($LASTEXITCODE -ne 0) { Die 'Не удалось установить зависимости.' }
  cmd /c "npm run prisma:generate --workspace @ailin/api"
}

# 2) Авто-обновление из git, если есть интернет
if (Test-Online) {
  if (Test-Path '.git') {
    Say 'Интернет есть - проверяю обновления...'
    cmd /c "git fetch --quiet"
    $local = (cmd /c "git rev-parse HEAD")
    $remote = (cmd /c "git rev-parse @{u}")
    if ($remote -and ($LASTEXITCODE -eq 0) -and ($local -ne $remote)) {
      Say 'Найдены обновления - устанавливаю...'
      cmd /c "git pull --quiet"
      cmd /c "npm install"
      cmd /c "npm run prisma:generate --workspace @ailin/api"
      $updated = $true
    } else {
      Say 'Установлена последняя версия.'
    }
  }
} else {
  Warn 'Интернета нет - работаю на текущей версии (это нормально).'
}

# 3) База данных (через Docker, если установлен)
if (Has 'docker') {
  Say 'Запускаю базу данных...'
  cmd /c "docker compose up -d db" | Out-Null
  for ($i = 0; $i -lt 30; $i++) {
    $h = (cmd /c "docker inspect -f ""{{.State.Health.Status}}"" ailin-db")
    if ($h -eq 'healthy') { break }
    Start-Sleep -Seconds 1
  }
} else {
  Warn 'Docker не найден - подразумевается, что PostgreSQL уже установлен и запущен.'
}

# 4) Сборка при первом запуске/после обновления (или если сборки нет)
$needBuild = $firstRun -or $updated -or -not (Test-Path 'apps/api/dist/main.js') -or -not (Test-Path 'apps/web/dist/index.html')
if ($needBuild) {
  Say 'Собираю программу (это может занять минуту)...'
  cmd /c "npm run build"
  if ($LASTEXITCODE -ne 0) { Die 'Сборка не удалась.' }
}

# 5) Миграции БД (применяем схему; при первом запуске - индексы и начальные данные)
Say 'Готовлю базу данных...'
cmd /c "npm run prisma:deploy --workspace @ailin/api"
if (-not (Test-Path '.ailin-installed')) {
  cmd /c "npm run db:indexes --workspace @ailin/api"
  cmd /c "npm run db:seed --workspace @ailin/api"
  New-Item -ItemType File '.ailin-installed' -Force | Out-Null
}

# 6) Запуск сервера (он же отдаёт интерфейс) и открытие браузера
Say 'Запускаю кассу...'
$apiDir = Join-Path $PSScriptRoot 'apps/api'
$api = Start-Process node -ArgumentList 'dist/main.js' -WorkingDirectory $apiDir -PassThru -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest "http://localhost:$ApiPort/api/sessions" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ready = $true; break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Die 'Сервер не запустился. Проверьте, что база данных работает.' }

Start-Process "http://localhost:$ApiPort/"

Write-Host ''
Write-Host '  [OK] Касса работает!' -ForegroundColor Green
Write-Host "       Касса:          http://localhost:$ApiPort/" -ForegroundColor Green
Write-Host "       Дисплей гостям: http://localhost:$ApiPort/display" -ForegroundColor Green
Write-Host ''
Warn 'Не закрывайте это окно, пока работает касса. Для остановки закройте окно.'
Write-Host ''

try { Wait-Process -Id $api.Id } finally {
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue }
}
