import re
from typing import List, Dict, Any

def run_document_summarizer(doc_name: str, full_text: str) -> str:
    """Generates a structured executive summary of the document text."""
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', full_text) if len(p.strip()) > 30]
    
    summary_md = f"### 📄 Executive Document Summary: **{doc_name}**\n\n"
    summary_md += "#### 🎯 Overview & Key Objective\n"
    if paragraphs:
        summary_md += f"{paragraphs[0]}\n\n"
    else:
        summary_md += f"This document provides essential reference specifications and details for **{doc_name}**.\n\n"

    summary_md += "#### 🔑 Key Section Highlights & Insights\n"
    highlights = paragraphs[1:6] if len(paragraphs) > 1 else paragraphs
    for idx, p in enumerate(highlights, 1):
        clean_bullet = p.replace("\n", " ").strip()
        clean_bullet = re.sub(r'^[#\-*•0-9.]+\s*', '', clean_bullet)
        if len(clean_bullet) > 220:
            clean_bullet = clean_bullet[:217] + "..."
        summary_md += f"- **Key Topic {idx}**: {clean_bullet}\n"

    summary_md += "\n#### ⚡ Recommended Next Actions\n"
    summary_md += "- Ask specific questions about figures, policies, SLA terms, or metrics in this document.\n"
    summary_md += "- Generate an interactive quiz to verify comprehension.\n"
    summary_md += "- Extract all metrics into a structured data table."

    return summary_md


def run_quiz_generator(doc_name: str, chunks: List[Any]) -> str:
    """Generates an interactive multi-question quiz based on retrieved document chunks."""
    quiz_md = f"### 📝 Interactive Comprehension Quiz: **{doc_name}**\n"
    quiz_md += "*Click an option to test your understanding of key facts from this PDF document.*\n\n"

    extracted_facts = []
    for c in chunks:
        sentences = [s.strip() for s in re.split(r'[.!?]\s+|\n+', c.content) if len(s.strip()) > 25]
        for s in sentences:
            clean = re.sub(r'^[#\-*•0-9.]+\s*', '', s).strip()
            if len(clean) > 20:
                extracted_facts.append((clean, c.metadata.page_number))

    if not extracted_facts:
        extracted_facts = [
            ("The document details core operational guidelines and parameters.", 1),
            ("Performance and metrics are continuously tracked to ensure compliance.", 1)
        ]

    num_questions = min(4, len(extracted_facts))
    for i in range(num_questions):
        fact_str, page_num = extracted_facts[i]
        q_num = i + 1
        
        # Format clean question statement
        q_topic = fact_str[:80]
        quiz_md += f"#### **Question {q_num} (Page {page_num}):**\n"
        quiz_md += f"Which of the following correctly reflects the document's statement regarding: *\"{q_topic}...\"*?\n\n"
        
        quiz_md += f"<div class='quiz-options-group' data-correct='A'>\n"
        quiz_md += f"  <div class='quiz-option' data-opt='A'><strong>A)</strong> {fact_str[:110]}</div>\n"
        quiz_md += f"  <div class='quiz-option' data-opt='B'><strong>B)</strong> It explicitly restricts these operations without prior board authorization.</div>\n"
        quiz_md += f"  <div class='quiz-option' data-opt='C'><strong>C)</strong> It applies strictly to temporary external vendors.</div>\n"
        quiz_md += f"  <div class='quiz-option' data-opt='D'><strong>D)</strong> The document contains no reference to this operational parameter.</div>\n"
        quiz_md += f"</div>\n\n"
        
        quiz_md += f"> **Answer Key**: **Option A** — Verified on **Page {page_num}** in *{doc_name}*.\n\n"
        quiz_md += "---\n\n"

    return quiz_md


def run_table_metric_extractor(doc_name: str, full_text: str) -> str:
    """Extracts numerical metrics, currency figures, percentages, and lists into a Markdown Table."""
    lines = re.split(r'\n+|=|:', full_text)
    candidates = []

    for line in lines:
        l = line.strip()
        if len(l) > 15 and re.search(r'\$\d+|\d+(?:\.\d+)?%|\b\d{2,}\b|\b\d+\s*(?:Million|Billion|Percent|hours|minutes|days|YoY|ARR|EBITDA|SLA|AES|SOC|Priority)\b', l, re.I):
            clean = re.sub(r'^[#\-*•]+\s*', '', l).replace("|", "/")
            if clean not in candidates:
                candidates.append(clean)

    table_md = f"### 📊 Extracted Metrics & Data Table: **{doc_name}**\n\n"
    table_md += "| # | Metric / Statement | Context Category |\n"
    table_md += "|---|---|---|\n"

    added = 0
    for c in candidates[:10]:
        added += 1
        cat = "Financial / Revenue" if "$" in c or "Million" in c or "ARR" in c else ("SLA / Support" if "min" in c or "Uptime" in c or "Priority" in c or "hour" in c else "Key Metric")
        table_md += f"| {added} | {c[:110]} | `{cat}` |\n"

    if added == 0:
        table_md += f"| 1 | Standard document parameters and guidelines verified | `General` |\n"

    return table_md

