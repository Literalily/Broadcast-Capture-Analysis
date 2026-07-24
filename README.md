# Real-Time Broadcast Subtitle Capture & AI-Driven Analysis System

> **School of Electronics, Electrical Engineering and Computer Science (EEECS)**  
> **Summer Research Internship 2026** | *Queen's University Belfast*  
> **Supervisors:** Dr. David Laverty & Dr. Iman Okasili  

---

## 📌 About the Project

This system is designed to ingest live broadcast television subtitle streams, convert them into structured textual datasets, and leverage modern **Natural Language Processing (NLP)** and **Large Language Models (LLMs)** to deliver near-real-time broadcast analytics.  
By continuously monitoring live programming, the system automates transcript extraction, speaker diarization, content summarisation, and audience sentiment tracking. The project bridges real-time data engineering, applied AI, and full-stack dashboard development.

---

## ✨ Key Features

* **📡 Live Data Ingestion & Processing:** Captures and structures subtitle streams directly from broadcast sources.
* **🤖 Automated AI Summarization:** Employs local LLMs (Ollama / Phi-3) to condense long transcripts into concise, actionable summaries.
* **📈 Sentiment Analysis Engine:** Tracks emotional tone, positive/negative polarity, and trends across broadcasts using hybrid VADER and LLM scoring pipelines (`-1.0` to `+1.0`).
* **👥 Speaker Diarization:** Segments and color-codes transcripts by speaker identity for easy reading and visual analysis.
* **📊 Interactive Web Dashboard:** Built with FastAPI and Chart.js to filter episodes, view timelines, display subtitle files, and analyze sentiment trends over time.

---

## 🎯 Project Objectives

1. **Capture:** Build a robust, scalable pipeline capable of ingesting live broadcast subtitle streams.
2. **Structure:** Extract, clean, and structure raw subtitle text into standard JSON format with timestamps.
3. **Summarize:** Integrate LLM pipelines for instant automated summarization of broadcast episodes.
4. **Analyze:** Evaluate content sentiment and emotional trajectory across different programs and dates.
5. **Visualize:** Deliver a web dashboard featuring real-time cards, filtering capabilities, and interactive charts.
6. **Evaluate:** Measure system reliability, latency, and analysis accuracy under continuous operation.

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend & Web Server** | Python 3.11, FastAPI, Uvicorn |
| **Artificial Intelligence & NLP** | Ollama (Phi-3), WhisperX, VADER Sentiment Analysis |
| **Frontend Dashboard** | HTML5, CSS3, JavaScript (ES6+), Chart.js |
| **Data Format** | JSON subtitle segments, Web Media Formats (`.mp4`, `.mkv`, `.ts`) |


## Required installations:
### === **Ollama** ===
1) Download and install Ollama from [here](ollama.com).
2) Open your computer's terminal or command prompt.
3) Run this command:  
```
ollama run phi3  
```
> [!TIP]
> You can also use `ollama run llama3` if your computer has a strong graphics card, but phi3 is incredibly fast and highly capable for summarization and sentiment).  

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

## Using 'Option 1: Transcribe Media Folder':
1) Open your terminal or command prompt in the directory and run the app setup script directly with the command:  
```
py -3.11 app.py  
```
This will trigger its automated setup sequence.  
> [!IMPORTANT]
> WhisperX requires a Python version >=3.10 or <3.14. When running this command, substitute '`3.11`' with your Python version. Using Python 3.14 will cause the system to only partially install the whisperx environment.  
3) Press y when it asks if you want to run the automatic installation.
4) Wait. It will take a few minutes to download the massive CUDA PyTorch libraries and WhisperX binaries.
5) Once app.py says `SUCCESS: WhisperX virtual environment created`, it will ask you for a target folder. Just type exit to close it.
6) Double-click run.bat to launch your web server.
8) In the web interface, paste the folder path in which your file to be transcribed is (note - it must be a folder, not an individual file. Working on fixing this)
9) Paste your unique Hugging Face token (if you're unsure how to get this, follow the instructions in [A Guide to Extracting Subtitles.pdf](https://github.com/user-attachments/files/29846177/A.Guide.to.Extracting.Subtitles.pdf)
10) Now the "Launch AI Pipeline" button will work perfectly.
