from typing import Dict, Any, List, TypedDict, Literal
from langgraph.graph import StateGraph, END
from backend.agent.nodes import (
    router_node,
    retrieval_node,
    self_rag_evaluator,
    execute_tool_node,
    answer_synthesizer
)

class AgentState(TypedDict):
    query: str
    doc_filter: str
    intent: str
    retrieved_chunks: List[Any]
    citations: List[Dict[str, Any]]
    context_quality: str
    final_answer: str
    step_history: List[Dict[str, Any]]

def route_next_node(state: AgentState) -> Literal["execute_tool", "synthesizer"]:
    """Conditional edge router based on user intent."""
    intent = state.get("intent", "qa")
    if intent in ["summary", "quiz", "table_extract"]:
        return "execute_tool"
    return "synthesizer"


def build_pdf_agent_graph(vector_store: Any):
    """
    Constructs and compiles the LangGraph StateGraph workflow for PDF analysis.
    
    Graph Topology:
          [START]
             │
      ┌──────▼──────┐
      │ Intent Router│
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │ PDF Retriever│
      └──────┬──────┘
             │
    ┌────────▼────────┐
    │ Self-RAG Eval   │
    └────────┬────────┘
             │ (conditional branch)
      ┌──────┴──────────────┐
      │                     │
┌─────▼───────┐    ┌────────▼────────┐
│ Tool Exec   │    │ Answer Synthesizer│
└─────┬───────┘    └────────┬────────┘
      │                     │
      └──────────┬──────────┘
                 │
               [END]
    """
    workflow = StateGraph(AgentState)

    # 1. Define Nodes
    workflow.add_node("router", router_node)
    
    # Wrap vector_store inside closures
    def retriever_bound(state):
        return retrieval_node(state, vector_store)
        
    def tool_bound(state):
        return execute_tool_node(state, vector_store)

    workflow.add_node("retriever", retriever_bound)
    workflow.add_node("self_rag", self_rag_evaluator)
    workflow.add_node("execute_tool", tool_bound)

    # Synthesizer is passed dynamic runtime arguments in execute_graph
    def synth_bound(state):
        # Default placeholder node; actual call with provider key happens in runner
        return state

    workflow.add_node("synthesizer", synth_bound)

    # 2. Define Edges
    workflow.set_entry_point("router")
    workflow.add_edge("router", "retriever")
    workflow.add_edge("retriever", "self_rag")

    workflow.add_conditional_edges(
        "self_rag",
        route_next_node,
        {
            "execute_tool": "execute_tool",
            "synthesizer": "synthesizer"
        }
    )

    workflow.add_edge("execute_tool", END)
    workflow.add_edge("synthesizer", END)

    compiled_graph = workflow.compile()
    return compiled_graph


def run_agent_workflow(
    vector_store: Any,
    query: str,
    doc_filter: str = None,
    api_keys: Dict[str, str] = None,
    model_provider: str = "demo"
) -> Dict[str, Any]:
    """
    Executes the compiled LangGraph workflow step-by-step and returns state trace & answer.
    """
    if api_keys is None:
        api_keys = {}

    # Initialize Graph State
    initial_state: AgentState = {
        "query": query,
        "doc_filter": doc_filter,
        "intent": "qa",
        "retrieved_chunks": [],
        "citations": [],
        "context_quality": "unknown",
        "final_answer": "",
        "step_history": []
    }

    # Step 1: Router
    s1 = router_node(initial_state)

    # Step 2: Retriever
    s2 = retrieval_node(s1, vector_store)

    # Step 3: Self-RAG Relevancy Evaluator
    s3 = self_rag_evaluator(s2)

    # Step 4: Branching Node
    intent = s3.get("intent", "qa")
    if intent in ["summary", "quiz", "table_extract"]:
        final_state = execute_tool_node(s3, vector_store)
    else:
        final_state = answer_synthesizer(s3, api_keys, model_provider)

    return final_state
