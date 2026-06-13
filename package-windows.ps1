param(
    [string]$OutputDir = "release"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReleaseRoot = Join-Path $RootDir $OutputDir
$PackageDir = Join-Path $ReleaseRoot "数据结构可视化系统-Windows"
$FrontendDir = Join-Path $RootDir "frontend"
$BackendDir = Join-Path $RootDir "backend"

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "[OK]   $message" -ForegroundColor Green
}

function Ensure-Dir($path) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

Write-Info "正在重新构建前端静态资源..."
Push-Location $FrontendDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "前端构建失败"
    }
} finally {
    Pop-Location
}

Write-Info "正在准备 Windows 发布目录..."
if (Test-Path -LiteralPath $PackageDir) {
    Remove-Item -LiteralPath $PackageDir -Recurse -Force
}
Ensure-Dir $PackageDir

Copy-Item -LiteralPath (Join-Path $RootDir "start.ps1") -Destination $PackageDir
Copy-Item -LiteralPath (Join-Path $RootDir "启动系统.bat") -Destination $PackageDir
Copy-Item -LiteralPath (Join-Path $RootDir "停止系统.bat") -Destination $PackageDir
Copy-Item -LiteralPath $BackendDir -Destination $PackageDir -Recurse
Ensure-Dir (Join-Path $PackageDir "frontend")
Copy-Item -LiteralPath (Join-Path $FrontendDir "dist") -Destination (Join-Path $PackageDir "frontend") -Recurse
Copy-Item -LiteralPath (Join-Path $FrontendDir "src") -Destination (Join-Path $PackageDir "frontend") -Recurse
Copy-Item -LiteralPath (Join-Path $FrontendDir "public") -Destination (Join-Path $PackageDir "frontend") -Recurse
Copy-Item -LiteralPath (Join-Path $FrontendDir "package.json") -Destination (Join-Path $PackageDir "frontend")
Copy-Item -LiteralPath (Join-Path $FrontendDir "package-lock.json") -Destination (Join-Path $PackageDir "frontend")
Copy-Item -LiteralPath (Join-Path $FrontendDir "vite.config.js") -Destination (Join-Path $PackageDir "frontend")
Copy-Item -LiteralPath (Join-Path $FrontendDir "index.html") -Destination (Join-Path $PackageDir "frontend")
Copy-Item -LiteralPath (Join-Path $FrontendDir "jsconfig.json") -Destination (Join-Path $PackageDir "frontend")
if (Test-Path -LiteralPath (Join-Path $FrontendDir "README.md")) {
    Copy-Item -LiteralPath (Join-Path $FrontendDir "README.md") -Destination (Join-Path $PackageDir "frontend")
}

$readme = @'
【Windows 一键启动说明】

1. 解压整个文件夹，不要只解压单个脚本。
2. 优先双击 启动系统.bat。
3. 第一次启动会自动创建本地 Python 虚拟环境并安装依赖，耐心等一会儿。
4. 启动成功后会自动打开浏览器：http://127.0.0.1:5000

如果双击 bat 没拉起来，再手动执行：
  powershell -ExecutionPolicy Bypass -File .\start.ps1

注意：
- 没装 Python 时，脚本会优先尝试用 winget 自动安装
- 不需要 Node.js
- 不需要手动装前端依赖
- 发布包内保留了 frontend 源码和 dist 静态产物
- AI 默认开启；如需关闭，请在启动前设置环境变量 ENABLE_AI=false
- 关闭后前端不显示 AI 对话，后端 /api/ai/* 会拒绝使用
'@

Set-Content -LiteralPath (Join-Path $PackageDir "使用说明.txt") -Value $readme -Encoding UTF8

Write-Ok "Windows 发布包已生成：$PackageDir"
