// odyssey/assets/chat-popup.js
(function(){
  const tpl = `
  <div id="ai-chat-popup" style="display:none; flex-direction:column;">
    <div id="ai-chat-header">
      <div>AI Chat</div>
      <div><button id="ai-chat-close" title="Close" style="background:transparent;border:none;color:white;font-size:18px;">✕</button></div>
    </div>
    <div id="ai-chat-messages"></div>
    <div id="ai-chat-input">
      <textarea id="ai-chat-text" placeholder="سوالت رو اینجا بنویس..."></textarea>
      <button id="ai-chat-send">ارسال</button>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  const popup = document.getElementById('ai-chat-popup');
  const messagesEl = document.getElementById('ai-chat-messages');
  const textarea = document.getElementById('ai-chat-text');
  const sendBtn = document.getElementById('ai-chat-send');
  const closeBtn = document.getElementById('ai-chat-close');

  function appendMsg(role, text){
    const wrapper = document.createElement('div');
    wrapper.className = `ai-chat-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessageToServer(userText){
    appendMsg('user', userText);
    const waitEl = document.createElement('div');
    waitEl.className = 'ai-chat-msg bot';
    waitEl.innerHTML = '<div class="bubble">در حال ارسال به هوش مصنوعی ...</div>';
    messagesEl.appendChild(waitEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const resp = await fetch('/odyssey/api_proxy.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a helpful assistant for VvvebJs users. Answer concisely in Persian if possible.' },
            { role: 'user', content: userText }
          ]
        })
      });

      const data = await resp.json();
      waitEl.remove();
      const answer = data?.choices?.[0]?.message?.content
        || data?.error || JSON.stringify(data).slice(0,300);
      appendMsg('bot', answer);
    } catch (err) {
      waitEl.remove();
      appendMsg('bot', 'خطا در ارتباط با سرور.');
      console.error(err);
    }
  }

  sendBtn.addEventListener('click', () => {
    const txt = textarea.value.trim();
    if (!txt) return;
    textarea.value = '';
    sendMessageToServer(txt);
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  closeBtn.addEventListener('click', () => popup.style.display = 'none');

  const openBtn = document.createElement('button');
  openBtn.id = 'ai-chat-open-btn';
  openBtn.textContent = '💬';
  document.body.appendChild(openBtn);
  openBtn.addEventListener('click', () => popup.style.display = (popup.style.display === 'none' ? 'flex' : 'none'));
})();
