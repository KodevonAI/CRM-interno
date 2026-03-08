(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var CRM_URL   = (script.getAttribute('data-crm-url') || 'https://crm.kodevon.com').replace(/\/$/, '');
  var TITLE     = script.getAttribute('data-crm-title') || '¿En qué podemos ayudarte?';
  var SUBTITLE  = script.getAttribute('data-crm-subtitle') || 'Cuéntanos sobre tu proyecto y te contactamos.';
  var THEME     = script.getAttribute('data-crm-theme') || 'dark'; // 'dark' | 'light'
  var BTN_LABEL = script.getAttribute('data-crm-btn') || 'Contáctanos';
  var WIDGET_ID = 'kodevon-crm-widget';

  // ─── Styles ──────────────────────────────────────────────────
  var isDark = THEME === 'dark';

  var COLORS = isDark
    ? {
        bg:        '#161B27',
        card:      '#1E2536',
        border:    '#2A3347',
        text:      '#F9FAFB',
        textMuted: '#9CA3AF',
        input:     '#0F1117',
        brand:     '#3B82F6',
        brandHov:  '#2563EB',
        error:     '#EF4444',
        success:   '#22C55E',
        overlay:   'rgba(0,0,0,0.6)',
      }
    : {
        bg:        '#FFFFFF',
        card:      '#F9FAFB',
        border:    '#E5E7EB',
        text:      '#111827',
        textMuted: '#6B7280',
        input:     '#FFFFFF',
        brand:     '#3B82F6',
        brandHov:  '#2563EB',
        error:     '#EF4444',
        success:   '#16A34A',
        overlay:   'rgba(0,0,0,0.4)',
      };

  var css = [
    '#' + WIDGET_ID + '-fab{',
    '  position:fixed;bottom:24px;right:24px;z-index:9998;',
    '  width:56px;height:56px;border-radius:50%;',
    '  background:' + COLORS.brand + ';color:#fff;',
    '  border:none;cursor:pointer;box-shadow:0 4px 20px rgba(59,130,246,0.4);',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-size:24px;transition:background 0.2s,transform 0.2s;',
    '}',
    '#' + WIDGET_ID + '-fab:hover{background:' + COLORS.brandHov + ';transform:scale(1.05);}',

    '#' + WIDGET_ID + '-overlay{',
    '  display:none;position:fixed;inset:0;z-index:9999;',
    '  background:' + COLORS.overlay + ';align-items:center;justify-content:center;',
    '  padding:16px;box-sizing:border-box;',
    '}',
    '#' + WIDGET_ID + '-overlay.open{display:flex;}',

    '#' + WIDGET_ID + '-modal{',
    '  background:' + COLORS.bg + ';border:1px solid ' + COLORS.border + ';',
    '  border-radius:12px;padding:28px;width:100%;max-width:440px;',
    '  box-shadow:0 20px 60px rgba(0,0,0,0.3);',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '  box-sizing:border-box;',
    '}',

    '#' + WIDGET_ID + '-modal h2{',
    '  margin:0 0 6px;font-size:20px;font-weight:700;color:' + COLORS.text + ';',
    '}',
    '#' + WIDGET_ID + '-modal p.subtitle{',
    '  margin:0 0 20px;font-size:14px;color:' + COLORS.textMuted + ';',
    '}',

    '#' + WIDGET_ID + '-modal input,',
    '#' + WIDGET_ID + '-modal textarea{',
    '  width:100%;box-sizing:border-box;',
    '  background:' + COLORS.input + ';color:' + COLORS.text + ';',
    '  border:1px solid ' + COLORS.border + ';border-radius:8px;',
    '  padding:10px 12px;font-size:14px;outline:none;',
    '  transition:border-color 0.2s;margin-bottom:12px;',
    '}',
    '#' + WIDGET_ID + '-modal input:focus,',
    '#' + WIDGET_ID + '-modal textarea:focus{border-color:' + COLORS.brand + ';}',
    '#' + WIDGET_ID + '-modal textarea{resize:vertical;min-height:90px;}',
    '#' + WIDGET_ID + '-modal input::placeholder,',
    '#' + WIDGET_ID + '-modal textarea::placeholder{color:' + COLORS.textMuted + ';}',

    '.' + WIDGET_ID + '-row{display:flex;gap:10px;}',
    '.' + WIDGET_ID + '-row input{flex:1;}',

    '#' + WIDGET_ID + '-submit{',
    '  width:100%;padding:11px;border:none;border-radius:8px;',
    '  background:' + COLORS.brand + ';color:#fff;',
    '  font-size:15px;font-weight:600;cursor:pointer;',
    '  transition:background 0.2s;margin-top:4px;',
    '}',
    '#' + WIDGET_ID + '-submit:hover{background:' + COLORS.brandHov + ';}',
    '#' + WIDGET_ID + '-submit:disabled{opacity:0.6;cursor:not-allowed;}',

    '#' + WIDGET_ID + '-error{',
    '  color:' + COLORS.error + ';font-size:13px;margin-bottom:10px;display:none;',
    '}',
    '#' + WIDGET_ID + '-success{',
    '  text-align:center;padding:20px 0;',
    '}',
    '#' + WIDGET_ID + '-success .check{font-size:48px;margin-bottom:12px;}',
    '#' + WIDGET_ID + '-success h3{margin:0 0 8px;color:' + COLORS.text + ';font-size:18px;}',
    '#' + WIDGET_ID + '-success p{margin:0;color:' + COLORS.textMuted + ';font-size:14px;}',

    '.' + WIDGET_ID + '-close{',
    '  position:absolute;top:14px;right:16px;',
    '  background:none;border:none;cursor:pointer;',
    '  color:' + COLORS.textMuted + ';font-size:20px;line-height:1;',
    '}',
    '#' + WIDGET_ID + '-modal{position:relative;}',
  ].join('\n');

  // ─── DOM ─────────────────────────────────────────────────────
  function inject() {
    // Style
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // FAB button
    var fab = document.createElement('button');
    fab.id = WIDGET_ID + '-fab';
    fab.setAttribute('aria-label', BTN_LABEL);
    fab.innerHTML = '&#128172;'; // 💬
    document.body.appendChild(fab);

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = WIDGET_ID + '-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = [
      '<div id="' + WIDGET_ID + '-modal">',
      '  <button class="' + WIDGET_ID + '-close" aria-label="Cerrar">&times;</button>',
      '  <h2>' + escapeHTML(TITLE) + '</h2>',
      '  <p class="subtitle">' + escapeHTML(SUBTITLE) + '</p>',
      '  <div id="' + WIDGET_ID + '-error"></div>',
      '  <div id="' + WIDGET_ID + '-form">',
      '    <input type="text" id="' + WIDGET_ID + '-name" placeholder="Nombre *" required>',
      '    <div class="' + WIDGET_ID + '-row">',
      '      <input type="email" id="' + WIDGET_ID + '-email" placeholder="Email">',
      '      <input type="tel" id="' + WIDGET_ID + '-phone" placeholder="Teléfono">',
      '    </div>',
      '    <input type="text" id="' + WIDGET_ID + '-company" placeholder="Empresa">',
      '    <textarea id="' + WIDGET_ID + '-message" placeholder="¿En qué podemos ayudarte? *" required></textarea>',
      '    <button id="' + WIDGET_ID + '-submit">' + escapeHTML(BTN_LABEL) + '</button>',
      '  </div>',
      '  <div id="' + WIDGET_ID + '-success" style="display:none">',
      '    <div class="check">&#10003;</div>',
      '    <h3>¡Mensaje enviado!</h3>',
      '    <p>Gracias por contactarnos. Te responderemos a la brevedad.</p>',
      '  </div>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    // ─── Events ─────────────────────────────────────────────────

    fab.addEventListener('click', function () {
      overlay.classList.add('open');
      document.getElementById(WIDGET_ID + '-name').focus();
    });

    overlay.querySelector('.' + WIDGET_ID + '-close').addEventListener('click', closeModal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    document.getElementById(WIDGET_ID + '-submit').addEventListener('click', handleSubmit);
  }

  function closeModal() {
    document.getElementById(WIDGET_ID + '-overlay').classList.remove('open');
  }

  function handleSubmit() {
    var name    = document.getElementById(WIDGET_ID + '-name').value.trim();
    var email   = document.getElementById(WIDGET_ID + '-email').value.trim();
    var phone   = document.getElementById(WIDGET_ID + '-phone').value.trim();
    var company = document.getElementById(WIDGET_ID + '-company').value.trim();
    var message = document.getElementById(WIDGET_ID + '-message').value.trim();
    var errorEl = document.getElementById(WIDGET_ID + '-error');
    var btn     = document.getElementById(WIDGET_ID + '-submit');

    errorEl.style.display = 'none';

    if (!name) { showError('El nombre es requerido.'); return; }
    if (!message) { showError('El mensaje es requerido.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('El email no es válido.'); return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';

    var payload = {
      name:        name,
      email:       email || undefined,
      phone:       phone || undefined,
      company:     company || undefined,
      message:     message,
      source_url:  window.location.href,
      source_page: document.title,
    };

    fetch(CRM_URL + '/api/form/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok) {
          showError(result.data.error || 'Error al enviar. Inténtalo de nuevo.');
          btn.disabled = false;
          btn.textContent = BTN_LABEL;
          return;
        }
        // Mostrar mensaje de éxito
        document.getElementById(WIDGET_ID + '-form').style.display = 'none';
        document.getElementById(WIDGET_ID + '-success').style.display = 'block';
        setTimeout(closeModal, 4000);
      })
      .catch(function () {
        showError('Error de conexión. Inténtalo de nuevo.');
        btn.disabled = false;
        btn.textContent = BTN_LABEL;
      });
  }

  function showError(msg) {
    var el = document.getElementById(WIDGET_ID + '-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Init ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
