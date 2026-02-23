@echo off
cd /d "%~dp0"
echo Cleaning previous build...
rmdir /s /q renderer_dist
rmdir /s /q release_v2
echo Starting Build and Publish...
call npx vite build && npx electron-builder --publish always
echo.
echo Build process completed. Check above for errors.
echo Build process completed. Check above for errors.
