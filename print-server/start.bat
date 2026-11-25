@echo off
title Print Server - Impresora Termica
color 0A
echo.
echo  ================================
echo   Print Server - Impresora USB
echo  ================================
echo.
echo  Iniciando servidor en puerto 3000...
echo  Mantén esta ventana abierta mientras imprimes.
echo  Presiona Ctrl+C para detener.
echo.
cd /d "%~dp0"
node print-server.js
pause