# Subtitle-Extraction-and-Visualisation

## Required installations:
### === **Ollama** ===
1) Download and install Ollama from [here](ollama.com).
2) Open your computer's terminal or command prompt.
3) Run this command:
> ollama run phi3
*(Note: You can also use ollama run llama3 if your computer has a strong graphics card, but phi3 is incredibly fast and highly capable for summarization and sentiment).*

### === **FFmpeg** ===
1) When installing FFmpeg, ensure you install a ‘full-build’ version instead of the ‘essentials’ version, which does not include libzvbi. The full-build version of FFmpeg can be found on [GitHub](https://github.com/BtbN/FFmpeg-Builds/releases/tag/latest)
The version I used was called Ffmpeg-master-latest-win64-gpl-shared.zip.
2) Right-click the downloaded folder and select ‘Extract All’. Choose the relevant destination folder (e.g. C:\FFmpeg) and click ‘Extract’.
3) You must then add FFmpeg to the system environment variables. To do this, press Windows + X and select "System."
4) Click "Advanced system settings."
5) Click "Environment Variables."
6) Under "System variables," select Path and click "Edit."
7) Click "New" and add the path to the bin folder (e.g., C:\FFmpeg\bin).
8) Click "OK" on all dialogs to apply the changes.
9) FFmpeg should now be successfully installed.

## To use 'Option 1: Transcribe Media Folder', you must:
1) Open your terminal or command prompt in the directory and run the app setup script directly with the command
> py -3.11 app.py
This will trigger its automated setup sequence. *(Note: WhisperX requires a Python version >=3.10 or <3.14. When running this command, substitute '3.11' with your Python version. Using Python 3.14 will cause the system to only partially install the whisperx environment.)*
3) Press y when it asks if you want to run the automatic installation.
4) Wait. It will take a few minutes to download the massive CUDA PyTorch libraries and WhisperX binaries.
5) Once app.py says SUCCESS: WhisperX virtual environment created, it will ask you for a target folder. Just type exit to close it.
6) Double-click run.bat to launch your web server.
8) In the web interface, paste the folder path in which your file to be transcribed is (note - it must be a folder, not an individual file. Working on fixing this)
9) Paste your unique Hugging Face token (if you're unsure how to get this, follow the instructions in [A Guide to Extracting Subtitles.pdf](https://github.com/user-attachments/files/29846177/A.Guide.to.Extracting.Subtitles.pdf)
10) Now the "Launch AI Pipeline" button will work perfectly.
