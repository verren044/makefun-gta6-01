// Keyboard and pointer input. Held keys give a move direction; one-shot presses
// (confirm, pause, enter/exit car, shoot) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
// Mouse aim: the pointer steers the camera-side shooting direction on screen.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE', 'KeyF']);
const SHOOT = new Set(['KeyJ', 'KeyX']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (SHOOT.has(event.code)) { if (!event.repeat) actions |= ACTION_SHOOT; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false; mouseDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => { mouseDown = false; });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  return {
    /** The held move direction, as booleans. */
    held() {
      return { up, down, left, right };
    },
    /** Is the mouse button (or touch) held, and where is the pointer? */
    mouse() {
      return { down: mouseDown, x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
