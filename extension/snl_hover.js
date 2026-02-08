(() => {
  'use strict';

  window.__SNL = window.__SNL || {};
  if (window.__SNL.hoverInstalled) return;
  window.__SNL.hoverInstalled = true;

  const preview = window.__SNL.preview;
  if (!preview) return;

  document.addEventListener('mouseover', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (preview.isPdfLink(a)) {
      preview.PdfPreview.link = a;
      preview.PdfPreview.overLink = true;
      if (preview.PdfPreview.hideTimer) window.clearTimeout(preview.PdfPreview.hideTimer);
      preview.PdfPreview.hideTimer = 0;
      preview.showPdfPreviewForLink(a);
      return;
    }

    if (location.hostname === 'jmail.world') {
      const row = e.target && e.target.closest ? e.target.closest('.email-row[data-doc-id]') : null;
      if (!row) return;
      preview.PdfPreview.link = row;
      preview.PdfPreview.overLink = true;
      if (preview.PdfPreview.hideTimer) window.clearTimeout(preview.PdfPreview.hideTimer);
      preview.PdfPreview.hideTimer = 0;
      preview.showJmailPreviewForRow(row);
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    const fromA = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    const fromRow = e.target && e.target.closest ? e.target.closest('.email-row[data-doc-id]') : null;
    const fromEl = fromA || fromRow;
    if (!fromEl || fromEl !== preview.PdfPreview.link) return;

    const related = e.relatedTarget;
    if (related && (fromEl.contains(related) || (preview.PdfPreview.el && preview.PdfPreview.el.contains(related)))) return;

    preview.PdfPreview.overLink = false;
    preview.scheduleHidePdfPreview();
  }, true);

  document.addEventListener('focusin', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!preview.isPdfLink(a)) return;
    preview.PdfPreview.overLink = true;
    preview.showPdfPreviewForLink(a);
  });

  document.addEventListener('focusout', (e) => {
    const fromA = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (fromA && fromA === preview.PdfPreview.link) preview.PdfPreview.overLink = false;
    preview.scheduleHidePdfPreview();
  });
})();
