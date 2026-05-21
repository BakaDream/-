param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDistDir = Join-Path $RootDir "frontend\\dist"
$RuntimeDir = Join-Path $RootDir ".runtime"
$PyDepsDir = Join-Path $RuntimeDir "pydeps"
$VenvDir = Join-Path $RuntimeDir "venv"
$LogDir = Join-Path $RuntimeDir "logs"
$BackendLog = Join-Path $LogDir "backend.log"
$PidFile = Join-Path $RuntimeDir "backend.pid"
$RequirementsFile = Join-Path $BackendDir "requirements.txt"
$Port = 5000
$AppUrl = "http://127.0.0.1:$Port"

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "[OK]   $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Ensure-Dir($path) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

function Get-PythonLauncher {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @{ File = "py"; Args = @("-3") }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{ File = "python"; Args = @() }
    }
    return $null
}

function Ensure-PythonInstalled {
    $launcher = Get-PythonLauncher
    if ($launcher) {
        return $launcher
    }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Warn "未检测到 Python，正在尝试用 winget 自动安装 Python 3.12..."
        winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "Python 自动安装失败，请手动安装 Python 3.10+ 后重试。"
        }
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $launcher = Get-PythonLauncher
        if ($launcher) {
            Write-Ok "Python 已自动安装完成"
            return $launcher
        }
    }

    throw "未检测到 Python，且无法自动安装。请先安装 Python 3.10+ 后重试。"
}

function Invoke-Python {
    param(
        [string[]]$Arguments,
        [switch]$IgnoreExitCode
    )

    $launcher = Ensure-PythonInstalled

    & $launcher.File @($launcher.Args + $Arguments)
    if (-not $IgnoreExitCode -and $LASTEXITCODE -ne 0) {
        throw "Python 命令执行失败：$($Arguments -join ' ')"
    }
}

function Ensure-Venv {
    if (Test-Path -LiteralPath (Join-Path $VenvDir "Scripts\\python.exe")) {
        return
    }

    Write-Info "正在创建本地 Python 虚拟环境..."
    Ensure-Dir $RuntimeDir
    Invoke-Python -Arguments @("-m", "venv", $VenvDir)
    Write-Ok "虚拟环境创建完成"
}

function Get-VenvPython {
    $pythonExe = Join-Path $VenvDir "Scripts\\python.exe"
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "虚拟环境 Python 不存在：$pythonExe"
    }
    return $pythonExe
}

function Install-Dependencies {
    $pythonExe = Get-VenvPython
    Ensure-Dir $PyDepsDir

    Write-Info "正在安装/校验后端依赖..."
    & $pythonExe -m pip install --upgrade pip --disable-pip-version-check | Out-Null
    & $pythonExe -m pip install -r $RequirementsFile --target $PyDepsDir --disable-pip-version-check
    if ($LASTEXITCODE -ne 0) {
        throw "后端依赖安装失败"
    }
    Write-Ok "后端依赖已就绪"
}

function Test-PortListening {
    param([int]$ListenPort)

    try {
        $conn = Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction Stop
        return $conn.Count -gt 0
    } catch {
        return $false
    }
}

function Stop-ExistingProcess {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        return
    }

    try {
        $pid = [int](Get-Content -LiteralPath $PidFile -ErrorAction Stop)
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Warn "发现旧的服务进程，正在关闭..."
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Start-Sleep -Seconds 1
        }
    } catch {
        Write-Warn "旧 PID 记录不可用，已忽略"
    } finally {
        Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
    }
}

function Ensure-FrontendBuilt {
    $indexFile = Join-Path $FrontendDistDir "index.html"
    if (-not (Test-Path -LiteralPath $indexFile)) {
        throw "缺少 frontend/dist/index.html。请使用项目内已打包好的前端资源重新发布。"
    }
    Write-Ok "前端静态资源已就绪"
}

function Start-Backend {
    Ensure-Dir $LogDir
    $pythonExe = Get-VenvPython
    $env:PYTHONPATH = "$PyDepsDir;$BackendDir"

    if (Test-PortListening -ListenPort $Port) {
        Write-Warn "端口 $Port 已被占用，老子先尝试清理旧进程。"
        Stop-ExistingProcess
    }

    Write-Info "正在启动本地服务..."
    $process = Start-Process -FilePath $pythonExe `
        -ArgumentList @("app.py") `
        -WorkingDirectory $BackendDir `
        -RedirectStandardOutput $BackendLog `
        -RedirectStandardError $BackendLog `
        -PassThru `
        -WindowStyle Hidden

    $process.Id | Set-Content -LiteralPath $PidFile -Encoding UTF8

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if ($process.HasExited) {
            $logText = ""
            if (Test-Path -LiteralPath $BackendLog) {
                $logText = Get-Content -LiteralPath $BackendLog -Raw -ErrorAction SilentlyContinue
            }
            throw "后端进程启动失败。日志：`n$logText"
        }

        try {
            $resp = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-Ok "服务启动成功：$AppUrl"
                return
            }
        } catch {
        }
    }

    throw "服务启动超时，请查看日志：$BackendLog"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  数据结构可视化系统 - Windows 一键启动" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Ensure-FrontendBuilt
Ensure-Venv
Install-Dependencies
Start-Backend

if (-not $NoBrowser) {
    Start-Process $AppUrl | Out-Null
}

Write-Host ""
Write-Ok "浏览地址：$AppUrl"
Write-Ok "后端日志：$BackendLog"
Write-Host ""
Write-Host "双击 start.ps1 就能再启动。要关闭服务，直接结束对应 python 进程，或者删掉 .runtime/backend.pid 后重启也行。" -ForegroundColor Yellow
Write-Host "如果系统拦 PowerShell 脚本，请右键 start.ps1 选择“使用 PowerShell 运行”，或者手动执行：" -ForegroundColor Yellow
Write-Host "powershell -ExecutionPolicy Bypass -File .\\start.ps1" -ForegroundColor Yellow
