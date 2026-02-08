(() => {
  'use strict';

  window.__SNL = window.__SNL || {};

  const STATE = {
    ageClickAttempts: 0,
    lastAgeClickMs: 0,
    captchaNotified: false,
  };

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function tryClickAgeYes() {
    const gate = document.getElementById('age-verify-block');
    if (!gate) return;

    const yesBtn = document.getElementById('age-button-yes');
    if (!yesBtn || yesBtn.disabled) return;

    const success = document.getElementById('ageSuccess');
    if (success && isVisible(success)) return;

    if (STATE.ageClickAttempts >= 5) return;

    const now = Date.now();
    if (now - STATE.lastAgeClickMs < 750) return;

    STATE.lastAgeClickMs = now;
    STATE.ageClickAttempts++;
    console.debug(`[doj-helper] Clicking age gate Yes (attempt ${STATE.ageClickAttempts})`);
    yesBtn.click();
  }

  function findCaptchaElement() {
    return (
      document.querySelector("iframe[src*='recaptcha']") ||
      document.querySelector('.g-recaptcha') ||
      document.querySelector('#recaptcha') ||
      document.querySelector("input[name*='captcha' i]") ||
      document.querySelector("iframe[title*='recaptcha' i]")
    );
  }

  function ensureCaptchaBanner() {
    if (STATE.captchaNotified) return;
    const found = findCaptchaElement();
    if (!found) return;

    STATE.captchaNotified = true;
    console.warn('[doj-helper] CAPTCHA detected; user interaction required.');

    const banner = document.createElement('div');
    banner.id = 'doj-helper-captcha-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;margin-bottom:4px;">CAPTCHA detected</div>
          <div style="font-size:12px;line-height:1.35;">Please complete the verification manually. This extension does not automate CAPTCHA.</div>
        </div>
        <button type="button" aria-label="Dismiss" style="border:0;background:transparent;color:inherit;font-size:16px;line-height:1;cursor:pointer;">×</button>
      </div>
    `;

    Object.assign(banner.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: '2147483647',
      maxWidth: '320px',
      padding: '10px 12px',
      borderRadius: '10px',
      border: '1px solid rgba(0,0,0,0.25)',
      background: 'rgba(20,20,20,0.92)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
    });

    banner.querySelector('button')?.addEventListener('click', () => banner.remove());
    document.documentElement.appendChild(banner);
  }

  function resetAuthState() {
    STATE.ageClickAttempts = 0;
    STATE.lastAgeClickMs = 0;
    STATE.captchaNotified = false;
    document.getElementById('doj-helper-captcha-banner')?.remove();
  }

  function tick() {
    tryClickAgeYes();
    ensureCaptchaBanner();
  }

  // Expose minimal hooks (optional)
  window.__SNL.auth = { resetAuthState, tick };

  // Best-effort: allow the toolbar popup to trigger a “re-auth” cycle.
  try {
    chrome.runtime?.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'REAUTH') return;
      resetAuthState();
      tick();
    });
  } catch {}

  try {
    chrome.storage?.local.get({ reauthRequestedAt: 0 }, (v) => {
      if (!v?.reauthRequestedAt) return;
      if (Date.now() - v.reauthRequestedAt > 15000) return;
      chrome.storage?.local.remove('reauthRequestedAt');
      resetAuthState();
      tick();
    });
  } catch {}

  // Initial run
  tick();

  // Watch for late-injected DOM
  const mo = new MutationObserver(() => tick());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Retry briefly
  let retries = 0;
  const interval = setInterval(() => {
    tick();
    retries++;
    if (STATE.ageClickAttempts >= 5 || retries > 20) clearInterval(interval);
  }, 500);
})();
