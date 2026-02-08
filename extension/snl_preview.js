(() => {
  "use strict";

  window.__SNL = window.__SNL || {};

  const ALLOWED_PDF_ORIGINS = new Set([
    "https://www.justice.gov",
    "https://jmail.world",
    "https://www.dropbox.com",
    "https://dropbox.com",
    "https://dl.dropboxusercontent.com"
  ]);

  function normalizeDropboxPdfUrl(url) {
    try {
      if (url.hostname === "www.dropbox.com" || url.hostname === "dropbox.com") {
        url.searchParams.delete("dl");
        url.searchParams.set("raw", "1");
      }
      return url.toString();
    } catch {
      return url.toString();
    }
  }

  function getAllowedPdfUrl(a) {
    if (!a || !a.getAttribute) return null;
    const href = a.getAttribute("href");
    if (!href) return null;

    try {
      const url = new URL(href, location.href);
      if (!ALLOWED_PDF_ORIGINS.has(url.origin)) return null;
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (!url.pathname.toLowerCase().endsWith(".pdf")) return null;

      if (url.hostname.endsWith("dropbox.com") || url.hostname === "dl.dropboxusercontent.com") {
        return normalizeDropboxPdfUrl(url);
      }

      return url.toString();
    } catch {
      return null;
    }
  }

  function isPdfLink(a) {
    return !!getAllowedPdfUrl(a);
  }

  function getJmailThreadUrlFromRow(row) {
    if (!row || !row.getAttribute) return null;
    const id = row.getAttribute("data-doc-id");
    if (!id) return null;

    try {
      const u = new URL(`/thread/${id}`, location.origin);
      const view = new URLSearchParams(location.search).get("view") || "inbox";
      u.searchParams.set("view", view);
      return u.toString();
    } catch {
      return null;
    }
  }

  function getJmailRowTitle(row) {
    const sender = row.querySelector?.(".sender-name")?.textContent?.trim();
    const subject = row.querySelector?.(".subject")?.textContent?.trim();
    const preview = row.querySelector?.(".preview")?.textContent?.trim();
    const parts = [sender, subject].filter(Boolean);
    const base = parts.join(" — ") || "Email";
    return preview ? `${base}${preview.startsWith("-") ? " " : " — "}${preview}` : base;
  }

  const PdfPreview = {
    link: null,
    src: "",
    hideTimer: 0,
    el: null,
    frame: null,
    header: null,
    pinBtn: null,
    overLink: false,
    overPopup: false,
    pinned: false,
    followHoverWhenPinned: true,
    pos: null,
  };

  function hidePdfPreview() {
    if (PdfPreview.hideTimer) window.clearTimeout(PdfPreview.hideTimer);
    PdfPreview.hideTimer = 0;
    PdfPreview.link = null;
    PdfPreview.src = "";
    PdfPreview.overLink = false;
    PdfPreview.overPopup = false;
    if (PdfPreview.el) PdfPreview.el.style.display = "none";
    if (PdfPreview.frame) PdfPreview.frame.src = "about:blank";
  }

  function scheduleHidePdfPreview() {
    if (PdfPreview.pinned) return;
    if (PdfPreview.hideTimer) window.clearTimeout(PdfPreview.hideTimer);
    PdfPreview.hideTimer = window.setTimeout(() => {
      if (!PdfPreview.overLink && !PdfPreview.overPopup) hidePdfPreview();
    }, 200);
  }

  function ensurePdfPreviewEl() {
    if (PdfPreview.el) return PdfPreview.el;

    const el = document.createElement("div");
    el.id = "doj-helper-pdf-preview";
    el.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "display:none",
      "width:600px",
      "height:800px",
      "min-width:360px",
      "min-height:420px",
      "max-width:calc(100vw - 16px)",
      "max-height:calc(100vh - 16px)",
      "resize:both",
      "border-radius:12px",
      "border:1px solid rgba(0,0,0,0.25)",
      "background:rgba(20,20,20,0.96)",
      "color:#fff",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
      "box-shadow:0 14px 34px rgba(0,0,0,0.45)",
      "overflow:hidden",
      "pointer-events:auto"
    ].join(";");

    const BTN_STYLE = "border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:#fff;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:12px;";

    el.innerHTML = `
      <div id="doj-helper-pdf-header" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.12);cursor:move;user-select:none;">
        <div style="font-size:12px;font-weight:700;opacity:0.95;">SLEEPYNERDLIVE VIEW</div>
        <div id="doj-helper-pdf-title" style="flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
        <button id="doj-helper-pdf-pin" type="button" style="${BTN_STYLE}">Pin</button>
        <button id="doj-helper-pdf-reload" type="button" style="${BTN_STYLE}">Reload</button>
        <a id="doj-helper-pdf-open" href="#" target="_blank" rel="noopener" style="font-size:12px;color:#9cdcfe;text-decoration:none;border:1px solid rgba(255,255,255,0.18);padding:5px 8px;border-radius:8px;">Open</a>
        <button id="doj-helper-pdf-close" type="button" aria-label="Close" style="border:0;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:4px 6px;">×</button>
      </div>
      <iframe id="doj-helper-pdf-frame" title="Preview" style="width:100%;height:calc(100% - 42px);border:0;background:#111827;"></iframe>
    `;

    const setOverPopup = (v) => {
      PdfPreview.overPopup = v;
      if (v && PdfPreview.hideTimer) {
        window.clearTimeout(PdfPreview.hideTimer);
        PdfPreview.hideTimer = 0;
      }
      if (!v) scheduleHidePdfPreview();
    };

    el.addEventListener("mouseenter", () => setOverPopup(true));
    el.addEventListener("mouseleave", () => setOverPopup(false));

    const header = el.querySelector("#doj-helper-pdf-header");
    const pinBtn = el.querySelector("#doj-helper-pdf-pin");
    const reloadBtn = el.querySelector("#doj-helper-pdf-reload");
    PdfPreview.header = header;
    PdfPreview.pinBtn = pinBtn;

    reloadBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!PdfPreview.frame || !PdfPreview.src) return;
      const src = PdfPreview.src;
      PdfPreview.frame.src = "about:blank";
      setTimeout(() => {
        if (PdfPreview.frame) PdfPreview.frame.src = src;
      }, 0);
    });

    function setPinned(v) {
      PdfPreview.pinned = !!v;
      if (PdfPreview.pinBtn) PdfPreview.pinBtn.textContent = PdfPreview.pinned ? "Unpin" : "Pin";
      try {
        chrome.storage?.local.set({ pdfPreviewPinned: PdfPreview.pinned });
      } catch {}
    }

    pinBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPinned(!PdfPreview.pinned);
      if (!PdfPreview.pinned) scheduleHidePdfPreview();
    });

    el.querySelector("#doj-helper-pdf-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPinned(false);
      hidePdfPreview();
    });

    const frame = el.querySelector("#doj-helper-pdf-frame");
    if (frame) {
      frame.addEventListener("mouseenter", () => setOverPopup(true));
      frame.addEventListener("mouseleave", () => setOverPopup(false));
      PdfPreview.frame = frame;
    }

    let suppressSave = true;
    const DEFAULTS = {
      pdfPreviewSize: { w: 600, h: 800 },
      pdfPreviewPinned: false,
      pdfPreviewFollowHoverWhenPinned: true,
      pdfPreviewPos: null,
    };

    function clampPos(left, top) {
      const margin = 8;
      const w = el.offsetWidth || 600;
      const h = el.offsetHeight || 800;
      const maxLeft = Math.max(margin, window.innerWidth - w - margin);
      const maxTop = Math.max(margin, window.innerHeight - h - margin);
      return {
        left: Math.max(margin, Math.min(maxLeft, left)),
        top: Math.max(margin, Math.min(maxTop, top)),
      };
    }

    try {
      chrome.storage?.local.get(DEFAULTS, (v) => {
        const w = Math.max(360, Number(v.pdfPreviewSize?.w) || 600);
        const h = Math.max(420, Number(v.pdfPreviewSize?.h) || 800);
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;

        PdfPreview.pinned = !!v.pdfPreviewPinned;
        PdfPreview.followHoverWhenPinned = !!v.pdfPreviewFollowHoverWhenPinned;
        if (PdfPreview.pinBtn) PdfPreview.pinBtn.textContent = PdfPreview.pinned ? "Unpin" : "Pin";

        if (v.pdfPreviewPos && Number.isFinite(v.pdfPreviewPos.left) && Number.isFinite(v.pdfPreviewPos.top)) {
          PdfPreview.pos = clampPos(v.pdfPreviewPos.left, v.pdfPreviewPos.top);
          el.style.left = `${PdfPreview.pos.left}px`;
          el.style.top = `${PdfPreview.pos.top}px`;
        }

        setTimeout(() => { suppressSave = false; }, 300);
      });

      const ro = new ResizeObserver(() => {
        if (suppressSave) return;
        if (el.style.display === "none") return;

        const w = Math.round(el.getBoundingClientRect().width);
        const h = Math.round(el.getBoundingClientRect().height);
        chrome.storage?.local.set({ pdfPreviewSize: { w, h } });

        if (PdfPreview.pos) {
          PdfPreview.pos = clampPos(PdfPreview.pos.left, PdfPreview.pos.top);
          el.style.left = `${PdfPreview.pos.left}px`;
          el.style.top = `${PdfPreview.pos.top}px`;
          chrome.storage?.local.set({ pdfPreviewPos: PdfPreview.pos });
        }
      });
      ro.observe(el);

      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      const isInteractive = (t) => !!(t && (t.closest?.("a,button,input,select,textarea") || t.getAttribute?.("role") === "button"));

      PdfPreview.header?.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (isInteractive(e.target)) return;
        dragging = true;
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        PdfPreview.overPopup = true;
        if (PdfPreview.hideTimer) { window.clearTimeout(PdfPreview.hideTimer); PdfPreview.hideTimer = 0; }

        const onMove = (ev) => {
          if (!dragging) return;
          const next = clampPos(startLeft + (ev.clientX - startX), startTop + (ev.clientY - startY));
          PdfPreview.pos = next;
          el.style.left = `${next.left}px`;
          el.style.top = `${next.top}px`;
        };

        const onUp = () => {
          if (!dragging) return;
          dragging = false;
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          if (PdfPreview.pos) chrome.storage?.local.set({ pdfPreviewPos: PdfPreview.pos });
          PdfPreview.overPopup = false;
          scheduleHidePdfPreview();
        };

        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseup", onUp, true);
      });
    } catch {
      suppressSave = false;
    }

    try {
      chrome.storage?.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if ("pdfPreviewPinned" in changes) {
          PdfPreview.pinned = !!changes.pdfPreviewPinned.newValue;
          if (PdfPreview.pinBtn) PdfPreview.pinBtn.textContent = PdfPreview.pinned ? "Unpin" : "Pin";
          if (!PdfPreview.pinned) scheduleHidePdfPreview();
        }
        if ("pdfPreviewFollowHoverWhenPinned" in changes) {
          PdfPreview.followHoverWhenPinned = !!changes.pdfPreviewFollowHoverWhenPinned.newValue;
        }
      });
    } catch {}

    document.documentElement.appendChild(el);
    PdfPreview.el = el;
    return el;
  }

  function showFramePreviewForElement(elForRect, src, title) {
    if (!src) return;

    const el = ensurePdfPreviewEl();
    const wasHidden = el.style.display === "none";

    const shouldUpdate = !PdfPreview.pinned || PdfPreview.followHoverWhenPinned || wasHidden;

    if (shouldUpdate && PdfPreview.src !== src) {
      PdfPreview.src = src;

      const titleEl = el.querySelector("#doj-helper-pdf-title");
      if (titleEl) titleEl.textContent = title || "Preview";

      const openEl = el.querySelector("#doj-helper-pdf-open");
      if (openEl) openEl.href = src;

      if (PdfPreview.frame) PdfPreview.frame.src = src;
    }

    el.style.display = "block";

    if (PdfPreview.pinned && !wasHidden) return;

    if (PdfPreview.pinned && PdfPreview.pos) {
      el.style.left = `${PdfPreview.pos.left}px`;
      el.style.top = `${PdfPreview.pos.top}px`;
      return;
    }

    const r = elForRect.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const w = el.offsetWidth || 600;
    const h = el.offsetHeight || 800;

    let left = r.right + margin;
    if (left + w > vw - margin) left = r.left - w - margin;
    if (left < margin) left = margin;

    let top = r.top;
    if (top + h > vh - margin) top = vh - h - margin;
    if (top < margin) top = margin;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    if (PdfPreview.pinned) {
      PdfPreview.pos = { left: Math.round(left), top: Math.round(top) };
      try { chrome.storage?.local.set({ pdfPreviewPos: PdfPreview.pos }); } catch {}
    }
  }

  function showPdfPreviewForLink(a) {
    const src = getAllowedPdfUrl(a);
    if (!src) return;

    let title = "PDF";
    try {
      const u = new URL(src);
      title = decodeURIComponent(u.pathname.split("/").pop() || "PDF");
    } catch {}

    showFramePreviewForElement(a, src, title);
  }

  function showJmailPreviewForRow(row) {
    const src = getJmailThreadUrlFromRow(row);
    if (!src) return;
    showFramePreviewForElement(row, src, getJmailRowTitle(row));
  }

  window.__SNL.preview = {
    PdfPreview,
    isPdfLink,
    showPdfPreviewForLink,
    showJmailPreviewForRow,
    scheduleHidePdfPreview,
    hidePdfPreview,
  };
})();
