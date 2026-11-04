// ---------- Materie: colori ed emoji ----------
const SUBJECTS = {
    "Scienze":              { emoji: "🔬", color: "#30D158" },
    "Matematica":           { emoji: "📐", color: "#FF453A" },
    "Matematica e fisica":  { emoji: "📐", color: "#FF453A" },
    "Fisica":               { emoji: "⚡", color: "#32ADE6" },
    "Italiano":             { emoji: "📚", color: "#FFD60A" },
    "Italiano/Geostoria":   { emoji: "📚", color: "#FFD60A" },
    "Italiano e latino":    { emoji: "📚", color: "#FFD60A" },
    "Latino":               { emoji: "🏛️", color: "#D4A373" },
    "Geostoria":            { emoji: "🌍", color: "#FF9F0A" },
    "Storia":               { emoji: "📜", color: "#FF9F0A" },
    "Filosofia":            { emoji: "🤔", color: "#AC8E68" },
    "Filosofia e storia":   { emoji: "🤔", color: "#AC8E68" },
    "Sc. Motorie":          { emoji: "🏃", color: "#FF9500" },
    "Informatica":          { emoji: "💻", color: "#5E5CE6" },
    "Comunicazione visiva": { emoji: "🖥️", color: "#64D2FF" },
    "Inglese":              { emoji: "🇬🇧", color: "#0A84FF" },
    "Spagnolo":             { emoji: "🇪🇸", color: "#FF6482" },
    "Francese":             { emoji: "🇫🇷", color: "#7D7AFF" },
    "Tedesco":              { emoji: "🇩🇪", color: "#E5B800" },
    "Disegno e Arte":       { emoji: "🎨", color: "#FF375F" },
    "Storia dell'arte":     { emoji: "🖼️", color: "#FF375F" },
    "Religione":            { emoji: "🕊️", color: "#E5E5EA" },
};
const DEFAULT_SUBJECT = { emoji: "📘", color: "#8E8E93" };

function meta(subject) {
    const m = SUBJECTS[subject] || DEFAULT_SUBJECT;
    return { ...m, bg: hexToRgba(m.color, 0.15) };
}
function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- Dati ----------
const CLASS_NAMES = Object.keys(TIMETABLE);
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Raggruppa le lezioni per giorno e orario d'inizio (lezioni divise per gruppi Q1/Q2 finiscono nello stesso slot)
const slotCache = {};
function getSlots(cls, day) {
    const key = cls + '|' + day;
    if (slotCache[key]) return slotCache[key];
    const slots = [];
    for (const [d, start, end, subject, room, teachers, note, group] of TIMETABLE[cls] || []) {
        if (d !== day) continue;
        let slot = slots.find(s => s.start === start);
        if (!slot) { slot = { start, end, items: [] }; slots.push(slot); }
        if (toMin(end) > toMin(slot.end)) slot.end = end;
        slot.items.push({ subject, room, teachers, note: note || '', group: group || '' });
    }
    slots.sort((a, b) => toMin(a.start) - toMin(b.start));
    slots.forEach(s => { s.s = toMin(s.start); s.e = toMin(s.end); });
    return (slotCache[key] = slots);
}

// Trova il nome corretto anche per valori salvati dalla vecchia versione ("2L" -> "2L SA")
function resolveClass(value, fallback) {
    if (value && TIMETABLE[value]) return value;
    if (value) {
        const found = CLASS_NAMES.find(c => c.split(' ')[0] === value.split(' ')[0]);
        if (found) return found;
    }
    return fallback === undefined ? CLASS_NAMES[0] : resolveClass(fallback);
}

// ---------- Stato ----------
let myClass = resolveClass(localStorage.getItem('myClass') || localStorage.getItem('selectedClass'), '2L SA');
let friendClass = resolveClass(localStorage.getItem('friendClass'), '2O SA');
let currentClass = resolveClass(localStorage.getItem('viewClass'), myClass);

const today = new Date().getDay();
let selectedDay = (today === 0 || today === 6) ? 1 : today;

const $ = id => document.getElementById(id);

// ---------- Header ----------
function renderHeader() {
    $('app-title').textContent = `Orario ${currentClass}`;
    const chips = [
        { cls: myClass, label: 'La mia' },
        { cls: friendClass, label: 'Amico' },
    ];
    if (currentClass !== myClass && currentClass !== friendClass) chips.push({ cls: currentClass, label: 'Altra' });
    $('class-chips').innerHTML = chips.map(c => `
        <button class="chip ${c.cls === currentClass ? 'active' : ''}" data-cls="${c.cls}">
            <span class="chip-label">${c.label}</span>${c.cls}
        </button>`).join('');
}

$('class-chips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (btn) setClass(btn.dataset.cls);
});

function setClass(cls) {
    currentClass = cls;
    localStorage.setItem('viewClass', cls);
    renderAll();
}

// ---------- Widget stato attuale ----------
function fmtDuration(mins) {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

function slotTitle(slot) {
    return slot.items.map(i => `${meta(i.subject).emoji} ${i.subject}`).join(' / ');
}
function slotRooms(slot) {
    return [...new Set(slot.items.map(i => i.room).filter(Boolean))].join(' · ');
}
function groupNote(slot) {
    const groups = slot.items.filter(i => i.group);
    if (!groups.length) return '';
    return `<div class="widget-groups">${groups.map(i => `<span>${i.group}: ${i.subject} ${i.room}</span>`).join('')}</div>`;
}

// Prossimo giorno di scuola (dopo "day") con almeno una lezione
function nextSchoolDay(day) {
    for (let k = 1; k <= 7; k++) {
        const d = (day + k) % 7;
        if (getSlots(currentClass, d).length) return { day: d, offset: k };
    }
    return null;
}

function updateStatus(now) {
    const day = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const slots = getSlots(currentClass, day);
    const container = $('status-widgets');
    let html = '';

    const current = slots.find(s => mins >= s.s && mins < s.e);
    const next = slots.find(s => s.s > mins);

    if (current) {
        const m = meta(current.items[0].subject);
        const progress = ((mins - current.s) / (current.e - current.s)) * 100;
        html += `
            <div class="widget current" style="--accent:${m.color}">
                <div class="widget-bg-blob"></div>
                <div class="widget-label"><span class="pulse"></span> In corso</div>
                <div class="widget-main">
                    <div class="widget-subject">${slotTitle(current)}</div>
                    <div class="widget-room">${slotRooms(current) || '—'}</div>
                </div>
                ${groupNote(current)}
                <div class="widget-footer">
                    <span>Fino alle ${current.end}</span>
                    <span class="countdown">ancora ${fmtDuration(current.e - mins)}</span>
                </div>
                <div class="progress-bar-container"><div class="progress-bar" style="width:${progress}%"></div></div>
            </div>`;
    } else if (next && mins < slots[0].s) {
        html += `
            <div class="widget current">
                <div class="widget-bg-blob"></div>
                <div class="widget-label">⏳ Prima ora</div>
                <div class="widget-main">
                    <div class="widget-subject">${slotTitle(next)}</div>
                    <div class="widget-room">${slotRooms(next) || '—'}</div>
                </div>
                ${groupNote(next)}
                <div class="widget-footer">
                    <span>Inizia alle ${next.start}</span>
                    <span class="countdown">tra ${fmtDuration(next.s - mins)}</span>
                </div>
            </div>`;
    } else if (!next) {
        const nd = nextSchoolDay(day);
        const first = nd && getSlots(currentClass, nd.day)[0];
        const when = !nd ? '' : nd.offset === 1 ? 'Domani' : DAYS[nd.day];
        const done = slots.length > 0;
        html += `
            <div class="widget current ${done ? 'done' : 'weekend'}">
                <div class="widget-bg-blob"></div>
                <div class="widget-label">${done ? '✅ Lezioni finite' : '🎉 Niente scuola oggi'}</div>
                ${first ? `
                <div class="widget-main">
                    <div class="widget-subject small">${when}: ${slotTitle(first)}</div>
                    <div class="widget-room">${slotRooms(first) || '—'}</div>
                </div>
                <div class="widget-footer"><span>Prima ora alle ${first.start}</span></div>` : ''}
            </div>`;
    }

    if (next && (current || mins >= slots[0].s)) {
        const m = meta(next.items[0].subject);
        const gap = next.s - mins;
        html += `
            <div class="widget next">
                <div class="widget-label" style="color:${m.color}">⏭️ Prossima · ${next.start} <span class="countdown muted">tra ${fmtDuration(gap)}</span></div>
                <div class="widget-main compact">
                    <div class="widget-subject small">${slotTitle(next)}</div>
                    <div class="widget-room small">${slotRooms(next) || '—'}</div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// ---------- Lista lezioni ----------
function renderTimetable() {
    document.querySelectorAll('.day-btn').forEach(btn => {
        const d = parseInt(btn.dataset.day);
        btn.classList.toggle('active', d === selectedDay);
        btn.classList.toggle('today', d === new Date().getDay());
    });

    const slots = getSlots(currentClass, selectedDay);
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const isToday = now.getDay() === selectedDay;

    if (!slots.length) {
        $('day-summary').textContent = '';
        $('timetable-list').innerHTML = `<div class="empty">Nessuna lezione</div>`;
        return;
    }
    $('day-summary').textContent =
        `${DAYS[selectedDay]} · ${slots[0].start}–${slots[slots.length - 1].end} · ${slots.length} lezioni`;

    $('timetable-list').innerHTML = slots.map(slot => {
        const active = isToday && mins >= slot.s && mins < slot.e;
        const past = isToday && mins >= slot.e;
        const m = meta(slot.items[0].subject);
        const dur = slot.e - slot.s;
        const multi = slot.items.length > 1 || slot.items[0].group;
        const body = slot.items.map(i => {
            const im = meta(i.subject);
            return `
                <div class="lesson-row" style="--item-color:${im.color}; --item-bg:${im.bg}">
                    <div class="lesson-content">
                        <div class="subject-wrapper">
                            <div class="subject-icon-box">${im.emoji}</div>
                            <div>
                                <span class="lesson-subject">${i.subject}</span>
                                ${i.group ? `<span class="group-badge">gruppo ${i.group}</span>` : ''}
                                <span class="lesson-teachers">${i.teachers || ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="lesson-room-badge">${i.room || '—'}${i.note ? `<small>${i.note}</small>` : ''}</div>
                </div>`;
        }).join('');
        return `
            <div class="lesson-item ${active ? 'active-lesson' : ''} ${past ? 'past' : ''} ${multi ? 'multi' : ''}" style="--item-color:${m.color}; --item-bg:${m.bg}">
                <div class="lesson-time">
                    <span class="time-start">${slot.start}</span>
                    <span class="time-end">${slot.end}</span>
                    ${dur > 70 ? `<span class="time-dur">${fmtDuration(dur)}</span>` : ''}
                </div>
                <div class="lesson-rows">${body}</div>
            </div>`;
    }).join('');
}

// ---------- Orologio ----------
let lastMinute = -1;
function tick() {
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const minute = now.getHours() * 60 + now.getMinutes();
    if (minute !== lastMinute) {
        lastMinute = minute;
        $('date-display').textContent = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
        updateStatus(now);
        renderTimetable();
        checkNotification(now);
    }
}

function renderAll() {
    renderHeader();
    lastMinute = -1;
    tick();
}

// ---------- Selettore giorni + swipe ----------
document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedDay = parseInt(btn.dataset.day);
        renderTimetable();
    });
});

let touchX = null, touchY = null;
const section = $('timetable-section');
section.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
section.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    selectedDay = Math.min(5, Math.max(1, selectedDay + (dx < 0 ? 1 : -1)));
    renderTimetable();
});

// ---------- Impostazioni ----------
function fillClassSelect(select, value) {
    const years = {};
    CLASS_NAMES.forEach(c => (years[c[0]] = years[c[0]] || []).push(c));
    select.innerHTML = Object.keys(years).sort().map(y =>
        `<optgroup label="Classi ${y}ª">${years[y].map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>`
    ).join('');
    select.value = value;
}

const modal = $('settings-modal');
$('settings-btn').addEventListener('click', () => {
    fillClassSelect($('my-class-select'), myClass);
    fillClassSelect($('friend-class-select'), friendClass);
    fillClassSelect($('any-class-select'), currentClass);
    modal.classList.remove('hidden');
});
$('close-settings').addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

$('my-class-select').addEventListener('change', e => {
    myClass = e.target.value;
    localStorage.setItem('myClass', myClass);
    setClass(myClass);
});
$('friend-class-select').addEventListener('change', e => {
    friendClass = e.target.value;
    localStorage.setItem('friendClass', friendClass);
    setClass(friendClass);
});
$('any-class-select').addEventListener('change', e => {
    setClass(e.target.value);
    modal.classList.add('hidden');
});

// ---------- Notifiche ----------
function updateNotifyBtn() {
    const on = 'Notification' in window && Notification.permission === 'granted';
    $('notify-btn').querySelector('span').textContent = on ? 'Avvisi attivi (7:50)' : 'Attiva avvisi (7:50)';
    $('notify-btn').classList.toggle('enabled', on);
}
$('notify-btn').addEventListener('click', () => {
    if (!('Notification' in window)) { alert('Questo browser non supporta le notifiche.'); return; }
    Notification.requestPermission().then(updateNotifyBtn);
});

function checkNotification(now) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (now.getHours() !== 7 || now.getMinutes() !== 50) return;
    const key = now.toDateString();
    if (localStorage.getItem('notifiedOn') === key) return;
    const first = getSlots(myClass, now.getDay())[0];
    if (!first) return;
    const body = `${first.start} in aula ${slotRooms(first)}`;
    const title = `Prima ora: ${first.items.map(i => i.subject).join(' / ')}`;
    const show = reg => reg ? reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'favicon.png' })
                            : new Notification(title, { body, icon: 'icon-192.png' });
    (navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : Promise.resolve(null))
        .then(show).catch(() => show(null));
    localStorage.setItem('notifiedOn', key);
}

// ---------- Utente e log accessi ----------
const esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let userName = localStorage.getItem('userName') || '';

function deviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'Mac';
    return 'Altro';
}

function localLogs() {
    try { return JSON.parse(localStorage.getItem('accessLogs') || '[]'); } catch { return []; }
}
function importedLogs() {
    try { return JSON.parse(localStorage.getItem('importedLogs') || '[]'); } catch { return []; }
}

// ----- Condivisione senza server: i log viaggiano dentro un link (#logs=...) -----
const b64e = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = str => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

function buildShareLink() {
    const mine = localLogs().slice(-300);
    const classes = [...new Set(mine.map(l => l.cls))];
    const payload = {
        v: 1,
        e: mine.map(l => [l.name, Math.round(l.ts / 1000), classes.indexOf(l.cls), l.device]),
        c: classes,
    };
    return location.origin + location.pathname + '#logs=' + b64e(JSON.stringify(payload));
}

function importFromHash(hash) {
    const m = /logs=([A-Za-z0-9_-]+)/.exec(hash || '');
    if (!m) return 0;
    let payload;
    try { payload = JSON.parse(b64d(m[1])); } catch { return -1; }
    const incoming = (payload.e || []).map(([name, sec, ci, device]) =>
        ({ name: String(name).slice(0, 30), ts: sec * 1000, cls: payload.c[ci] || '', device: device || '' }));
    const stored = importedLogs();
    const seen = new Set([...stored, ...localLogs()].map(l => l.name + '|' + l.ts));
    let added = 0;
    for (const l of incoming) {
        if (!l.name || !l.ts || seen.has(l.name + '|' + l.ts)) continue;
        stored.push(l); seen.add(l.name + '|' + l.ts); added++;
    }
    localStorage.setItem('importedLogs', JSON.stringify(stored.slice(-3000)));
    return added;
}

function logAccess() {
    if (!userName) return;
    const entry = { name: userName, ts: Date.now(), cls: currentClass, device: deviceLabel() };
    const logs = localLogs();
    logs.push(entry);
    localStorage.setItem('accessLogs', JSON.stringify(logs.slice(-500)));
    localStorage.setItem('lastLogAt', String(entry.ts));
}

// Un nuovo "accesso" = apertura dell'app, oppure ritorno dopo almeno 10 minuti in background
function maybeLogReturn() {
    const last = parseInt(localStorage.getItem('lastLogAt') || '0');
    if (Date.now() - last > 10 * 60 * 1000) logAccess();
}


const fmtDay = ts => new Date(ts).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = ts => new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let allLogs = [];
function renderLogs() {
    const filter = $('logs-filter').value;
    const logs = allLogs.filter(l => !filter || l.name === filter).sort((a, b) => b.ts - a.ts);
    if (!logs.length) { $('logs-list').innerHTML = '<div class="empty">Nessun accesso registrato</div>'; return; }
    let html = '', lastDay = '';
    for (const l of logs) {
        const day = fmtDay(l.ts);
        if (day !== lastDay) { html += `<div class="log-day">${day}</div>`; lastDay = day; }
        html += `
            <div class="log-item">
                <div><div class="log-name">${esc(l.name)}</div><div class="log-meta">${esc(l.cls || '')} · ${esc(l.device || '')}</div></div>
                <div class="log-time">${fmtTime(l.ts)}</div>
            </div>`;
    }
    $('logs-list').innerHTML = html;
}

function openLogs(message) {
    $('logs-modal').classList.remove('hidden');
    allLogs = [...localLogs(), ...importedLogs()].filter(l => l && l.name && l.ts);
    $('logs-source').textContent = message ||
        'I tuoi accessi più quelli che gli amici ti hanno mandato. Per vedere quelli nuovi di un amico, chiedigli di toccare "Condividi i miei accessi" e apri il link che ti manda.';
    const names = [...new Set(allLogs.map(l => l.name))].sort((a, b) => a.localeCompare(b));
    $('logs-filter').innerHTML = `<option value="">Tutti (${names.length} persone)</option>` +
        names.map(n => {
            const c = allLogs.filter(l => l.name === n).length;
            return `<option value="${esc(n)}">${esc(n)} · ${c} accessi</option>`;
        }).join('');
    renderLogs();
}

$('logs-btn').addEventListener('click', () => { modal.classList.add('hidden'); openLogs(); });
$('share-logs-btn').addEventListener('click', async () => {
    const url = buildShareLink();
    const text = `Accessi di ${userName} all'app Orario`;
    try {
        if (navigator.share) { await navigator.share({ title: text, text, url }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); alert('Link copiato! Mandalo al tuo amico.'); }
    catch { prompt('Copia questo link e mandalo al tuo amico:', url); }
});
$('import-logs-btn').addEventListener('click', () => {
    const link = prompt('Incolla il link che ti ha mandato il tuo amico:');
    if (!link) return;
    const added = importFromHash(link);
    openLogs(added < 0 || added === 0 && !/logs=/.test(link) ? 'Link non valido.' : `Importati ${added} nuovi accessi.`);
});
$('logs-filter').addEventListener('change', renderLogs);
$('close-logs').addEventListener('click', () => $('logs-modal').classList.add('hidden'));
$('logs-modal').addEventListener('click', e => { if (e.target === $('logs-modal')) $('logs-modal').classList.add('hidden'); });

function askUserName(changing) {
    $('welcome-name').value = changing ? userName : '';
    $('welcome-modal').classList.remove('hidden');
    setTimeout(() => $('welcome-name').focus(), 300);
}
$('welcome-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('welcome-name').value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const isNew = name !== userName;
    userName = name;
    localStorage.setItem('userName', name);
    $('user-name-display').textContent = name;
    $('welcome-modal').classList.add('hidden');
    if (isNew) logAccess();
});
$('change-user-btn').addEventListener('click', () => { modal.classList.add('hidden'); askUserName(true); });

// ---------- Avvio ----------
$('user-name-display').textContent = userName;
if (userName) logAccess(); else askUserName(false);
if (/logs=/.test(location.hash)) {
    const added = importFromHash(location.hash);
    history.replaceState(null, '', location.pathname);
    openLogs(added < 0 ? 'Link non valido.' : `Importati ${added} nuovi accessi dal link.`);
}
$('updated-date').textContent = TIMETABLE_UPDATED;
updateNotifyBtn();
renderAll();
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderAll(); maybeLogReturn(); } });

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error', err));
}
