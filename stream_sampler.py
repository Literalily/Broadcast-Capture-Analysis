import requests
import subprocess
import time
import os
from datetime import datetime

# --- CONFIGURATION ---
STREAMS = {
    "BBCOneNINews": {
        "url": "https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_one_northern_ireland_hd/mobile_wifi_main_hd_abr_v2.m3u8",
        "ext": "mp4"
    },
    "RTERadio1": {
        "url": "http://icecast.rte.ie/radio1",
        "ext": "mp3"
    }
}

OUTPUT_BASE_DIR = "./Broadcast-Data"
RECORD_DURATION = 1800  # Record for 30 minutes (in seconds) - hard cap per segment

def record_broadcasts():
    """Uses FFmpeg to record blocks of live streams concurrently."""
    for name, info in STREAMS.items():
        output_dir = os.path.join(OUTPUT_BASE_DIR, name)
        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"{name}_{timestamp}.{info['ext']}")

        print(f"[{datetime.now()}] 🎥 Spawning recording for: {name} -> {output_file}")

        command = [
            "ffmpeg",
            "-y",
            "-i", info["url"],
            "-t", str(RECORD_DURATION),
            "-c", "copy",
            output_file
        ]

        try:
            # Popen allows them to all run in parallel without blocking the loop
            subprocess.Popen(command)
        except Exception as e:
            print(f"[{datetime.now()}] ❌ Error initiating recording for {name}: {e}")

def is_news_time():
    now = datetime.now()
    hour = now.hour
    minute = now.minute

    if (hour == 13 and minute == 00) or \
        (hour == 18 and minute == 00):
            return True

    return False

# --- MAIN SCHEDULER LOOP ---
print("Starting Precision Schedule Multi-Stream Sampler...")

while True:
    if is_news_time():
        print(f"[{datetime.now()}] ⏰ Scheduled news time hit! Triggering recordings...")
        record_broadcasts()
        time.sleep(60)
    else:
        time.sleep(30)