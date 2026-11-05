import os
import time
import json
import asyncio
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.rag.indexer import HybridVectorStore
from backend.rag.samples import load_sample_pdfs_into_store, SAMPLE_DOCUMENTS
from backend.agent.graph import run_agent_workflow

app = FastAPI(
    title="AI PDF Chatbot & Agent (LangChain + LangGraph)",
    description="Full-stack AI PDF platform powered by LangChain and LangGraph stateful multi-agent workflows.",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Vector Store Instance
vector_store = HybridVectorStore()

# Pre-load sample PDFs on app launch
@app.on_event("startup")
def startup_event():
    print("🚀 Initializing Vector Store and loading Sample Documents...")
    load_sample_pdfs_into_store(vector_store)
    print(f"✅ Vector Store initialized with {len(vector_store.documents)} document(s) and {len(vector_store.chunks)} chunk(s).")


class ChatRequest(BaseModel):
    query: str
    doc_filter: Optional[str] = None
    model_provider: str = "demo" # "demo", "gemini", "openai"
    openai_api_key: Optional[str] = ""
    gemini_api_key: Optional[str] = ""


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "total_documents": len(vector_store.documents),
        "total_chunks": len(vector_store.chunks),
        "documents": [doc.filename for doc in vector_store.documents.values()]
    }


@app.get("/api/documents")
def list_documents():
    return {
        "documents": [doc.model_dump() for doc in vector_store.documents.values()]
    }


@app.post("/api/sample")
def load_samples():
    docs = load_sample_pdfs_into_store(vector_store)
    return {
        "status": "success",
        "message": f"Loaded {len(docs)} sample document(s).",
        "documents": [d.model_dump() for d in docs]
    }


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    doc_id = f"custom_{int(time.time())}_{file.filename.replace(' ', '_')}"
    upload_time = time.strftime("%Y-%m-%d %H:%M:%S")

    try:
        doc = vector_store.add_pdf(
            doc_id=doc_id,
            filename=file.filename,
            pdf_bytes=pdf_bytes,
            upload_time=upload_time
        )
        return {
            "status": "success",
            "message": f"Successfully indexed PDF: {file.filename}",
            "document": doc.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    if doc_id not in vector_store.documents:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    filename = vector_store.documents[doc_id].filename
    vector_store.remove_document(doc_id)
    return {
        "status": "success",
        "message": f"Document '{filename}' removed from index."
    }


@app.get("/api/documents/{doc_id}/file")
def get_document_file(doc_id: str):
    """Streams raw PDF binary buffer to the browser PDF.js canvas renderer."""
    if doc_id not in vector_store.documents:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    pdf_bytes = vector_store.get_pdf_bytes(doc_id)
    if not pdf_bytes:
        # Re-generate bytes if it's a sample document that was loaded before store update
        if doc_id in SAMPLE_DOCUMENTS:
            from backend.rag.samples import create_simple_pdf_bytes
            info = SAMPLE_DOCUMENTS[doc_id]
            pdf_bytes = create_simple_pdf_bytes(info["title"], info["pages"])
            vector_store.raw_bytes[doc_id] = pdf_bytes
        else:
            raise HTTPException(status_code=404, detail="PDF binary content not available.")
        
    doc = vector_store.documents[doc_id]
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'}
    )


@app.get("/api/graph/schema")
def get_graph_schema():
    """Returns the visual node-edge layout of the LangGraph agent for the UI."""
    return {
        "nodes": [
            {"id": "START", "label": "User Query Input", "type": "input", "description": "Trigger point for new prompt"},
            {"id": "intent_router", "label": "Intent Router", "type": "router", "description": "Classifies intent: Q&A, Summary, Quiz, Table"},
            {"id": "pdf_retriever", "label": "Hybrid PDF Retriever", "type": "retriever", "description": "Searches Cosine Vector Store + BM25"},
            {"id": "self_rag_evaluator", "label": "Self-RAG Evaluator", "type": "evaluator", "description": "Assesses chunk relevancy & quality"},
            {"id": "tool_executor", "label": "Sub-Tool Executor", "type": "tool", "description": "Generates Quiz, Summary, or Data Table"},
            {"id": "answer_synthesizer", "label": "Answer Synthesizer", "type": "llm", "description": "Formulates response with page citations"},
            {"id": "END", "label": "Final Output", "type": "output", "description": "Streams response & citations to client UI"}
        ],
        "edges": [
            {"source": "START", "target": "intent_router"},
            {"source": "intent_router", "target": "pdf_retriever"},
            {"source": "pdf_retriever", "target": "self_rag_evaluator"},
            {"source": "self_rag_evaluator", "target": "tool_executor", "condition": "intent in [summary, quiz, table]"},
            {"source": "self_rag_evaluator", "target": "answer_synthesizer", "condition": "intent == 'qa'"},
            {"source": "tool_executor", "target": "END"},
            {"source": "answer_synthesizer", "target": "END"}
        ]
    }


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """Standard REST endpoint for multi-agent reasoning."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    api_keys = {
        "openai_api_key": req.openai_api_key,
        "gemini_api_key": req.gemini_api_key
    }

    result = run_agent_workflow(
        vector_store=vector_store,
        query=req.query,
        doc_filter=req.doc_filter,
        api_keys=api_keys,
        model_provider=req.model_provider
    )

    return {
        "status": "success",
        "intent": result.get("intent", "qa"),
        "context_quality": result.get("context_quality", "unknown"),
        "answer": result.get("final_answer", ""),
        "citations": result.get("citations", []),
        "step_history": result.get("step_history", [])
    }


@app.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """Server-Sent Events (SSE) streaming endpoint for live graph step notifications."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    api_keys = {
        "openai_api_key": req.openai_api_key,
        "gemini_api_key": req.gemini_api_key
    }

    async def event_generator():
        yield f"data: {json.dumps({'type': 'step', 'node': 'START', 'detail': 'Initializing LangGraph execution state...'})}\n\n"
        await asyncio.sleep(0.15)

        # Run workflow
        result = run_agent_workflow(
            vector_store=vector_store,
            query=req.query,
            doc_filter=req.doc_filter,
            api_keys=api_keys,
            model_provider=req.model_provider
        )

        for step in result.get("step_history", []):
            yield f"data: {json.dumps({'type': 'step', 'node': step['node'], 'detail': step['detail']})}\n\n"
            await asyncio.sleep(0.2)

        # Yield citations
        yield f"data: {json.dumps({'type': 'citations', 'data': result.get('citations', [])})}\n\n"
        
        # Yield final answer
        yield f"data: {json.dumps({'type': 'answer', 'text': result.get('final_answer', '')})}\n\n"
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Mount static directory for frontend web UI
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
