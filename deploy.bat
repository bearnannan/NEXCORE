@echo off
:: NEXCORE Premium Git Deployer Batch Script
:: พัฒนาขึ้นโดย Antigravity เพื่อใช้ในการแก้ปัญหา Sandbox Permission Denied บน Windows

chcp 65001 > nul
echo ==========================================================
echo 🚀 NEXCORE GIT DEPLOYER - AUTOMATION SCRIPT
echo ==========================================================
echo.

:: ตรวจสอบว่ามีโฟลเดอร์ .git หรือไม่
if not exist .git (
    echo [❌ ERROR] ไม่พบ Git Repository ในโฟลเดอร์นี้!
    echo กรุณาตรวจสอบให้มั่นใจว่ารันไฟล์นี้ในโฟลเดอร์หลักของโปรเจกต์
    pause
    exit /b
)

:: ตั้งค่า Remote Repository
echo [📦 REMOTE] กำลังตรวจสอบความถูกต้องของ GitHub Remote...
git remote remove origin 2>nul
git remote add origin https://github.com/bearnannan/NEXCORE.git
echo Remote 'origin' ได้รับการตั้งค่าไปที่: https://github.com/bearnannan/NEXCORE.git
echo.

:: ตรวจสอบสถานะไฟล์
echo [🔍 STATUS] กำลังตรวจสอบสถานะไฟล์ภายในโปรเจกต์...
git status -s
echo.

:: ถามเพื่อดำเนินการต่อ
set /p CONFIRM="ต้องการทำ Git Add และ Commit ข้อมูลทั้งหมดหรือไม่? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo [🛑 CANCEL] ยกเลิกการอัพโหลดข้อมูล
    pause
    exit /b
)

echo.
echo [➕ ADD] กำลังเพิ่มไฟล์ทั้งหมดลงใน Git Staging (ยกเว้นไฟล์ใน .gitignore)...
git add .
echo เพิ่มไฟล์สำเร็จ!
echo.

:: รับ Commit Message
set /p COMMIT_MSG="ระบุรายละเอียดการ Commit (หรือกด Enter เพื่อใช้ค่าเริ่มต้น: 'feat: integrated client-side export and deployment configs'): "
if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG="feat: integrated client-side export and deployment configs"
)

echo.
echo [💾 COMMIT] กำลังสร้าง Commit...
git commit -m %COMMIT_MSG%
echo Commit สำเร็จ!
echo.

:: ตรวจสอบชื่อ Branch
for /f "tokens=*" %%i in ('git branch --show-current') do set BRANCH=%%i
if "%BRANCH%"=="" (
    set BRANCH=main
)

echo [📤 PUSH] กำลัง Deploy และอัพโหลดข้อมูลขึ้น GitHub (Branch: %BRANCH%)...
echo *หมายเหตุ: หากหน้าต่างสอบถามสิทธิ์การใช้งาน (GitHub Login) ปรากฏขึ้น กรุณาดำเนินการเข้าสู่ระบบ*
echo.
git push -u origin %BRANCH%

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==========================================================
    echo 🎉 DEPLOY SUCCESSFUL! อัพโหลดข้อมูลขึ้น GitHub เรียบร้อยแล้ว!
    echo ==========================================================
) else (
    echo.
    echo ==========================================================
    echo ❌ DEPLOY FAILED: เกิดข้อผิดพลาดในการ Push ข้อมูลขึ้น GitHub
    echo แนะนำให้ตรวจสอบอินเทอร์เน็ต สิทธิ์การเขียนลง Repository
    echo หรือรันคำสั่ง: git push -u origin %BRANCH% --force
    echo ==========================================================
)

pause
