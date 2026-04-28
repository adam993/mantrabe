// Tiny vanilla-JS view layer. Re-renders the whole app on state change.
// State is owned by main.js; this module renders + emits intents via callbacks.

import { describeMantra } from './scheduler.js';

// --- DOM helpers -------------------------------------------------------------

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'checked' || k === 'disabled' || k === 'readOnly') {
      if (v) el.setAttribute(k, '');
    } else {
      el.setAttribute(k, v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// --- App shell ---------------------------------------------------------------

export function renderApp(root, state, actions) {
  clear(root);
  const screen = state.screen || { name: 'list' };

  const banner = renderPermissionBanner(state, actions);
  if (banner) root.append(banner);

  if (screen.name === 'list') {
    root.append(renderList(state, actions));
  } else if (screen.name === 'edit') {
    root.append(renderEditor(state, actions, screen.draft));
  }
}

function renderPermissionBanner(state, actions) {
  if (state.permission === 'granted') return null;
  if (state.permission === 'denied') {
    return h('div', { class: 'banner banner--warn' }, [
      h('span', {}, 'Notifications are blocked. Enable them in your system settings to receive reminders.'),
    ]);
  }
  return h('div', { class: 'banner banner--info' }, [
    h('span', {}, 'Allow notifications so reminders can reach you.'),
    h('button', { class: 'btn btn--small', onclick: () => actions.requestPermission() }, 'Enable'),
  ]);
}

// --- List screen -------------------------------------------------------------

function renderList(state, actions) {
  const wrap = h('main', { class: 'screen' });

  wrap.append(
    h('header', { class: 'topbar' }, [
      h('div', { class: 'topbar__title' }, [
        h('span', { class: 'logo-dot' }),
        h('span', {}, 'Mantrabe'),
      ]),
      h('button', {
        class: 'btn btn--primary btn--icon',
        title: 'Add mantra',
        'aria-label': 'Add mantra',
        onclick: () => actions.openEditor(),
      }, '+'),
    ]),
  );

  if (state.mantras.length === 0) {
    wrap.append(renderEmptyState(actions));
  } else {
    const list = h('ul', { class: 'mantra-list' });
    for (const m of state.mantras) list.append(renderMantraCard(m, actions));
    wrap.append(list);
  }

  return wrap;
}

function renderEmptyState(actions) {
  return h('div', { class: 'empty' }, [
    h('div', { class: 'empty__glyph' }, '🔔'),
    h('h2', {}, 'No mantras yet'),
    h('p', {}, 'Add a phrase you want to be reminded of throughout the day.'),
    h('button', {
      class: 'btn btn--primary',
      onclick: () => actions.openEditor(),
    }, 'Add a mantra'),
  ]);
}

function renderMantraCard(mantra, actions) {
  return h('li', { class: 'mantra' + (mantra.enabled ? '' : ' mantra--off') }, [
    h('div', { class: 'mantra__main' }, [
      h('p', { class: 'mantra__text' }, mantra.text || '(empty mantra)'),
      h('p', { class: 'mantra__meta' }, describeMantra(mantra)),
    ]),
    h('div', { class: 'mantra__actions' }, [
      h('label', { class: 'switch', title: mantra.enabled ? 'Pause' : 'Resume' }, [
        h('input', {
          type: 'checkbox',
          checked: mantra.enabled,
          onchange: (e) => actions.toggleEnabled(mantra.id, e.target.checked),
        }),
        h('span', { class: 'switch__track' }),
      ]),
      h('button', {
        class: 'btn btn--ghost btn--small',
        onclick: () => actions.openEditor(mantra.id),
      }, 'Edit'),
      h('button', {
        class: 'btn btn--ghost btn--small btn--danger',
        onclick: () => {
          if (confirm('Delete this mantra?')) actions.deleteMantra(mantra.id);
        },
      }, 'Delete'),
    ]),
  ]);
}

// --- Editor screen -----------------------------------------------------------

function renderEditor(state, actions, draft) {
  const wrap = h('main', { class: 'screen screen--editor' });

  wrap.append(
    h('header', { class: 'topbar' }, [
      h('button', {
        class: 'btn btn--ghost',
        onclick: () => actions.cancelEditor(),
      }, '← Back'),
      h('div', { class: 'topbar__title' }, draft.id ? 'Edit mantra' : 'New mantra'),
      h('button', {
        class: 'btn btn--primary',
        'data-role': 'save',
        onclick: () => actions.saveDraft(),
        disabled: !draft.text || !draft.text.trim(),
      }, 'Save'),
    ]),
  );

  wrap.append(renderField('Mantra', renderTextarea(draft, actions)));
  wrap.append(renderField('Reminder frequency', renderFrequencyControl(draft, actions)));
  wrap.append(renderField('Active hours', renderHoursControl(draft, actions)));
  wrap.append(renderField('Active days', renderDaysControl(draft, actions)));

  wrap.append(
    h('div', { class: 'editor-actions' }, [
      h('button', {
        class: 'btn btn--ghost',
        onclick: () => actions.testNotification(),
      }, '🔔  Test notification'),
      draft.id
        ? h('button', {
            class: 'btn btn--ghost btn--danger',
            onclick: () => {
              if (confirm('Delete this mantra?')) actions.deleteMantra(draft.id);
            },
          }, 'Delete')
        : null,
    ]),
  );

  return wrap;
}

function renderField(label, control) {
  return h('section', { class: 'field' }, [
    h('label', { class: 'field__label' }, label),
    control,
  ]);
}

function renderTextarea(draft, actions) {
  const ta = h('textarea', {
    class: 'input input--textarea',
    rows: '3',
    placeholder: 'e.g. I am calm and present.',
    maxlength: '240',
    oninput: (e) => {
      actions.patchDraft({ text: e.target.value });
      // Sync the Save button's disabled state without a full re-render
      // (which would steal focus from the textarea on every keystroke).
      const save = document.querySelector('[data-role="save"]');
      if (save) save.toggleAttribute('disabled', !e.target.value.trim());
    },
  });
  ta.value = draft.text || '';
  return ta;
}

function renderFrequencyControl(draft, actions) {
  const presets = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];
  const select = h('select', {
    class: 'input input--select',
    onchange: (e) => actions.patchDraft({ frequencyMinutes: Number(e.target.value) }),
  });
  for (const p of presets) {
    const opt = h(
      'option',
      { value: String(p) },
      p < 60 ? `Every ${p} minutes` : p === 60 ? 'Every hour' : `Every ${p / 60} hours`,
    );
    if (p === draft.frequencyMinutes) opt.setAttribute('selected', '');
    select.append(opt);
  }
  // If draft has a custom frequency not in presets, add it as the selected option.
  if (!presets.includes(draft.frequencyMinutes)) {
    const opt = h(
      'option',
      { value: String(draft.frequencyMinutes), selected: '' },
      `Every ${draft.frequencyMinutes} minutes`,
    );
    select.prepend(opt);
  }
  return select;
}

function renderHoursControl(draft, actions) {
  const startSel = renderHourSelect(draft.activeHours.start, (v) =>
    actions.patchDraft({ activeHours: { ...draft.activeHours, start: v } }),
  );
  const endSel = renderHourSelect(draft.activeHours.end, (v) =>
    actions.patchDraft({ activeHours: { ...draft.activeHours, end: v } }),
  );
  return h('div', { class: 'hours' }, [
    h('span', { class: 'hours__label' }, 'From'),
    startSel,
    h('span', { class: 'hours__label' }, 'to'),
    endSel,
  ]);
}

function renderHourSelect(value, onChange) {
  const sel = h('select', {
    class: 'input input--select',
    onchange: (e) => onChange(Number(e.target.value)),
  });
  for (let i = 0; i <= 24; i++) {
    const opt = h('option', { value: String(i) }, `${String(i).padStart(2, '0')}:00`);
    if (i === value) opt.setAttribute('selected', '');
    sel.append(opt);
  }
  return sel;
}

function renderDaysControl(draft, actions) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return h(
    'div',
    { class: 'days' },
    labels.map((label, i) => {
      const on = !!draft.activeDays[i];
      return h(
        'button',
        {
          type: 'button',
          class: 'day-pill' + (on ? ' day-pill--on' : ''),
          onclick: () => {
            const next = [...draft.activeDays];
            next[i] = !on;
            actions.patchDraft({ activeDays: next }, { rerender: true });
          },
        },
        label,
      );
    }),
  );
}
