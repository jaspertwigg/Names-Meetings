(function () {
  'use strict';

  const STORAGE_KEY = 'names-meetings:v1';

  // ---------- Data ----------
  // { people: [{ id, name, tagline, createdAt, meetings: [{ id, date, place, notes, createdAt }] }] }
  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.people)) return parsed;
      }
    } catch (e) {
      console.error('Could not load saved data', e);
    }
    return { people: [] };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      alert('Could not save. Your browser storage may be full or disabled.');
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function today() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function findPerson(id) {
    return data.people.find(p => p.id === id);
  }

  function sortedMeetings(person) {
    return [...person.meetings].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function lastMet(person) {
    const m = sortedMeetings(person)[0];
    return m ? m.date : null;
  }

  // ---------- Formatting ----------
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function relative(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const then = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.round((now - then) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 0) return 'in the future';
    if (days < 7) return days + ' days ago';
    if (days < 30) { const w = Math.round(days / 7); return w + (w === 1 ? ' week ago' : ' weeks ago'); }
    if (days < 365) { const mo = Math.round(days / 30); return mo + (mo === 1 ? ' month ago' : ' months ago'); }
    const yr = Math.round(days / 365);
    return yr + (yr === 1 ? ' year ago' : ' years ago');
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  function colorFor(str) {
    let h = 0;
    for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h} 55% 48%)`;
  }

  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function snippetAround(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return '';
    const start = Math.max(0, i - 40);
    const end = Math.min(text.length, i + q.length + 60);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  // ---------- DOM refs ----------
  const app = document.getElementById('app');
  const titleEl = document.getElementById('title');
  const backBtn = document.getElementById('backBtn');
  const fab = document.getElementById('fab');
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const importFile = document.getElementById('importFile');
  const dialog = document.getElementById('dialog');
  const dialogForm = document.getElementById('dialogForm');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const dialogDelete = document.getElementById('dialogDelete');
  const dialogCancel = document.getElementById('dialogCancel');

  let searchQuery = '';

  // ---------- Routing ----------
  function route() {
    const hash = location.hash.slice(1);
    const m = hash.match(/^person\/(.+)$/);
    if (m) {
      const person = findPerson(m[1]);
      if (person) return renderPerson(person);
      location.hash = '';
      return;
    }
    renderList();
  }

  window.addEventListener('hashchange', route);
  backBtn.addEventListener('click', () => { location.hash = ''; });

  // ---------- List view ----------
  function renderList() {
    titleEl.textContent = 'Names & Meetings';
    backBtn.hidden = true;
    fab.setAttribute('aria-label', 'Add person');
    fab.onclick = () => openPersonDialog();

    if (data.people.length === 0) {
      app.innerHTML = `
        <div class="empty">
          <p style="font-size:2.5rem;margin:0">👋</p>
          <p><strong>No one here yet.</strong></p>
          <p>Tap <strong>+</strong> to add someone you've met, with a short note about who they are.</p>
        </div>`;
      return;
    }

    app.innerHTML = `
      <input class="search" id="search" type="search" placeholder="Search names, taglines and notes…" value="${esc(searchQuery)}" autocomplete="off">
      <ul class="list" id="peopleList"></ul>`;
    const searchEl = document.getElementById('search');
    searchEl.addEventListener('input', () => { searchQuery = searchEl.value; renderPeopleList(); });
    renderPeopleList();
  }

  function renderPeopleList() {
    const list = document.getElementById('peopleList');
    const q = searchQuery.trim();
    const ql = q.toLowerCase();

    let rows = data.people.map(p => {
      if (!q) return { p, snippet: '' };
      if (p.name.toLowerCase().includes(ql) || (p.tagline || '').toLowerCase().includes(ql)) {
        return { p, snippet: '' };
      }
      const hit = p.meetings.find(mt =>
        (mt.notes || '').toLowerCase().includes(ql) || (mt.place || '').toLowerCase().includes(ql));
      if (!hit) return null;
      const field = (hit.notes || '').toLowerCase().includes(ql) ? hit.notes : hit.place;
      return { p, snippet: snippetAround(field, q) };
    }).filter(Boolean);

    // Most recently met first; never-met people sorted by when they were added.
    rows.sort((a, b) => {
      const la = lastMet(a.p) || '', lb = lastMet(b.p) || '';
      if (la !== lb) return lb.localeCompare(la);
      return (b.p.createdAt || 0) - (a.p.createdAt || 0);
    });

    if (rows.length === 0) {
      list.innerHTML = `<li class="empty">No matches for “${esc(q)}”.</li>`;
      return;
    }

    list.innerHTML = rows.map(({ p, snippet }) => {
      const lm = lastMet(p);
      const count = p.meetings.length;
      const meta = lm
        ? `Last met ${relative(lm)} · ${count} meeting${count === 1 ? '' : 's'}`
        : 'No meetings recorded yet';
      return `
        <li class="card person-item" data-id="${p.id}" tabindex="0">
          <div class="avatar" style="background:${colorFor(p.name)}">${esc(initials(p.name))}</div>
          <div class="person-text">
            <div class="person-name">${highlight(p.name, q)}</div>
            ${p.tagline ? `<div class="tagline">${highlight(p.tagline, q)}</div>` : ''}
            <div class="meta">${meta}</div>
            ${snippet ? `<div class="snippet">${highlight(snippet, q)}</div>` : ''}
          </div>
        </li>`;
    }).join('');

    list.querySelectorAll('.person-item').forEach(el => {
      const go = () => { location.hash = 'person/' + el.dataset.id; };
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  // ---------- Person view ----------
  function renderPerson(person) {
    titleEl.textContent = person.name;
    backBtn.hidden = false;
    fab.setAttribute('aria-label', 'Add meeting');
    fab.onclick = () => openMeetingDialog(person);

    const meetings = sortedMeetings(person);
    app.innerHTML = `
      <div class="profile">
        <div class="avatar large" style="background:${colorFor(person.name)}">${esc(initials(person.name))}</div>
        <div>
          <h2>${esc(person.name)}</h2>
          ${person.tagline ? `<div class="tagline">${esc(person.tagline)}</div>` : ''}
        </div>
      </div>
      <div class="profile-actions">
        <button class="primary" id="addMeeting">+ Log a meeting</button>
        <button class="secondary" id="editPerson">Edit details</button>
      </div>
      ${summaryHtml(person, meetings)}
      <div class="section-title">Meetings (${meetings.length})</div>
      ${meetings.length === 0
        ? `<div class="card empty">No meetings yet. Log one to remember what you talked about.</div>`
        : `<ul class="list">${meetings.map(m => `
            <li class="card meeting">
              <div class="meeting-head">
                <div>
                  <span class="meeting-date">${esc(formatDate(m.date))}</span>
                  <span class="meta">· ${esc(relative(m.date))}</span>
                  ${m.place ? `<div class="meeting-place">📍 ${esc(m.place)}</div>` : ''}
                </div>
                <button class="edit-link" data-id="${m.id}">Edit</button>
              </div>
              <div class="meeting-notes">${esc(m.notes)}</div>
            </li>`).join('')}</ul>`}
    `;

    document.getElementById('addMeeting').onclick = () => openMeetingDialog(person);
    document.getElementById('editPerson').onclick = () => openPersonDialog(person);
    app.querySelectorAll('.edit-link').forEach(btn => {
      btn.onclick = () => openMeetingDialog(person, person.meetings.find(m => m.id === btn.dataset.id));
    });
  }

  // ---------- Summary (generated on the device, nothing is sent anywhere) ----------
  const FOLLOW_UP_RE = /\b(going|gonna|will|won't|soon|next|planning|plans?|about to|hoping|hopes?|wants? to|trying to|thinking (of|about)|starting|starts|moving|trip|holiday|vacation|travel|wedding|engaged|pregnant|expecting|baby|birthday|interview|exam|surgery|operation|new job|retir\w*|tomorrow|tonight|weekend|this (week|month|year)|upcoming|booked)\b/i;

  function parseIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(a, b) {
    return Math.round((parseIso(b) - parseIso(a)) / 86400000);
  }

  function describeGap(days) {
    if (days < 2) return 'every day or so';
    if (days < 10) return `every ${days} days`;
    if (days < 45) return `every ${Math.round(days / 7)} weeks`;
    if (days < 330) return `every ${Math.round(days / 30)} months`;
    return 'about once a year';
  }

  function sentences(text) {
    return (text || '')
      .split(/\n+|(?<=[.!?])\s+/)
      .map(s => s.trim().replace(/^[-•*]\s*/, ''))
      .filter(s => s.length > 2);
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  function summaryHtml(person, meetings) {
    if (meetings.length === 0) return '';
    const first = person.name.trim().split(/\s+/)[0];
    const latest = meetings[0];
    const oldest = meetings[meetings.length - 1];
    const n = meetings.length;

    // Overview
    let overview = n === 1
      ? `You've met ${esc(first)} once, ${esc(relative(latest.date))} (${esc(formatDate(latest.date))})`
      : `You've met ${esc(first)} <strong>${n} times</strong>, first ${esc(relative(oldest.date))} and most recently <strong>${esc(relative(latest.date))}</strong>`;
    overview += latest.place ? ` at ${esc(latest.place)}.` : '.';
    if (n >= 3) {
      const gap = daysBetween(oldest.date, latest.date) / (n - 1);
      if (gap >= 1) overview += ` That's roughly ${describeGap(Math.round(gap))}.`;
    }

    // Places
    const placeCounts = new Map();
    for (const m of meetings) {
      const key = (m.place || '').trim();
      if (!key) continue;
      const k = key.toLowerCase();
      const e = placeCounts.get(k) || { name: key, count: 0 };
      e.count++;
      placeCounts.set(k, e);
    }
    const places = [...placeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
    const placesLine = places.length > 1
      ? `<p><strong>Usually at:</strong> ${places.map(p => esc(p.name) + (p.count > 1 ? ` (${p.count}×)` : '')).join(', ')}</p>`
      : '';

    // Things to ask about: plan-like sentences from recent meetings
    const followUps = [];
    const seen = new Set();
    for (const m of meetings.slice(0, 8)) {
      for (const s of sentences(m.notes)) {
        const k = s.toLowerCase();
        if (FOLLOW_UP_RE.test(s) && !seen.has(k)) {
          seen.add(k);
          followUps.push({ text: s, date: m.date });
        }
      }
      if (followUps.length >= 5) break;
    }
    const followHtml = followUps.length
      ? `<div class="summary-sub">Things to ask about</div>
         <ul class="summary-list">${followUps.slice(0, 5).map(f =>
           `<li>${esc(truncate(f.text, 160))} <span class="meta">(${esc(relative(f.date))})</span></li>`).join('')}</ul>`
      : '';

    // Last time
    const lastHtml = `<div class="summary-sub">Last time you met</div>
      <p class="summary-last">${esc(truncate(latest.notes.replace(/\s+/g, ' '), 280))}</p>`;

    return `
      <section class="card summary" aria-label="Summary">
        <div class="summary-title">✨ Summary</div>
        <p>${overview}</p>
        ${placesLine}
        ${followHtml}
        ${lastHtml}
      </section>`;
  }

  // ---------- Dialogs ----------
  let onSave = null;
  let onDelete = null;

  function openDialog({ title, body, save, del }) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = body;
    onSave = save;
    onDelete = del || null;
    dialogDelete.hidden = !del;
    dialog.showModal();
    const first = dialogBody.querySelector('[autofocus]') || dialogBody.querySelector('input, textarea');
    if (first) first.focus();
  }

  dialogForm.addEventListener('submit', e => {
    e.preventDefault();
    if (onSave && onSave() !== false) dialog.close();
  });
  dialogCancel.addEventListener('click', () => dialog.close());
  dialogDelete.addEventListener('click', () => {
    if (onDelete && onDelete() !== false) dialog.close();
  });

  function val(id) { return document.getElementById(id).value.trim(); }

  function openPersonDialog(person) {
    const editing = !!person;
    openDialog({
      title: editing ? 'Edit person' : 'New person',
      body: `
        <label for="fName">Name</label>
        <input class="field" id="fName" required maxlength="100" value="${esc(person?.name)}" autofocus>
        <label for="fTagline">Tagline / description</label>
        <input class="field" id="fTagline" maxlength="200" placeholder="e.g. Sam's dad, works in finance, loves cycling" value="${esc(person?.tagline)}">`,
      save() {
        const name = val('fName');
        if (!name) return false;
        const tagline = val('fTagline');
        if (editing) {
          person.name = name;
          person.tagline = tagline;
          save();
          route();
        } else {
          const p = { id: uid(), name, tagline, createdAt: Date.now(), meetings: [] };
          data.people.push(p);
          save();
          location.hash = 'person/' + p.id;
        }
      },
      del: editing ? () => {
        const n = person.meetings.length;
        if (!confirm(`Delete ${person.name}${n ? ` and ${n} meeting${n === 1 ? '' : 's'}` : ''}? This can't be undone.`)) return false;
        data.people = data.people.filter(p => p.id !== person.id);
        save();
        location.hash = '';
      } : null
    });
  }

  function openMeetingDialog(person, meeting) {
    const editing = !!meeting;
    openDialog({
      title: editing ? 'Edit meeting' : `Met ${person.name}`,
      body: `
        <label for="fDate">Date</label>
        <input class="field" id="fDate" type="date" required value="${esc(meeting?.date || today())}">
        <label for="fPlace">Where (optional)</label>
        <input class="field" id="fPlace" maxlength="120" placeholder="e.g. The park" value="${esc(meeting?.place)}">
        <label for="fNotes">What did you talk about?</label>
        <textarea class="field" id="fNotes" required placeholder="e.g. Going on holiday to Japan next month" autofocus>${esc(meeting?.notes)}</textarea>`,
      save() {
        const date = val('fDate');
        const notes = val('fNotes');
        if (!date || !notes) return false;
        const place = val('fPlace');
        if (editing) {
          Object.assign(meeting, { date, place, notes });
        } else {
          person.meetings.push({ id: uid(), date, place, notes, createdAt: Date.now() });
        }
        save();
        route();
      },
      del: editing ? () => {
        if (!confirm('Delete this meeting?')) return false;
        person.meetings = person.meetings.filter(m => m.id !== meeting.id);
        save();
        route();
      } : null
    });
  }

  // ---------- Menu: export / import ----------
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true;
  });

  menu.addEventListener('click', e => {
    const action = e.target.dataset.action;
    if (!action) return;
    menu.hidden = true;
    if (action === 'export') exportData();
    if (action === 'import') importFile.click();
  });

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `names-meetings-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  }

  importFile.addEventListener('change', async () => {
    const file = importFile.files[0];
    importFile.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.people)) throw new Error('bad format');
      const merge = data.people.length > 0 && confirm(
        'Merge the backup with your current data?\n\nOK = merge (keeps everything)\nCancel = replace current data with the backup');
      if (!merge && data.people.length > 0 &&
          !confirm('This will replace all your current data with the backup. Continue?')) return;
      if (merge) {
        const byId = new Map(data.people.map(p => [p.id, p]));
        for (const p of parsed.people) {
          const existing = byId.get(p.id);
          if (!existing) { data.people.push(p); continue; }
          const have = new Set(existing.meetings.map(m => m.id));
          for (const m of p.meetings || []) if (!have.has(m.id)) existing.meetings.push(m);
        }
      } else {
        data = parsed;
      }
      data.people.forEach(p => { p.meetings = p.meetings || []; });
      save();
      route();
      toast('Backup imported');
    } catch (e) {
      alert("That file doesn't look like a Names & Meetings backup.");
    }
  });

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // Ask the browser not to clear our storage automatically.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  route();
})();
