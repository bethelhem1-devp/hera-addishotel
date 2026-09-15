/* ============================================================
   HERA ADDIS HOTEL — AI CHATBOT (Frontend)
   Vanilla JS, ES Module style syntax, no frameworks.
   Talks to /api/chat (Vercel Serverless Function) which in turn
   calls the Gemini API. The API key never touches the browser.
   ============================================================ */

(() => {
  "use strict";

  // ----------------------------------------------------------
  // Config
  // ----------------------------------------------------------
  const API_ENDPOINT = "/api/chat";
  const STORAGE_KEY = "heraChatHistory";
  const MAX_HISTORY_SENT = 12; // limit context sent to the API

  const WELCOME_MESSAGE =
    "Welcome to **Hera Addis Hotel**! 👋 I'm your virtual concierge. " +
    "Ask me about our rooms, amenities, restaurant, pool, airport shuttle, " +
    "parking, WiFi, location, or hotel policies — I'm happy to help.";

  const SUGGESTED_QUESTIONS = [
    "What room types do you offer?",
    "What time is check-in and check-out?",
    "Do you have a swimming pool?",
    "Is there an airport shuttle?",
    "Is WiFi free?",
    "What's your cancellation policy?",
  ];

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------
  let conversation = []; // { role: 'user' | 'assistant', content: string }
  let isWaitingForReply = false;

  // ----------------------------------------------------------
  // DOM references (populated in init)
  // ----------------------------------------------------------
  let els = {};

  // ----------------------------------------------------------
  // Init
  // ----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    els = {
      toggle: document.getElementById("heraChatToggle"),
      window: document.getElementById("heraChatWindow"),
      closeBtn: document.getElementById("heraChatClose"),
      messages: document.getElementById("heraChatMessages"),
      suggestions: document.getElementById("heraChatSuggestions"),
      form: document.getElementById("heraChatForm"),
      textarea: document.getElementById("heraChatTextarea"),
      sendBtn: document.getElementById("heraChatSend"),
    };

    if (!els.toggle || !els.window) return; // widget not present on this page

    loadHistory();
    renderSuggestions();
    bindEvents();

    if (conversation.length === 0) {
      addMessage("assistant", WELCOME_MESSAGE, { persist: true, animate: false });
    } else {
      renderStoredHistory();
    }
  }

  // ----------------------------------------------------------
  // Event bindings
  // ----------------------------------------------------------
  function bindEvents() {
    els.toggle.addEventListener("click", toggleChat);
    els.closeBtn.addEventListener("click", closeChat);

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSend();
    });

    // Enter sends, Shift+Enter makes a new line
    els.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize the textarea as the guest types
    els.textarea.addEventListener("input", () => {
      els.textarea.style.height = "auto";
      els.textarea.style.height = `${Math.min(els.textarea.scrollHeight, 90)}px`;
    });
  }

  // ----------------------------------------------------------
  // Open / close
  // ----------------------------------------------------------
  function toggleChat() {
    const isOpen = els.window.classList.toggle("is-open");
    els.toggle.classList.toggle("is-active", isOpen);
    els.toggle.classList.add("is-seen"); // stop the notification pulse once opened
    if (isOpen) {
      els.textarea.focus();
      scrollToBottom();
    }
  }

  function closeChat() {
    els.window.classList.remove("is-open");
    els.toggle.classList.remove("is-active");
  }

  // ----------------------------------------------------------
  // Suggested question chips
  // Clicking a chip only FILLS the input box as an example prompt —
  // it does NOT send automatically. The guest can edit it, then
  // send it themselves via Enter or the send button.
  // ----------------------------------------------------------
  function renderSuggestions() {
    els.suggestions.innerHTML = "";
    SUGGESTED_QUESTIONS.forEach((question) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "hera-chat-chip";
      chip.textContent = question;
      chip.addEventListener("click", () => {
        els.textarea.value = question;
        els.textarea.focus();
        // Place the cursor at the end of the inserted text
        els.textarea.setSelectionRange(question.length, question.length);
        // Trigger the same auto-resize logic used for manual typing
        els.textarea.dispatchEvent(new Event("input"));
      });
      els.suggestions.appendChild(chip);
    });
  }

  // ----------------------------------------------------------
  // Sending a message
  // ----------------------------------------------------------
  async function handleSend() {
    const text = els.textarea.value.trim();
    if (!text || isWaitingForReply) return;

    addMessage("user", text, { persist: true });
    els.textarea.value = "";
    els.textarea.style.height = "auto";
    setSendingState(true);
    showTypingIndicator();

    try {
      const reply = await fetchAssistantReply(text);
      hideTypingIndicator();
      addMessage("assistant", reply, { persist: true });
    } catch (err) {
      console.error("Hera Chat error:", err);
      hideTypingIndicator();
      addMessage(
        "assistant",
        "I'm sorry, I'm having trouble connecting right now. " +
          "Please contact our reception directly and they'll be glad to help.",
        { persist: true }
      );
    } finally {
      setSendingState(false);
    }
  }

  async function fetchAssistantReply(latestMessage) {
    const historyToSend = conversation.slice(-MAX_HISTORY_SENT);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: latestMessage,
        history: historyToSend,
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data.reply !== "string") {
      throw new Error("Malformed response from server");
    }

    return data.reply;
  }

  function setSendingState(sending) {
    isWaitingForReply = sending;
    els.sendBtn.disabled = sending;
    els.textarea.disabled = sending;
  }

  // ----------------------------------------------------------
  // Rendering messages
  // ----------------------------------------------------------
  function addMessage(role, content, { persist = false, animate = true } = {}) {
    if (persist) {
      conversation.push({ role, content });
      saveHistory();
    }
    renderMessage(role, content, animate);
    scrollToBottom();
  }

  function renderMessage(role, content, animate = true) {
    const bubble = document.createElement("div");
    bubble.className = `hera-chat-msg ${role === "user" ? "user" : "bot"}`;
    if (!animate) bubble.style.animation = "none";

    if (role === "assistant") {
      bubble.innerHTML = renderMarkdown(content);
    } else {
      bubble.textContent = content;
    }

    els.messages.appendChild(bubble);

    const time = document.createElement("div");
    time.className = "hera-chat-time";
    time.textContent = formatTime(new Date());
    els.messages.appendChild(time);
  }

  function renderStoredHistory() {
    conversation.forEach((msg) => renderMessage(msg.role, msg.content, false));
    scrollToBottom();
  }

  function showTypingIndicator() {
    const typing = document.createElement("div");
    typing.className = "hera-chat-typing";
    typing.id = "heraChatTypingIndicator";
    typing.innerHTML = "<span></span><span></span><span></span>";
    els.messages.appendChild(typing);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const typing = document.getElementById("heraChatTypingIndicator");
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ----------------------------------------------------------
  // Minimal, safe Markdown renderer
  // Supports: **bold**, *italic*, `code`, [text](url), line breaks,
  // and "- item" bullet lists. HTML is escaped first to prevent
  // any injected markup from the model being rendered as real HTML.
  // ----------------------------------------------------------
  function renderMarkdown(rawText) {
    let text = escapeHtml(rawText);

    // Bullet lists: turn consecutive "- " lines into <ul><li>
    text = text.replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (match, lead, block) => {
      const items = block
        .trim()
        .split("\n")
        .map((line) => `<li>${line.replace(/^- /, "").trim()}</li>`)
        .join("");
      return `${lead}<ul>${items}</ul>`;
    });

    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
    // Inline code
    text = text.replace(/`(.+?)`/g, "<code>$1</code>");
    // Links [text](url)
    text = text.replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Paragraphs: split on double line breaks, single breaks become <br>
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    return paragraphs || `<p>${text}</p>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ----------------------------------------------------------
  // Persistence (sessionStorage — clears when the tab is closed)
  // Keeps the conversation intact while a guest browses between
  // your site's pages during one visit.
  // ----------------------------------------------------------
  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch (err) {
      console.warn("Could not save chat history:", err);
    }
  }

  function loadHistory() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      conversation = stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.warn("Could not load chat history:", err);
      conversation = [];
    }
  }
})();