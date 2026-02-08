(() => {
  'use strict';

  const statusEl = document.getElementById('status');
  const metaEl = document.getElementById('meta');
  const viewer = document.getElementById('viewer');
  const openOriginal = document.getElementById('openOriginal');

  const params = new URLSearchParams(location.search);
  const src = params.get('src');

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'error' : '';
  }

  function filenameFromUrl(u) {
    try {
      const url = new URL(u);
      const p = url.pathname.split('/').pop() || '';
      return decodeURIComponent(p);
    } catch {
      return '';
    }
  }

  if (!src) {
    setStatus('Missing ?src= PDF URL', true);
    metaEl.textContent = '';
    return;
  }

  const pdfUrl = src;

  let parsed;
  try {
    parsed = new URL(pdfUrl);
  } catch {
    setStatus('Invalid PDF URL', true);
    metaEl.textContent = '';
    return;
  }

  if (parsed.origin !== 'https://www.justice.gov' || !parsed.pathname.toLowerCase().endsWith('.pdf')) {
    setStatus('Blocked: only justice.gov PDF URLs are allowed', true);
    metaEl.textContent = pdfUrl;
    openOriginal.href = pdfUrl;
    return;
  }

  const file = filenameFromUrl(pdfUrl) || 'PDF';
  metaEl.textContent = `${file} — ${pdfUrl}`;
  openOriginal.href = pdfUrl;

  // Embed directly to avoid CORS issues with fetch() from chrome-extension:// origins.
  setStatus('Loading PDF…');
  viewer.src = pdfUrl;

  viewer.addEventListener('load', () => setStatus('Loaded.'), { once: true });

  // Some failures (e.g., frame restrictions) won’t reliably trigger an iframe error event.
  // Keep “Open original PDF” available as the fallback.
  viewer.addEventListener('error', () => {
    setStatus('Could not embed PDF here. Use “Open original PDF”.', true);
  }, { once: true });
})();
