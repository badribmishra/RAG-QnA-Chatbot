import io
import time
from typing import List, Dict, Any
from backend.rag.indexer import PDFDocument

def create_simple_pdf_bytes(title: str, pages_text: List[str]) -> bytes:
    """
    Generates a valid, clean PDF binary buffer containing formatted text pages 
    without needing external binary dependencies.
    """
    pdf_buffer = io.BytesIO()
    
    # Simple PDF standard headers and structure generator
    objects = []
    
    # Obj 1: Catalog
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
    
    # We will compute total objects
    num_pages = len(pages_text)
    page_refs = " ".join([f"{i*2 + 3} 0 R" for i in range(num_pages)])
    
    # Obj 2: Pages tree
    objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{page_refs}] /Count {num_pages} >>\nendobj")
    
    # For each page, create Page Object and Content Stream Object
    for i, page_content in enumerate(pages_text):
        page_obj_num = i * 2 + 3
        content_obj_num = i * 2 + 4
        
        # Escape parenthesis for PDF string format
        cleaned_text = page_content.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        lines = cleaned_text.split("\n")
        
        # Build text drawing stream
        stream_lines = [
            "BT",
            "/F1 12 Tf",
            "14 TL",
            "50 750 Td",
            f"({title} - Page {i+1}) Tj",
            "T*",
            "T*",
        ]
        
        for line in lines:
            if line.startswith("# "):
                stream_lines.append("/F1 16 Tf")
                stream_lines.append(f"({line[2:]}) Tj")
                stream_lines.append("/F1 12 Tf")
                stream_lines.append("T*")
            elif line.startswith("## "):
                stream_lines.append("/F1 14 Tf")
                stream_lines.append(f"({line[3:]}) Tj")
                stream_lines.append("/F1 12 Tf")
                stream_lines.append("T*")
            else:
                # Wrap text lines cleanly at word boundaries
                import textwrap
                wrapped = textwrap.wrap(line, width=80) if line else [""]
                for w in wrapped:
                    stream_lines.append(f"({w}) Tj")
                    stream_lines.append("T*")
        
        stream_lines.append("ET")
        stream_content = "\n".join(stream_lines)
        stream_bytes = stream_content.encode("latin1", errors="replace")
        
        page_obj = f"{page_obj_num} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents {content_obj_num} 0 R >>\nendobj"
        content_obj = f"{content_obj_num} 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n{stream_content}\nendstream\nendobj"
        
        objects.append(page_obj)
        objects.append(content_obj)

    # Write PDF file structure
    pdf_buffer.write(b"%PDF-1.4\n")
    offsets = []
    
    for obj in objects:
        offsets.append(pdf_buffer.tell())
        pdf_buffer.write(obj.encode("latin1", errors="replace"))
        pdf_buffer.write(b"\n")
        
    xref_offset = pdf_buffer.tell()
    pdf_buffer.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin1"))
    
    for offset in offsets:
        pdf_buffer.write(f"{offset:010d} 00000 n \n".encode("latin1"))
        
    pdf_buffer.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("latin1"))
    
    return pdf_buffer.getvalue()


SAMPLE_DOCUMENTS = {
    "sample_langgraph_ai": {
        "title": "Autonomous AI Agents with LangChain & LangGraph Framework",
        "filename": "LangGraph_AI_Agents_Research.pdf",
        "pages": [
            """# Autonomous AI Agents & LangGraph Framework
Executive Summary: Modern generative AI architectures are rapidly shifting from single-prompt LLM completion calls to stateful multi-agent workflows. Frameworks like LangChain and LangGraph provide graph-based cyclic state management, allowing autonomous agents to execute complex reasoning loops, call external vector tools, self-correct errors, and maintain transactional memory across multi-step execution graphs.

## Core Capabilities of LangGraph
1. Stateful Execution Graphs: Represents agent decision pathways as explicit nodes (actions) and directed edges (conditional transitions).
2. Cyclic Reasoning Loops: Enables Self-RAG, where an agent retrieves knowledge, evaluates its quality, and loops back to rewrite search queries if retrieval confidence is low.
3. Structured Tool Calling: Integrates API endpoints, databases, code execution sandboxes, and PDF vector indices.
4. Streaming State Updates: Exposes token streaming and node transition notifications in real-time to front-end client user interfaces.""",

            """## Self-RAG and Corrective RAG Design Patterns
Standard Retrieval-Augmented Generation (RAG) often suffers from noisy or irrelevant document retrieval. LangGraph solves this through Corrective RAG (CRAG) and Self-RAG.

### Step-by-Step Workflow:
- Step 1 (Intent Router): Classifies user prompt into domain query, document summarization, or tool request.
- Step 2 (Retriever Node): Queries top-k vector index and BM25 keyword index for relevant context chunks.
- Step 3 (Self-RAG Evaluator): Evaluates chunk relevance score. If context score is below threshold (0.65), routes request to Query Rewriter.
- Step 4 (Synthesizer Node): Generates accurate response with strict in-line page citations [Doc ID, Page Number].

### Multi-Agent Collaboration
In multi-agent setups, specialized agents (Researcher, Code Tester, Reviewer) pass state updates back and forth via a centralized StateGraph dictionary, ensuring deterministic and audit-logged operations."""
        ]
    },
    "sample_fintech_q4": {
        "title": "Global Tech Corp Q4 Financial & Operations Report",
        "filename": "Global_Tech_Q4_Financial_Report.pdf",
        "pages": [
            """# Global Tech Corp Q4 Financial Report
Financial Performance Overview: Global Tech Corp achieved strong financial results in Q4 2025, driven by enterprise AI adoption and cloud SaaS subscription expansion. Total revenue reached $42.5 Million, representing a 24.8% YoY growth compared to Q4 2024 ($34.0 Million). Net Operating Income stood at $9.2 Million with Gross Profit Margin expanding to 72.4%.

## Key Financial Highlights & Operational Metrics
- Annual Recurring Revenue (ARR): Reached $168.0 Million by end of fiscal year.
- Customer Acquisition Cost (CAC): Decreased by 12.5% to $142 per enterprise account.
- Net Revenue Retention (NRR): Sustained at a healthy 118.5%.
- Cloud Infrastructure Capital Expenditure: $4.8 Million invested in GPU clusters and vector storage datacenters.
- Operating EBITDA: $11.4 Million (+18.4% YoY).""",

            """## Regional Segment Breakdown & Risk Factors
Enterprise revenue distribution by key geographic markets:
1. North America: $24.2 Million (57% of total revenue)
2. European Union & UK: $11.8 Million (28% of total revenue)
3. Asia-Pacific & Japan: $6.5 Million (15% of total revenue)

### Strategic Initiatives and Q1 2026 Guidance
- Cloud Migration Roadmap: Completion of legacy database migration to serverless PostgreSQL and vector embeddings cluster by Q2.
- Guidance for Q1 2026: Projecting consolidated quarterly revenue between $44.0M and $46.5M.
- Key Risk Factors: Foreign currency exchange volatility in EU markets and semiconductor hardware supply lead times."""
        ]
    },
    "sample_cloud_sla": {
        "title": "Enterprise Cloud Platform Service Level Agreement & Compliance",
        "filename": "Enterprise_Cloud_SLA_Contract.pdf",
        "pages": [
            """# Enterprise Cloud Platform SLA & Security Contract
Section 1: Service Availability Commitment
Provider guarantees a Monthly Uptime Percentage of at least 99.99% for all production API services, database nodes, and vector search clusters. Monthly Uptime is calculated as total minutes in a calendar month minus total Downtime minutes divided by total minutes.

## Service Credit Schedule for Downtime
- Less than 99.99% but >= 99.90%: 10% Service Credit refund on monthly invoice.
- Less than 99.90% but >= 99.00%: 25% Service Credit refund on monthly invoice.
- Less than 99.00%: 50% Service Credit refund on monthly invoice.

## Section 2: Support Response Times (SLAs)
- Priority 1 (Critical Outage): Initial response within 15 minutes. 24x7 support team engagement.
- Priority 2 (High Impact): Initial response within 1 hour.
- Priority 3 (Standard Inquiry): Initial response within 4 business hours.""",

            """## Section 3: Data Security, Privacy & AES-256 Standards
- Data Encryption: All customer data at rest is encrypted using AES-256 standard. Data in transit across public networks is secured via TLS 1.3 protocol.
- Compliance Certifications: Provider maintains active SOC 2 Type II, ISO 27001, HIPAA, and GDPR compliance certifications with annual third-party audits.
- Data Retention & Backup: Differential backups taken every 6 hours, with full weekly backups retained for 90 days across redundant geographic zones.

## Section 4: Limitation of Liability
Neither party shall be liable for indirect, incidental, or consequential damages exceeding the total fees paid by Customer during the 12-month period preceding the claim."""
        ]
    }
}


def load_sample_pdfs_into_store(vector_store) -> List[PDFDocument]:
    """Generates sample PDFs and indexes them into the vector store."""
    loaded_docs = []
    current_time = time.strftime("%Y-%m-%d %H:%M:%S")

    for key, info in SAMPLE_DOCUMENTS.items():
        if key in vector_store.documents:
            loaded_docs.append(vector_store.documents[key])
            continue
            
        pdf_bytes = create_simple_pdf_bytes(info["title"], info["pages"])
        doc = vector_store.add_pdf(
            doc_id=key,
            filename=info["filename"],
            pdf_bytes=pdf_bytes,
            upload_time=current_time
        )
        loaded_docs.append(doc)
        
    return loaded_docs
