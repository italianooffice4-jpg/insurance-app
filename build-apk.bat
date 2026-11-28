@echo off
cd /d "%~dp0"
title Aman System - Build APK
where node >nul 2>nul || (echo Install Node.js LTS first: https://nodejs.org & pause & exit /b 1)
if not defined ANDROID_HOME if not defined ANDROID_SDK_ROOT (echo Install Android Studio first, open it once, then run this again. & pause & exit /b 1)
call npm install || (pause & exit /b 1)
call npm run android:init || (pause & exit /b 1)
cd android
call gradlew.bat assembleDebug || (pause & exit /b 1)
echo.
echo APK: %cd%\app\build\outputs\apk\debug\app-debug.apk
pause
