// odyssey/assets/chat-popup.js
(function(){
  /* ---------- Templates ---------- */
  const tpl = `
  <div id="ai-chat-popup" style="display:none;">
    <div id="ai-chat-header">
      <div class="title">Odyssey AI</div>
      <div id="ai-chat-controls">
        <button id="od-open-agent" title="Agent: build landing page">⚙️ Agent</button>
        <button id="od-toggle-theme" title="Toggle theme">🌓</button>
        <button id="od-open-settings" title="Settings">⚙</button>
        <button id="ai-chat-close" title="Close">✕</button>
      </div>
    </div>

    <div id="ai-chat-messages" aria-live="polite"></div>

    <div id="ai-chat-input">
      <textarea id="ai-chat-text" placeholder="سوال یا درخواستت رو اینجا بنویس..."></textarea>
      <button id="ai-chat-send">ارسال</button>
    </div>

    <div id="od-footer" style="display:none;">
      <button id="od-preview-btn">Preview Generated Page</button>
      <button id="od-insert-btn">Insert into Editor</button>
      <button id="od-clear-history">Clear History</button>
    </div>

    <div id="od-settings">
      <label>Model</label>
      <select id="od-model">
        <option value="gpt-4">gpt-4</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4o">gpt-4o</option>
      </select>
      <label>Temperature (0-1)</label>
      <input id="od-temp" type="number" min="0" max="1" step="0.1" value="0.3" />
      <label>Agent Mode</label>
      <select id="od-agent-mode">
        <option value="off">Off (chat)</option>
        <option value="landing">Landing Page Generator</option>
      </select>
      <label>Estimated tokens limit</label>
      <input id="od-max-tokens" type="number" min="256" max="8000" step="1" value="1500" />
      <div style="margin-top:8px;">
        <button id="od-save-settings">Save</button>
      </div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);

  /* ---------- Elements ---------- */
  const popup = document.getElementById('ai-chat-popup');
  const openBtn = document.createElement('button');
  openBtn.id = 'ai-chat-open-btn';
  openBtn.textContent = '💬';
  document.body.appendChild(openBtn);

  const messagesEl = document.getElementById('ai-chat-messages');
  const textarea = document.getElementById('ai-chat-text');
  const sendBtn = document.getElementById('ai-chat-send');
  const closeBtn = document.getElementById('ai-chat-close');
  const openAgentBtn = document.getElementById('od-open-agent');
  const previewBtn = document.getElementById('od-preview-btn');
  const insertBtn = document.getElementById('od-insert-btn');
  const footer = document.getElementById('od-footer');
  const settingsBtn = document.getElementById('od-open-settings');
  const settingsPanel = document.getElementById('od-settings');
  const themeToggle = document.getElementById('od-toggle-theme');
  const saveSettingsBtn = document.getElementById('od-save-settings');
  const modelSelect = document.getElementById('od-model');
  const tempInput = document.getElementById('od-temp');
  const agentModeSelect = document.getElementById('od-agent-mode');
  const maxTokensInput = document.getElementById('od-max-tokens');
  const clearHistoryBtn = document.getElementById('od-clear-history');

  /* ---------- State ---------- */
  let state = {
    theme: localStorage.getItem('odyssey_theme') || 'dark',
    history: JSON.parse(localStorage.getItem('odyssey_hist') || '[]'),
    settings: JSON.parse(localStorage.getItem('odyssey_settings') || '{}'),
    lastGenerated: null, // {html, css}
  };

  function saveState() {
    localStorage.setItem('odyssey_hist', JSON.stringify(state.history));
    localStorage.setItem('odyssey_settings', JSON.stringify(state.settings));
  }

  /* ---------- Theme handling ---------- */
  function applyTheme(mode) {
    document.documentElement.classList.remove('od-theme-dark','od-theme-light');
    if (mode === 'light') {
      document.documentElement.classList.add('od-theme-light');
      state.theme = 'light';
    } else {
      document.documentElement.classList.remove('od-theme-light');
      state.theme = 'dark';
    }
    localStorage.setItem('odyssey_theme', state.theme);
  }
  applyTheme(state.theme);

  /* ---------- UI helper ---------- */
  function appendMsg(role, text, raw=false){
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-chat-msg ' + (role === 'user' ? 'user' : 'bot');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!raw) {
      state.history.push({role, text, t: Date.now()});
      saveState();
    }
  }

  /* ---------- Sanitizer (very basic) ---------- */
  function sanitizeHtml(input) {
    // Remove script tags and on* attributes (very simple approach)
    let out = input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    out = out.replace(/on\w+="[^"]*"/gi, '');
    out = out.replace(/on\w+='[^']*'/gi, '');
    // optionally remove <iframe> tags
    out = out.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
    return out;
  }

  /* ---------- API call ---------- */
  async function callProxy(messages, model, temperature, max_tokens) {
    try {
      const resp = await fetch('/odyssey/api_proxy.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({model, messages, temperature, max_tokens})
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:'unknown'}));
        throw new Error(JSON.stringify(err));
      }
      const data = await resp.json();
      return data;
    } catch (e) {
      throw e;
    }
  }

  /* ---------- Chat send ---------- */
  sendBtn.addEventListener('click', async ()=>{
    const txt = textarea.value.trim();
    if (!txt) return;
    textarea.value = '';
    appendMsg('user', txt);
    appendMsg('bot', 'در حال دریافت پاسخ...');
    try {
      const model = state.settings.model || modelSelect.value || 'gpt-4';
      const temp = parseFloat(state.settings.temperature ?? state.settings.temp ?? tempInput.value) || 0.3;
      const maxT = parseInt(state.settings.max_tokens ?? maxTokensInput.value) || 1500;
      const messages = [
        {role:'system', content: 'You are a helpful assistant. Answer concisely in Persian when appropriate.'},
        {role:'user', content: txt}
      ];
      const data = await callProxy(messages, model, temp, maxT);
      // remove last "در حال..." message
      const lastBot = messagesEl.querySelector('.ai-chat-msg.bot:last-child');
      if (lastBot) lastBot.remove();
      const answer = data?.choices?.[0]?.message?.content || JSON.stringify(data).slice(0,300);
      appendMsg('bot', answer);
    } catch (err) {
      const lastBot = messagesEl.querySelector('.ai-chat-msg.bot:last-child');
      if (lastBot) lastBot.remove();
      appendMsg('bot', 'خطا در برقراری ارتباط: ' + (err.message || err));
      console.error(err);
    }
  });

  textarea.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  /* ---------- settings UI ---------- */
  settingsBtn.addEventListener('click', ()=>{
    settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
    // populate with saved
    modelSelect.value = state.settings.model || modelSelect.value;
    tempInput.value = state.settings.temperature ?? tempInput.value;
    agentModeSelect.value = state.settings.agentMode || agentModeSelect.value;
    maxTokensInput.value = state.settings.max_tokens ?? maxTokensInput.value;
  });
  saveSettingsBtn.addEventListener('click', ()=>{
    state.settings.model = modelSelect.value;
    state.settings.temperature = parseFloat(tempInput.value);
    state.settings.agentMode = agentModeSelect.value;
    state.settings.max_tokens = parseInt(maxTokensInput.value);
    saveState();
    settingsPanel.style.display = 'none';
    appendMsg('bot','تنظیمات ذخیره شد.');
  });

  /* ---------- theme toggle ---------- */
  themeToggle.addEventListener('click', ()=>{
    const mode = (state.theme === 'dark') ? 'light' : 'dark';
    applyTheme(mode);
    appendMsg('bot', 'تم به ' + mode + ' تغییر یافت.');
  });

  /* ---------- open/close ---------- */
  openBtn.addEventListener('click', ()=> popup.style.display = popup.style.display === 'none' ? 'flex' : 'none' );
  closeBtn.addEventListener('click', ()=> popup.style.display = 'none' );

  /* ---------- History, clear ---------- */
  function renderHistory() {
    messagesEl.innerHTML = '';
    state.history.slice(-200).forEach(h=>{
      const role = h.role;
      appendMsg(role, h.text, true);
    });
  }
  renderHistory();
  clearHistoryBtn.addEventListener('click', ()=> {
    state.history = [];
    saveState();
    messagesEl.innerHTML = '';
    appendMsg('bot','تاریخچه پاک شد.');
  });

  /* ---------- Agent: Landing Page Generator (multi-step) ---------- */
  async function runLandingAgent() {
    // brief form sequence
    const brief = await promptBrief();
    if (!brief) return appendMsg('bot','ساخت لندینگ پیج کنسل شد.');

    appendMsg('user', 'Agent brief: ' + JSON.stringify(brief).slice(0,300));
    appendMsg('bot', 'درخواست ساختار صفحه...');

    const model = state.settings.model || modelSelect.value || 'gpt-4';
    const temp = parseFloat(state.settings.temperature ?? tempInput.value) || 0.2;
    const maxT = parseInt(state.settings.max_tokens ?? maxTokensInput.value) || 2000;

    try {
      // Step A: structure (ask for JSON)
      const promptA = `You are a senior front-end developer and UX writer. Given this brief (in Persian/English): ${JSON.stringify(brief)}. 
Produce a JSON describing a landing page structure: sections list with id, title, purpose, components. Respond ONLY with JSON.`;
      const resA = await callProxy([{role:'system',content:'You respond in JSON only.'},{role:'user',content:promptA}], model, temp, maxT);
      const structureText = resA?.choices?.[0]?.message?.content || '';
      let structureJson = null;
      try { structureJson = JSON.parse(structureText); } catch(e){
        // attempt to extract JSON block
        const m = structureText.match(/\{[\s\S]*\}$/);
        if (m) {
          try { structureJson = JSON.parse(m[0]); } catch(e2) { structureJson = null; }
        }
      }
      if (!structureJson) {
        appendMsg('bot','خطا: ساختار JSON از مدل دریافت نشد. پاسخ: ' + structureText.slice(0,500));
        return;
      }
      appendMsg('bot','ساختار دریافت شد. در حال تولید محتوای هر بخش...');

      // Step B: content for each section
      for (const sec of (structureJson.sections || [])) {
        appendMsg('bot', `Generating content for section: ${sec.id || sec.title || 'section'}`);
        const p = `Write concise Persian content for section "${sec.title}" (id: ${sec.id}). Provide JSON: {"title": "...", "subtitle":"...", "bullets":[...], "cta":"..."} .`;
        const resSec = await callProxy([{role:'system',content:'You respond with JSON only.'},{role:'user',content:p}], model, temp, maxT);
        const text = resSec?.choices?.[0]?.message?.content || '';
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e){
          const m = text.match(/\{[\s\S]*\}$/);
          if (m) try { parsed = JSON.parse(m[0]); } catch(e2) { parsed=null; }
        }
        sec.content = parsed || {title:sec.title, subtitle:'', bullets:[], cta:'Learn more'};
      }

      appendMsg('bot','تمام بخش‌ها محتوا گرفتند. در حال ساخت HTML/CSS نهایی...');
      // Step C: generate final HTML/CSS
      const finalPrompt = `Given this JSON structure and contents:\n${JSON.stringify(structureJson, null, 2)}\n\nGenerate a responsive single-file landing page: provide a JSON with keys {"html":"...","css":"..."} where html is the body markup for the landing page (with comments) and css is a combined stylesheet. Avoid external JS. Use Google Fonts only. Return JSON only.`;
      const resFinal = await callProxy([{role:'system',content:'You produce JSON only.'},{role:'user',content:finalPrompt}], model, temp, maxT);
      const finalText = resFinal?.choices?.[0]?.message?.content || '';
      let finalJson = null;
      try { finalJson = JSON.parse(finalText); } catch(e){
        const m = finalText.match(/\{[\s\S]*\}$/);
        if (m) try { finalJson = JSON.parse(m[0]); } catch(e2){ finalJson = null; }
      }
      if (!finalJson) {
        appendMsg('bot','خطا: خروجی نهایی JSON نشد. پاسخ: ' + finalText.slice(0,800));
        return;
      }
      // save in state
      state.lastGenerated = finalJson;
      appendMsg('bot','صفحه تولید شد — حالا می‌توانید Preview یا Insert کنید.');
      footer.style.display = 'flex';
    } catch (err) {
      appendMsg('bot','خطا در agent: ' + (err.message || err));
      console.error(err);
    }
  }

  /* brief prompt UI (simple prompt collection) */
  async function promptBrief() {
    // collect via prompt dialogs (simple)
    const product = prompt('اسم محصول/سرویس؟','محصول من');
    if (!product) return null;
    const audience = prompt('مخاطب هدف (مثلاً: توسعه‌دهندگان، مدیران):','عموم');
    const goal = prompt('هدف لندینگ (مثلاً: ثبت‌نام، فروش، معرفی):','ثبت‌نام کاربران');
    const tone = prompt('لحن (مثلاً: رسمی، دوستانه):','دوستانه');
    const colors = prompt('رنگ‌های دلخواه (مثلاً: blue, purple) یا خالی بذار:','');
    return {product, audience, goal, tone, colors};
  }

  openAgentBtn.addEventListener('click', async ()=>{
    const mode = agentModeSelect.value || state.settings.agentMode || 'landing';
    if (mode === 'off') {
      appendMsg('bot','Agent غیرفعال است — از تنظیمات آن را فعال کن.');
      settingsPanel.style.display = 'block';
      return;
    }
    if (mode === 'landing') {
      appendMsg('bot','Agent: ساخت لندینگ پیج را آغاز می‌کنم — لطفاً چند سوال کوتاه جواب بده.');
      await runLandingAgent();
    } else {
      appendMsg('bot','Agent mode ناشناخته: ' + mode);
    }
  });

  /* ---------- Preview & Insert ---------- */
  previewBtn.addEventListener('click', ()=>{
    if (!state.lastGenerated) return appendMsg('bot','هیچ صفحه‌ای تولید نشده.');
    const html = state.lastGenerated.html || '<div>no html</div>';
    const css = state.lastGenerated.css || '';
    // open preview in new window
    const win = window.open('', '_blank');
    const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
    win.document.open();
    win.document.write(full);
    win.document.close();
  });

  insertBtn.addEventListener('click', ()=>{
    if (!state.lastGenerated) return appendMsg('bot','هیچ صفحه‌ای تولید نشده.');
    const html = sanitizeHtml(state.lastGenerated.html || '');
    const css = state.lastGenerated.css || '';

    // METHOD A: Attempt to find VvvebJs editor iframe and replace its content
    let inserted = false;
    try {
      const iframe = document.querySelector('iframe');
      if (iframe && (iframe.contentDocument || iframe.contentWindow.document)) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
        doc.open();
        doc.write(full);
        doc.close();
        appendMsg('bot','صفحه در iframe ادیتور درج شد.');
        inserted = true;
      }
    } catch(e) {
      console.warn('iframe insert failed', e);
    }

    // METHOD B: fallback — open new tab with page and inform user to import manually
    if (!inserted) {
      const win = window.open('', '_blank');
      const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
      win.document.open();
      win.document.write(full);
      win.document.close();
      appendMsg('bot','صفحه در تب جدید باز شد. آن را ذخیره و در VvvebJs آپلود کن.');
    }
  });

  /* ---------- initial UI state ---------- */
  popup.style.display = 'none';
  footer.style.display = 'none';
  // show open button
  openBtn.style.display = 'flex';

  // show a welcome message if no history
  if (!state.history.length) appendMsg('bot','سلام! من Odysse y AI هستم. از من بخواه لندینگ پیج بسازم یا سوال بپرس.');
})();
