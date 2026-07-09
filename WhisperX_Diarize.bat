@echo off
setlocal

set HF_HUB_DISABLE_SYMLINKS_WARNING=1
set HF_HUB_DISABLE_SYMLINKS=1

set "VENV=D:\WPy64-313130\notebooks\whisperx-env"
set "IN=D:\Broadcast data\Liveline Recordings\Liveline"
set "OUT=D:\Broadcast data\Liveline Recordings\Liveline\Subtitles"
set "HF_TOKEN=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"

call "%VENV%\Scripts\activate.bat"

echo ==========================================
echo Checking CUDA...
echo ==========================================

python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"

echo.

if not exist "%IN%" (
    echo ERROR: Input folder does not exist:
    echo %IN%
    pause
    exit /b
)

if not exist "%OUT%" mkdir "%OUT%"

set FOUND=0

for %%E in (mp4 mkv mov avi m4v ts mp3 wav m4a flac) do (
    for %%F in ("%IN%\*.%%E") do (
        if exist "%%F" (
            set FOUND=1
            echo ============================================
            echo Processing %%~nxF with diarization
            echo ============================================

            whisperx "%%F" ^
                --model large-v3 ^
                --device cuda ^
                --language en ^
                --batch_size 8 ^
                --compute_type float16 ^
                --diarize ^
                --hf_token "%HF_TOKEN%" ^
                --output_dir "%OUT%" ^
                --output_format json ^
                --print_progress True

            if errorlevel 1 (
                echo ERROR: WhisperX failed on %%~nxF
                pause
            )
        )
    )
)

if "%FOUND%"=="0" (
    echo No supported media files found in:
    echo %IN%
)

echo.
echo Finished diarization.
pause
