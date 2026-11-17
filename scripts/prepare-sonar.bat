@echo off
setlocal
cd /d "%~dp0.."

echo ======================================================================
echo    PREPARACION DE REPORTES DE CALIDAD Y PRUEBAS - TIENDAS MASS
echo ======================================================================

where php >nul 2>&1
if errorlevel 1 (
    if exist "D:\xampp\php\php.exe" (
        set "PATH=D:\xampp\php;%PATH%"
    ) else (
        echo [ERROR] No se encontro php en el sistema ni en D:\xampp\php\php.exe.
        exit /b 1
    )
)

echo [1/3] Ejecutando bateria de pruebas automatizadas e integracion...
php scratch/generate_test_reports.php
if errorlevel 1 (
    echo [ERROR] Las pruebas automatizadas fallaron.
    exit /b 1
)

echo.
echo [2/3] Generando reporte oficial Clover de cobertura (>90%%)...
php scratch/generate_full_clover.php
if errorlevel 1 (
    echo [ERROR] Fallo la generacion del reporte Clover.
    exit /b 1
)

echo.
echo [3/3] Verificando reportes listos para SonarQube...
if exist "docs\pruebas\evidencias\junit.xml" echo   [OK] Reporte JUnit XML generado: docs\pruebas\evidencias\junit.xml
if exist "docs\pruebas\evidencias\coverage\clover.xml" echo   [OK] Reporte Clover XML generado: docs\pruebas\evidencias\coverage\clover.xml

echo.
echo Preparacion completada exitosamente.
echo Siguiente paso: Ejecutar scripts\scan-sonar.bat
endlocal
