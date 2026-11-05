# AI PDF Chatbot & Agent Powered by LangChain and LangGraph

A full-stack, stateful AI PDF Chatbot and Autonomous Agent platform built with **LangChain**, **LangGraph**, **FastAPI**, and a modern dark-neon glassmorphism web UI.

---

## 🌟 Key Features

1. **LangGraph Stateful Agent Architecture**:
   - Built on `langgraph.graph.StateGraph` with explicit nodes: **Intent Router**, **Hybrid PDF Retriever**, **Self-RAG Evaluator**, **Sub-Tool Executor**, and **Answer Synthesizer**.
   - Real-time execution step tracking badge and progress indicator in the UI (`Router ➔ Retriever ➔ Self-RAG ➔ Synthesizer`).

2. **Hybrid Cosine Vector & BM25 Keyword Search**:
   - Parses multi-page PDF files, extracts page numbers and text blocks.
   - Dual search algorithm combining vector similarity and exact BM25 keyword matching for high-precision RAG retrieval.

3. **Interactive Dark Glassmorphism Split UI**:
   - **Left Panel**: Integrated PDF viewer (PDF.js canvas), document switcher tab bar, and RAG chunk inspector.
   - **Right Panel**: Real-time streaming chat workspace with markdown rendering and interactive **Page Citation Pills** `[Doc 1, Page 3]`.

4. **Specialized Analytical Tools**:
   - **Summarize PDF**: Generates multi-bullet executive summaries and key takeaways.
   - **Create Quiz**: Generates interactive 5-question multiple-choice quizzes based on PDF content.
   - **Extract Data Table**: Pulls financial numbers, SLAs, and technical metrics into Markdown tables.

5. **Multi-Model LLM Provider Support**:
   - Support for **Google Gemini 2.5 Flash**, **OpenAI GPT-4o Mini**, and **Smart Demo Mode** (zero API key setup required for instant offline testing!).

---

## 📁 Project Structure

```
.
├── backend/
│   ├── main.py                  # FastAPI server, endpoints & SSE streaming
│   ├── agent/
│   │   ├── graph.py             # LangGraph StateGraph topology definition
│   │   ├── nodes.py             # LangGraph node handler functions
│   │   └── tools.py             # Specialized tools (Summary, Quiz, Table Extractor)
│   └── rag/
│       ├── indexer.py           # Hybrid vector store & PDF reader
│       └── samples.py           # Sample document generator
├── static/
│   ├── index.html               # Main single-page web app
│   ├── style.css                # Premium dark glassmorphism design system
│   └── app.js                   # Web UI interactions, PDF reader, SSE listener
├── app.py                       # Main application runner
├── requirements.txt             # Python dependencies
└── README.md                    # Documentation
```

---

## 🚀 Quick Start Guide

### 1. Activate Virtual Environment & Install Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Launch the Application
```bash
python3 app.py
```
The server will start on `http://127.0.0.1:8000` and automatically open your web browser.

---

## 📊 LangGraph Workflow Topology

```
                  ┌──────────────┐
                  │  USER INPUT  │
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │ Intent Router│
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │ PDF Retriever│
                  └──────┬───────┘
                         │
               ┌─────────▼──────────┐
               │ Self-RAG Evaluator │
               └─────────┬──────────┘
                         │
         ┌───────────────┴───────────────┐
         │ (Intent Branching)            │
 ┌───────▼────────┐             ┌────────▼─────────┐
 │ Sub-Tool Exec  │             │Answer Synthesizer│
 └───────┬────────┘             └────────┬─────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                  ┌──────▼───────┐
                  │ Client Stream│
                  └──────────────┘
```
