// Velvet Bay — keyboard / mouse / wheel input.
// Written fresh for round 10 (attempt 5).
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    lookDX: 0, lookDY: 0, // accumulated drag deltas, consumed per frame
    wheel: 0, // accumulated wheel delta, consumed per frame
    shootPressed: false,
    dragging: false,
    lastX: 0, lastY: 0,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'brake',
    KeyE: 'enter',
    KeyF: 'shoot',
    KeyR: 'retry',
    KeyP: 'pause',
    KeyM: 'music',
    Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      keys.add(action);
      if (['up', 'down', 'left', 'right', 'brake'].includes(action)) e.preventDefault();
      if (action === 'shoot') state.shootPressed = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
    if (e.button === 0) state.shootPressed = true;
  });
  window.addEventListener('mouseup', () => { state.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    state.lookDX += e.clientX - state.lastX;
    state.lookDY += e.clientY - state.lastY;
    state.lastX = e.clientX; state.lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    state.wheel += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // One-shot helpers: consume a key press exactly once.
  state.pressed = (action) => {
    if (keys.has(action)) { keys.delete(action); return true; }
    return false;
  };
  state.consumeLook = () => {
    const dx = state.lookDX, dy = state.lookDY;
    state.lookDX = 0; state.lookDY = 0;
    return { dx, dy };
  };
  state.consumeWheel = () => {
    const w = state.wheel; state.wheel = 0; return w;
  };
  state.consumeShoot = () => {
    const s = state.shootPressed; state.shootPressed = false; return s;
  };
  return state;
}
