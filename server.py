from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import subprocess
from datetime import datetime

app = FastAPI()

# Enable CORS so your local HTML file dashboard can talk to this server safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

script_dir = os.path.dirname(os.path.abspath(__file__))
# mount static asset folders
css_dir = os.path.join(script_dir, "css")
if os.path.exists(css_dir):
    app.mount("/css", StaticFiles(directory=css_dir), name="css")

js_dir = os.path.join(script_dir, "js")
if os.path.exists(js_dir):
    app.mount("/js", StaticFiles(directory=js_dir), name="js")

assets_dir = os.path.join(script_dir, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

broadcast_dir = os.path.join(script_dir, "Broadcast-Data")
if os.path.exists(broadcast_dir):
    app.mount("/Broadcast-Data", StaticFiles(directory=broadcast_dir), name="broadcast-data")

# html page routes
@app.get("/")
async def get_dashboard():
    index_path = os.path.join(script_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "index.html not found in server root folder."}

@app.get("/page2.html")
async def get_page2():
    page2_path = os.path.join(script_dir, "page2.html")
    if os.path.exists(page2_path):
        return FileResponse(page2_path)
    return {"error": "page2.html not found in server root folder."}

# API endpoints
@app.get("/api/broadcast-data")
async def get_broadcast_data():
    if not os.path.exists(broadcast_dir):
        return []
    
    file_map = {}

    for root, dirs, files in os.walk(broadcast_dir):
        for file in files:
            rel_path = os.path.relpath(os.path.join(root, file), broadcast_dir)
            parts = rel_path.split(os.sep)

            if len(parts) >= 2:
                folder_name = parts[0]
                base_name = os.path.splitext(file)[0]
                ext = os.path.splitext(file)[1].lower().replace('.', '')
                unique_key = f"{folder_name}/{base_name}"

                if unique_key not in file_map:
                    mod_time = os.path.getmtime(os.path.join(root, file))
                    date_str = datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d')
                    file_map[unique_key] = {
                        "folder": folder_name,
                        "series": base_name,
                        "date": date_str,
                        "videoPath": None,
                        "subtitlePath": None
                    }

                web_path = f"/Broadcast-Data/{folder_name}/{file}"
                if ext in ['mp4', 'mkv', 'mov', 'avi', 'ts', 'm4v', 'mp3', 'wav', 'flac']:
                    file_map[unique_key]["videoPath"] = web_path
                elif ext == 'json':
                    file_map[unique_key]["subtitlePath"] = web_path

    return [item for item in file_map.values() if item["videoPath"] or item["subtitlePath"]]

class TranscriptionRequest(BaseModel):
    input_path: str
    hf_token: str
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)