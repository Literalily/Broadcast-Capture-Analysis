# Subtitle-Extraction-and-Visualisation

To use 'Option 1: Transcribe Media Folder', you must:
1) Open your terminal or command prompt in the directory and run the app setup script directly with ' python app.py '. This will trigger its automated setup sequence.
2) Press y when it asks if you want to run the automatic installation.
3) Wait. It will take a few minutes to download the massive CUDA PyTorch libraries and WhisperX binaries.
4) Once app.py says SUCCESS: WhisperX virtual environment created, it will ask you for a target folder. Just type exit to close it.
5) Double-click run.bat to launch your web server.
8) In the web interface, paste the folder path in which your file to be transcribed is (note - it must be a folder, not an individual file. Working on fixing this)
9) Paste your unique Hugging Face token (if you're unsure how to get this, follow the instructions in [A Guide to Extracting Subtitles.pdf](https://github.com/user-attachments/files/29846177/A.Guide.to.Extracting.Subtitles.pdf)
10) Now the "Launch AI Pipeline" button will work perfectly.
