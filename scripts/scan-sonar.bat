@echo off
REM Ejecuta SonarScanner contra el proyecto Tiendas Mass (requiere SonarQube + token).
REM Uso recomendado:
REM   set SONAR_TOKEN=tu_token_aqui
REM   scripts\scan-sonar.bat
REM O pasar el token como argumento:
REM   scripts\scan-sonar.bat tu_token_aqui

setlocal
cd /d "%~dp0.."

if not "%~1"=="" (
    set "SONAR_TOKEN=%~1"
)

if "%SONAR_TOKEN%"=="" (
    echo ======================================================================
    echo [ERROR] No se ha definido la variable SONAR_TOKEN.
    echo.
    echo Para escanear, genera un token de analisis en SonarQube:
    echo   1. Ingresa a http://localhost:9000
    echo   2. Ve a tu Perfil -^> My Account -^> Security -^> Generate Token
    echo   3. Ejecuta en tu terminal:
    echo        set SONAR_TOKEN=sqp_tu_token_generado
    echo        scripts\scan-sonar.bat
    echo      o directamente:
    echo        scripts\scan-sonar.bat sqp_tu_token_generado
    echo ======================================================================
    exit /b 1
)

if "%SONAR_HOST_URL%"=="" set "SONAR_HOST_URL=http://localhost:9000"

where sonar-scanner >nul 2>&1
if errorlevel 1 (
    if exist "C:\sonar-scanner\bin\sonar-scanner.bat" (
        set "PATH=C:\sonar-scanner\bin;%PATH%"
    ) else (
        echo [ERROR] sonar-scanner no se encuentra en el PATH ni en C:\sonar-scanner\bin.
        echo Asegurate de tener instalado SonarScanner CLI.
        exit /b 1
    )
)

echo ======================================================================
echo    INICIANDO ANALISIS DE CODIGO CON SONARSCANNER - TIENDAS MASS
echo ======================================================================
echo Host URL    : %SONAR_HOST_URL%
echo Project Key : tiendas-mass-v1
echo Properties  : sonar-project.properties
echo.

call sonar-scanner -Dsonar.host.url=%SONAR_HOST_URL% -Dsonar.token=%SONAR_TOKEN%
set ERR=%ERRORLEVEL%

if %ERR% neq 0 (
    echo.
    echo [ERROR] El analisis fallo con codigo de salida %ERR%.
    exit /b %ERR%
)

echo.
echo ======================================================================
echo [EXITO] Analisis completado y enviado exitosamente a SonarQube!
echo Puedes revisar el panel de control y Quality Gate en:
echo   %SONAR_HOST_URL%/dashboard?id=tiendas-mass-v1
echo ======================================================================
endlocal
