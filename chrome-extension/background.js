const API_BASE = 'https://sovereignmatrix.agency/api/v1/agents';

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sovereign-analyze',
    title: 'Analyze with Sovereign Matrix',
    contexts: ['page', 'link'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sovereign-analyze') {
    const targetUrl = info.linkUrl || info.pageUrl || tab.url;

    // Store the URL so the popup can pick it up
    chrome.storage.local.set({ pendingUrl: targetUrl }, () => {
      // Open the popup programmatically
      chrome.action.openPopup();
    });
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYZE_SITE') {
    analyzeSite(message.url, message.action, message.apiKey)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'GET_PENDING_URL') {
    chrome.storage.local.get('pendingUrl', (result) => {
      sendResponse({ url: result.pendingUrl || null });
      // Clear it after reading
      chrome.storage.local.remove('pendingUrl');
    });
    return true;
  }
});

async function analyzeSite(url, action, apiKey) {
  const endpoint = `${API_BASE}/site-assassin`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ url, action: action || 'full-analysis' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}
