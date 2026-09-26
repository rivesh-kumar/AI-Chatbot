import json
import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import agent

app = FastAPI(
    title="NovaMind AI - ChatGPT-Grade Context Agent",
    description="Interactive conversational interface with authentic multi-turn context memory powered by agent.py",
    version="2.0.0"
)

# Enable CORS for local cross-origin development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class ChatRequest(BaseModel):
    goal: str
    history: Optional[List[Dict[str, str]]] = None
    api_key: Optional[str] = None
    model: Optional[str] = agent.DEFAULT_MODEL
    system_instruction: Optional[str] = None

class SaveKeyRequest(BaseModel):
    api_key: str

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>NovaMind AI UI is initializing...</h1>")

@app.get("/api/config")
async def get_config():
    """Returns environment configuration status."""
    has_key = bool(os.getenv("OPENROUTER_API_KEY") and os.getenv("OPENROUTER_API_KEY").strip())
    return JSONResponse({
        "has_env_key": has_key,
        "default_model": agent.DEFAULT_MODEL,
        "default_system_prompt": agent.DEFAULT_SYSTEM_PROMPT
    })

@app.post("/api/save-key")
async def save_api_key(req: SaveKeyRequest):
    """Saves the OpenRouter API key to local .env file."""
    key = req.api_key.strip()
    if not key:
        return JSONResponse({"status": "error", "message": "Key cannot be empty."}, status_code=400)
    
    os.environ["OPENROUTER_API_KEY"] = key
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(f"OPENROUTER_API_KEY={key}\n")
        
    return JSONResponse({"status": "success", "message": "API key saved to .env file and active environment."})

@app.post("/api/context/inspect")
async def inspect_context(req: ChatRequest):
    """Returns the exact messages array that will be sent to the AI model."""
    messages = agent.build_messages_context(
        goal=req.goal,
        history=req.history,
        system_instruction=req.system_instruction
    )
    return JSONResponse({
        "messages": messages,
        "total_messages": len(messages),
        "system_prompt": messages[0]["content"] if messages else None,
        "history_turns": len(messages) - 2 if len(messages) >= 2 else 0
    })

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """Synchronous chat endpoint with authentic context."""
    plan = agent.study_agent(
        goal=req.goal,
        history=req.history,
        api_key=req.api_key,
        model=req.model or agent.DEFAULT_MODEL,
        system_instruction=req.system_instruction
    )
    return JSONResponse({
        "status": "success",
        "response": plan,
        "model": req.model
    })

@app.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """
    Real-time Server-Sent Events (SSE) streaming endpoint.
    Passes genuine multi-turn context directly to OpenRouter.
    """
    def event_generator():
        stream_gen = agent.study_agent_stream(
            goal=req.goal,
            history=req.history,
            api_key=req.api_key,
            model=req.model or agent.DEFAULT_MODEL,
            system_instruction=req.system_instruction
        )
        for data in stream_gen:
            payload = json.dumps(data)
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/models")
async def get_available_models():
    """List of verified free and popular OpenRouter models."""
    return JSONResponse([
        {
            "id": "openrouter/free",
            "name": "OpenRouter Free (Auto-Router)",
            "provider": "OpenRouter",
            "speed": "⚡ Fast & Reliable",
            "context": "200k tokens",
            "recommended": True
        },
        {
            "id": "google/gemma-4-31b-it:free",
            "name": "Google Gemma 4 31B (Free)",
            "provider": "Google",
            "speed": "High Quality",
            "context": "262k tokens",
            "recommended": True
        },
        {
            "id": "qwen/qwen3.8-27b:free",
            "name": "Qwen 3.8 27B (Free)",
            "provider": "Alibaba",
            "speed": "Smart & Accurate",
            "context": "262k tokens",
            "recommended": False
        },
        {
            "id": "nvidia/nemotron-3.5-lightning:free",
            "name": "NVIDIA Nemotron 3.5 (Free)",
            "provider": "NVIDIA",
            "speed": "Lightning Fast",
            "context": "1M tokens",
            "recommended": False
        },
        {
            "id": "cohere/north-mini-code:free",
            "name": "Cohere North Mini Code (Free)",
            "provider": "Cohere",
            "speed": "Coding Specialist",
            "context": "256k tokens",
            "recommended": False
        },
        {
            "id": "liquid/lfm-2.5-2.6b:free",
            "name": "LiquidAI LFM 2.6B (Free)",
            "provider": "LiquidAI",
            "speed": "Compact & Fast",
            "context": "65k tokens",
            "recommended": False
        },
        {
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Meta Llama 3.3 70B (Paid Tier)",
            "provider": "Meta",
            "speed": "Top Tier",
            "context": "131k tokens",
            "recommended": False
        }
    ])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
