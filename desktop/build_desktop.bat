@echo off
cd /d "%~dp0"
echo Cleaning previous build...
rmdir /s /q renderer_dist
rmdir /s /q release_v2
echo Starting Build...
call npm run build
echo.
echo Build process completed. Check above for errors.
echo Build process completed. Check above for errors.
