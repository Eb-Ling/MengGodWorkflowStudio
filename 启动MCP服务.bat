@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%启动MCP服务.ps1"
if errorlevel 1 pause
