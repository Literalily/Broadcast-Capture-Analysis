@echo off
cd /d "%~dp0"

:: Step 1: Prevent unoptimized background environments from generating
if not exist "whisperx-env" (
    echo ============================================================
    echo CRITICAL ERROR: Environment 'whisperx-env' is missing!
    echo Please run setup first using: py -3.11 app.py
    echo ============================================================
    pause
    exit /b 1
)

:: Step 2: Verify core FastAPI backend requirements
echo [INFO] Ensuring backend dependencies are installed...
call whisperx-env\Scripts\activate
python -m pip install -r requirements.txt

:: Step 3: Launch the browser automatically to the correct URL
echo [INFO] Launching dashboard interface...
start http://127.0.0.1:8000

:: Step 4: Run the FastAPI backend server using the environment shell
python server.py

pause