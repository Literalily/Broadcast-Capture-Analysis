@echo off
:: Navigate to the directory where this batch script is located
cd /d "%~dp0"

:: Step 1: Create the virtual environment if it doesn't exist
if not exist "whisperx-env" (
    echo [INFO] Creating Python virtual environment (whisperx-env)...
    python -m venv whisperx-env
)

:: Step 2: Install/Verify core FastAPI backend requirements
echo [INFO] Ensuring backend dependencies are installed...
call whisperx-env\Scripts\activate
python -m pip install -r requirements.txt

:: Step 3: Launch the browser automatically to the correct URL
echo [INFO] Launching dashboard interface...
start http://127.0.0.1:8000

:: Step 4: Run the FastAPI backend server
echo [INFO] Starting engine server process...
python server.py

pause