/**
 * avatar-position.js — Handle avatar reposition commands from the host app (e.g. React Native WebView).
 */
import {
  raiseCharacter,
  lowerCharacter,
  moveCharacterLeft,
  moveCharacterRight,
  moveCharacterForward,
  moveCharacterBack,
  saveCharacterPosition,
} from './scene.js';

const MOVE_STEP = 0.02;

const ACTIONS = {
  left: () => moveCharacterLeft(MOVE_STEP),
  right: () => moveCharacterRight(MOVE_STEP),
  forward: () => moveCharacterForward(MOVE_STEP),
  back: () => moveCharacterBack(MOVE_STEP),
  up: () => raiseCharacter(MOVE_STEP),
  down: () => lowerCharacter(MOVE_STEP),
  save: () => saveCharacterPosition(),
};

function notifyHost(payload) {
  const msg = JSON.stringify(payload);
  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(msg);
  }
}

export function handleAvatarPositionMessage(data) {
  if (!data || data.type !== 'avatar-position') return false;

  const action = data.action;
  if (action === 'save') {
    saveCharacterPosition();
    notifyHost({ type: 'avatar-position', action: 'saved', ok: true });
    return true;
  }

  const move = ACTIONS[action];
  if (move) {
    move();
    notifyHost({ type: 'avatar-position', action, ok: true });
    return true;
  }

  return false;
}
