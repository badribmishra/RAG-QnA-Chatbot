import io
import math
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import pypdf

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
    "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "isn't", "it", "its", "itself", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "should", "shouldn't", "so", "some", "such",
    "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "were",
    "weren't", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "won't", "would",
    "wouldn't", "you", "your", "yours", "yourself", "yourselves", "please", "tell", "give", "show", "according",
    "pdf", "document", "file"
}

class ChunkMetadata(BaseModel):
    doc_id: str
    doc_name: str
    page_number: int
    chunk_index: int
    char_count: int

class DocChunk(BaseModel):
    id: str
    content: str
    metadata: ChunkMetadata
    score: float = 0.0

class PDFDocument(BaseModel):
    id: str
    filename: str
    num_pages: int
    total_chunks: int
    total_words: int
    upload_time: str
    summary_preview: str = ""

class HybridVectorStore:
    """
    Enhanced Hybrid Vector Store combining TF-IDF, BM25 term weighting, 
    stop-word filtering, exact phrase boosting, sentence-level indexing,
    and raw PDF binary storage for PDF.js canvas rendering.
    """
    def __init__(self):
        self.documents: Dict[str, PDFDocument] = {}
        self.chunks: List[DocChunk] = []
        self.raw_bytes: Dict[str, bytes] = {}
        self.doc_freqs: Dict[str, int] = {}
        self.total_docs: int = 0
        self.idf_cache: Dict[str, float] = {}

    def _tokenize(self, text: str, remove_stopwords: bool = True) -> List[str]:
        """Robust tokenization with optional stop-word removal and lowercasing."""
        words = re.findall(r'\b\w+\b', text.lower())
        if remove_stopwords:
            return [w for w in words if len(w) > 1 and w not in STOP_WORDS]
        return [w for w in words if len(w) > 1]

    def add_pdf(self, doc_id: str, filename: str, pdf_bytes: bytes, upload_time: str) -> PDFDocument:
        """Parses a PDF binary stream, splits text by sentence-aware chunks, and indexes it."""
        self.raw_bytes[doc_id] = pdf_bytes
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        num_pages = len(reader.pages)
        new_chunks: List[DocChunk] = []
        total_words = 0
        first_page_text = ""

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            raw_text = page.extract_text() or ""
            if not raw_text.strip():
                continue
            
            # Clean text breaks while preserving paragraph boundaries
            text = re.sub(r'(?<!\n)\n(?!\n)', ' ', raw_text)
            text = re.sub(r'[ \t]+', ' ', text).strip()
            
            if page_idx == 0:
                first_page_text = text[:350].strip()

            words = text.split()
            total_words += len(words)

            # Sentence-aware chunking with overlapping context (~700 chars max)
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
            
            current_chunk = ""
            chunk_seq = 0
            
            for sent in sentences:
                if len(current_chunk) + len(sent) < 700:
                    current_chunk += (" " if current_chunk else "") + sent
                else:
                    if len(current_chunk.strip()) > 15:
                        c_id = f"{doc_id}_p{page_num}_c{chunk_seq}"
                        chunk_meta = ChunkMetadata(
                            doc_id=doc_id,
                            doc_name=filename,
                            page_number=page_num,
                            chunk_index=chunk_seq,
                            char_count=len(current_chunk)
                        )
                        new_chunks.append(DocChunk(id=c_id, content=current_chunk.strip(), metadata=chunk_meta))
                        chunk_seq += 1
                    # Overlap last 150 chars for tail continuity
                    current_chunk = current_chunk[-150:] + " " + sent if len(current_chunk) > 150 else sent

            if current_chunk.strip():
                c_id = f"{doc_id}_p{page_num}_c{chunk_seq}"
                chunk_meta = ChunkMetadata(
                    doc_id=doc_id,
                    doc_name=filename,
                    page_number=page_num,
                    chunk_index=chunk_seq,
                    char_count=len(current_chunk)
                )
                new_chunks.append(DocChunk(id=c_id, content=current_chunk.strip(), metadata=chunk_meta))

        # Append to global store
        self.chunks.extend(new_chunks)

        # Update TF-IDF index
        self._update_index(new_chunks)

        doc = PDFDocument(
            id=doc_id,
            filename=filename,
            num_pages=num_pages,
            total_chunks=len(new_chunks),
            total_words=total_words,
            upload_time=upload_time,
            summary_preview=first_page_text or "No text summary available."
        )
        self.documents[doc_id] = doc
        return doc

    def get_pdf_bytes(self, doc_id: str) -> Optional[bytes]:
        """Returns the raw binary bytes of a loaded PDF document."""
        return self.raw_bytes.get(doc_id)

    def _update_index(self, new_chunks: List[DocChunk]):
        """Updates document frequency statistics."""
        for chunk in new_chunks:
            tokens = set(self._tokenize(chunk.content, remove_stopwords=True))
            for t in tokens:
                self.doc_freqs[t] = self.doc_freqs.get(t, 0) + 1
        self.total_docs = len(self.chunks)
        
        # Compute IDF dictionary
        for term, df in self.doc_freqs.items():
            self.idf_cache[term] = math.log((self.total_docs + 1.0) / (df + 0.5)) + 1.0

    def search(self, query: str, top_k: int = 8, doc_filter: Optional[str] = None) -> List[DocChunk]:
        """Enhanced search matching key terms, exact phrases, numbers, and entities."""
        if not self.chunks:
            return []

        # Tokenize query both with and without stop words
        filtered_q_tokens = self._tokenize(query, remove_stopwords=True)
        raw_q_tokens = self._tokenize(query, remove_stopwords=False)

        # Extract specific numbers, percentages, dates, acronyms, or proper nouns from query
        key_numbers = re.findall(r'\b\d+(?:\.\d+)?%?\b', query)

        search_terms = filtered_q_tokens if filtered_q_tokens else raw_q_tokens

        scored_chunks: List[DocChunk] = []

        for chunk in self.chunks:
            if doc_filter and chunk.metadata.doc_id != doc_filter:
                continue

            chunk_content_lower = chunk.content.lower()
            chunk_tokens = self._tokenize(chunk.content, remove_stopwords=False)
            if not chunk_tokens:
                continue

            tf_dict: Dict[str, int] = {}
            for t in chunk_tokens:
                tf_dict[t] = tf_dict.get(t, 0) + 1

            chunk_len = len(chunk_tokens)
            score = 0.0

            # 1. BM25 term weighting on key search terms
            matched_terms_count = 0
            for term in search_terms:
                if term in tf_dict:
                    tf = tf_dict[term]
                    idf = self.idf_cache.get(term, 1.5)
                    bm25_val = (tf * 2.5) / (tf + 1.2 * (0.25 + 0.75 * (chunk_len / 100.0)))
                    score += idf * bm25_val
                    matched_terms_count += 1
                else:
                    # Partial / prefix match boost
                    for c_term in tf_dict:
                        if (len(term) > 3 and c_term.startswith(term)) or (len(c_term) > 3 and term.startswith(c_term)):
                            score += 0.8
                            break

            # Term density bonus if multiple query terms match in same chunk
            if matched_terms_count > 1:
                score += matched_terms_count * 1.5

            # 2. Number/Metric exact match boost (Crucial for questions asking about numbers, dates, rates)
            for num in key_numbers:
                if num in chunk_content_lower:
                    score += 4.0

            # 3. Exact query phrase boost
            clean_q = query.lower().strip()
            if len(clean_q) > 4 and clean_q in chunk_content_lower:
                score += 6.0

            if score > 0.01:
                chunk_copy = chunk.model_copy(deep=True)
                chunk_copy.score = round(score, 3)
                scored_chunks.append(chunk_copy)

        scored_chunks.sort(key=lambda x: x.score, reverse=True)
        return scored_chunks[:top_k]

    def remove_document(self, doc_id: str):
        """Removes a document and rebuilds TF-IDF statistics."""
        if doc_id in self.documents:
            del self.documents[doc_id]
        if doc_id in self.raw_bytes:
            del self.raw_bytes[doc_id]
        self.chunks = [c for c in self.chunks if c.metadata.doc_id != doc_id]
        self.doc_freqs.clear()
        self.idf_cache.clear()
        self._update_index(self.chunks)

    def get_all_document_texts(self, doc_id: str) -> str:
        """Returns full concatenated document text."""
        doc_chunks = [c for c in self.chunks if c.metadata.doc_id == doc_id]
        doc_chunks.sort(key=lambda x: (x.metadata.page_number, x.metadata.chunk_index))
        return "\n\n".join([c.content for c in doc_chunks])

