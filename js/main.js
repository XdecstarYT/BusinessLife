/* ============================================================
   BusinessLife — BOOTSTRAP
   ============================================================ */
(function () {
  /* nav icons */
  document.querySelectorAll('.nav-ico').forEach(el => {
    el.innerHTML = Icons[el.dataset.ico] || '';
  });

  /* nav clicks */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => UI.setTab(btn.dataset.tab));
  });

  /* live clock in status bar */
  function tickClock() {
    const d = new Date();
    document.getElementById('sbTime').textContent =
      d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  tickClock();
  setInterval(tickClock, 30000);

  /* keyboard shortcut: space = advance month */
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && G && !G.gameOver && document.getElementById('modalRoot').classList.contains('hidden')
        && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      Engine.advance(1);
    }
  });

  /* boot */
  UI.render();
})();
