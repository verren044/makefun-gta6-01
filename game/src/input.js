// Solmar Bay — keyboard input. DOM only here; logic modules take plain input objects.
export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    shoot: false, enter: false, pause: false, save: false, confirm: false,
  };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function attachInput(input) {
  const down = (e) => {
    if (KEYMAP[e.code] !== undefined) {
      input[KEYMAP[e.code]] = true;
      e.preventDefault();
    } else if (e.code === 'KeyJ') { input.shoot = true; e.preventDefault(); }
    else if (e.code === 'KeyE') { input.enter = true; }
    else if (e.code === 'KeyP') { input.pause = true; }
    else if (e.code === 'KeyS' && e.shiftKey) { input.save = true; }
    else if (e.code === 'Enter') { input.confirm = true; }
  };
  const up = (e) => {
    if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
    else if (e.code === 'KeyJ') input.shoot = false;
    else if (e.code === 'KeyE') input.enter = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
