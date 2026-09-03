/**
 * controls.js
 * Keyboard input -> normalized state.
 */

export function createControls(target = window) {
  const state = { forward: false, backward: false, left: false, right: false, brake: false };

  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    state.forward  = true; break;
      case 'KeyS': case 'ArrowDown':  state.backward = true; break;
      case 'KeyA': case 'ArrowLeft':  state.left     = true; break;
      case 'KeyD': case 'ArrowRight':  state.right    = true; break;
      case 'Space': state.brake = true; e.preventDefault(); break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    state.forward  = false; break;
      case 'KeyS': case 'ArrowDown':  state.backward = false; break;
      case 'KeyA': case 'ArrowLeft':  state.left     = false; break;
      case 'KeyD': case 'ArrowRight': state.right    = false; break;
      case 'Space': state.brake = false; break;
    }
  }

  function onBlur() { state.forward = state.backward = state.left = state.right = state.brake = false; }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    state,
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}