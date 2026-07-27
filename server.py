from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os
import re
import json
import subprocess

DATE_PATTERN = re.compile(r"(19\d{2}|20\d{2}|2100)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])")

def extract_date_from_name(base_name: str) -> str:
    match = DATE_PATTERN.search(base_name)
    if match and len(match.groups()) == 3:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return "00-00-0000"

# VADER analyzer instance
sentiment_analyzer = SentimentIntensityAnalyzer()

def score_text(text: str):
    # """Returns a -1.0..1.0 compound sentiment score for a chunk of text, or
    # None if there's nothing usable to score."""
    if not text or not text.strip():
        return None
    scores = sentiment_analyzer.polarity_scores(text)
    return round(scores["compound"], 2)

def score_subtitle_file(file_path: str):
    # Reads subtitle JSON file from disk and returns its overall sentiment score. 
    # Returns None on any read/parse error rather than raising, so one bad file can't break the whole broadcast listing.
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        segments = data if isinstance(data, list) else data.get("segments", [])
        if not segments:
            return None
        
        # Faster (reads it all at once) ============
        full_text = " ".join(
            (seg.get("text") or "").strip()
            for seg in segments
            if (seg.get("text") or "").strip()
        )
        
        if not full_text:
            return None
        
        return score_text(full_text)
        # ==========================================
    
        # Slower (line by line) ====================
        # segment_scores = []
        # for seg in segments:
        #     txt = (seg.get("text") or "").strip()
        #     if txt:
        #         # scores each line individually
        #         compound = sentiment_analyzer.polarity_scores(txt)["compound"]
        #         segment_scores.append(compound)
                
        # if not segment_scores:
        #     return None
        
        # # return avergae sentiment across all lines
        # avg_score = sum(segment_scores) / len(segment_scores)
        # return round(avg_score, 2)

    except Exception as e:
        print(f"Warning: could not score sentiment for {file_path}: {e}")
        return None

app = FastAPI()

# Enable CORS so your local HTML file dashboard can talk to this server safely
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
    # Try lowercase fallback if Broadcast-data was created instead
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

            if ext in ['mp4', 'mkv', 'mov', 'avi', 'ts', 'm4v', 'mp3', 'wav', 'flac']:
                file_map[unique_key]["videoPath"] = web_path
            elif ext == 'json':
                file_map[unique_key]["subtitlePath"] = web_path
                # Pre-calculate line-averaged sentiment instantly on backend scan
                file_map[unique_key]["sentiment"] = score_subtitle_file(os.path.join(root, file))

    return [item for item in file_map.values() if item["videoPath"] or item["subtitlePath"]]

class SentimentRequest(BaseModel):
    text: str

class TranscriptionRequest(BaseModel):
    input_path: str
    hf_token: str

@app.post("/api/sentiment")
def analyze_sentiment(data: SentimentRequest):
    return {"score": score_text(data.text)}
    
@app.post("/api/transcribe")
async def start_transcription(data: TranscriptionRequest):
    input_dir = data.input_path.strip('"').strip("'")
    if not os.path.isdir(input_dir):
        raise HTTPException(status_code=400, detail="Provided broadcast folder path does not exist.")
    
    output_dir = input_dir
    batch_script = os.path.join(script_dir, "WhisperXDiarize.bat")
    venv_dir = os.path.join(script_dir, "whisperx-env")
    
    if not os.path.exists(venv_dir) or not os.path.exists(batch_script):
        raise HTTPException(status_code=500, detail="Backend execution script or environment missing.")

    try:
        # Popen fires the process in the background, allowing the browser to immediately get a success confirmation instead of freezing/timing out.
        subprocess.Popen([batch_script, input_dir, output_dir, data.hf_token, venv_dir], shell=True)
        return {"status": "Processing initiated", "output_folder": output_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
    
    
#*1) Changed "async def" to standard "def" so FastAPI uses background worker threads. 
    # I was having repeated errors where the network shows tasks like sentiment analysis and loading files as (Pending) constantly with no progress. 
    # In FastAPI, when you mark a function as async def, FastAPI expects you to use asynchronous non-blocking code inside it. However, inside get_broadcast_data(), I was running synchronous disk commands.