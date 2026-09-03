/**
 * modals.js
 * ----------------------------------------------------------------------
 * Owns all #modal* dialogs and a "modal manager" singleton.
 *
 * Behavior:
 *   - open(id)        : shows the matching modal, fires onOpen callback
 *   - close()         : hides any open modal, fires onClose
 *   - isOpen()        : current state
 *
 * Wire-up is one-directional: main.js provides the callbacks; the
 * modal DOM is in index.html.
 *
 * Any element with id="modal<Name>" is automatically picked up —
 * no ID whitelist needed.
 * ----------------------------------------------------------------------
 */

export function createModalManager() {
  // Dynamically find all #modal* elements in the DOM
  const elements = {};
  document.querySelectorAll('[id^="modal"]').forEach((el) => {
    elements[el.id] = el;
  });

  const buttons = document.querySelectorAll('[data-resume]');

  const handlers = { onOpen: null, onClose: null };
  let active = null;

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      if (!active) return;
      close();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) close();
  });

  function open(id) {
    if (active === id) return;
    if (active) close();

    const el = elements[id];
    if (!el) {
      console.warn('[modals] unknown modal id:', id);
      return;
    }
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    active = id;
    if (handlers.onOpen) handlers.onOpen(id);
  }

  function close() {
    if (!active) return;
    const el = elements[active];
    if (el) {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    }
    const closingId = active;
    active = null;
    if (handlers.onClose) handlers.onClose(closingId);
  }

  function isOpen() {
    return active !== null;
  }

  return {
    open,
    close,
    isOpen,
    onOpen(fn) { handlers.onOpen = fn; },
    onClose(fn) { handlers.onClose = fn; },
  };
}

/**
 * The audio-unlock gate. Click to call `onUnlock`.
 * Once clicked, fades out and removes itself.
 */
export function createAudioGate(onUnlock) {
  const gate = document.getElementById('audioGate');
  const btn = document.getElementById('startBtn');
  const foot = gate ? gate.querySelector('.gate__foot') : null;

  if (!gate || !btn) {
    console.error('[gate] audioGate / startBtn not found in DOM');
    return;
  }

  let armed = false;

  function dismissGate(audioOk, audioMessage) {
    gate.classList.add('is-hidden');
    setTimeout(() => {
      try { gate.remove(); } catch (_) { /* already removed */ }
    }, 600);
    if (!audioOk && foot) {
      console.warn('[gate] audio unavailable:', audioMessage);
    }
  }

  function unlockWithTimeout() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (result) => { if (!settled) { settled = true; resolve(result); } };
      const timer = setTimeout(() => settle({ ok: false, message: 'timeout' }), 1000);
      Promise.resolve()
        .then(() => onUnlock())
        .then(
          () => { clearTimeout(timer); settle({ ok: true }); },
          (err) => { clearTimeout(timer); settle({ ok: false, message: (err && err.message) || String(err) }); }
        );
    });
  }

  async function tryEnter() {
    if (armed) return;
    armed = true;
    btn.disabled = true;
    btn.textContent = 'Entering…';
    const result = await unlockWithTimeout();
    if (result.ok) {
      btn.textContent = 'Entered';
      dismissGate(true);
    } else {
      btn.textContent = 'Enter (audio off)';
      dismissGate(false, result.message);
    }
  }

  btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); tryEnter(); }, { capture: true });

  const card = gate.querySelector('.gate__card');
  if (card) {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      ev.preventDefault(); ev.stopPropagation(); tryEnter();
    }, { capture: true });
  }

  document.addEventListener('keydown', (ev) => {
    if (armed) return;
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); btn.click(); }
  }, { once: false });

  gate.__dismiss = () => dismissGate(true);
}