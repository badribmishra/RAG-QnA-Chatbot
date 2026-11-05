/* ==========================================================================
   DocuGraph AI Agent - Frontend Web Logic, PDF.js & LangGraph Client
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Navigation & Actions
  const modelSelect = document.getElementById("modelSelect");
  const btnApiKey = document.getElementById("btnApiKey");
  const btnGraphView = document.getElementById("btnGraphView");
  const btnLoadSamples = document.getElementById("btnLoadSamples");
  const btnClearChat = document.getElementById("btnClearChat");

  // Layout View Mode Switchers
  const workspaceGrid = document.getElementById("workspaceGrid");
  const leftPanel = document.getElementById("leftPanel");
  const viewBtnSplit = document.getElementById("viewBtnSplit");
  const viewBtnPdf = document.getElementById("viewBtnPdf");
  const viewBtnChat = document.getElementById("viewBtnChat");
  const btnCollapseLeft = document.getElementById("btnCollapseLeft");

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const docCountBadge = document.getElementById("docCountBadge");

  // Document List & Dropzone
  const dropzone = document.getElementById("dropzone");
  const pdfFileInput = document.getElementById("pdfFileInput");
  const documentsList = document.getElementById("documentsList");
  const docSearchInput = document.getElementById("docSearchInput");
  const activeDocFilterBanner = document.getElementById("activeDocFilterBanner");
  const activeDocFilterName = document.getElementById("activeDocFilterName");
  const btnClearFilter = document.getElementById("btnClearFilter");
  const chatFilterPill = document.getElementById("chatFilterPill");
  const chatFilterPillName = document.getElementById("chatFilterPillName");
  const btnQuickClearFilter = document.getElementById("btnQuickClearFilter");

  // PDF Viewer Elements
  const pdfDocTitle = document.getElementById("pdfDocTitle");
  const btnPdfZoomOut = document.getElementById("btnPdfZoomOut");
  const btnPdfZoomIn = document.getElementById("btnPdfZoomIn");
  const btnPdfFitWidth = document.getElementById("btnPdfFitWidth");
  const pdfZoomLevel = document.getElementById("pdfZoomLevel");
  const btnPdfFirstPage = document.getElementById("btnPdfFirstPage");
  const btnPdfPrevPage = document.getElementById("btnPdfPrevPage");
  const btnPdfNextPage = document.getElementById("btnPdfNextPage");
  const btnPdfLastPage = document.getElementById("btnPdfLastPage");
  const inputPdfPageJump = document.getElementById("inputPdfPageJump");
  const pdfTotalPages = document.getElementById("pdfTotalPages");
  const pdfCanvasContainer = document.getElementById("pdfCanvasContainer");
  const pdfRenderCanvas = document.getElementById("pdfRenderCanvas");
  const pdfEmptyState = document.getElementById("pdfEmptyState");
  const pdfLoadingSpinner = document.getElementById("pdfLoadingSpinner");

  // Configure PDF.js Worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // RAG Inspector
  const ragInspectorContent = document.getElementById("ragInspectorContent");

  // Chat Elements
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const btnSend = document.getElementById("btnSend");
  const actionChips = document.querySelectorAll(".action-chip");
  const agentActiveModeText = document.getElementById("agentActiveModeText");

  // LangGraph Tracker
  const graphExecutionTracker = document.getElementById("graphExecutionTracker");
  const graphStepBadge = document.getElementById("graphStepBadge");
  const graphStepDetails = document.getElementById("graphStepDetails");
  const pipelineProgressFill = document.getElementById("pipelineProgressFill");

  // Modals & Password Toggles
  const modalApiKey = document.getElementById("modalApiKey");
  const inputGeminiKey = document.getElementById("inputGeminiKey");
  const inputOpenAIKey = document.getElementById("inputOpenAIKey");
  const btnSaveApiKeys = document.getElementById("btnSaveApiKeys");
  const modalGraphView = document.getElementById("modalGraphView");
  const graphDiagramContainer = document.getElementById("graphDiagramContainer");
  const modalCloseBtns = document.querySelectorAll(".modal-close");
  const toastContainer = document.getElementById("toastContainer");

  // Application State
  let documents = [];
  let activeDocFilter = null;
  let currentLoadedDoc = null;
  let pdfDocObj = null;
  let currentPdfPage = 1;
  let totalPdfPages = 1;
  let pdfScale = 1.2;
  let isProcessing = false;
  let renderTask = null;

  // Load API Keys from LocalStorage
  inputGeminiKey.value = localStorage.getItem("gemini_api_key") || "";
  inputOpenAIKey.value = localStorage.getItem("openai_api_key") || "";

  // --------------------------------------------------------------------------
  // 1. TOAST NOTIFICATION UTILITY
  // --------------------------------------------------------------------------
  function showToast(message, type = "info", duration = 3200) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "toastOut 0.25s ease forwards";
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // --------------------------------------------------------------------------
  // 2. LAYOUT VIEW MODE SWITCHING
  // --------------------------------------------------------------------------
  function setViewMode(mode) {
    workspaceGrid.classList.remove("mode-chat-focus", "mode-pdf-focus");
    viewBtnSplit.classList.remove("active");
    viewBtnPdf.classList.remove("active");
    viewBtnChat.classList.remove("active");

    if (mode === "split") {
      viewBtnSplit.classList.add("active");
    } else if (mode === "pdf") {
      workspaceGrid.classList.add("mode-pdf-focus");
      viewBtnPdf.classList.add("active");
      switchTab("pdf-preview-tab");
      setTimeout(() => fitPdfWidth(), 150);
    } else if (mode === "chat") {
      workspaceGrid.classList.add("mode-chat-focus");
      viewBtnChat.classList.add("active");
    }
  }

  viewBtnSplit.addEventListener("click", () => setViewMode("split"));
  viewBtnPdf.addEventListener("click", () => setViewMode("pdf"));
  viewBtnChat.addEventListener("click", () => setViewMode("chat"));

  btnCollapseLeft.addEventListener("click", () => {
    if (workspaceGrid.classList.contains("mode-chat-focus")) {
      setViewMode("split");
    } else {
      setViewMode("chat");
    }
  });

  // --------------------------------------------------------------------------
  // 3. TAB NAVIGATION
  // --------------------------------------------------------------------------
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));

    const targetBtn = Array.from(tabBtns).find(b => b.getAttribute("data-tab") === tabId);
    if (targetBtn) targetBtn.classList.add("active");
    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.add("active");

    // If switching to PDF viewer, trigger canvas redraw if needed
    if (tabId === "pdf-preview-tab" && pdfDocObj) {
      setTimeout(() => renderRealPdfPage(currentPdfPage), 50);
    }
  }

  // --------------------------------------------------------------------------
  // 4. DOCUMENT LIST & UPLOAD LOGIC
  // --------------------------------------------------------------------------
  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      documents = data.documents || [];
      renderDocumentsList();
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      showToast("Failed to fetch documents list", "error");
    }
  }

  fetchDocuments();

  // Instant Document Search Filter
  if (docSearchInput) {
    docSearchInput.addEventListener("input", () => {
      renderDocumentsList(docSearchInput.value.trim().toLowerCase());
    });
  }

  function renderDocumentsList(searchTerm = "") {
    docCountBadge.textContent = documents.length;
    documentsList.innerHTML = "";

    const filtered = searchTerm
      ? documents.filter(d => d.filename.toLowerCase().includes(searchTerm))
      : documents;

    if (documents.length === 0) {
      documentsList.innerHTML = `
        <div class="empty-rag">
          <i class="fa-regular fa-folder-open"></i>
          <p>No documents indexed yet. Drop a PDF file or click <strong>"Load Sample PDFs"</strong> above to begin.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      documentsList.innerHTML = `
        <div class="empty-rag">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>No documents matching "<strong>${escapeHtml(searchTerm)}</strong>"</p>
        </div>
      `;
      return;
    }

    filtered.forEach(doc => {
      const isFiltered = activeDocFilter === doc.id;
      const isCurrentlyOpen = currentLoadedDoc && currentLoadedDoc.id === doc.id;
      const card = document.createElement("div");
      card.className = `doc-card ${isFiltered ? 'active-filter' : ''} ${isCurrentlyOpen ? 'active-preview' : ''}`;
      
      card.innerHTML = `
        <div class="doc-card-header">
          <span class="doc-title" title="${doc.filename}">
            <i class="fa-solid fa-file-pdf"></i> ${escapeHtml(doc.filename)}
          </span>
          <div class="doc-actions">
            <button class="btn-card-action btn-filter-doc" data-id="${doc.id}" title="${isFiltered ? 'Clear Scope' : 'Filter AI Agent scope to this document'}">
              <i class="fa-solid ${isFiltered ? 'fa-filter-circle-xmark' : 'fa-filter'}"></i>
            </button>
            <button class="btn-card-action btn-delete-doc" data-id="${doc.id}" title="Remove Document">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="doc-meta-pills">
          <span class="meta-tag"><i class="fa-solid fa-book-open"></i> ${doc.num_pages || 1} Pages</span>
          <span class="meta-tag"><i class="fa-solid fa-cubes"></i> ${doc.total_chunks || 0} Chunks</span>
          <span class="meta-tag"><i class="fa-regular fa-clock"></i> ${doc.upload_time || 'Preloaded'}</span>
        </div>
      `;

      // Click card to open in viewer
      card.addEventListener("click", (e) => {
        if (e.target.closest(".doc-actions")) return;
        switchTab("pdf-preview-tab");
        loadPdfInViewer(doc);
      });

      // Filter button toggle
      const filterBtn = card.querySelector(".btn-filter-doc");
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (activeDocFilter === doc.id) {
          clearActiveDocFilter();
          showToast("AI Agent search scope reset to All PDFs", "info");
        } else {
          setActiveDocFilter(doc.id, doc.filename);
          showToast(`Agent queries focused on: ${doc.filename}`, "success");
        }
      });

      // Delete action
      const deleteBtn = card.querySelector(".btn-delete-doc");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Remove '${doc.filename}' from the vector store?`)) {
          await deleteDocument(doc.id);
        }
      });

      documentsList.appendChild(card);
    });
  }

  function setActiveDocFilter(docId, filename) {
    activeDocFilter = docId;
    activeDocFilterName.textContent = filename;
    activeDocFilterBanner.classList.remove("hidden");

    chatFilterPillName.textContent = filename;
    chatFilterPill.classList.remove("hidden");

    renderDocumentsList(docSearchInput ? docSearchInput.value.trim().toLowerCase() : "");
  }

  function clearActiveDocFilter() {
    activeDocFilter = null;
    activeDocFilterBanner.classList.add("hidden");
    chatFilterPill.classList.add("hidden");
    renderDocumentsList(docSearchInput ? docSearchInput.value.trim().toLowerCase() : "");
  }

  btnClearFilter.addEventListener("click", clearActiveDocFilter);
  btnQuickClearFilter.addEventListener("click", () => {
    clearActiveDocFilter();
    showToast("AI Agent search scope reset to All PDFs", "info");
  });

  // Dropzone Handlers
  dropzone.addEventListener("click", () => pdfFileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  });

  pdfFileInput.addEventListener("change", async (e) => {
    if (e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
      pdfFileInput.value = "";
    }
  });

  async function uploadFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please upload a valid .pdf file", "error");
      return;
    }

    showToast(`Uploading and indexing '${file.name}'...`, "info");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully indexed '${data.document.filename}'!`, "success");
        await fetchDocuments();
        setActiveDocFilter(data.document.id, data.document.filename);
        switchTab("pdf-preview-tab");
        loadPdfInViewer(data.document);
      } else {
        showToast(data.detail || "Upload error", "error");
      }
    } catch (err) {
      console.error("Upload error:", err);
      showToast("Network error uploading PDF file", "error");
    }
  }

  async function deleteDocument(docId) {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        if (activeDocFilter === docId) {
          clearActiveDocFilter();
        }
        if (currentLoadedDoc && currentLoadedDoc.id === docId) {
          currentLoadedDoc = null;
          pdfDocObj = null;
          pdfEmptyState.classList.remove("hidden");
          pdfRenderCanvas.classList.add("hidden");
          pdfDocTitle.textContent = "No document loaded";
        }
        showToast("Document removed from index", "info");
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete document", "error");
    }
  }

  btnLoadSamples.addEventListener("click", async () => {
    btnLoadSamples.disabled = true;
    btnLoadSamples.innerHTML = `<i class="fa-solid fa-spinner spinner-icon"></i> <span>Loading...</span>`;
    try {
      const res = await fetch("/api/sample", { method: "POST" });
      if (res.ok) {
        showToast("Sample PDFs loaded into vector store!", "success");
        await fetchDocuments();
      } else {
        showToast("Failed to load sample documents", "error");
      }
    } catch (err) {
      console.error("Load samples error:", err);
      showToast("Network error loading samples", "error");
    } finally {
      btnLoadSamples.disabled = false;
      btnLoadSamples.innerHTML = `<i class="fa-solid fa-file-circle-plus"></i> <span>Load Sample PDFs</span>`;
    }
  });

  // --------------------------------------------------------------------------
  // 5. PDF RENDERING VIA PDF.JS CANVAS (HIGH-DPI OPTIMIZED)
  // --------------------------------------------------------------------------
  async function loadPdfInViewer(doc) {
    currentLoadedDoc = doc;
    pdfDocTitle.textContent = doc.filename;
    pdfDocTitle.title = doc.filename;
    pdfEmptyState.classList.add("hidden");
    pdfRenderCanvas.classList.remove("hidden");
    
    currentPdfPage = 1;
    totalPdfPages = doc.num_pages || 1;
    inputPdfPageJump.value = currentPdfPage;
    pdfTotalPages.textContent = totalPdfPages;

    renderDocumentsList(docSearchInput ? docSearchInput.value.trim().toLowerCase() : "");

    try {
      if (window.pdfjsLib) {
        if (pdfLoadingSpinner) pdfLoadingSpinner.classList.remove("hidden");
        const fileUrl = `/api/documents/${doc.id}/file`;
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        pdfDocObj = await loadingTask.promise;
        totalPdfPages = pdfDocObj.numPages;
        pdfTotalPages.textContent = totalPdfPages;
        inputPdfPageJump.max = totalPdfPages;
        await renderRealPdfPage(currentPdfPage);
      } else {
        renderCanvasFallback(doc.filename, currentPdfPage, doc.summary_preview);
      }
    } catch (err) {
      console.warn("PDF.js streaming canvas notice:", err);
      renderCanvasFallback(doc.filename, currentPdfPage, doc.summary_preview);
    } finally {
      if (pdfLoadingSpinner) pdfLoadingSpinner.classList.add("hidden");
    }
  }

  async function renderRealPdfPage(pageNum) {
    if (!pdfDocObj) return;
    
    if (renderTask) {
      try {
        renderTask.cancel();
      } catch (e) {}
    }

    try {
      if (pdfLoadingSpinner) pdfLoadingSpinner.classList.remove("hidden");
      const page = await pdfDocObj.getPage(pageNum);
      
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: pdfScale });
      
      const canvas = pdfRenderCanvas;
      const ctx = canvas.getContext("2d");
      
      canvas.height = viewport.height * pixelRatio;
      canvas.width = viewport.width * pixelRatio;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.width = `${viewport.width}px`;

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      renderTask = page.render(renderContext);
      await renderTask.promise;
      renderTask = null;

      pdfZoomLevel.textContent = `${Math.round(pdfScale * 100)}%`;
      inputPdfPageJump.value = pageNum;
    } catch (err) {
      if (err.name !== "RenderingCancelledException") {
        console.error("Render page error:", err);
      }
    } finally {
      if (pdfLoadingSpinner) pdfLoadingSpinner.classList.add("hidden");
    }
  }

  function renderCanvasFallback(title, pageNum, textSnippet) {
    const canvas = pdfRenderCanvas;
    const ctx = canvas.getContext("2d");
    
    canvas.width = 460;
    canvas.height = 580;
    canvas.style.width = "460px";
    canvas.style.height = "580px";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${title} (Page ${pageNum})`, 24, 38);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 50);
    ctx.lineTo(436, 50);
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "12.5px sans-serif";
    
    const lines = (textSnippet || "PDF content indexed").split("\n");
    let y = 84;
    for (let l of lines) {
      ctx.fillText(l.substring(0, 52), 24, y);
      y += 24;
      if (y > 520) break;
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Page ${pageNum} of ${totalPdfPages} • Hybrid Vector Store Indexed`, 120, 555);
  }

  function fitPdfWidth() {
    if (!pdfDocObj || !pdfCanvasContainer) return;
    const containerWidth = pdfCanvasContainer.clientWidth - 48; // padding
    if (containerWidth > 200) {
      pdfDocObj.getPage(currentPdfPage).then(page => {
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        pdfScale = Math.min(Math.max(containerWidth / unscaledViewport.width, 0.6), 2.5);
        renderRealPdfPage(currentPdfPage);
      });
    }
  }

  btnPdfFitWidth.addEventListener("click", fitPdfWidth);

  btnPdfZoomIn.addEventListener("click", () => {
    if (pdfScale < 2.5) {
      pdfScale = Math.round((pdfScale + 0.15) * 100) / 100;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
    }
  });

  btnPdfZoomOut.addEventListener("click", () => {
    if (pdfScale > 0.5) {
      pdfScale = Math.round((pdfScale - 0.15) * 100) / 100;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
    }
  });

  inputPdfPageJump.addEventListener("change", () => {
    const target = parseInt(inputPdfPageJump.value, 10);
    if (target >= 1 && target <= totalPdfPages) {
      currentPdfPage = target;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      else if (currentLoadedDoc) renderCanvasFallback(currentLoadedDoc.filename, currentPdfPage, currentLoadedDoc.summary_preview);
    } else {
      inputPdfPageJump.value = currentPdfPage;
    }
  });

  btnPdfFirstPage.addEventListener("click", () => {
    if (currentPdfPage !== 1) {
      currentPdfPage = 1;
      inputPdfPageJump.value = currentPdfPage;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      else if (currentLoadedDoc) renderCanvasFallback(currentLoadedDoc.filename, currentPdfPage, currentLoadedDoc.summary_preview);
    }
  });

  btnPdfLastPage.addEventListener("click", () => {
    if (currentPdfPage !== totalPdfPages) {
      currentPdfPage = totalPdfPages;
      inputPdfPageJump.value = currentPdfPage;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      else if (currentLoadedDoc) renderCanvasFallback(currentLoadedDoc.filename, currentPdfPage, currentLoadedDoc.summary_preview);
    }
  });

  btnPdfPrevPage.addEventListener("click", () => {
    if (currentPdfPage > 1) {
      currentPdfPage--;
      inputPdfPageJump.value = currentPdfPage;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      else if (currentLoadedDoc) renderCanvasFallback(currentLoadedDoc.filename, currentPdfPage, currentLoadedDoc.summary_preview);
    }
  });

  btnPdfNextPage.addEventListener("click", () => {
    if (currentPdfPage < totalPdfPages) {
      currentPdfPage++;
      inputPdfPageJump.value = currentPdfPage;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      else if (currentLoadedDoc) renderCanvasFallback(currentLoadedDoc.filename, currentPdfPage, currentLoadedDoc.summary_preview);
    }
  });

  // Keyboard navigation for PDF reader (Left/Right arrow)
  document.addEventListener("keydown", (e) => {
    const pdfTab = document.getElementById("pdf-preview-tab");
    if (pdfTab && pdfTab.classList.contains("active")) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        btnPdfPrevPage.click();
      } else if (e.key === "ArrowRight") {
        btnPdfNextPage.click();
      }
    }
  });

  // Jump directly to document page
  function jumpToPdfPage(docName, pageNum) {
    switchTab("pdf-preview-tab");
    const targetDoc = documents.find(d => d.filename === docName || d.id === docName);
    if (targetDoc) {
      loadPdfInViewer(targetDoc).then(() => {
        currentPdfPage = Math.min(pageNum, totalPdfPages);
        inputPdfPageJump.value = currentPdfPage;
        if (pdfDocObj) renderRealPdfPage(currentPdfPage);
      });
    } else {
      currentPdfPage = Math.min(pageNum, totalPdfPages);
      inputPdfPageJump.value = currentPdfPage;
      if (pdfDocObj) renderRealPdfPage(currentPdfPage);
    }
  }

  // --------------------------------------------------------------------------
  // 6. CHAT & LANGGRAPH STREAMING PIPELINE
  // --------------------------------------------------------------------------
  modelSelect.addEventListener("change", () => {
    const val = modelSelect.value;
    if (val === "demo") {
      agentActiveModeText.textContent = "Mode: Smart Demo Agent (Stateful Execution)";
      showToast("Switched to Offline Smart Demo Agent", "info");
    } else if (val === "gemini") {
      agentActiveModeText.textContent = "Mode: Google Gemini Flash (Cloud)";
      showToast("Switched to Google Gemini Flash", "info");
    } else if (val === "openai") {
      agentActiveModeText.textContent = "Mode: OpenAI GPT-4o Mini (Cloud)";
      showToast("Switched to OpenAI GPT-4o Mini", "info");
    }
  });

  // Quick Action Chips
  actionChips.forEach(chip => {
    chip.addEventListener("click", () => {
      userInput.value = chip.getAttribute("data-prompt");
      autoResizeTextarea();
      chatForm.dispatchEvent(new Event("submit"));
    });
  });

  // Welcome Starter Cards
  chatMessages.addEventListener("click", (e) => {
    const starterCard = e.target.closest(".starter-card");
    if (starterCard) {
      const prompt = starterCard.getAttribute("data-prompt");
      if (prompt) {
        userInput.value = prompt;
        autoResizeTextarea();
        chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  // Textarea Auto-expand & Enter to Submit (Shift+Enter for newline)
  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
  }

  userInput.addEventListener("input", autoResizeTextarea);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing && userInput.value.trim().length > 0) {
        chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  btnClearChat.addEventListener("click", () => {
    chatMessages.innerHTML = `
      <div class="message system-welcome">
        <div class="avatar agent-avatar"><i class="fa-solid fa-brain-circuit"></i></div>
        <div class="message-content">
          <div class="welcome-header">
            <h3>Chat session reset 👋</h3>
            <span class="welcome-tag">Ready for new queries</span>
          </div>
          <p>Context memory cleared. Ask questions or select an action chip to begin a new analytical session.</p>
        </div>
      </div>
    `;
    showToast("Conversation cleared", "info");
  });

  // Form Submit Handler
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query || isProcessing) return;

    // Append User Message
    appendMessage("user", query);
    userInput.value = "";
    userInput.style.height = "auto";
    isProcessing = true;
    btnSend.disabled = true;

    // Show Graph Tracker
    graphExecutionTracker.classList.remove("hidden");
    updateGraphTracker("router", "Classifying intent & initializing LangGraph workflow...", 20);

    const payload = {
      query: query,
      doc_filter: activeDocFilter,
      model_provider: modelSelect.value,
      openai_api_key: localStorage.getItem("openai_api_key") || "",
      gemini_api_key: localStorage.getItem("gemini_api_key") || ""
    };

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let fullAnswerText = "";
      let citationsData = [];

      // Create Agent Message Shell with live typing indicator
      const agentMsgObj = appendMessage("agent", "Thinking...");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n\n");
        streamBuffer = lines.pop(); // Keep incomplete tail

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === "step") {
                handleGraphStep(event.node, event.detail);
              } else if (event.type === "citations") {
                citationsData = event.data || [];
                renderRagInspector(citationsData);
              } else if (event.type === "answer") {
                fullAnswerText = event.text;
                updateAgentMessage(agentMsgObj, fullAnswerText, citationsData);
              }
            } catch (pErr) {
              console.error("Stream parse error:", pErr);
            }
          }
        }
      }

      // If stream ended with answer
      if (fullAnswerText) {
        updateAgentMessage(agentMsgObj, fullAnswerText, citationsData);
      }

    } catch (err) {
      console.error("Chat error:", err);
      appendMessage("agent", "⚠️ **An error occurred** while executing the LangGraph agent. Please check your network connection or API keys.");
      showToast("Agent execution error", "error");
    } finally {
      isProcessing = false;
      btnSend.disabled = false;
      setTimeout(() => {
        graphExecutionTracker.classList.add("hidden");
      }, 2000);
    }
  });

  function handleGraphStep(node, detail) {
    let progress = 30;
    if (node === "pdf_retriever") progress = 50;
    if (node === "self_rag_evaluator") progress = 70;
    if (node === "tool_executor" || node === "answer_synthesizer") progress = 90;
    if (node === "END") progress = 100;

    updateGraphTracker(node, detail, progress);
  }

  function updateGraphTracker(badge, detail, progressPercent) {
    graphStepBadge.textContent = badge.toUpperCase();
    graphStepDetails.textContent = detail;
    pipelineProgressFill.style.width = `${progressPercent}%`;
  }

  function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;

    const iconClass = sender === "user" ? "fa-user" : "fa-brain-circuit";
    const avatarClass = sender === "user" ? "user-avatar" : "agent-avatar";

    msgDiv.innerHTML = `
      <div class="avatar ${avatarClass}">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div class="message-content">
        <div class="msg-body">${formatMarkdown(text)}</div>
      </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }

  function updateAgentMessage(msgObj, text, citations) {
    const msgBody = msgObj.querySelector(".msg-body");
    msgBody.innerHTML = formatMarkdown(text);

    // Append Citations Pills
    if (citations && citations.length > 0) {
      const citContainer = document.createElement("div");
      citContainer.className = "citations-container";
      citContainer.style.marginTop = "10px";
      citContainer.style.paddingTop = "8px";
      citContainer.style.borderTop = "1px solid rgba(255,255,255,0.06)";

      citContainer.innerHTML = `<span style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-right: 6px;"><i class="fa-solid fa-file-circle-check"></i> Citations: </span>`;

      citations.forEach(c => {
        const pill = document.createElement("span");
        pill.className = "citation-pill";
        pill.title = `Jump to ${c.doc_name} (Page ${c.page})`;
        pill.innerHTML = `<i class="fa-solid fa-bookmark"></i> Page ${c.page}`;
        
        pill.addEventListener("click", () => {
          jumpToPdfPage(c.doc_name, c.page);
          showToast(`Jumped to Page ${c.page} of ${c.doc_name}`, "info");
        });

        citContainer.appendChild(pill);
      });

      msgBody.appendChild(citContainer);
    }

    // Append Message Action Toolbar (Copy button)
    let toolbar = msgObj.querySelector(".msg-actions-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "msg-actions-toolbar";
      
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn-msg-copy";
      copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
      copyBtn.title = "Copy response to clipboard";
      
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.classList.add("copied");
          copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Copied!</span>`;
          showToast("Copied to clipboard!", "success", 1800);
          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
          }, 2000);
        } catch (err) {
          console.error("Clipboard copy failed:", err);
        }
      });

      toolbar.appendChild(copyBtn);
      msgObj.querySelector(".message-content").appendChild(toolbar);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Interactive Quiz Option Selection Event Listener
  chatMessages.addEventListener("click", (e) => {
    const optEl = e.target.closest(".quiz-option");
    if (!optEl) return;

    const group = optEl.closest(".quiz-options-group");
    if (!group) return;

    const correctOpt = group.getAttribute("data-correct");
    const selectedOpt = optEl.getAttribute("data-opt");

    group.querySelectorAll(".quiz-option").forEach(o => {
      o.classList.remove("correct-selected", "incorrect-selected");
    });

    if (selectedOpt === correctOpt) {
      optEl.classList.add("correct-selected");
      showToast("Correct Answer! 🎉", "success", 2000);
    } else {
      optEl.classList.add("incorrect-selected");
      const correctEl = group.querySelector(`.quiz-option[data-opt="${correctOpt}"]`);
      if (correctEl) correctEl.classList.add("correct-selected");
      showToast(`Incorrect. Correct option was (${correctOpt})`, "info", 2400);
    }
  });

  // RAG Inspector Render
  function renderRagInspector(citations) {
    ragInspectorContent.innerHTML = "";
    if (!citations || citations.length === 0) {
      ragInspectorContent.innerHTML = `<div class="empty-rag"><p>No relevant context chunks matched for this query.</p></div>`;
      return;
    }

    citations.forEach((c, idx) => {
      const card = document.createElement("div");
      card.className = "chunk-card";
      card.innerHTML = `
        <div class="chunk-header">
          <span>#${idx+1} ${escapeHtml(c.doc_name)} (Page ${c.page})</span>
          <span class="chunk-score">Cosine: ${c.score}</span>
        </div>
        <div class="chunk-body">${escapeHtml(c.snippet)}</div>
        <div class="chunk-footer" style="margin-top: 4px; text-align: right;">
          <button class="btn-icon-pill btn-jump-chunk" data-doc="${c.doc_name}" data-page="${c.page}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Page ${c.page}
          </button>
        </div>
      `;

      card.querySelector(".btn-jump-chunk").addEventListener("click", () => {
        jumpToPdfPage(c.doc_name, c.page);
        showToast(`Opened Page ${c.page} in PDF viewer`, "info");
      });

      ragInspectorContent.appendChild(card);
    });
  }

  // Markdown Formatter
  function formatMarkdown(str) {
    if (!str) return "";
    if (window.marked && typeof marked.parse === "function") {
      try {
        return marked.parse(str);
      } catch (e) {
        console.warn("Marked parse error:", e);
      }
    }
    
    // Fallback Simple Markdown Formatter
    return str
      .replace(/### (.*?)\n/g, "<h3>$1</h3>")
      .replace(/#### (.*?)\n/g, "<h4>$1</h4>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/> (.*?)\n/g, "<blockquote>$1</blockquote>")
      .replace(/- (.*?)\n/g, "<li>$1</li>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --------------------------------------------------------------------------
  // 7. MODAL HANDLERS & PASSWORD TOGGLES
  // --------------------------------------------------------------------------
  btnApiKey.addEventListener("click", () => modalApiKey.classList.remove("hidden"));
  btnGraphView.addEventListener("click", () => {
    renderGraphDiagram();
    modalGraphView.classList.remove("hidden");
  });

  modalCloseBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-modal");
      if (modalId) {
        document.getElementById(modalId).classList.add("hidden");
      } else {
        const overlay = btn.closest(".modal-overlay");
        if (overlay) overlay.classList.add("hidden");
      }
    });
  });

  // Close modals on clicking overlay outside
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    });
  });

  // Password visibility toggle
  document.querySelectorAll(".btn-toggle-pwd").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`;
        } else {
          input.type = "password";
          btn.innerHTML = `<i class="fa-solid fa-eye"></i>`;
        }
      }
    });
  });

  btnSaveApiKeys.addEventListener("click", () => {
    localStorage.setItem("gemini_api_key", inputGeminiKey.value.trim());
    localStorage.setItem("openai_api_key", inputOpenAIKey.value.trim());
    modalApiKey.classList.add("hidden");
    showToast("API Keys saved securely in browser!", "success");
  });

  async function renderGraphDiagram() {
    try {
      const res = await fetch("/api/graph/schema");
      const data = await res.json();
      
      graphDiagramContainer.innerHTML = "";
      
      data.nodes.forEach((node, i) => {
        const nodeBox = document.createElement("div");
        nodeBox.className = "graph-node-box";
        nodeBox.innerHTML = `
          <div><i class="fa-solid fa-circle-nodes" style="color: var(--accent-cyan); margin-right: 6px;"></i> ${node.label}</div>
          <div style="font-size: 10.5px; font-weight: normal; color: var(--text-secondary); margin-top: 4px;">${node.description}</div>
        `;
        graphDiagramContainer.appendChild(nodeBox);

        if (i < data.nodes.length - 1) {
          const arrow = document.createElement("div");
          arrow.className = "graph-arrow";
          arrow.innerHTML = `<i class="fa-solid fa-arrow-down"></i>`;
          graphDiagramContainer.appendChild(arrow);
        }
      });
    } catch (err) {
      console.error("Failed to render graph schema:", err);
      graphDiagramContainer.innerHTML = `<p style="color: var(--text-muted);">Failed to load architecture schema</p>`;
    }
  }

});
