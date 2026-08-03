from fastapi import FastAPI, HTTPException, BackgroundTasks #(see #*3)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os
import re
import json
import subprocess
from datetime import datetime

DATE_PATTERN = re.compile(r"(19\d{2}|20\d{2}|2100)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])")

def extract_date_from_name(base_name: str) -> str:
    match = DATE_PATTERN.search(base_name)
    if match and len(match.groups()) == 3:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return "00-00-0000"

# VADER analyzer instance
sentiment_analyzer = SentimentIntensityAnalyzer()

def score_text(text: str):
    # Returns a -1.0..1.0 compound sentiment score for a chunk of text, or None if there's nothing usable to score.
    if not text or not text.strip():
        return None
    scores = sentiment_analyzer.polarity_scores(text)
    return round(scores["compound"], 2)

# In-memory index cache (see *2)
_subtitle_cache = {}

def get_subtitle_data(file_path: str):
    # Reads subtitle JSON file from disk and returns its overall sentiment score.
    # Returns None on any read/parse error rather than raising, so one bad file can't break the whole broadcast listing.
    try:
        mtime = os.path.getmtime(file_path)
    except OSError as e:
        print(f"Warning: could not stat {file_path}: {e}")
        return None, []

    cached = _subtitle_cache.get(file_path)
    if cached and cached[0] == mtime:
        return cached[1]["sentiment"], cached[1]["segments"]

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw_segments = data if isinstance(data, list) else data.get("segments", [])

        segments = []
        line_scores = []
        for seg in raw_segments:
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            line_sentiment = score_text(text)
            if line_sentiment is not None:
                line_scores.append(line_sentiment)
            segments.append({
                "text": text,
                "start": seg.get("start"),
                "end": seg.get("end"),
                "sentiment": line_sentiment
            })

        overall_sentiment = round(sum(line_scores) / len(line_scores), 2) if line_scores else None
        _subtitle_cache[file_path] = (mtime, {"sentiment": overall_sentiment, "segments": segments})
        return overall_sentiment, segments

    except Exception as e:
        print(f"Warning: could not read/score {file_path}: {e}")
        return None, []

# Enable CORS so your local HTML file dashboard can talk to this server safely
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

script_dir = os.path.dirname(os.path.abspath(__file__))

# Mount static asset folders safely
for folder in ["css", "js", "assets"]:
    target = os.path.join(script_dir, folder)
    if os.path.exists(target):
        app.mount(f"/{folder}", StaticFiles(directory=target), name=folder)
        
broadcast_dir = os.path.join(script_dir, "Broadcast-Data")
if not os.path.exists(broadcast_dir):
    # lowercase fallback if Broadcast-data was created instead
    alt_dir = os.path.join(script_dir, "Broadcast-data")
    if os.path.exists(alt_dir):
        broadcast_dir = alt_dir

if os.path.exists(broadcast_dir):
    app.mount("/Broadcast-Data", StaticFiles(directory=broadcast_dir), name="broadcast-data")
    
# HTML Page Routes
@app.get("/")
@app.get("/index.html")
def get_dashboard():
    return FileResponse(os.path.join(script_dir, "index.html"))

@app.get("/page2.html")
def get_page2():
    return FileResponse(os.path.join(script_dir, "page2.html"))

@app.get("/page3.html")
def get_page3():
    return FileResponse(os.path.join(script_dir, "page3.html"))

# API Endpoints
@app.get("/api/broadcast-data") #removed async because it was causing problems (see #*1)
def get_broadcast_data():
    if not os.path.exists(broadcast_dir):
        return []
    
    file_map = {}

    for root, dirs, files in os.walk(broadcast_dir):
        for file in files:
            rel_path = os.path.relpath(os.path.join(root, file), broadcast_dir)
            parts = rel_path.split(os.sep)

            # Handles files placed directly in Broadcast-Data as well as subfolders
            if len(parts) >= 2:
                folder_name = parts[0]
            else:
                folder_name = "General Broadcasts"

            base_name = os.path.splitext(file)[0]
            ext = os.path.splitext(file)[1].lower().replace('.', '')
            unique_key = f"{folder_name}/{base_name}"
            
            if unique_key not in file_map:
                date_str = extract_date_from_name(base_name)
                file_map[unique_key] = {
                    "folder": folder_name,
                    "series": base_name,
                    "date": date_str,
                    "videoPath": None,
                    "subtitlePath": None,
                    "sentiment": None
                }

            # Normalize path for web browser consumption
            clean_rel = rel_path.replace(os.sep, '/')
            web_path = f"/Broadcast-Data/{clean_rel}"

            if ext in ['mp4', 'mkv', 'mov', 'avi', 'ts', 'm4v', 'mp3', 'wav', 'm4a', 'flac']:
                file_map[unique_key]["videoPath"] = web_path
            elif ext == 'json':
                file_map[unique_key]["subtitlePath"] = web_path
                # Cached after the first read - see get_subtitle_data() above
                sentiment, _ = get_subtitle_data(os.path.join(root, file))
                file_map[unique_key]["sentiment"] = sentiment

    return [item for item in file_map.values() if item["videoPath"] or item["subtitlePath"]]

@app.get("/api/search-subtitles")
def search_subtitles(q: str):
    # Keyword search - checks every subtitle file for a keyword and returns each matching line
    # along with the lines immediately before and after for context
    # Uses the same cache as /api/broadcast-data, so repeat searches should be near-instant
    query = q.strip().lower()
    if not query or not os.path.exists(broadcast_dir):
        return []

    matches = []
    for root, dirs, files in os.walk(broadcast_dir):
        for file in files:
            if not file.lower().endswith(".json"):
                continue

            rel_path = os.path.relpath(os.path.join(root, file), broadcast_dir)
            parts = rel_path.split(os.sep)
            folder_name = parts[0] if len(parts) >= 2 else "General Broadcasts"
            base_name = os.path.splitext(file)[0]
            date_str = extract_date_from_name(base_name)

            _, segments = get_subtitle_data(os.path.join(root, file))

            for i, seg in enumerate(segments):
                if query in seg["text"].lower():
                    matches.append({
                        "folder": folder_name,
                        "series": base_name,
                        "date": date_str,
                        "text": seg["text"],
                        "contextBefore": segments[i - 1]["text"] if i > 0 else "",
                        "contextAfter": segments[i + 1]["text"] if i < len(segments) - 1 else "",
                        "start": seg["start"],
                        "sentiment": seg["sentiment"]
                    })

    matches.sort(key=lambda m: (m["date"], m["start"] if m["start"] is not None else 0))
    return matches

class SentimentRequest(BaseModel):
    text: str

class TranscriptionRequest(BaseModel):
    input_path: str
    hf_token: str
    
class LiveCaptureRequest(BaseModel):
    station_name: str
    stream_url: str
    duration: int
    hf_token: str

@app.post("/api/sentiment")
def analyze_sentiment(data: SentimentRequest):
    return {"score": score_text(data.text)}
    
@app.post("/api/transcribe")
async def start_transcription(data: TranscriptionRequest):
    # clean up the incoming input directory string
    input_dir = data.input_path.strip('"').strip("'")
    if not os.path.isdir(input_dir):
        raise HTTPException(status_code=400, detail="Provided broadcast folder path does not exist.")
    
    # automatically determine output path and script location
    output_dir = input_dir
    batch_script = os.path.join(script_dir, "WhisperXDiarize.bat")
    venv_dir = os.path.join(script_dir, "whisperx-env")
    
    if not os.path.exists(venv_dir):
        raise HTTPException(status_code=500, detail="Python virtual environment 'whisperx-env' missing.")
    
    if not os.path.exists(batch_script):
        raise HTTPException(status_code=500, detail="Core execution batch script asset missing.")
    
    try:
        # Popen fires the process in the background, allowing the browser to immediately get a success confirmation instead of freezing/timing out.
        subprocess.Popen([batch_script, input_dir, output_dir, data.hf_token, venv_dir], shell=True)
        return {"status": "Processing initiated", "output_folder": output_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Background worker for handling Live Streams and auto-handoff
def capture_and_transcribe(station_name: str, stream_url: str, duration: int, hf_token: str):
    # Determine the appropriate media container based on the stream source
    ext = "mp4"
    if "rte.ie" in stream_url:
        ext = "mp3"
    elif "audio" in stream_url or "bbc_radio" in stream_url:
        ext = "m4a"

    out_dir = os.path.join(broadcast_dir, station_name)
    os.makedirs(out_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(out_dir, f"{station_name}_{timestamp}.{ext}")
    
    print(f"\n[LIVE INGEST] 🎥 Starting recording: {output_file} for {duration} seconds")
    
    # 1. Capture the stream locally using FFmpeg
    command = [
        "ffmpeg", "-y",
        "-i", stream_url,
        "-t", str(duration),
        "-c", "copy",
        output_file
    ]
    
    try:
        subprocess.run(command, check=True)
        print(f"[LIVE INGEST] ✅ Recording saved successfully: {output_file}")
    except subprocess.CalledProcessError as e:
        print(f"[LIVE INGEST] ❌ Error recording {station_name}: {e}")
        return
        
    # 2. Automatically feed it to the new WhisperXSingle pipeline
    batch_script = os.path.join(script_dir, "WhisperXSingle.bat")
    venv_dir = os.path.join(script_dir, "whisperx-env")
    
    if os.path.exists(venv_dir) and os.path.exists(batch_script):
        print(f"[LIVE INGEST] 🤖 Handing off to AI Transcription pipeline for {output_file}...")
        subprocess.Popen([batch_script, output_file, out_dir, hf_token, venv_dir], shell=True)
    else:
        print(f"[LIVE INGEST] ❌ Cannot transcribe: Environment or WhisperXSingle.bat missing.")

@app.post("/api/live-capture")
async def start_live_capture(data: LiveCaptureRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        capture_and_transcribe, 
        data.station_name, 
        data.stream_url, 
        data.duration, 
        data.hf_token
    )
    return {"status": "Live capture initiated", "target": data.station_name}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
    
#*1) Changed "async def" to standard "def" so FastAPI uses background worker threads.
    # I was having repeated errors where the network shows tasks like sentiment analysis and loading files as (Pending) constantly with no progress.
    # In FastAPI, when you mark a function as async def, FastAPI expects you to use asynchronous non-blocking code inside it. However, inside get_broadcast_data(), I was running synchronous disk commands.
  
#*2) Keyed on modification time, so an edited/re-transcribed file is automatically
    # picked up next time it's requested, while an unchanged file is served straight from memory.
    # This is the fix for /api/broadcast-data being slow: without it, every
    # single request re-reads and re-scores every subtitle file in the whole
    # library from scratch, every time.
    
#*3) FastAPI's BackgroundTasks feature allows the server to silently record the stream 
    # using FFmpeg and then transcribe it by executing WhisperXSingle.bat upon completion, 
    # while still being connected to the dashboard.