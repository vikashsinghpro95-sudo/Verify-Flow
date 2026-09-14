@echo off
title Email Validator
echo Starting Email Validator Web Application...

:: Check and install server dependencies if missing
if not exist "server\node_modules\" (
    echo [Setup] Installing Server Dependencies... This may take a minute.
    cd server
    call npm install
    cd ..
)

:: Check and install client dependencies if missing or broken (e.g., copied from Mac)
if not exist "client\node_modules\.bin\vite.cmd" (
    echo [Setup] Installing/Repairing Client Dependencies for Windows... This may take a minute.
    cd client
    call npm install
    cd ..
)

echo Please wait while the servers start up...

:: Start the Backend Server in its own window
start "Email Validator Backend" cmd /k "cd server && npm run dev"

:: Start the Frontend Client in its own window
start "Email Validator Frontend" cmd /k "cd client && npm run dev"

:: Wait 7 seconds for Vite and Node to initialize
timeout /t 7 /nobreak > nul

:: Open the default web browser to the frontend URL
start http://localhost:5173

echo Application is running! Keep the two black console windows open to process emails.
exit
