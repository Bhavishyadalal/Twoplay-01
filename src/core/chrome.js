// ===================================================================
// GAME REGISTRY
// ===================================================================
const GAMES = {
    chess:    { name: 'Chess',        icon: '♞', color: 'g-chess' },
    ttt:      { name: 'Tic-Tac-Toe',  icon: '✕', color: 'g-ttt' },
    c4:       { name: 'Connect 4',    icon: '🔴', color: 'g-c4' },
    checkers: { name: 'Checkers',     icon: '⛃', color: 'g-chk' },
    reversi:  { name: 'Reversi',      icon: '⬤', color: 'g-rev' },
    whiteboard: { name: 'Whiteboard', icon: '🎨', color: 'g-wb' },
    ytsync: { name: 'Watch Together', icon: '📺', color: 'g-yt' },
    ludo:     { name: 'Ludo',         icon: '🎲', color: 'g-ludo' }
};
const GAME_ORDER = ['chess', 'ttt', 'c4', 'checkers', 'reversi', 'ludo', 'whiteboard', 'ytsync'];

function buildGamePickGrid(containerId, onPick) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    GAME_ORDER.forEach(key => {
        const g = GAMES[key];
        const card = document.createElement('button');
        card.className = 'game-pick-card';
        card.dataset.game = key;
        card.innerHTML = `<span class="icon">${g.icon}</span><span class="name">${g.name}</span>`;
        card.onclick = () => onPick(key, card, el);
        el.appendChild(card);
    });
}

// ===================================================================
// CAT LOGO — tap-to-wink interaction on the header mascot badges.
// Idle sway/blink/tail animations run purely in CSS (see .cat-logo
// keyframes); this just layers a one-shot bounce+wink class on tap,
// removed after it finishes so the idle loop resumes untouched.
// ===================================================================
function toggleCatWink(badgeId) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    const svg = badge.querySelector('.cat-logo');
    if (!svg) return;
    svg.classList.remove('cat-tapped');
    void svg.offsetWidth; // restart animation even on rapid re-taps
    svg.classList.add('cat-tapped');
    setTimeout(() => svg.classList.remove('cat-tapped'), 450);
}

// ===================================================================
// CAT MASCOT — pose variants (base / heart / flowers). Same body+face
// markup for every pose; only paws + a held item fade in/out via CSS
// (see .cat-pose-item / .cat-pose-paws). setCatPose() drives both
// badges (landing + in-game mini) at once so they stay in sync.
// ===================================================================
const catPoseTimers = {}; // badgeId -> revert timeout, so overlapping calls don't clobber each other
function setCatPose(pose, holdMs) {
    ['landing-cat-badge', 'mini-cat-badge'].forEach(badgeId => {
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        badge.classList.remove('pose-heart', 'pose-flowers');
        if (pose) badge.classList.add('pose-' + pose);
        if (catPoseTimers[badgeId]) { clearTimeout(catPoseTimers[badgeId]); catPoseTimers[badgeId] = null; }
        if (pose && holdMs) {
            catPoseTimers[badgeId] = setTimeout(() => badge.classList.remove('pose-' + pose), holdMs);
        }
    });
}

// Occasional random idle pose swap — purely decorative, low-frequency,
// respects prefers-reduced-motion (no point cycling poses if the user
// doesn't want motion at all).
function startCatIdlePoseCycle() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const poses = ['heart', 'flowers'];
    const scheduleNext = () => {
        const delay = 14000 + Math.random() * 16000; // ~14-30s between swaps
        setTimeout(() => {
            const pose = poses[Math.floor(Math.random() * poses.length)];
            setCatPose(pose, 3400);
            scheduleNext();
        }, delay);
    };
    scheduleNext();
}
startCatIdlePoseCycle();

// ===================================================================
// TOASTS
// ===================================================================
function toast(msg, ms) {
    const stack = document.getElementById('toast-stack');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    stack.appendChild(t);
    setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 200); }, ms || 2600);
}

// ===================================================================
// HAPTICS (best-effort — silently does nothing on unsupported devices)
// ===================================================================
function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

// ===================================================================
// CONFETTI (lightweight canvas burst — no external assets/libraries)
// ===================================================================
function fireConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:90;pointer-events:none;width:100%;height:100%;';
    document.body.appendChild(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR: uncapped 3x on some Android phones triples pixel fill for no visible gain
    const W = canvas.width = innerWidth * dpr, H = canvas.height = innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const colors = ['#dc9a3c', '#6fbf73', '#5f9bb0', '#c3573f', '#9c7bc4', '#f3ecdc'];
    const N = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches ? 55 : 90;
    const pieces = Array.from({ length: N }, () => ({
        x: innerWidth / 2 + (Math.random() - 0.5) * 60,
        y: innerHeight * 0.35 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        shape: Math.random() < 0.5 ? 'rect' : 'circle'
    }));
    const gravity = 0.32, drag = 0.992;
    let frame = 0;
    const maxFrames = 130;
    function step() {
        frame++;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (const p of pieces) {
            p.vx *= drag; p.vy = p.vy * drag + gravity;
            p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
            const fade = frame > maxFrames - 30 ? Math.max(0, (maxFrames - frame) / 30) : 1;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = fade;
            ctx.fillStyle = p.color;
            if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
            else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        }
        if (frame < maxFrames) requestAnimationFrame(step);
        else canvas.remove();
    }
    requestAnimationFrame(step);
}

// ===================================================================
// SESSION SCOREBOARD — wins/draws this room, since the room was entered
// ===================================================================
let sessionScore = { me: 0, opp: 0, draws: 0 };
function resetSessionScore() { sessionScore = { me: 0, opp: 0, draws: 0 }; updateSessionScoreUI(); }
function recordSessionResult(kind, winnerColor) {
    if (kind === 'draw') sessionScore.draws++;
    else if (localMode && winnerColor) { if (winnerColor === myColor) sessionScore.me++; else sessionScore.opp++; }
    else if (kind === 'win') sessionScore.me++;
    else if (kind === 'lose') sessionScore.opp++;
    updateSessionScoreUI();
}
function updateSessionScoreUI() {
    const el = document.getElementById('session-score');
    if (!el) return;
    const { me, opp, draws } = sessionScore;
    if (me + opp + draws === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<span class="ss-me">${me}</span><span class="ss-sep">–</span><span class="ss-opp">${opp}</span>${draws ? `<span class="ss-draws">· ${draws} draw${draws === 1 ? '' : 's'}</span>` : ''}`;
}

// ===================================================================
// HEADER MENU (mobile only — icon buttons collapse into a dropdown
// behind a "more" button so they can't overflow the header pill)
// ===================================================================
function closeHeaderMenu() {
    const menu = document.getElementById('header-actions');
    const btn = document.getElementById('header-more-btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
function toggleHeaderMenu() {
    const menu = document.getElementById('header-actions');
    const btn = document.getElementById('header-more-btn');
    if (!menu || !btn) return;
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
}
document.addEventListener('click', e => {
    const menu = document.getElementById('header-actions');
    const btn = document.getElementById('header-more-btn');
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
    closeHeaderMenu();
});
// picking any action inside the menu closes it (theme/switch/leave open
// their own overlay, sound just toggles) so it doesn't stay stuck open
// underneath a full-screen overlay. This script runs at the end of
// <body>, so the DOM is already parsed — attach directly, no need to
// wait for DOMContentLoaded (which would have already fired by now).
(() => {
    const menu = document.getElementById('header-actions');
    if (menu) menu.addEventListener('click', e => { if (e.target.closest('.icon-btn')) setTimeout(closeHeaderMenu, 0); });
})();
window.addEventListener('resize', closeHeaderMenu);

// ===================================================================
// SOUND (WebAudio synthesized — no external assets)
// ===================================================================
let soundOn = true;
let audioCtx = null;
function ensureAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return audioCtx;
}
function playTone(freq, dur, type, gainMax) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainMax || 0.15, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
}
function sndMove() { playTone(520, 0.09, 'sine', 0.12); vibrate(10); }
function sndCapture() { playTone(340, 0.11, 'square', 0.08); vibrate([12, 30, 12]); }
function sndCheck() { playTone(720, 0.15, 'sawtooth', 0.1); setTimeout(() => playTone(880, 0.12, 'sawtooth', 0.08), 70); vibrate([15, 40, 15, 40, 15]); }
function sndEnd() { playTone(300, 0.2, 'sine', 0.12); setTimeout(() => playTone(200, 0.35, 'sine', 0.1), 140); }
function sndNotify() { playTone(660, 0.08, 'sine', 0.1); }
function sndConnect() { playTone(440, 0.09, 'sine', 0.1); setTimeout(() => playTone(660, 0.14, 'sine', 0.1), 90); setTimeout(sndCatChirp, 260); }
// A tiny playful "mrrp" — two quick pitch-bent blips, not a literal purr
// (pure oscillators can't do vocal texture), layered after the existing
// connect chime so it reads as a little greeting rather than a new alert.
function sndCatChirp() {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.09);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
}

function toggleSound() {
    soundOn = !soundOn;
    const gameBtn = document.getElementById('sound-toggle-game');
    if (gameBtn) {
        gameBtn.querySelector('.icon-sound-on').classList.toggle('hidden', !soundOn);
        gameBtn.querySelector('.icon-sound-off').classList.toggle('hidden', soundOn);
        gameBtn.classList.add('pop'); setTimeout(() => gameBtn.classList.remove('pop'), 220);
    }
    try { localStorage.setItem('twoplay_sound', soundOn ? '1' : '0'); } catch (e) {}
    if (soundOn) ensureAudio();
}
try {
    const saved = localStorage.getItem('twoplay_sound');
    if (saved === '0') {
        soundOn = false;
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('sound-toggle-game');
            if (btn) { btn.querySelector('.icon-sound-on').classList.add('hidden'); btn.querySelector('.icon-sound-off').classList.remove('hidden'); }
        });
    }
} catch (e) {}
