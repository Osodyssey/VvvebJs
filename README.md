# VvvebJs — Modified by Odyssey

> ⚠️ **This README is the Odyssey-maintained README for a fork of VvvebJs.**  
> The original project (upstream) is **VvvebJs** by givanz: https://github.com/givanz/VvvebJs  
> This fork and the UI/UX enhancements described below were prepared by **Odyssey** (GitHub: https://github.com/Osodyssey and https://github.com/Osodyssey/VvvebJs).

---

<p align="center">
  <img src="https://www.vvveb.com/admin/themes/default/img/biglogo.png" alt="Vvveb">
  <br><br>
  <strong>Drag and drop page builder javascript library (Bootstrap 5)</strong>
</p>

Live demo (upstream): https://www.vvveb.com/vvvebjs/editor.html

---

## What this fork adds / why this README exists

This repository is the original VvvebJs page builder with **Odyssey** enhancements focused on developer UX for embedding an AI assistant that can:

- Generate landing pages (Agent mode) and return HTML/CSS.
- Provide an in-panel chat UI (Odyssey chat popup) to interact with the model.
- Allow the user to configure a **custom API URL** in the chat settings (so you can point it to your own server/proxy).
- Detect VvvebJs editor targets (global API or same-origin iframe) and attempt safe, best-effort **Insert into Editor**.
- Improved UI/CSS/JS for the chat popup (accessibility, responsive behavior, sanitized insertion, better state & error handling).

> **Important:** These changes are additive and do **not** alter the core VvvebJs source code or component APIs. The Odyssey files live under `odyssey/assets/` and should be integrated alongside the original project files.

---

## Files added / modified by Odyssey

The primary Odyssey files are:

- `odyssey/assets/chat-popup.css` — cleaned, optimized CSS for the chat UI
- `odyssey/assets/chat-popup.js`  — improved JS with:
  - Custom API URL support (settings field and checkbox)
  - `callProxy()` uses the custom URL when enabled; otherwise uses the original `/odyssey/api_proxy.php`
  - Editor detection helpers (`odyssey_detect_editor`, `odyssey_check_editor`) to attempt insertion into VvvebJs
  - Open-button hides while popup is open (avoids duplicate controls)
  - Better sanitization (DOMParser), history limits, UI state fixes, accessibility improvements

These files are intentionally namespaced under `odyssey/` to avoid overwriting upstream VvvebJs files.

---

## Quick integration guide

1. **Place Odyssey files**

   Copy the `odyssey/` folder into the root of your VvvebJs project so the path becomes:

   ```
   <project-root>/
     odyssey/
       assets/
         chat-popup.css
         chat-popup.js
   ```

2. **Include CSS & JS in `editor.html` (or your host page)**

   Add to the `<head>` (for CSS) and before `</body>` (for JS):

   ```html
   <!-- Odyssey chat popup -->
   <link rel="stylesheet" href="odyssey/assets/chat-popup.css" />
   ...
   <script src="odyssey/assets/chat-popup.js"></script>
   ```

   Ensure scripts are loaded after the page's DOM so the plugin can attach itself. You can include it at the end of `<body>` or wrap in a DOM ready handler.

3. **API / Proxy**

   - By default the chat attempts requests to `/odyssey/api_proxy.php` (assumed to be present on the site).
   - Open the chat `Settings` → `Custom API URL` to provide your own proxy endpoint (e.g., `https://your-domain.com/odyssey/proxy`), and toggle `Use custom API URL`.
   - The proxy must accept a POST JSON body: `{ model, messages, temperature, max_tokens }` and return an OpenAI-like JSON response containing `choices[0].message.content`.

   If you need a simple PHP proxy example, adapt your existing proxy or use the upstream `api_proxy.php` (not included by Odyssey to avoid leaking credentials).

4. **Testing editor insertion**

   - When the popup opens it automatically runs a capability check and prints status messages into the chat window.
   - Exposed helpers (for dev console):
     - `odyssey_detect_editor()` — returns detection details (type, node, reason).
     - `odyssey_check_editor()`  — runs detection and appends a status message to the chat.
   - The plugin attempts the following insertion strategies (best-effort):
     - Use global `Vvveb` / `Vvvebjs` / `VvvebEditor` APIs (if detected).
     - If there is an **iframe** that is same-origin (editor.html loaded via same origin), write the generated HTML/CSS into the iframe document.
     - If iframe is cross-origin or no editor is found, the plugin falls back to opening the generated page in a new tab — you can then download/import into VvvebJs manually.

   **Note:** Because of browser security (cross-origin iframes), automatic insertion may fail if the editor is served from a different origin than the page hosting the plugin. This is expected behavior and the plugin includes user-friendly fallbacks.

---

## Security & sanitization

- Odyssey's chat JS includes a conservative `sanitizeHtml()` (DOMParser-based) to strip scripts, iframes, inline event handlers and `javascript:` URIs before writing generated HTML into an iframe or editor.
- **Do not** treat content from AI models as secure — always review generated HTML/CSS before publishing it live.
- If you allow users to input a **Custom API URL**, ensure that URL is trusted and secured. The plugin stores the URL in `localStorage` and will use it when enabled.

---

## Developer notes

- The Odyssey plugin keeps UI IDs and DOM structure stable so it won't break other scripts that target the same ids. Elements used:
  - `#ai-chat-popup`, `#ai-chat-open-btn`, `#ai-chat-messages`, `#ai-chat-text`, `#ai-chat-send`, `#od-settings`, `#od-model`, `#od-api-url`, `#od-use-api`, `#od-save-settings`, and similar.
- To debug editor detection: open DevTools and run `odyssey_detect_editor()` — it will return an object describing what it found.
- To see runtime messages and errors, keep the chat popup open; important messages are appended to the chat window.

---

## Example usage flow

1. Open VvvebJs `editor.html` on a local server (e.g., `http://localhost/editor.html`) and ensure Odyssey assets are included.
2. Click the floating `💬` button — the popup will appear and the button will hide while the popup is open.
3. (Optional) Settings → enter `Custom API URL`, check `Use custom API URL`, Save.
4. Type a prompt (Persian or English) and click `ارسال`.
5. Use **Agent** to generate landing page structure and final HTML/CSS. After generation, use **Preview** or **Insert into Editor**:
   - If editor is detectable and accessible, the plugin will attempt to write the generated page into the editor.
   - Otherwise it opens the page in a new tab (fallback).

---

## Credits

- Original VvvebJs project: givanz — https://github.com/givanz/VvvebJs  
- Fork and Odyssey UI/UX enhancements: Osodyssey — https://github.com/Osodyssey and https://github.com/Osodyssey/VvvebJs

---

## License

Upstream license: **Apache 2.0** (see original repository).  
This README and the Odyssey assets are distributed in accordance with the upstream license and do not relicense the upstream project.

---

## Contact / Support

If you need specific help integrating Odyssey changes, open an issue in the Odyssey fork:  
https://github.com/Osodyssey/VvvebJs

---

*This README was updated and generated by Odyssey to document the Odyssey-specific enhancements and integration instructions. It is intended to be a drop-in documentation file for the forked repository.*
