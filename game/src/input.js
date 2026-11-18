// Keyboard and mouse input. Held keys steer and drive; one-shot presses (start,
// pause, steal, punch, save, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The
// mouse position is reported in canvas pixels; main.js turns it into world aim.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SAVE = 16;
export const ACTION_MUTE = 32;
export const ACTION_CONTINUE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const STEAL = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SAVE = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);
const CONTINUE = new Set(['KeyC']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') held.add('Space');
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (STEAL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_STEAL;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (SAVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SAVE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CONTINUE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** The held-key state the world step reads, plus the mouse aim. */
    heldState() {
      return {
        up: has(UP),
        down: has(DOWN),
        left: has(LEFT),
        right: has(RIGHT),
        run: has(RUN),
        shoot: mouse.down || held.has('Space'),
        aimCanvasX: mouse.x,
        aimCanvasY: mouse.y,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
