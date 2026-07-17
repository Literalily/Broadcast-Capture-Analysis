from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import subprocess

app = FastAPI()

# Enable CORS so your local HTML file dashboard can talk to this server safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranscriptionRequest(BaseModel):
    input_path: str
    hf_token: str
    
@app.get("/")
async def get_dashboard():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(script_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "index.html not found in server root folder."}

@app.post("/api/transcribe")
async def start_transcription(data: TranscriptionRequest):
    # 1. Clean up the incoming input directory string
    input_dir = data.input_path.strip('"').strip("'")
    
    if not os.path.isdir(input_dir):
        raise HTTPException(status_code=400, detail="Provided broadcast folder path does not exist.")
    
    # 2. Automatically determine output path and script location
    output_dir = input_dir
    script_dir = os.path.dirname(os.path.abspath(__file__))
    batch_script = os.path.join(script_dir, "WhisperXDiarize.bat")
    
    # DYNAMIC VENV CHECK: Look for the environment next to this server file
    venv_dir = os.path.join(script_dir, "whisperx-env")
    
    # Fallback to absolute path if not found in the relative project directory
    if not os.path.exists(venv_dir):
        raise HTTPException(
            status_code=500, 
            detail="Python virtual environment 'whisperx-env' missing from project root. Please run setup."
        )
        
    if not os.path.exists(batch_script):
        raise HTTPException(status_code=500, detail="Core execution batch script asset missing from server root.")

    try:
        # Popen fires the process in the background, allowing the browser 
        # to immediately get a success confirmation instead of freezing/timing out.
        subprocess.Popen([batch_script, input_dir, output_dir, data.hf_token, venv_dir], shell=True)
        return {"status": "Processing initiated", "output_folder": output_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Start the server on localhost port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)