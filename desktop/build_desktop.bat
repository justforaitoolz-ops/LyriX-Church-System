@echo off
cd /d "%~dp0"
echo Cleaning previous build...
rmdir /s /q renderer_dist
rmdir /s /q release_v2
echo Starting Build and Publish...
call npx vite build && npx electron-builder --publish always
echo Uploading Mobile APK to GitHub Release...
for /f "tokens=2 delims=:, " %%a in ('findstr "version" package.json') do set VERSION=%%~a
gh release upload v%VERSION% "LyriX-Mobile.apk" --clobber
echo.
echo Build process completed. Check above for errors.
