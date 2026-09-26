import os
import sys
import time
import threading
import subprocess
import webbrowser

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import uvicorn

SERVER_URL = "http://127.0.0.1:8000"

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
]

def launch_chrome():
    time.sleep(1.2)  # Wait for uvicorn to initialize
    print(f"\n[NovaMind] Launching Google Chrome to {SERVER_URL} ...")
    
    # Try direct Chrome binary first
    for path in CHROME_PATHS:
        if os.path.exists(path):
            try:
                subprocess.Popen([path, SERVER_URL])
                print(f"[NovaMind] Opened in Google Chrome: {path}")
                return
            except Exception as e:
                print(f"[NovaMind] Notice: Could not launch directly via {path}: {e}")
                
    # Fallback to default browser
    webbrowser.open(SERVER_URL)
    print("[NovaMind] Opened in default browser.")

if __name__ == "__main__":
    print("=" * 60)
    print(" NOVAMIND AI - CHATGPT-GRADE INTERFACE & STUDY AGENT")
    print(f" Server running at: {SERVER_URL}")
    print(" Zero-Delay Response Engine & SSE Streaming Active")
    print("=" * 60)
    
    # Launch browser in a background thread
    threading.Thread(target=launch_chrome, daemon=True).start()
    
    # Run uvicorn server
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
