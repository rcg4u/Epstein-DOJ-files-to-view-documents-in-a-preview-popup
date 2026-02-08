(() => {
  'use strict';

  const DEFAULTS = {
    pdfPreviewPinned: false,
    pdfPreviewFollowHoverWhenPinned: true,
  };

  function open(url) {
    chrome.tabs.create({ url });
    window.close();
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function setDisabled(el, v) {
    if (!el) return;
    el.disabled = v;
    el.style.opacity = v ? '0.55' : '1';
  }

  async function loadPrefs() {
    const v = await chrome.storage.local.get(DEFAULTS);
    const pin = !!v.pdfPreviewPinned;
    const follow = !!v.pdfPreviewFollowHoverWhenPinned;

    const pinEl = qs('pinPreview');
    const followEl = qs('followHover');

    if (pinEl) pinEl.checked = pin;
    if (followEl) followEl.checked = follow;

    setDisabled(followEl, !pin);
  }

  qs('openDoj')?.addEventListener('click', () => open('https://www.justice.gov/epstein'));
  qs('reportSmartScreen')?.addEventListener('click', () => open('https://www.microsoft.com/wdsi/support/report-unsafe-site'));

  qs('reloadExt')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) chrome.tabs.reload(tab.id);
    window.close();
  });

  qs('reauth')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const fallback = 'https://www.justice.gov/epstein';

    if (!tab?.id) {
      chrome.tabs.create({ url: fallback });
      window.close();
      return;
    }

    // Flag for the content script to reset its auth-related state after reload.
    await chrome.storage.local.set({ reauthRequestedAt: Date.now() });

    try {
      if (tab.url) {
        const u = new URL(tab.url);
        if (u.origin !== 'https://www.justice.gov') {
          await chrome.tabs.update(tab.id, { url: fallback });
          window.close();
          return;
        }
      }
    } catch {}

    chrome.tabs.reload(tab.id, { bypassCache: true });
    window.close();
  });

  qs('pinPreview')?.addEventListener('change', async (e) => {
    const pinned = !!e.target.checked;
    await chrome.storage.local.set({ pdfPreviewPinned: pinned });
    setDisabled(qs('followHover'), !pinned);
  });

  qs('followHover')?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ pdfPreviewFollowHoverWhenPinned: !!e.target.checked });
  });

  loadPrefs();
})();
