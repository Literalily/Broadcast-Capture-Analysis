@echo off
setlocal

:: Prevent Hugging Face symlink warnings
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
set HF_HUB_DISABLE_SYMLINKS=1

:: Catch parameters sent from Python
set "IN=%~1"
set "OUT=%~2"
set "HF_TOKEN=%~3"
set "VENV=%~4"

echo ==========================================
echo Activating Environment: %VENV%
echo ==========================================
call "%VENV%\Scripts\activate.bat"

echo ==========================================
echo Verifying Local Hardware & CUDA Status...
echo ==========================================
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
echo.

if not exist "%IN%" (
    echo ERROR: Target input folder does not exist:
    echo %IN%
    pause
    exit /b 1
)

if not exist "%OUT%" mkdir "%OUT%"

set FOUND=0

:: Process all video and audio containers found in directory
for %%E in (mp4 mkv mov avi m4v ts mp3 wav m4a flac) do (
    for %%F in ("%IN%\*.%%E") do (
        if exist "%%F" (
            set FOUND=1
            echo ============================================================
            echo Ingesting: %%~nxF 
            echo Running transcription and speaker diarization pipelines...
            echo ============================================================

            whisperx "%%F" ^
                --model large-v3 ^
                --device cuda ^
                --language en ^
                --batch_size 8 ^
                --compute_type float16 ^
                --diarize ^"D:\Broadcast data\Dropoff-yCETDNuprR8mjNDN\downloads\downloads\radio1\JoeDuffysChristmasEveSpecial"
                --hf_token "%HF_TOKEN%" ^
                --output_dir "%OUT%" ^
                --output_format json ^
                --print_progress True

            if errorlevel 1 (
                echo ERROR: WhisperX execution structural failure on %%~nxF
            )
        )
    )
)

if "%FOUND%"=="0" (
    echo No supported media tracks found in target directory: %IN%
)

echo.
echo ==========================================
echo Batch execution processing complete.
echo ==========================================
