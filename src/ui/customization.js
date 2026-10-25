// ===================================================================
// CHESS BOARD THEMES — purely visual, local-only, not synced to opponent
// ===================================================================
// Move animation styles — each takes eased progress t (0..1) plus the
// straight-line from/to pixel deltas and returns how the piece should
// be drawn this frame. Kept as pure functions so paintFrame just calls
// whichever one is selected without branching on style by name.
const MOVE_ANIMS = {
    slide:   { name: 'Smooth Slide',  durationMs: 160, ease: t => 1 - Math.pow(1 - t, 3),
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: 1, rot: 0 }) },
    snap:    { name: 'Quick Snap',    durationMs: 90,  ease: t => t,
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: 1, rot: 0 }) },
    bounce:  { name: 'Bouncy',        durationMs: 320, ease: t => {
                   const c4 = (2 * Math.PI) / 3;
                   return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
               }, offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: 1, rot: 0 }) },
    hop:     { name: 'Arc Hop',       durationMs: 260, ease: t => 1 - Math.pow(1 - t, 2),
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t) - Math.sin(t * Math.PI) * 26, scale: 1, rot: 0 }) },
    elastic: { name: 'Elastic',       durationMs: 380, ease: t => {
                   const c5 = (2 * Math.PI) / 4.5;
                   return t === 0 ? 0 : t === 1 ? 1 :
                       t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
                                : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
               }, offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: 1, rot: 0 }) },
    spin:    { name: 'Spin Drop',     durationMs: 300, ease: t => 1 - Math.pow(1 - t, 3),
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: 0.7 + 0.3 * t, rot: (1 - t) * Math.PI * 2 }) },
    pop:     { name: 'Pop In',        durationMs: 180, ease: t => 1 - Math.pow(1 - t, 3),
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t), scale: t < 0.85 ? 1 : 1 + (1 - t) * 0.8, rot: 0 }) },
    glide:   { name: 'Floaty Glide',  durationMs: 420, ease: t => t * t * (3 - 2 * t),
               offset: (t, dx, dy) => ({ x: dx * (1 - t), y: dy * (1 - t) - Math.sin(t * Math.PI) * 10, scale: 1, rot: 0 }) },
    teleport:{ name: 'Teleport',      durationMs: 200, ease: t => t,
               offset: (t, dx, dy) => {
                   const p = t < 0.5 ? t * 2 : (t - 0.5) * 2;
                   const scale = t < 0.5 ? 1 - p : p;
                   return { x: t < 0.5 ? dx : 0, y: t < 0.5 ? dy : 0, scale, rot: 0 };
               } },
    none:    { name: 'Instant',       durationMs: 1,   ease: t => 1,
               offset: (t, dx, dy) => ({ x: 0, y: 0, scale: 1, rot: 0 }) }
};
let currentMoveAnim = 'slide';
try {
    const savedAnim = localStorage.getItem('twoplay_move_anim');
    if (savedAnim && MOVE_ANIMS[savedAnim]) currentMoveAnim = savedAnim;
} catch (e) {}
function setMoveAnim(key) {
    if (!MOVE_ANIMS[key]) return;
    currentMoveAnim = key;
    try { localStorage.setItem('twoplay_move_anim', key); } catch (e) {}
    buildMoveAnimGrids();
}
function buildOneMoveAnimGrid(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    Object.keys(MOVE_ANIMS).forEach(key => {
        const a = MOVE_ANIMS[key];
        const card = document.createElement('button');
        card.className = 'move-anim-card' + (key === currentMoveAnim ? ' active' : '');
        card.innerHTML = '<span class="move-anim-dot"></span><span class="move-anim-name"></span>';
        card.querySelector('.move-anim-name').innerText = a.name;
        card.addEventListener('click', () => setMoveAnim(key));
        el.appendChild(card);
    });
}
function buildMoveAnimGrids() {
    buildOneMoveAnimGrid('move-anim-grid-live');
}
buildMoveAnimGrids();

const BOARD_THEMES = {
    classic:  { name: 'Lounge',     light: '#f5f0df', dark: '#93a58c', lastMoveLight: 'rgba(255,180,61,0.4)', lastMoveDark: 'rgba(255,140,61,0.4)', select: 'rgba(255,180,61,0.55)', coord: true },
    midnight: { name: 'Midnight',   light: '#3a4a63', dark: '#1a2233', lastMoveLight: 'rgba(90,180,255,0.35)', lastMoveDark: 'rgba(60,140,220,0.4)', select: 'rgba(120,200,255,0.5)', coord: true },
    candy:    { name: 'Candy Pop',  light: '#ffd9ec', dark: '#ff6fa5', lastMoveLight: 'rgba(255,244,120,0.55)', lastMoveDark: 'rgba(255,210,90,0.55)', select: 'rgba(255,255,140,0.6)', coord: true },
    marble:   { name: 'Royal Marble', light: '#f2ede3', dark: '#8b7d6b', lastMoveLight: 'rgba(212,175,55,0.4)', lastMoveDark: 'rgba(212,175,55,0.5)', select: 'rgba(230,200,120,0.55)', coord: true },
    wood:     { name: 'Wood Deluxe', light: '#e8c99b', dark: '#8b5a2b', lastMoveLight: 'rgba(255,220,120,0.4)', lastMoveDark: 'rgba(255,190,80,0.45)', select: 'rgba(255,230,140,0.55)', coord: true },

    mono:     { name: 'Mono Ink',    light: '#f4f4f2', dark: '#232323', lastMoveLight: 'rgba(120,120,120,0.3)', lastMoveDark: 'rgba(180,180,180,0.3)', select: 'rgba(0,0,0,0.22)', coord: true },
    neon:     { name: 'Neon Grid',   light: '#171225', dark: '#0a0716', lastMoveLight: 'rgba(255,60,220,0.4)', lastMoveDark: 'rgba(80,255,220,0.35)', select: 'rgba(80,255,220,0.5)', coord: true },
    sunset:   { name: 'Sunset',      light: '#ffe3c2', dark: '#ff7a59', lastMoveLight: 'rgba(255,90,150,0.4)', lastMoveDark: 'rgba(255,60,120,0.45)', select: 'rgba(255,200,90,0.55)', coord: true },
    mint:     { name: 'Fresh Mint',  light: '#eafff5', dark: '#7bd9ab', lastMoveLight: 'rgba(60,200,255,0.35)', lastMoveDark: 'rgba(40,170,220,0.4)', select: 'rgba(255,255,150,0.55)', coord: true },
    lavender: { name: 'Lavender Dream', light: '#f4eeff', dark: '#b39ddb', lastMoveLight: 'rgba(255,200,240,0.5)', lastMoveDark: 'rgba(255,160,220,0.5)', select: 'rgba(255,220,255,0.6)', coord: true },
    ocean:    { name: 'Deep Ocean',  light: '#dff3f8', dark: '#1f6f8b', lastMoveLight: 'rgba(255,210,120,0.4)', lastMoveDark: 'rgba(255,180,80,0.45)', select: 'rgba(120,220,255,0.5)', coord: true },
    forest:   { name: 'Forest Floor', light: '#e9e2c9', dark: '#3f5b3a', lastMoveLight: 'rgba(255,190,80,0.4)', lastMoveDark: 'rgba(220,150,50,0.45)', select: 'rgba(180,220,120,0.5)', coord: true },
    desert:   { name: 'Desert Dune', light: '#f6e6c8', dark: '#c98a4b', lastMoveLight: 'rgba(255,120,90,0.4)', lastMoveDark: 'rgba(220,90,60,0.45)', select: 'rgba(255,210,140,0.55)', coord: true },
    ice:      { name: 'Glacier Ice', light: '#f0fbff', dark: '#a9d8ea', lastMoveLight: 'rgba(140,200,255,0.4)', lastMoveDark: 'rgba(100,170,240,0.45)', select: 'rgba(200,240,255,0.6)', coord: true },
    lava:     { name: 'Molten Lava', light: '#3a2626', dark: '#1a1010', lastMoveLight: 'rgba(255,110,40,0.45)', lastMoveDark: 'rgba(255,70,20,0.5)', select: 'rgba(255,160,60,0.55)', coord: true },
    sakura:   { name: 'Sakura',      light: '#fff2f6', dark: '#ffb7c9', lastMoveLight: 'rgba(255,255,255,0.5)', lastMoveDark: 'rgba(255,230,240,0.5)', select: 'rgba(255,180,210,0.6)', coord: true },
    gemstone: { name: 'Gemstone',    light: '#e8f0ff', dark: '#2b5d9e', lastMoveLight: 'rgba(160,120,255,0.4)', lastMoveDark: 'rgba(120,80,220,0.45)', select: 'rgba(130,200,255,0.55)', coord: true },
    autumn:   { name: 'Autumn Leaves', light: '#fbead0', dark: '#b5622e', lastMoveLight: 'rgba(255,190,50,0.4)', lastMoveDark: 'rgba(220,140,20,0.45)', select: 'rgba(255,210,110,0.55)', coord: true },
    vintage:  { name: 'Vintage Sepia', light: '#ecdcc0', dark: '#9c7a54', lastMoveLight: 'rgba(150,110,60,0.35)', lastMoveDark: 'rgba(120,85,40,0.4)', select: 'rgba(200,170,120,0.5)', coord: true },
    contrast: { name: 'High Contrast', light: '#ffffff', dark: '#000000', lastMoveLight: 'rgba(255,220,0,0.5)', lastMoveDark: 'rgba(255,220,0,0.55)', select: 'rgba(0,180,255,0.5)', coord: true }
};
let currentBoardTheme = 'classic';
try {
    const savedTheme = localStorage.getItem('twoplay_board_theme');
    if (savedTheme && BOARD_THEMES[savedTheme]) currentBoardTheme = savedTheme;
} catch (e) {}

function setBoardTheme(key) {
    if (!BOARD_THEMES[key]) return;
    currentBoardTheme = key;
    try { localStorage.setItem('twoplay_board_theme', key); } catch (e) {}
    buildThemeGrids();
    if (GameControllers.chess && GameControllers.chess.render) GameControllers.chess.render();
}

function buildOneThemeGrid(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    Object.keys(BOARD_THEMES).forEach(key => {
        const t = BOARD_THEMES[key];
        const card = document.createElement('button');
        card.className = 'board-theme-card' + (key === currentBoardTheme ? ' active' : '');
        card.setAttribute('aria-label', t.name);
        const swatch = document.createElement('div');
        swatch.className = 'board-theme-swatch';
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cell = document.createElement('div');
                cell.style.background = (r + c) % 2 === 0 ? t.light : t.dark;
                swatch.appendChild(cell);
            }
        }
        const label = document.createElement('span');
        label.className = 'board-theme-name';
        label.innerText = t.name;
        card.appendChild(swatch);
        card.appendChild(label);
        card.addEventListener('click', () => setBoardTheme(key));
        el.appendChild(card);
    });
}
function buildThemeGrids() {
    buildOneThemeGrid('board-theme-grid-live');
}
buildThemeGrids();

// ===================================================================
// CREDITS — a cinematic "made by Cattitude" reveal, staged in
// sequence: curtain iris opens -> card pops with a paw shockwave and
// shimmer sweep -> confetti burst fires once the card has landed.
// Only one canvas ever runs (confetti); the curtain, sparkles, sheen,
// and shimmer are all cheap CSS transform/opacity work driven by the
// .credits-open class, so nothing fights for the same frame budget.
// ===================================================================
const CREDITS_SPARKLE_EMOJI = ['✨', '💗', '🐾', '⭐', '🌸'];
function spawnCreditsSparkles() {
    const field = document.getElementById('credits-sparkle-field');
    if (!field) return;
    field.innerHTML = '';
    const count = 7;
    for (let i = 0; i < count; i++) {
        const s = document.createElement('span');
        s.className = 'credits-sparkle';
        s.textContent = CREDITS_SPARKLE_EMOJI[i % CREDITS_SPARKLE_EMOJI.length];
        s.style.left = (4 + Math.random() * 92) + '%';
        s.style.top = (6 + Math.random() * 80) + '%';
        s.style.animationDelay = (0.9 + Math.random() * 2.2) + 's';
        s.style.animationDuration = (2.4 + Math.random() * 1.4) + 's';
        field.appendChild(s);
    }
}

let creditsConfettiRAF = null;
function runCreditsConfettiBurst() {
    const canvas = document.getElementById('credits-confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const colors = ['#FF6FA5', '#FFA24C', '#8A63F2', '#1FAE7A', '#F2B705', '#FF9EC4'];
    const originX = canvas.width * 0.5, originY = canvas.height * 0.38;
    const shapes = ['rect', 'rect', 'rect', 'paw', 'heart', 'star'];
    const pieces = Array.from({ length: 60 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = (2.2 + Math.random() * 6.5) * dpr;
        return {
            x: originX, y: originY,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2.2 * dpr,
            size: (4.5 + Math.random() * 6) * dpr,
            color: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.4,
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            life: 1
        };
    });
    const gravity = 0.085 * dpr;
    const drag = 0.988;
    const start = performance.now();
    function drawPaw(ctx, size) {
        ctx.beginPath();
        ctx.arc(0, size * 0.15, size * 0.32, 0, Math.PI * 2);
        ctx.arc(-size * 0.32, -size * 0.12, size * 0.16, 0, Math.PI * 2);
        ctx.arc(0, -size * 0.32, size * 0.17, 0, Math.PI * 2);
        ctx.arc(size * 0.32, -size * 0.12, size * 0.16, 0, Math.PI * 2);
        ctx.fill();
    }
    function drawHeart(ctx, size) {
        const s = size * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.55);
        ctx.bezierCurveTo(s, -s * 0.35, s * 0.35, -s, 0, -s * 0.15);
        ctx.bezierCurveTo(-s * 0.35, -s, -s, -s * 0.35, 0, s * 0.55);
        ctx.fill();
    }
    function drawStar(ctx, size) {
        const spikes = 5, outer = size * 0.55, inner = outer * 0.45;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (Math.PI / spikes) * i - Math.PI / 2;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }
    function frame(now) {
        const elapsed = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        pieces.forEach(p => {
            p.vy += gravity;
            p.vx *= drag; p.vy *= drag;
            p.x += p.vx; p.y += p.vy;
            p.rot += p.vrot;
            p.life = Math.max(0, 1 - elapsed / 2200);
            if (p.life > 0.02) alive = true;
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            if (p.shape === 'paw') { drawPaw(ctx, p.size * 1.5); }
            else if (p.shape === 'heart') { drawHeart(ctx, p.size * 1.5); }
            else if (p.shape === 'star') { drawStar(ctx, p.size * 1.6); }
            else { ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.62); }
            ctx.restore();
        });
        if (alive) {
            creditsConfettiRAF = requestAnimationFrame(frame);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    if (creditsConfettiRAF) cancelAnimationFrame(creditsConfettiRAF);
    creditsConfettiRAF = requestAnimationFrame(frame);
}
function stopCreditsConfetti() {
    if (creditsConfettiRAF) { cancelAnimationFrame(creditsConfettiRAF); creditsConfettiRAF = null; }
    const canvas = document.getElementById('credits-confetti-canvas');
    if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function openCreditsPopup() {
    const overlay = document.getElementById('credits-overlay');
    clearTimeout(overlay._closeTimer);
    clearTimeout(overlay._confettiTimer);
    overlay.classList.remove('credits-closing');
    overlay.classList.remove('hidden');
    spawnCreditsSparkles();
    void overlay.offsetWidth;
    overlay.classList.add('credits-open');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    overlay._confettiTimer = setTimeout(() => {
        runCreditsConfettiBurst();
        if (navigator.vibrate) { try { navigator.vibrate([10, 40, 16]); } catch (e) {} }
    }, 560);
}
function closeCreditsPopup() {
    const overlay = document.getElementById('credits-overlay');
    clearTimeout(overlay._closeTimer);
    clearTimeout(overlay._confettiTimer);
    stopCreditsConfetti();
    overlay.classList.remove('credits-open');
    overlay.classList.add('credits-closing');
    overlay._closeTimer = setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('credits-closing');
    }, 320);
}



function openThemePicker() {
    buildOneThemeGrid('board-theme-grid-live');
    buildOneMoveAnimGrid('move-anim-grid-live');
    document.getElementById('theme-picker-overlay').classList.remove('hidden');
}
function closeThemePicker() { document.getElementById('theme-picker-overlay').classList.add('hidden'); }

// ===================================================================
// ROOM THEMES — background + accent color for the in-game shell.
// Local-only display preference (never sent to the opponent), stored
// per-room so different rooms can remember different looks.
// ===================================================================
const ROOM_THEMES = {
    classic:   { name: 'Classic',   swatch: 'linear-gradient(135deg, #FFF8EE 55%, #FF6FA5 55%)' },
    sunset:    { name: 'Sunset',    swatch: 'linear-gradient(135deg, #FFF3E9 55%, #FF7A45 55%)' },
    mint:      { name: 'Mint',      swatch: 'linear-gradient(135deg, #EAFBF3 55%, #1FAE7A 55%)' },
    lavender:  { name: 'Lavender',  swatch: 'linear-gradient(135deg, #F4F0FF 55%, #8A63F2 55%)' },
    midnight:  { name: 'Midnight',  swatch: 'linear-gradient(135deg, #232041 55%, #7FA8FF 55%)' },
    sun:       { name: 'Sun',       swatch: 'linear-gradient(135deg, #FFF9E3 55%, #F2B705 55%)' }
};
let currentRoomTheme = 'classic';

function roomThemeStorageKey() {
    // Prefer the actual room code so each room can carry its own theme.
    // Joiners have it in lastJoinedCode; hosts have it in myPeerCode
    // (lastJoinedCode stays null on the host side). Falls back to a
    // shared key if neither is available yet.
    const code = (typeof lastJoinedCode === 'string' && lastJoinedCode)
        ? lastJoinedCode
        : ((typeof myPeerCode === 'string' && myPeerCode) ? myPeerCode : 'default');
    return 'twoplay_room_theme_' + code;
}
function loadRoomThemeForCurrentRoom() {
    let theme = 'classic';
    try {
        const saved = localStorage.getItem(roomThemeStorageKey());
        if (saved && ROOM_THEMES[saved]) theme = saved;
    } catch (e) {}
    applyRoomTheme(theme, false);
}
function applyRoomTheme(key, persist) {
    if (!ROOM_THEMES[key]) key = 'classic';
    currentRoomTheme = key;
    Object.keys(ROOM_THEMES).forEach(k => document.body.classList.remove('room-theme-' + k));
    if (key !== 'classic') document.body.classList.add('room-theme-' + key);
    if (persist) {
        try { localStorage.setItem(roomThemeStorageKey(), key); } catch (e) {}
    }
    buildRoomThemeGrid();
}
function setRoomTheme(key) { applyRoomTheme(key, true); }

function buildRoomThemeGrid() {
    const el = document.getElementById('room-theme-grid');
    if (!el) return;
    el.innerHTML = '';
    Object.keys(ROOM_THEMES).forEach(key => {
        const t = ROOM_THEMES[key];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'room-theme-card' + (key === currentRoomTheme ? ' active' : '');
        card.setAttribute('aria-label', t.name);
        const swatch = document.createElement('div');
        swatch.className = 'room-theme-swatch';
        swatch.style.background = t.swatch;
        const label = document.createElement('span');
        label.className = 'room-theme-name';
        label.innerText = t.name;
        card.appendChild(swatch);
        card.appendChild(label);
        card.addEventListener('click', () => setRoomTheme(key));
        el.appendChild(card);
    });
}
function openRoomThemePicker() {
    buildRoomThemeGrid();
    document.getElementById('room-theme-overlay').classList.remove('hidden');
}
function closeRoomThemePicker() { document.getElementById('room-theme-overlay').classList.add('hidden'); }
