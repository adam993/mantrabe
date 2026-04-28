import './styles.css';
import { renderApp } from './ui.js';
import {
  loadMantras,
  upsertMantra,
  deleteMantra as deleteMantraStore,
  makeMantra,
  getPermissionAsked,
  setPermissionAsked,
} from './storage.js';
import {
  requestPermission,
  getPermissionState,
  rescheduleAll,
  fireTestNotification,
} from './notifications.js';

const root = document.getElementById('app');

const state = {
  mantras: [],
  permission: 'default', // 'granted' | 'denied' | 'prompt' | 'default'
  screen: { name: 'list' },
};

const actions = {
  openEditor(id) {
    const existing = id ? state.mantras.find((m) => m.id === id) : null;
    const draft = existing ? { ...existing } : makeMantra({});
    state.screen = { name: 'edit', draft };
    render();
  },

  cancelEditor() {
    state.screen = { name: 'list' };
    render();
  },

  patchDraft(patch, opts = {}) {
    if (state.screen.name !== 'edit') return;
    state.screen.draft = { ...state.screen.draft, ...patch };
    // Only re-render when the patch changes something the user can't see yet
    // (e.g. day-pill toggle). Text and <select> changes already reflect in the
    // DOM, and re-rendering would steal focus / kill cursor position.
    if (opts.rerender) render();
  },

  async saveDraft() {
    if (state.screen.name !== 'edit') return;
    const draft = state.screen.draft;
    if (!draft.text || !draft.text.trim()) return;
    draft.text = draft.text.trim();
    await upsertMantra(draft);
    state.mantras = await loadMantras();
    state.screen = { name: 'list' };
    render();
    // Make sure permission is granted before scheduling fires.
    if (state.permission !== 'granted') {
      const asked = await getPermissionAsked();
      if (!asked) {
        await setPermissionAsked();
        const granted = await requestPermission();
        state.permission = granted ? 'granted' : await getPermissionState();
        render();
      }
    }
    await rescheduleAll(state.mantras);
  },

  async deleteMantra(id) {
    await deleteMantraStore(id);
    state.mantras = await loadMantras();
    if (state.screen.name === 'edit' && state.screen.draft?.id === id) {
      state.screen = { name: 'list' };
    }
    render();
    await rescheduleAll(state.mantras);
  },

  async toggleEnabled(id, enabled) {
    const m = state.mantras.find((x) => x.id === id);
    if (!m) return;
    m.enabled = enabled;
    await upsertMantra(m);
    state.mantras = await loadMantras();
    render();
    await rescheduleAll(state.mantras);
  },

  async requestPermission() {
    await setPermissionAsked();
    const granted = await requestPermission();
    state.permission = granted ? 'granted' : await getPermissionState();
    render();
    if (granted) await rescheduleAll(state.mantras);
  },

  async testNotification() {
    if (state.permission !== 'granted') {
      const granted = await requestPermission();
      state.permission = granted ? 'granted' : await getPermissionState();
      render();
      if (!granted) return;
    }
    const draft = state.screen.name === 'edit' ? state.screen.draft : null;
    await fireTestNotification(draft);
  },
};

function render() {
  renderApp(root, state, actions);
}

async function init() {
  // Render the empty UI first so a slow / failing async call below can
  // never produce a blank screen. We re-render once data is loaded.
  render();

  try {
    state.mantras = await loadMantras();
  } catch (err) {
    console.error('loadMantras failed:', err);
  }

  try {
    state.permission = await getPermissionState();
  } catch (err) {
    console.error('getPermissionState failed:', err);
  }

  render();

  // Reschedule on load so reminders survive app restarts. (On native, the OS
  // already remembers scheduled notifications, but rescheduling extends the
  // lookahead window past anything that has fired since.)
  if (state.permission === 'granted' && state.mantras.length > 0) {
    try {
      await rescheduleAll(state.mantras);
    } catch (err) {
      console.error('rescheduleAll failed:', err);
    }
  }
}

init().catch((err) => {
  console.error('Mantrabe init failed:', err);
  // Last-resort visible signal so a failure never silently blanks the UI.
  try {
    root.textContent = 'Mantrabe could not start: ' + (err && err.message || err);
  } catch {}
});
