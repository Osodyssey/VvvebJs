// odyssey/assets/chat-popup.js
// Improved and cleaned JS: keeps original behavior and structure but fixes UI bugs,
// accessibility, state handling, sanitization, and small UX improvements.

(function(){
  /* ---------- Templates ---------- */
  const tpl = `
  <div id="ai-chat-popup" role="dialog" aria-label="Odyssey AI chat" aria-hidden="true" style="display:none;">
    <div id="ai-chat-header">
      <div class="title" id="od-title">Odyssey AI</div>
      <div id="ai-chat-controls" role="toolbar" aria-label="chat controls">
        <button id="od-open-agent" title="Agent: build landing page" aria-label="Run agent">Agent</button>
        <button id="od-toggle-theme" title="Toggle theme" aria-label="Toggle theme">🌓</button>
        <button id="od-open-settings" title="Settings" aria-label="Open settings">⚙</button>
        <button id="ai-chat-close" title="Close" aria-label="Close chat">✕</button>
      </div>
    </div>

    <div id="ai-chat-messages" aria-live="polite" aria-atomic="false"></div>

    <div id="ai-chat-input">
      <textarea id="ai-chat-text" placeholder="سوال یا درخواستت رو اینجا بنویس..." aria-label="پیام" rows="2"></textarea>
      <button id="ai-chat-send" aria-label="ارسال پیام">ارسال</button>
    </div>

    <div id="od-footer" style="display:none;">
      <button id="od-preview-btn">Preview Generated Page</button>
      <button id="od-insert-btn">Insert into Editor</button>
      <button id="od-clear-history">Clear History</button>
    </div>

    <div id="od-settings" aria-hidden="true">
      <label for="od-model">Model</label>
      <select id="od-model">
        <option value="gpt-4">gpt-4</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4o">gpt-4o</option>
      </select>
      <label for="od-temp">Temperature (0-1)</label>
      <input id="od-temp" type="number" min="0" max="1" step="0.1" value="0.3" />
      <label for="od-agent-mode">Agent Mode</label>
      <select id="od-agent-mode">
        <option value="off">Off (chat)</option>
        <option value="landing">Landing Page Generator</option>
      </select>
      <label for="od-max-tokens">Estimated tokens limit</label>
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
  openBtn.setAttribute('aria-controls','ai-chat-popup');
  openBtn.setAttribute('aria-expanded','false');
  openBtn.setAttribute('title','Open chat');
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
  const DEFAULTS = {
    theme: localStorage.getItem('odyssey_theme') || 'dark',
    history: JSON.parse(localStorage.getItem('odyssey_hist') || '[]'),
    settings: JSON.parse(localStorage.getItem('odyssey_settings') || '{}'),
    lastGenerated: null
  };
  let state = Object.assign({}, DEFAULTS);

  function saveState(){
    localStorage.setItem('odyssey_hist', JSON.stringify(state.history || []));
    localStorage.setItem('odyssey_settings', JSON.stringify(state.settings || {}));
    if (state.theme) localStorage.setItem('odyssey_theme', state.theme);
  }

  /* ---------- Theme handling ---------- */
  function applyTheme(mode){
    document.documentElement.classList.remove('od-theme-light','od-theme-dark');
    if (mode === 'light'){
      document.documentElement.classList.add('od-theme-light');
      state.theme = 'light';
    } else {
      document.documentElement.classList.add('od-theme-dark');
      state.theme = 'dark';
    }
    saveState();
  }
  applyTheme(state.theme || 'dark');

  /* ---------- Sanitizer (improved but conservative) ---------- */
  function sanitizeHtml(input){
    if (!input) return '';
    // Basic approach: parse using DOMParser, strip scripts, iframes, and on* attrs.
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input, 'text/html');
      // remove script and iframe elements
      doc.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
      // remove event handler attributes and javascript: href/src
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null, false);
      while(walker.nextNode()){
        const el = walker.currentNode;
        // clone attribute names to avoid live mutation issues
        const attrs = Array.from(el.attributes || []);
        attrs.forEach(a=>{
          const name = a.name.toLowerCase();
          const val = a.value || '';
          if (name.startsWith('on')) el.removeAttribute(a.name);
          if ((name === 'href' || name === 'src') && val.trim().toLowerCase().startsWith('javascript:')) el.removeAttribute(a.name);
          // disallow style attribute (to avoid injection)
          if (name === 'style') el.removeAttribute(a.name);
        });
      }
      return doc.body.innerHTML;
    } catch (e){
      // fallback: escape
      return escapeHtml(input);
    }
  }
  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  /* ---------- UI helper ---------- */
  function formatTime(ts){
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {hour:'2-digit',minute:'2-digit'});
  }
  function createMsgElement(role, text, raw=false){
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-chat-msg ' + (role === 'user' ? 'user' : 'bot');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden','true');
    avatar.textContent = role === 'user' ? 'شما' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    // allow minimal HTML for bot if raw === true: sanitize then set innerHTML
    if (role === 'bot' && raw === true){
      bubble.innerHTML = sanitizeHtml(text);
    } else {
      bubble.textContent = text;
    }

    const meta = document.createElement('div');
    meta.className = 'od-meta hidden';
    meta.textContent = formatTime(Date.now());

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    return wrapper;
  }

  function appendMsg(role, text, raw=false){
    const el = createMsgElement(role, text, raw);
    messagesEl.appendChild(el);
    // scroll smoothly
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (!raw){
      state.history = state.history || [];
      state.history.push({role, text, t: Date.now()});
      // keep last 500 messages to avoid localStorage bloat
      if (state.history.length > 500) state.history = state.history.slice(-500);
      saveState();
    }
  }

  /* ---------- API call (proxy) ---------- */
  async function callProxy(messages, model='gpt-4', temperature=0.3, max_tokens=1500){
    const payload = {model, messages, temperature, max_tokens};
    try {
      const resp = await fetch('/odyssey/api_proxy.php', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!resp.ok){
        let err;
        try { err = await resp.json(); } catch(e){ err = {error: resp.statusText}; }
        throw new Error(err?.error || JSON.stringify(err));
      }
      const data = await resp.json();
      return data;
    } catch (e){
      throw e;
    }
  }

  /* ---------- Send flow ---------- */
  let sending = false;
  async function doSend(){
    const txt = textarea.value.trim();
    if (!txt || sending) return;
    textarea.value = '';
    appendMsg('user', txt);
    // show a temporary "typing" bot message
    const typingMsg = createMsgElement('bot', 'در حال دریافت پاسخ...');
    messagesEl.appendChild(typingMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    sending = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
      const model = state.settings?.model || modelSelect.value || 'gpt-4';
      const temp = parseFloat(state.settings?.temperature ?? tempInput.value) || 0.3;
      const maxT = parseInt(state.settings?.max_tokens ?? maxTokensInput.value) || 1500;
      const messages = [
        {role:'system', content: 'You are a helpful assistant. Answer concisely in Persian when appropriate.'},
        {role:'user', content: txt}
      ];
      const data = await callProxy(messages, model, temp, maxT);
      // remove typing
      typingMsg.remove();
      const answer = data?.choices?.[0]?.message?.content || (typeof data === 'string' ? data : JSON.stringify(data).slice(0,500));
      appendMsg('bot', answer);
    } catch (err) {
      typingMsg.remove();
      appendMsg('bot', 'خطا در برقراری ارتباط: ' + (err.message || err));
      console.error(err);
    } finally {
      sending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = 'ارسال';
    }
  }

  sendBtn.addEventListener('click', doSend);
  textarea.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      doSend();
    }
  });

  /* ---------- Settings UI ---------- */
  settingsBtn.addEventListener('click', ()=>{
    const open = settingsPanel.style.display === 'block';
    settingsPanel.style.display = open ? 'none' : 'block';
    settingsPanel.setAttribute('aria-hidden', open ? 'true' : 'false');
    // populate controls from state
    modelSelect.value = state.settings?.model || modelSelect.value;
    tempInput.value = state.settings?.temperature ?? tempInput.value;
    agentModeSelect.value = state.settings?.agentMode || agentModeSelect.value;
    maxTokensInput.value = state.settings?.max_tokens ?? maxTokensInput.value;
  });

  saveSettingsBtn.addEventListener('click', ()=>{
    state.settings = state.settings || {};
    state.settings.model = modelSelect.value;
    state.settings.temperature = parseFloat(tempInput.value);
    state.settings.agentMode = agentModeSelect.value;
    state.settings.max_tokens = parseInt(maxTokensInput.value);
    saveState();
    settingsPanel.style.display = 'none';
    settingsPanel.setAttribute('aria-hidden','true');
    appendMsg('bot','تنظیمات ذخیره شد.');
  });

  /* ---------- Theme toggle ---------- */
  themeToggle.addEventListener('click', ()=>{
    const mode = (state.theme === 'dark') ? 'light' : 'dark';
    applyTheme(mode);
    appendMsg('bot', 'تم به ' + mode + ' تغییر یافت.');
  });

  /* ---------- Open / Close ---------- */
  openBtn.addEventListener('click', ()=>{
    const isHidden = popup.style.display === 'none' || popup.getAttribute('aria-hidden') === 'true';
    popup.style.display = isHidden ? 'flex' : 'none';
    popup.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    openBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) {
      // focus textarea for quick typing
      setTimeout(()=> textarea.focus(), 120);
    }
  });
  closeBtn.addEventListener('click', ()=>{
    popup.style.display = 'none';
    popup.setAttribute('aria-hidden','true');
    openBtn.setAttribute('aria-expanded','false');
  });

  /* ---------- History ---------- */
  function renderHistory(){
    messagesEl.innerHTML = '';
    (state.history || []).slice(-200).forEach(h=>{
      appendMsg(h.role, h.text, true);
    });
  }
  renderHistory();

  clearHistoryBtn.addEventListener('click', ()=>{
    state.history = [];
    saveState();
    messagesEl.innerHTML = '';
    appendMsg('bot','تاریخچه پاک شد.');
  });

  /* ---------- Agent flow (landing page generator) ---------- */
  async function runLandingAgent(){
    const brief = await promptBrief();
    if (!brief){
      appendMsg('bot','ساخت لندینگ پیج کنسل شد.');
      return;
    }
    appendMsg('user','Agent brief: ' + JSON.stringify(brief).slice(0,300));
    appendMsg('bot','در حال دریافت ساختار از مدل...');
    const model = state.settings?.model || modelSelect.value || 'gpt-4';
    const temp = parseFloat(state.settings?.temperature ?? tempInput.value) || 0.2;
    const maxT = parseInt(state.settings?.max_tokens ?? maxTokensInput.value) || 2000;
    try {
      const promptA = `You are a senior front-end developer and UX writer. Given this brief (in Persian/English): ${JSON.stringify(brief)}. Produce a JSON describing a landing page structure: sections list with id, title, purpose, components. Respond ONLY with JSON.`;
      const resA = await callProxy([{role:'system',content:'You respond in JSON only.'},{role:'user',content:promptA}], model, temp, maxT);
      const structureText = resA?.choices?.[0]?.message?.content || '';
      let structureJson = null;
      try { structureJson = JSON.parse(structureText); } catch(e){
        const m = structureText.match(/\{[\s\S]*\}$/);
        if (m) try { structureJson = JSON.parse(m[0]); } catch(e2) { structureJson = null; }
      }
      if (!structureJson){
        appendMsg('bot','خطا: ساختار JSON از مدل دریافت نشد. پاسخ: ' + structureText.slice(0,500));
        return;
      }
      appendMsg('bot','ساختار دریافت شد. در حال تولید محتوای هر بخش...');
      for (const sec of (structureJson.sections || [])){
        appendMsg('bot', `در حال تولید محتوا برای بخش: ${sec.title || sec.id}`);
        const p = `Write concise Persian content for section "${sec.title}" (id: ${sec.id}). Provide JSON: {"title":"...","subtitle":"...","bullets":[...],"cta":"..."} .`;
        const resSec = await callProxy([{role:'system',content:'You respond with JSON only.'},{role:'user',content:p}], model, temp, maxT);
        const text = resSec?.choices?.[0]?.message?.content || '';
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e){
          const m = text.match(/\{[\s\S]*\}$/);
          if (m) try { parsed = JSON.parse(m[0]); } catch(e2) { parsed = null; }
        }
        sec.content = parsed || {title: sec.title, subtitle:'', bullets:[], cta:'Learn more'};
      }
      appendMsg('bot','تمام بخش‌ها محتوا گرفتند. در حال ساخت HTML/CSS نهایی...');
      const finalPrompt = `Given this JSON structure and contents:\n${JSON.stringify(structureJson, null, 2)}\n\nGenerate a responsive single-file landing page: provide a JSON with keys {"html":"...","css":"..."} where html is the body markup for the landing page (with comments) and css is a combined stylesheet. Avoid external JS. Use Google Fonts only. Return JSON only.`;
      const resFinal = await callProxy([{role:'system',content:'You produce JSON only.'},{role:'user',content:finalPrompt}], model, temp, maxT);
      const finalText = resFinal?.choices?.[0]?.message?.content || '';
      let finalJson = null;
      try { finalJson = JSON.parse(finalText); } catch(e){
        const m = finalText.match(/\{[\s\S]*\}$/);
        if (m) try { finalJson = JSON.parse(m[0]); } catch(e2){ finalJson = null; }
      }
      if (!finalJson){
        appendMsg('bot','خطا: خروجی نهایی JSON نشد. پاسخ: ' + finalText.slice(0,800));
        return;
      }
      state.lastGenerated = finalJson;
      appendMsg('bot','صفحه تولید شد — حالا می‌توانید Preview یا Insert کنید.');
      footer.style.display = 'flex';
    } catch (err){
      appendMsg('bot','خطا در agent: ' + (err.message || err));
      console.error(err);
    }
  }

  /* brief prompt UI (simple prompt collection) */
  async function promptBrief(){
    const product = prompt('اسم محصول/سرویس؟','محصول من');
    if (!product) return null;
    const audience = prompt('مخاطب هدف (مثلاً: توسعه‌دهندگان، مدیران):','عموم');
    const goal = prompt('هدف لندینگ (مثلاً: ثبت‌نام، فروش، معرفی):','ثبت‌نام کاربران');
    const tone = prompt('لحن (مثلاً: رسمی، دوستانه):','دوستانه');
    const colors = prompt('رنگ‌های دلخواه (مثلاً: blue, purple) یا خالی بذار:','');
    return {product, audience, goal, tone, colors};
  }

  openAgentBtn.addEventListener('click', async ()=>{
    const mode = agentModeSelect.value || state.settings?.agentMode || 'landing';
    if (mode === 'off'){
      appendMsg('bot','Agent غیرفعال است — از تنظیمات آن را فعال کن.');
      settingsPanel.style.display = 'block';
      return;
    }
    if (mode === 'landing'){
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
    let inserted = false;
    try {
      const iframe = document.querySelector('iframe');
      if (iframe && (iframe.contentDocument || iframe.contentWindow.document)){
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
        doc.open();
        doc.write(full);
        doc.close();
        appendMsg('bot','صفحه در iframe ادیتور درج شد.');
        inserted = true;
      }
    } catch(e){
      console.warn('iframe insert failed', e);
    }
    if (!inserted){
      const win = window.open('', '_blank');
      const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
      win.document.open();
      win.document.write(full);
      win.document.close();
      appendMsg('bot','صفحه در تب جدید باز شد. آن را ذخیره و در ویرایشگر خود آپلود کنید.');
    }
  });

  /* ---------- initial UI state ---------- */
  popup.style.display = 'none';
  popup.setAttribute('aria-hidden','true');
  footer.style.display = 'none';
  openBtn.style.display = 'flex';
  openBtn.classList.add('center');

  // welcome
  if (!(state.history && state.history.length)) appendMsg('bot','سلام! من Odyssey AI هستم. از من بخواه لندینگ پیج بسازم یا سوال بپرس.');

})();
