# 🤖 NovaMind AI — Interactive ChatGPT-Grade Study Planner & Chatbot

An interactive, responsive, and full-context chatbot and study planning assistant built with **FastAPI**, **Vanilla HTML/CSS/JS**, and **OpenRouter AI models** (`openrouter/free`, `google/gemma`, `qwen`, etc.).

---

## ✨ Features

- 💬 **ChatGPT-Grade Interface**: Dark Obsidian & Slate theme, smooth frosted glass cards, Google Fonts (*Outfit*, *Inter*, *JetBrains Mono*), and responsive mobile layout.
- 🧠 **Authentic Multi-Turn Context Memory**: Every conversation turn, answer, and follow-up question is stored and passed directly to the LLM context window.
- ⚡ **Real-Time Token Streaming**: Real-time Server-Sent Events (SSE) streaming with sub-second Time-To-First-Token (TTFT).
- 📚 **Smart Study Planner Agent**: Breaks down learning goals into phased roadmaps with interactive, clickable checklists (`- [ ]`).
- 🔍 **Context Window Inspector**: Inspect the exact JSON `messages` array loaded in the AI model's context memory.
- 💻 **Syntax Highlighting & Quick Copy**: Clean code block rendering with language chips and one-click copy buttons.
- 🎙️ **Voice Input & TTS**: Speech-to-Text dictation via Web Speech API and text-to-speech "Read Aloud" button.
- 📁 **Chat Management**: Multi-session history in local storage, session renaming, deletion, and Markdown export.
- 🛡️ **Auto-Fallback Engine**: Automatically re-routes if a selected free model experiences high load or changes tiers.

---

## 🏗️ Project Architecture

```
d:\python\agent\
├── agent.py              # Core agent logic, context builder, and OpenRouter streaming
├── server.py             # FastAPI backend with SSE streaming & context endpoints
├── run_app.py            # Launcher script that boots server and opens Chrome
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variable template
├── .gitignore            # Protects secrets (.env) and excludes build artifacts
└── static\
    ├── index.html        # Modern chat interface structure
    ├── style.css         # Dark theme, glassmorphism, responsive styles
    └── app.js            # Streaming client, markdown parser, and state management
```

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/rivesh-kumar/AI-Chatbot.git
cd AI-Chatbot
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API Key
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Add your free [OpenRouter API Key](https://openrouter.ai/keys):
```ini
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```
*(You can also paste your API key directly in the web UI Settings modal ⚙️)*

### 4. Launch the Application
Run the launcher to start the server and automatically open Google Chrome:
```bash
python run_app.py
```
Open your browser at **`http://127.0.0.1:8000`**.

---

## 🖥️ Terminal (CLI) Mode
You can also run the agent directly in your command line:
```bash
python agent.py
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
"# AI-Chatbot" 
