#!/bin/bash
# 广泰远程医疗系统 - Android APK 构建脚本
set -e

export JAVA_HOME=/Volumes/External/workspace/bksys2/dev-tools/jdk-21.0.6.jdk/Contents/Home
export ANDROID_HOME=/Volumes/External/workspace/bksys2/dev-tools/android-sdk
export GRADLE_USER_HOME=/Volumes/External/workspace/bksys2/gradle-cache
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$HOME/node/bin:$PATH"

echo "=== 1. 构建前端 ==="
cd /Volumes/External/workspace/bksys2/frontend
npx vite build

echo ""
echo "=== 2. 同步到 Android ==="
npx cap sync android

echo ""
echo "=== 3. 构建 Android APK ==="
cd android
./gradlew assembleDebug

echo ""
echo "=== 构建完成 ==="
APK="/Volumes/External/workspace/bksys2/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
ls -lh "$APK"
echo ""
echo "安装包已就绪: $APK"
