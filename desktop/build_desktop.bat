@echo off
cd /d "%~dp0"
echo Cleaning previous build...
rmdir /s /q renderer_dist
rmdir /s /q release_v2
echo Starting Build and Publish...
call npx vite build && npx electron-builder --publish always
echo Uploading Mobile APK to GitHub Release...
gh release upload v1.1.6 "C:\Users\BODDU_VAMSI\Documents\LyriX-Mobile.apk" --clobber
echo.
echo Build process completed. Check above for errors.
