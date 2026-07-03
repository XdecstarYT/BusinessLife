/* ============================================================
   BusinessLife — UI CORE
   Rendering pipeline, modals, toasts, event popups.
   Screens themselves live in screens.js.
   ============================================================ */
window.UI = (function () {
  let activeTab = 'home';
  const screenEl = () => document.getElementById('screen');
  const modalRoot = () => document.getElementById('modalRoot');
  const toastRoot = () => document.getElementById('toastRoot');

  /* ---------- tab switching ---------- */
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    render();
    screenEl().scrollTop = 0;
  }

  /* ---------- render pipeline ---------- */
  function render() {
    const s = screenEl();
    if (!G) { s.innerHTML = ''; Screens.renderIntro(s); document.getElementById('navbar').style.display = 'none'; return; }
    if (G.gameOver) { s.innerHTML = ''; Screens.renderGameOver(s); document.getElementById('navbar').style.display = 'none'; return; }
    document.getElementById('navbar').style.display = '';
    s.innerHTML = '';
    const fn = {
      home: Screens.renderHome,
      ventures: Screens.renderVentures,
      market: Screens.renderMarket,
      life: Screens.renderLife,
      you: Screens.renderYou,
    }[activeTab];
    fn(s);
  }

  /* ---------- modal ---------- */
  function modal(contentHTML, { center = false, dismissible = true } = {}) {
    const root = modalRoot();
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="modal-scrim"></div>
      <div class="modal ${center ? 'center' : ''}">
        ${center ? '' : '<div class="modal-grab"></div>'}
        <div class="modal-body"></div>
      </div>`;
    root.querySelector('.modal-body').innerHTML = contentHTML;
    if (dismissible) root.querySelector('.modal-scrim').onclick = closeModal;
    return root.querySelector('.modal-body');
  }
  function closeModal() {
    modalRoot().classList.add('hidden');
    modalRoot().innerHTML = '';
  }

  /* ---------- toast ---------- */
  function toast(emoji, text, kind = '') {
    const t = U.el(`<div class="toast ${kind}"><span class="t-em">${emoji}</span><span>${U.esc(text)}</span></div>`);
    toastRoot().appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s, transform .4s'; t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; }, 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /* ---------- decision event popup ---------- */
  function showEvent(ev) {
    const body = modal(`
      <div class="center-txt" style="font-size:54px;margin:6px 0 10px">${ev.emoji}</div>
      <h2 class="center-txt">${U.esc(ev.title)}</h2>
      <p class="sub center-txt">${U.esc(ev.text)}</p>
      <div class="ev-opts"></div>
    `, { center: true, dismissible: false });
    const wrap = body.querySelector('.ev-opts');
    ev.options.forEach(opt => {
      const btn = U.el(`<button class="opt"><div class="o-tx"><b>${U.esc(opt.label)}</b><small>${U.esc(opt.desc || '')}</small></div></button>`);
      btn.onclick = () => {
        const result = opt.apply() || { emoji: '✔️', text: 'Done.' };
        State.log(result.emoji, result.text, 'event');
        body.innerHTML = `
          <div class="center-txt" style="font-size:54px;margin:6px 0 10px">${result.emoji}</div>
          <p class="sub center-txt" style="font-size:16px">${U.esc(result.text)}</p>
          <button class="btn primary" id="evOk">Continue</button>`;
        body.querySelector('#evOk').onclick = () => {
          closeModal();
          State.save();
          // chain any further queued events
          if (G.pendingEvents.length) showEvent(G.pendingEvents.shift());
          else render();
        };
      };
      wrap.appendChild(btn);
    });
  }

  /* ---------- shared components ---------- */
  function sparkline(hist, height = 34) {
    if (!hist || hist.length < 2) return '<div class="spark"><i style="height:20%"></i></div>';
    const recent = hist.slice(-18);
    const min = Math.min(...recent), max = Math.max(...recent);
    const range = max - min || 1;
    return '<div class="spark">' + recent.map((v, i) => {
      const h = 10 + ((v - min) / range) * 90;
      const dir = i > 0 && v >= recent[i - 1] ? 'up' : 'dn';
      return `<i class="${dir}" style="height:${h}%"></i>`;
    }).join('') + '</div>';
  }

  function statBar(label, val, color = '') {
    return `<div class="metric">
      <div class="m-top"><b>${U.esc(label)}</b><span>${Math.round(val)}</span></div>
      <div class="bar ${color}"><span style="width:${U.clamp(val, 0, 100)}%"></span></div>
    </div>`;
  }

  function confirm(title, text, okLabel, onOk, okClass = 'primary') {
    const body = modal(`
      <h2>${U.esc(title)}</h2>
      <p class="sub">${U.esc(text)}</p>
      <div class="btn-row">
        <button class="btn ghost" id="cNo">Cancel</button>
        <button class="btn ${okClass}" id="cYes">${U.esc(okLabel)}</button>
      </div>`, { center: true });
    body.querySelector('#cNo').onclick = closeModal;
    body.querySelector('#cYes').onclick = () => { closeModal(); onOk(); };
  }

  return { setTab, render, modal, closeModal, toast, showEvent, sparkline, statBar, confirm, get activeTab() { return activeTab; } };
})();
