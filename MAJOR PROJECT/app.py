import uvicorn
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("=" * 70)
    print(" 🚀 Launching LangGraph AI PDF Chatbot & Autonomous Agent Workspace")
    print(" 🌐 Server URL: http://127.0.0.1:8000")
    print("=" * 70)
    
    # Auto-open browser tab
    threading.Thread(target=open_browser, daemon=True).start()
    
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
