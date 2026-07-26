/**
 * Sovereign Matrix AI Chat Widget — Embeddable Script
 *
 * Usage: Add this to any website:
 * <script src="https://sovereignmatrix.agency/widget.js" data-umbra-owner="owner@email.com"></script>
 *
 * Optional config:
 * data-umbra-color="#00B7FF"
 * data-umbra-position="right" (or "left")
 * data-umbra-greeting="Hi! How can I help you today?"
 * data-umbra-business="Description of the business for AI context"
 */

(function () {
  "use strict";

  // Get config from script tag
  const script = document.currentScript;
  const baseUrl = script.src.replace("/widget.js", "");
  const ownerEmail =
    script.getAttribute("data-umbra-owner") || "admin@sovereignmatrix.agency";
  const primaryColor = script.getAttribute("data-umbra-color") || "#00B7FF";
  const position = script.getAttribute("data-umbra-position") || "right";
  const greeting =
    script.getAttribute("data-umbra-greeting") ||
    "Hi there! 👋 How can I help you today?";
  const businessDesc = script.getAttribute("data-umbra-business") || "";

  // State
  let isOpen = false;
  let messages = [{ role: "assistant", content: greeting }];
  let isTyping = false;

  // Create styles
  const style = document.createElement("style");
  style.textContent = `
    #umbra-widget-container * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    
    #umbra-widget-bubble {
      position: fixed; bottom: 24px; ${position}: 24px; z-index: 999999;
      width: 60px; height: 60px; border-radius: 50%;
      background: ${primaryColor}; color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 30px ${primaryColor}33;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none; outline: none;
    }
    #umbra-widget-bubble:hover { transform: scale(1.1); box-shadow: 0 6px 32px rgba(0,0,0,0.4), 0 0 50px ${primaryColor}55; }
    #umbra-widget-bubble svg { width: 28px; height: 28px; transition: transform 0.3s; }
    #umbra-widget-bubble.open svg { transform: rotate(90deg); }
    
    #umbra-widget-panel {
      position: fixed; bottom: 100px; ${position}: 24px; z-index: 999998;
      width: 380px; max-width: calc(100vw - 48px); height: 520px; max-height: calc(100vh - 140px);
      background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${primaryColor}11;
      display: flex; flex-direction: column;
      transform: scale(0.8) translateY(20px); opacity: 0; pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #umbra-widget-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    
    .umbra-header {
      padding: 16px 20px; background: #111; border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; gap: 12px;
    }
    .umbra-header-dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: umbra-pulse 2s infinite; }
    @keyframes umbra-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .umbra-header-text { font-size: 13px; font-weight: 700; color: white; letter-spacing: 0.1em; text-transform: uppercase; }
    .umbra-header-sub { font-size: 10px; color: #666; display: block; margin-top: 2px; letter-spacing: 0.05em; }
    
    .umbra-messages {
      flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin; scrollbar-color: #333 transparent;
    }
    
    .umbra-msg {
      max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5;
      animation: umbra-fade-in 0.3s ease-out;
    }
    @keyframes umbra-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .umbra-msg.assistant { background: #1a1a1a; color: #e0e0e0; align-self: flex-start; border-bottom-left-radius: 4px; }
    .umbra-msg.user { background: ${primaryColor}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    
    .umbra-typing { display: flex; gap: 4px; padding: 12px 16px; align-self: flex-start; }
    .umbra-typing span { 
      width: 8px; height: 8px; background: #444; border-radius: 50%;
      animation: umbra-bounce 1.2s infinite;
    }
    .umbra-typing span:nth-child(2) { animation-delay: 0.2s; }
    .umbra-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes umbra-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    
    .umbra-input-area {
      padding: 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; background: #0d0d0d;
    }
    .umbra-input {
      flex: 1; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 10px 16px; color: white; font-size: 14px; outline: none;
      transition: border-color 0.2s;
    }
    .umbra-input:focus { border-color: ${primaryColor}44; }
    .umbra-input::placeholder { color: #555; }
    .umbra-send {
      width: 40px; height: 40px; border-radius: 12px; background: ${primaryColor};
      border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .umbra-send:hover { opacity: 0.9; transform: scale(1.05); }
    .umbra-send:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
    
    .umbra-powered { padding: 8px; text-align: center; font-size: 10px; color: #444; letter-spacing: 0.1em; text-transform: uppercase; }
    .umbra-powered a { color: ${primaryColor}; text-decoration: none; font-weight: 700; }
  `;
  document.head.appendChild(style);

  // Create widget container
  const container = document.createElement("div");
  container.id = "umbra-widget-container";
  container.innerHTML = `
    <div id="umbra-widget-panel">
      <div class="umbra-header">
        <div class="umbra-header-dot"></div>
        <div>
          <div class="umbra-header-text">AI Assistant</div>
          <span class="umbra-header-sub">Typically replies instantly</span>
        </div>
      </div>
      <div class="umbra-messages" id="umbra-messages"></div>
      <div class="umbra-input-area">
        <input class="umbra-input" id="umbra-input" placeholder="Type a message..." autocomplete="off" />
        <button class="umbra-send" id="umbra-send" title="Send">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="umbra-powered">Powered by <a href="${baseUrl}" target="_blank">Sovereign Matrix</a></div>
    </div>
    <button id="umbra-widget-bubble" title="Chat with us">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  `;
  document.body.appendChild(container);

  // DOM refs
  const bubble = document.getElementById("umbra-widget-bubble");
  const panel = document.getElementById("umbra-widget-panel");
  const messagesEl = document.getElementById("umbra-messages");
  const input = document.getElementById("umbra-input");
  const sendBtn = document.getElementById("umbra-send");

  function renderMessages() {
    messagesEl.innerHTML =
      messages
        .map((m) => `<div class="umbra-msg ${m.role}">${m.content}</div>`)
        .join("") +
      (isTyping
        ? '<div class="umbra-typing"><span></span><span></span><span></span></div>'
        : "");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isTyping) return;

    messages.push({ role: "user", content: text });
    input.value = "";
    isTyping = true;
    renderMessages();

    try {
      const res = await fetch(baseUrl + "/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          widgetConfig: { ownerEmail, businessDescription: businessDesc },
        }),
      });
      const data = await res.json();
      messages.push({
        role: "assistant",
        content: data.message || "I'm here to help! Could you tell me more?",
      });
    } catch {
      messages.push({
        role: "assistant",
        content: "Sorry, I'm having a moment. Could you try again?",
      });
    }

    isTyping = false;
    renderMessages();
  }

  // Event listeners
  bubble.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    bubble.classList.toggle("open", isOpen);
    if (isOpen) {
      renderMessages();
      setTimeout(() => input.focus(), 300);
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Initial render
  renderMessages();
})();
