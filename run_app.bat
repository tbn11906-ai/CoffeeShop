@echo off
chcp 65001 >nul
title Highlands Coffee Web App (Python + SQLite)
echo ========================================================
echo   HIGHLANDS COFFEE - WEB ORDERING & E-MENU (PYTHON FLASK)
echo ========================================================
echo.
echo Checking Python environment...
set PYTHON_EXE=C:\Users\ThuyBinh\AppData\Local\Programs\Python\Python312\python.exe

if exist "%PYTHON_EXE%" (
    echo Using Python at: %PYTHON_EXE%
    "%PYTHON_EXE%" app.py
) else (
    echo Using system Python...
    python app.py
)

pause
