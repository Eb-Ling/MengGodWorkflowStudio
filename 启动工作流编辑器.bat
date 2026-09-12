@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%启动工作流编辑器.ps1"
if errorlevel 1 pause
