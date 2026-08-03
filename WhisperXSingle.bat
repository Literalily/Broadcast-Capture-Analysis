@echo off
setlocal

:: Prevent Hugging Face symlink warnings
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
set HF_HUB_DISABLE_SYMLINKS=1

:: Catch parameters sent from Python
set "FILE=%~1"
set "OUT=%~2"
set "HF_TOKEN=%~3"
set "VENV=%~4"

echo ==========================================
echo Activating Environment: %VENV%
echo ==========================================
call "%VENV%\Scripts\activate.bat"

if not exist "%FILE%" (
    echo ERROR: Target input file does not exist:
    echo %FILE%
    exit /b 1
)

if not exist "%OUT%" mkdir "%OUT%"

echo ============================================================
echo Ingesting: %FILE% 
echo Running transcription and speaker diarization pipelines...
echo ============================================================

whisperx "%FILE%" --model large-v3 --device cuda --language en --batch_size 8 --compute_type float16 --diarize --hf_token "%HF_TOKEN%" --output_dir "%OUT%" --output_format json --print_progress True

if errorlevel 1 (
    echo ERROR: WhisperX execution structural failure on %FILE%
)

echo.
echo ==========================================
echo Single file execution processing complete.
echo ==========================================