@echo off
setlocal
cd /d "%~dp0"

if exist ".runtime\backend.pid" (
  set /p APP_PID=<".runtime\backend.pid"
  taskkill /PID %APP_PID% /F >nul 2>nul
  del /f /q ".runtime\backend.pid" >nul 2>nul
  echo 已尝试停止服务进程 %APP_PID%
) else (
  echo 没找到 .runtime\backend.pid，可能服务没启动，或者已经退出了。
)

pause
endlocal
