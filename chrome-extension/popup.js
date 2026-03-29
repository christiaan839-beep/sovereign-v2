document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const currentUrlEl = document.getElementById('currentUrl');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsSection = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');
  const clearResultsBtn = document.getElementById('clearResults');
  const errorEl = document.getElementById('error');
  const quickBtns = document.querySelectorAll('.quick-btn');

  let targetUrl = '';

  // --- Initialization ---

  // Load saved API key
  chrome.storage.local.get('apiKey', (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Get the current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      targetUrl = tabs[0].url;
      currentUrlEl.textContent = truncateUrl(targetUrl);
    }
  });

  // Check for a pending URL from the context menu
  chrome.runtime.sendMessage({ type: 'GET_PENDING_URL' }, (response) => {
    if (response?.url) {
      targetUrl = response.url;
      currentUrlEl.textContent = truncateUrl(targetUrl);
    }
  });

  // --- Event Handlers ---

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ apiKey: key });
      saveKeyBtn.textContent = 'Saved';
      setTimeout(() => { saveKeyBtn.textContent = 'Save'; }, 1500);
    }
  });

  analyzeBtn.addEventListener('click', () => {
    runAnalysis(targetUrl, 'full-analysis');
  });

  quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      runAnalysis(targetUrl, action);
    });
  });

  clearResultsBtn.addEventListener('click', () => {
    resultsSection.classList.remove('visible');
    resultsContent.textContent = '';
  });

  // --- Core Logic ---

  function runAnalysis(url, action) {
    if (!url) {
      showError('No URL detected. Navigate to a page first.');
      return;
    }

    hideError();
    showLoading();

    const apiKey = apiKeyInput.value.trim();

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_SITE', url, action, apiKey },
      (response) => {
        hideLoading();

        if (chrome.runtime.lastError) {
          showError('Extension error: ' + chrome.runtime.lastError.message);
          return;
        }

        if (response?.success) {
          displayResults(response.data);
        } else {
          showError(response?.error || 'Analysis failed. Check your API key and try again.');
        }
      }
    );
  }

  function displayResults(data) {
    resultsSection.classList.add('visible');

    if (typeof data === 'string') {
      resultsContent.textContent = data;
    } else if (data?.result) {
      resultsContent.textContent = data.result;
    } else if (data?.summary) {
      resultsContent.textContent = data.summary;
    } else {
      resultsContent.textContent = JSON.stringify(data, null, 2);
    }
  }

  function showLoading() {
    analyzeBtn.disabled = true;
    // Use safe DOM methods instead of innerHTML
    analyzeBtn.textContent = '';
    const loadingSpan = document.createElement('span');
    loadingSpan.className = 'loading';
    const spinnerSpan = document.createElement('span');
    spinnerSpan.className = 'spinner';
    loadingSpan.appendChild(spinnerSpan);
    loadingSpan.appendChild(document.createTextNode(' Agents working...'));
    analyzeBtn.appendChild(loadingSpan);
    resultsSection.classList.remove('visible');
  }

  function hideLoading() {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze This Page';
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }

  function hideError() {
    errorEl.classList.remove('visible');
  }

  function truncateUrl(url) {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
});
