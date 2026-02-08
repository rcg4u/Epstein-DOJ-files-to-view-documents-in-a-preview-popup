(() => {
  'use strict';

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'OPEN_NERD_VIEW' || !msg.src) return;

    const nerdUrl = chrome.runtime.getURL('nerd_view.html') + '?src=' + encodeURIComponent(msg.src);
    chrome.tabs.create({ url: nerdUrl });
  });
})();
