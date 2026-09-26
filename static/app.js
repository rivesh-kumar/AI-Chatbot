/**
 * NovaMind AI — Frontend Application Logic
 * Genuine Multi-Turn Context Memory & Real-Time OpenRouter Streaming
 */

let storedModel = localStorage.getItem('novamind_model') || 'openrouter/free';
if (storedModel.includes('llama-3.3-70b-instruct:free')) {
  storedModel = 'openrouter/free';
  localStorage.setItem('novamind_model', 'openrouter/free');
}

// Application State
const state = {
  currentSessionId: null,
  sessions: [],
  activeModel: storedModel,
  systemPrompt: localStorage.getItem('novamind_system_prompt') || '',
  contextTurnsLimit: parseInt(localStorage.getItem('novamind_context_limit') || '0', 10), // 0 = unlimited
  isGenerating: false,
  abortController: null,
  activeMode: 'study', // 'study' or 'chat'
  availableModels: [],
  hasEnvKey: false
};

// DOM Elements
const DOM = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
  btnNewChat: document.getElementById('btn-new-chat'),
  chatHistoryList: document.getElementById('chat-history-list'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  
  chatContainer: document.getElementById('chat-container'),
  heroScreen: document.getElementById('hero-screen'),
  messagesList: document.getElementById('messages-list'),
  
  userInput: document.getElementById('user-input'),
  btnSend: document.getElementById('btn-send'),
  btnStopStream: document.getElementById('btn-stop-stream'),
  btnMic: document.getElementById('btn-mic'),
  
  // Context Memory Elements
  contextPill: document.getElementById('context-pill'),
  contextPillText: document.getElementById('context-pill-text'),
  contextIndicatorTag: document.getElementById('context-indicator-tag'),
  contextTurnsCount: document.getElementById('context-turns-count'),
  sidebarContextSummary: document.getElementById('sidebar-context-summary'),
  openContextInspectorBtn: document.getElementById('open-context-inspector-btn'),
  
  modelDropdownBtn: document.getElementById('model-dropdown-btn'),
  modelMenu: document.getElementById('model-menu'),
  activeModelName: document.getElementById('active-model-name'),
  currentModelBadge: document.getElementById('current-model-badge'),
  
  themeToggle: document.getElementById('theme-toggle'),
  exportChatBtn: document.getElementById('export-chat-btn'),
  
  modeStudyBtn: document.getElementById('mode-study-btn'),
  modeChatBtn: document.getElementById('mode-chat-btn'),
  
  // Settings Modal
  settingsModal: document.getElementById('settings-modal'),
  openSettingsBtn: document.getElementById('open-settings-modal'),
  settingModelSelect: document.getElementById('setting-model-select'),
  settingSystemPrompt: document.getElementById('setting-system-prompt'),
  settingContextTurns: document.getElementById('setting-context-turns'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  
  // Context Inspector Modal
  contextInspectorModal: document.getElementById('context-inspector-modal'),
  inspTotalMessages: document.getElementById('insp-total-messages'),
  inspTurns: document.getElementById('insp-turns'),
  inspModel: document.getElementById('insp-model'),
  contextJsonDisplay: document.getElementById('context-json-display'),
  btnCopyContext: document.getElementById('btn-copy-context'),
  btnClearContextModal: document.getElementById('btn-clear-context-modal')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initMarkdown();
  initTheme();
  initStorage();
  checkConfig();
  fetchModels();
  bindEvents();
  updateContextIndicators();
  autoResizeInput();
});

// Configure Marked.js
function initMarkdown() {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      highlight: function(code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
      },
      breaks: true,
      gfm: true
    });
  }
}

// Check Backend Config for API Key
async function checkConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const data = await res.json();
    state.hasEnvKey = data.has_env_key;
    if (!state.systemPrompt && data.default_system_prompt) {
      state.systemPrompt = data.default_system_prompt;
    }
  } catch (e) {
    console.warn('Could not read /api/config', e);
  }
}

// Storage & Session Handling
function initStorage() {
  try {
    const saved = localStorage.getItem('novamind_sessions');
    state.sessions = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.sessions = [];
  }

  if (state.sessions.length > 0) {
    loadSession(state.sessions[0].id);
  } else {
    createNewSession();
  }
  renderHistoryList();
}

function saveSessions() {
  try {
    localStorage.setItem('novamind_sessions', JSON.stringify(state.sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
  }
}

function createNewSession() {
  const newId = 'session_' + Date.now();
  const session = {
    id: newId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: []
  };
  state.sessions.unshift(session);
  state.currentSessionId = newId;
  saveSessions();
  renderHistoryList();
  renderCurrentChat();
  updateContextIndicators();
  DOM.userInput.focus();
}

function getCurrentSession() {
  return state.sessions.find(s => s.id === state.currentSessionId);
}

function loadSession(id) {
  state.currentSessionId = id;
  renderHistoryList();
  renderCurrentChat();
  updateContextIndicators();
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.sessions.length === 0) {
    createNewSession();
  } else if (state.currentSessionId === id) {
    state.currentSessionId = state.sessions[0].id;
  }
  saveSessions();
  renderHistoryList();
  renderCurrentChat();
  updateContextIndicators();
}

// Fetch Models
async function fetchModels() {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) return;
    const models = await res.json();
    state.availableModels = models;
    renderModelDropdown(models);
  } catch (err) {
    console.warn('Unable to load models list from server:', err);
  }
}

function renderModelDropdown(models) {
  DOM.modelMenu.innerHTML = '';
  DOM.settingModelSelect.innerHTML = '';

  models.forEach(m => {
    // Menu item
    const item = document.createElement('div');
    item.className = `model-menu-item ${m.id === state.activeModel ? 'selected' : ''}`;
    item.innerHTML = `
      <strong>
        <span>${m.name}</span>
        <span style="color:var(--accent-emerald)">${m.speed}</span>
      </strong>
      <small>${m.provider} • Context: ${m.context}</small>
    `;
    item.addEventListener('click', () => {
      selectModel(m.id, m.name);
      DOM.modelMenu.classList.remove('open');
    });
    DOM.modelMenu.appendChild(item);

    // Settings select option
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.context})`;
    if (m.id === state.activeModel) opt.selected = true;
    DOM.settingModelSelect.appendChild(opt);
  });
}

function selectModel(id, name) {
  state.activeModel = id;
  DOM.activeModelName.textContent = name;
  DOM.currentModelBadge.textContent = name.split(' ')[0] + ' ' + (name.split(' ')[1] || '');
  renderModelDropdown(state.availableModels);
  updateContextIndicators();
}

// Render History
function renderHistoryList() {
  DOM.chatHistoryList.innerHTML = '';
  state.sessions.forEach(sess => {
    const item = document.createElement('div');
    item.className = `history-item ${sess.id === state.currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="history-item-title">${escapeHtml(sess.title)}</span>
      <button class="history-item-del" title="Delete Conversation">&times;</button>
    `;
    item.addEventListener('click', () => loadSession(sess.id));
    item.querySelector('.history-item-del').addEventListener('click', (e) => deleteSession(sess.id, e));
    DOM.chatHistoryList.appendChild(item);
  });
}

// Render Current Chat Messages
function renderCurrentChat() {
  const session = getCurrentSession();
  if (!session || session.messages.length === 0) {
    DOM.heroScreen.style.display = 'flex';
    DOM.messagesList.innerHTML = '';
    return;
  }

  DOM.heroScreen.style.display = 'none';
  DOM.messagesList.innerHTML = '';

  session.messages.forEach((msg, idx) => {
    appendMessageElement(msg.role, msg.content, msg.meta, false, idx);
  });

  scrollToBottom();
}

// Context Management Helpers
function getActiveContextMessages(includeGoal = null) {
  const session = getCurrentSession();
  const rawHistory = session ? [...session.messages] : [];

  // Limit turns if configured
  let historyToInclude = rawHistory;
  if (state.contextTurnsLimit > 0 && rawHistory.length > state.contextTurnsLimit) {
    historyToInclude = rawHistory.slice(-state.contextTurnsLimit);
  }

  const messages = [];

  // 1. System Prompt
  const sysPrompt = state.systemPrompt.trim();
  if (sysPrompt) {
    messages.push({ role: 'system', content: sysPrompt });
  }

  // 2. Multi-turn history
  historyToInclude.forEach(m => {
    messages.push({ role: m.role, content: m.content });
  });

  // 3. Current goal (if not already included)
  if (includeGoal && includeGoal.trim()) {
    if (!messages.length || messages[messages.length - 1].content !== includeGoal.trim()) {
      messages.push({ role: 'user', content: includeGoal.trim() });
    }
  }

  return messages;
}

function updateContextIndicators() {
  const session = getCurrentSession();
  const msgCount = session ? session.messages.length : 0;
  const turnsCount = Math.floor(msgCount / 2);

  const totalWithSys = msgCount + 1; // +1 for system prompt
  DOM.contextPillText.textContent = `🧠 Context: ${totalWithSys} msgs (${turnsCount} turns)`;
  DOM.contextTurnsCount.textContent = `${turnsCount} turns (${totalWithSys} msgs in LLM)`;
  DOM.sidebarContextSummary.textContent = `${totalWithSys} messages in context`;
}

// Open Context Window Inspector Modal
function openContextInspector() {
  const messages = getActiveContextMessages();
  const session = getCurrentSession();
  const turns = session ? Math.floor(session.messages.length / 2) : 0;

  DOM.inspTotalMessages.textContent = messages.length;
  DOM.inspTurns.textContent = turns;
  DOM.inspModel.textContent = state.activeModel.split('/')[1] || state.activeModel;

  DOM.contextJsonDisplay.textContent = JSON.stringify(messages, null, 2);
  if (typeof hljs !== 'undefined') {
    hljs.highlightElement(DOM.contextJsonDisplay);
  }

  openModal(DOM.contextInspectorModal);
}

// Event Bindings
function bindEvents() {
  // Sidebar Toggle
  DOM.sidebarToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('collapsed');
  });

  DOM.mobileSidebarToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('open');
  });

  // New Chat
  DOM.btnNewChat.addEventListener('click', createNewSession);

  // Clear History
  DOM.btnClearHistory.addEventListener('click', () => {
    if (confirm('Clear all conversation history?')) {
      state.sessions = [];
      createNewSession();
    }
  });

  // Context Inspector Triggers
  DOM.contextPill.addEventListener('click', openContextInspector);
  DOM.openContextInspectorBtn.addEventListener('click', openContextInspector);
  DOM.contextIndicatorTag.addEventListener('click', openContextInspector);

  DOM.btnCopyContext.addEventListener('click', () => {
    navigator.clipboard.writeText(DOM.contextJsonDisplay.textContent);
    DOM.btnCopyContext.textContent = 'Copied!';
    setTimeout(() => { DOM.btnCopyContext.textContent = 'Copy JSON'; }, 2000);
  });

  DOM.btnClearContextModal.addEventListener('click', () => {
    const session = getCurrentSession();
    if (session) {
      session.messages = [];
      saveSessions();
      renderCurrentChat();
      updateContextIndicators();
      openContextInspector();
    }
  });

  // Model Menu Trigger
  DOM.modelDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.modelMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    DOM.modelMenu.classList.remove('open');
  });

  // Textarea Auto-expand & Enter to Send
  DOM.userInput.addEventListener('input', autoResizeInput);
  DOM.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  DOM.btnSend.addEventListener('click', handleSend);
  DOM.btnStopStream.addEventListener('click', stopGenerating);

  // Quick Inspiration Prompt Chips
  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const promptText = card.getAttribute('data-prompt');
      DOM.userInput.value = promptText;
      autoResizeInput();
      handleSend();
    });
  });

  // Mode Switches
  DOM.modeStudyBtn.addEventListener('click', () => {
    state.activeMode = 'study';
    DOM.modeStudyBtn.classList.add('active');
    DOM.modeChatBtn.classList.remove('active');
    DOM.userInput.placeholder = "Ask a question or enter your study goal...";
  });

  DOM.modeChatBtn.addEventListener('click', () => {
    state.activeMode = 'chat';
    DOM.modeChatBtn.classList.add('active');
    DOM.modeStudyBtn.classList.remove('active');
    DOM.userInput.placeholder = "Ask anything, clarify doubts, or continue the discussion...";
  });

  // Modals Open/Close
  DOM.openSettingsBtn.addEventListener('click', openSettings);

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // Settings Save
  DOM.btnSaveSettings.addEventListener('click', saveSettings);

  // Export to Markdown
  DOM.exportChatBtn.addEventListener('click', exportChatToMarkdown);

  // Voice Input (Speech to Text)
  initSpeechRecognition();

  // Keyboard Shortcuts (Ctrl+K = New Chat, Ctrl+B = Toggle Sidebar)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      createNewSession();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      DOM.sidebar.classList.toggle('collapsed');
    }
  });
}

function autoResizeInput() {
  DOM.userInput.style.height = 'auto';
  DOM.userInput.style.height = Math.min(DOM.userInput.scrollHeight, 180) + 'px';
}

function openModal(modal) {
  modal.classList.add('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

function openSettings() {
  DOM.settingSystemPrompt.value = state.systemPrompt;
  DOM.settingContextTurns.value = state.contextTurnsLimit.toString();
  DOM.settingModelSelect.value = state.activeModel;
  openModal(DOM.settingsModal);
}

async function saveSettings() {
  state.systemPrompt = DOM.settingSystemPrompt.value.trim();
  state.contextTurnsLimit = parseInt(DOM.settingContextTurns.value, 10);
  state.activeModel = DOM.settingModelSelect.value;

  localStorage.setItem('novamind_system_prompt', state.systemPrompt);
  localStorage.setItem('novamind_context_limit', state.contextTurnsLimit.toString());

  // Update dropdown display
  const selectedOpt = DOM.settingModelSelect.selectedOptions[0];
  if (selectedOpt) {
    selectModel(state.activeModel, selectedOpt.textContent.split(' (')[0]);
  }

  updateContextIndicators();
  closeAllModals();
}

// Light/Dark Theme Switcher
function initTheme() {
  const isLight = localStorage.getItem('novamind_theme') === 'light';
  if (isLight) {
    document.body.classList.add('light-theme');
  }

  DOM.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const currentIsLight = document.body.classList.contains('light-theme');
    localStorage.setItem('novamind_theme', currentIsLight ? 'light' : 'dark');
  });
}

// Send Message Flow with Real Multi-Turn Context
async function handleSend() {
  if (state.isGenerating) return;

  const text = DOM.userInput.value.trim();
  if (!text) return;

  DOM.userInput.value = '';
  autoResizeInput();
  DOM.heroScreen.style.display = 'none';

  const session = getCurrentSession();
  if (!session) return;

  // Set chat title from first prompt
  if (session.messages.length === 0) {
    session.title = text.length > 28 ? text.slice(0, 28) + '...' : text;
    saveSessions();
    renderHistoryList();
  }

  // 1. Append User Message
  session.messages.push({ role: 'user', content: text });
  appendMessageElement('user', text);
  saveSessions();
  updateContextIndicators();

  // 2. Prepare Multi-Turn History Payload
  // Include all prior turns up to the context turns limit
  let historyPayload = session.messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  if (state.contextTurnsLimit > 0 && historyPayload.length > state.contextTurnsLimit) {
    historyPayload = historyPayload.slice(-state.contextTurnsLimit);
  }

  // 3. Append Assistant Placeholder
  const assistantBubble = appendMessageElement('assistant', '', null, true);
  scrollToBottom();

  state.isGenerating = true;
  setGeneratingUI(true);
  state.abortController = new AbortController();

  let accumulatedText = '';
  let contextCount = historyPayload.length + 1;

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: text,
        history: historyPayload,
        model: state.activeModel,
        system_instruction: state.systemPrompt || undefined
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    // Remove thinking indicator
    const thinking = assistantBubble.querySelector('.thinking-indicator');
    if (thinking) thinking.remove();

    // Stream Reading Loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr) continue;

        try {
          const payload = JSON.parse(jsonStr);

          if (payload.context_count) {
            contextCount = payload.context_count;
          }

          if (payload.chunk) {
            accumulatedText += payload.chunk;
            renderStreamingText(assistantBubble, accumulatedText);
            scrollToBottom();
          }
        } catch (e) {
          console.error('Error parsing SSE stream line:', e);
        }
      }
    }

    // Finalize assistant message with full context record
    renderFinalAssistantMessage(assistantBubble, accumulatedText, {
      contextCount: contextCount
    });

    session.messages.push({
      role: 'assistant',
      content: accumulatedText,
      meta: {
        contextCount: contextCount
      }
    });
    saveSessions();
    updateContextIndicators();

  } catch (err) {
    if (err.name === 'AbortError') {
      renderFinalAssistantMessage(assistantBubble, accumulatedText + '\n\n*(Response stopped by user)*', null);
      session.messages.push({ role: 'assistant', content: accumulatedText });
      saveSessions();
      updateContextIndicators();
    } else {
      console.error('Chat context streaming error:', err);
      const errText = `\n\n⚠️ **Context Connection Notice:** ${err.message}`;
      renderFinalAssistantMessage(assistantBubble, accumulatedText + errText, null);
    }
  } finally {
    state.isGenerating = false;
    setGeneratingUI(false);
  }
}

function stopGenerating() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

function setGeneratingUI(generating) {
  if (generating) {
    DOM.btnSend.classList.add('hidden');
    DOM.btnStopStream.classList.remove('hidden');
  } else {
    DOM.btnSend.classList.remove('hidden');
    DOM.btnStopStream.classList.add('hidden');
  }
}

// UI Rendering Functions
function appendMessageElement(role, content, meta = null, isLive = false, msgIndex = null) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'user' ? '👤' : '🧠';

  const contentCol = document.createElement('div');
  contentCol.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    if (isLive) {
      bubble.innerHTML = `
        <div class="thinking-indicator">
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
          <span>Processing prompt with full context memory...</span>
        </div>
      `;
    } else {
      bubble.innerHTML = formatMarkdownContent(content);
      attachChecklistListeners(bubble);
      addCodeCopyButtons(bubble);
    }
  }

  contentCol.appendChild(bubble);

  if (role === 'assistant' && !isLive) {
    const metaBar = createActionBar(content, meta);
    contentCol.appendChild(metaBar);
  }

  row.appendChild(avatar);
  row.appendChild(contentCol);
  DOM.messagesList.appendChild(row);

  return bubble;
}

function renderStreamingText(bubble, text) {
  bubble.innerHTML = formatMarkdownContent(text) + '<span class="streaming-cursor"></span>';
  attachChecklistListeners(bubble);
  addCodeCopyButtons(bubble);
}

function renderFinalAssistantMessage(bubble, text, meta) {
  bubble.innerHTML = formatMarkdownContent(text);
  attachChecklistListeners(bubble);
  addCodeCopyButtons(bubble);

  const parentCol = bubble.parentElement;
  if (!parentCol.querySelector('.message-actions')) {
    const metaBar = createActionBar(text, meta);
    parentCol.appendChild(metaBar);
  }
}

function createActionBar(content, meta) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  if (meta && meta.contextCount) {
    const contextTag = document.createElement('span');
    contextTag.className = 'meta-latency-tag';
    contextTag.innerHTML = `🧠 <strong>${meta.contextCount} msgs</strong> in LLM context`;
    actions.appendChild(contextTag);
  }

  // Copy Full Response Button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn-sm';
  copyBtn.innerHTML = `<span>📋 Copy</span>`;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(content);
    copyBtn.innerHTML = `<span>✓ Copied</span>`;
    setTimeout(() => { copyBtn.innerHTML = `<span>📋 Copy</span>`; }, 2000);
  });
  actions.appendChild(copyBtn);

  // Read Aloud (TTS) Button
  if ('speechSynthesis' in window) {
    const speakBtn = document.createElement('button');
    speakBtn.className = 'action-btn-sm';
    speakBtn.innerHTML = `<span>🔊 Read</span>`;
    speakBtn.addEventListener('click', () => speakText(content, speakBtn));
    actions.appendChild(speakBtn);
  }

  return actions;
}

// Markdown Formatter with Checklist & Syntax Support
function formatMarkdownContent(rawMarkdown) {
  if (typeof marked === 'undefined') {
    return escapeHtml(rawMarkdown).replace(/\n/g, '<br/>');
  }

  let parsed = marked.parse(rawMarkdown);

  // Replace Markdown tasks with interactive checkboxes
  parsed = parsed.replace(/\[ \]\s?(.*?)(?=(<\/li>|<br\s*\/?>|$))/g, 
    '<label class="checklist-item"><input type="checkbox" class="checklist-checkbox"><span>$1</span></label>'
  );
  parsed = parsed.replace(/\[x\]\s?(.*?)(?=(<\/li>|<br\s*\/?>|$))/gi, 
    '<label class="checklist-item completed"><input type="checkbox" class="checklist-checkbox" checked><span>$1</span></label>'
  );

  return parsed;
}

function attachChecklistListeners(container) {
  container.querySelectorAll('.checklist-checkbox').forEach(cb => {
    cb.onchange = () => {
      const parentLabel = cb.closest('.checklist-item');
      if (parentLabel) {
        if (cb.checked) {
          parentLabel.classList.add('completed');
        } else {
          parentLabel.classList.remove('completed');
        }
      }
    };
  });
}

function addCodeCopyButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-header';

    const codeEl = pre.querySelector('code');
    const langMatch = codeEl ? codeEl.className.match(/language-(\w+)/) : null;
    const lang = langMatch ? langMatch[1] : 'code';

    header.innerHTML = `
      <span>${lang}</span>
      <button class="btn-copy-code">Copy</button>
    `;

    header.querySelector('.btn-copy-code').addEventListener('click', () => {
      const codeText = pre.innerText;
      navigator.clipboard.writeText(codeText);
      const btn = header.querySelector('.btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

// Voice Recognition (Speech to Text)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    DOM.btnMic.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isRecording = false;

  DOM.btnMic.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    isRecording = true;
    DOM.btnMic.classList.add('recording');
    DOM.userInput.placeholder = "Listening... Speak now...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    DOM.userInput.value = transcript;
    autoResizeInput();
  };

  recognition.onend = () => {
    isRecording = false;
    DOM.btnMic.classList.remove('recording');
    DOM.userInput.placeholder = "Ask a question or follow up on previous answers...";
  };

  recognition.onerror = () => {
    isRecording = false;
    DOM.btnMic.classList.remove('recording');
  };
}

// Text-to-Speech (Read Aloud)
function speakText(content, btn) {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.innerHTML = `<span>🔊 Read</span>`;
    return;
  }

  const cleanText = content
    .replace(/[#*`_\[\]()]/g, '')
    .replace(/<[^>]*>/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  utterance.onstart = () => { btn.innerHTML = `<span>⏹ Stop</span>`; };
  utterance.onend = () => { btn.innerHTML = `<span>🔊 Read</span>`; };
  utterance.onerror = () => { btn.innerHTML = `<span>🔊 Read</span>`; };

  window.speechSynthesis.speak(utterance);
}

// Export Chat to Markdown
function exportChatToMarkdown() {
  const session = getCurrentSession();
  if (!session || session.messages.length === 0) {
    alert('No conversation to export yet.');
    return;
  }

  let mdContent = `# ${session.title}\n*Created: ${new Date(session.createdAt).toLocaleString()}*\n\n---\n\n`;
  session.messages.forEach(msg => {
    mdContent += `### ${msg.role === 'user' ? '👤 User' : '🧠 NovaMind AI'}\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function scrollToBottom() {
  DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return (text || '').replace(/[&<>"']/g, m => map[m]);
}
