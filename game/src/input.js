// Keyboard + mouse input for Velvet Bay. Tracks held keys and drag-look deltas;
// the player and vehicle systems consume this state every frame.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    lookDX: 0,
    lookDY: 0,
    mouseDown: false,
    mouseClicked: false,   // consumed once per frame by combat
    dragging: false,
    pressed: new Set(),    // keys pressed since last consume (edge-triggered)
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    KeyE: 'enter',
    KeyF: 'shoot',
    Space: 'brake',
    KeyP: 'pause',
    KeyM: 'music',
    KeyR: 'restart',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      if (!keys.has(action)) input.pressed.add(action);
      keys.add(action);
      if (action === 'brake' || action === 'up' || action === 'down') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  let lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.dragging = true;
    input.mouseClicked = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.lookDX += e.clientX - lastX;
    input.lookDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  input.isDown = (a) => keys.has(a);
  input.wasPressed = (a) => input.pressed.has(a);
  input.endFrame = () => {
    input.pressed.clear();
    input.mouseClicked = false;
    input.lookDX = 0;
    input.lookDY = 0;
  };
  return input;
}
