// ===================================================================
// FUN CURSORS — optional animated cursor packs, picked from the header's
// "more" menu. Rendered as a JS-driven sprite that follows the pointer
// (CSS `cursor:` can't animate reliably across browsers), so the real
// system cursor is hidden and this sprite takes over instead. Local-only
// preference (stored per-browser via localStorage), applies across the
// whole site — landing page and in-room alike — not just the room you
// picked it in. Desktop only: gated behind isDesktopPointer() so touch
// devices never get cursor:none applied to them.
// ===================================================================
const CURSOR_STORAGE_KEY = 'twoplay_cursor';
let activeCursorKey = null;      // null/'' = default system cursor
let cursorFrameIndex = 0;
let cursorFrameTimer = null;
let cursorMouseX = -100, cursorMouseY = -100;
let cursorRafPending = false;
let cursorMoveBound = false;

function isDesktopPointer() {
    try { return window.matchMedia('(pointer: fine)').matches && window.matchMedia('(hover: hover)').matches; }
    catch (e) { return false; }
}

function ensureCursorLayer() {
    let layer = document.getElementById('custom-cursor-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'custom-cursor-layer';
    const sprite = document.createElement('div');
    sprite.id = 'custom-cursor-sprite';
    layer.appendChild(sprite);
    document.body.appendChild(layer);
    return layer;
}

function onCursorMouseMove(e) {
    cursorMouseX = e.clientX; cursorMouseY = e.clientY;
    if (!cursorRafPending) { cursorRafPending = true; requestAnimationFrame(paintCursorPosition); }
}
function paintCursorPosition() {
    cursorRafPending = false;
    const sprite = document.getElementById('custom-cursor-sprite');
    if (sprite) sprite.style.transform = 'translate3d(' + cursorMouseX + 'px,' + cursorMouseY + 'px,0)';
}
function bindCursorMouseTracking() {
    if (cursorMoveBound) return;
    cursorMoveBound = true;
    window.addEventListener('mousemove', onCursorMouseMove, { passive: true });
}

// Walks the frame strip on a setTimeout chain (not setInterval) so each
// frame can honor its own duration from the source .ani's rate table
// instead of assuming a uniform frame length.
function stepCursorFrame(pack) {
    const sprite = document.getElementById('custom-cursor-sprite');
    if (!sprite) return;
    sprite.style.backgroundImage = 'url(' + pack.strip + ')';
    sprite.style.width = pack.w + 'px';
    sprite.style.height = pack.h + 'px';
    sprite.style.backgroundSize = (pack.w * pack.frames) + 'px ' + pack.h + 'px';
    sprite.style.backgroundPosition = '-' + (cursorFrameIndex * pack.w) + 'px 0';
    const dur = pack.durations[cursorFrameIndex] || 120;
    cursorFrameTimer = setTimeout(() => {
        cursorFrameIndex = (cursorFrameIndex + 1) % pack.frames;
        stepCursorFrame(pack);
    }, dur);
}
function stopCursorAnimation() {
    if (cursorFrameTimer) clearTimeout(cursorFrameTimer);
    cursorFrameTimer = null;
    cursorFrameIndex = 0;
}

function applyCustomCursor(key) {
    stopCursorAnimation();
    if (!key || !CURSOR_PACKS[key] || !isDesktopPointer()) {
        document.body.classList.remove('custom-cursor-active');
        const layer = document.getElementById('custom-cursor-layer');
        if (layer) layer.style.display = 'none';
        activeCursorKey = null;
        return;
    }
    activeCursorKey = key;
    ensureCursorLayer();
    bindCursorMouseTracking();
    document.body.classList.add('custom-cursor-active');
    const layer = document.getElementById('custom-cursor-layer');
    if (layer) layer.style.display = 'block';
    paintCursorPosition();
    stepCursorFrame(CURSOR_PACKS[key]);
}

function setCustomCursor(key) {
    if (!isDesktopPointer()) return;
    applyCustomCursor(key);
    try { localStorage.setItem(CURSOR_STORAGE_KEY, key || ''); } catch (e) {}
    buildCursorGrid();
    closeCursorPicker();
    toast(key ? (CURSOR_PACKS[key].label + ' cursor on!') : 'Back to the default cursor.');
}

function buildCursorGrid() {
    const el = document.getElementById('cursor-pick-grid');
    if (!el) return;
    el.innerHTML = '';
    const def = document.createElement('button');
    def.type = 'button';
    def.className = 'cursor-pick-card' + (!activeCursorKey ? ' active' : '');
    def.innerHTML = '<span class="cursor-pick-default">\u27A4</span><span class="cursor-pick-name">Default</span>';
    def.addEventListener('click', () => setCustomCursor(null));
    el.appendChild(def);
    Object.keys(CURSOR_PACKS).forEach(key => {
        const pack = CURSOR_PACKS[key];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'cursor-pick-card' + (activeCursorKey === key ? ' active' : '');
        const thumb = document.createElement('span');
        thumb.className = 'cursor-pick-thumb';
        thumb.style.backgroundImage = 'url(' + pack.strip + ')';
        thumb.style.width = pack.w + 'px';
        thumb.style.height = pack.h + 'px';
        thumb.style.backgroundSize = (pack.w * pack.frames) + 'px ' + pack.h + 'px';
        thumb.style.backgroundPosition = '0 0';
        const name = document.createElement('span');
        name.className = 'cursor-pick-name';
        name.innerText = pack.label;
        card.appendChild(thumb);
        card.appendChild(name);
        card.addEventListener('click', () => setCustomCursor(key));
        el.appendChild(card);
    });
}

function openCursorPicker() {
    if (!isDesktopPointer()) return;
    buildCursorGrid();
    document.getElementById('cursor-picker-overlay').classList.remove('hidden');
}
function closeCursorPicker() { document.getElementById('cursor-picker-overlay').classList.add('hidden'); }

function updateCursorButtonVisibility() {
    const btn = document.getElementById('cursor-picker-btn');
    if (btn) btn.classList.toggle('hidden', !isDesktopPointer());
}

function initCustomCursorFeature() {
    updateCursorButtonVisibility();
    if (!isDesktopPointer()) return;
    let saved = null;
    try { saved = localStorage.getItem(CURSOR_STORAGE_KEY); } catch (e) {}
    if (saved && CURSOR_PACKS[saved]) applyCustomCursor(saved);
}
initCustomCursorFeature();
const CURSOR_PACKS = {
    cute_cat: { label: "Cute Cat", w: 48, h: 48, frames: 6, durations: [400, 150, 150, 150, 150, 100], strip: "assets/cursors/cursor-1.png" },
    hachiware: { label: "Hachiware", w: 48, h: 48, frames: 6, durations: [150, 150, 150, 150, 150, 150], strip: "assets/cursors/cursor-2.png" },
    dabbing_cat: { label: "Dabbing Cat", w: 48, h: 48, frames: 4, durations: [167, 167, 167, 167], strip: "assets/cursors/cursor-3.png" },
    hero_cat: { label: "Flying Hero Cat", w: 48, h: 48, frames: 4, durations: [100, 100, 100, 100], strip: "assets/cursors/cursor-4.png" },
    slapping_cat: { label: "Slapping Cat", w: 48, h: 48, frames: 3, durations: [100, 100, 100], strip: "assets/cursors/cursor-5.png" },
    hk_pajama: { label: "Hello Kitty Pajama", w: 48, h: 48, frames: 10, durations: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100], strip: "assets/cursors/cursor-6.png" },
    newjeans: { label: "NewJeans", w: 48, h: 48, frames: 11, durations: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], strip: "assets/cursors/cursor-7.png" },
    cute_ears: { label: "Cute Ears Doll", w: 32, h: 32, frames: 12, durations: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], strip: "assets/cursors/cursor-8.png" },
    cinnamoroll: { label: "Cinnamoroll", w: 48, h: 48, frames: 14, durations: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], strip: "assets/cursors/cursor-9.png" },
    hk_teddy: { label: "HK Teddy Bear", w: 48, h: 48, frames: 14, durations: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], strip: "assets/cursors/cursor-10.png" },
    pusheen_noodles: { label: "Pusheen Noodles", w: 48, h: 48, frames: 3, durations: [100, 100, 100], strip: "assets/cursors/cursor-11.png" },
    pusheen_arrow: { label: "Pusheen & Arrow", w: 48, h: 48, frames: 10, durations: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100], strip: "assets/cursors/cursor-12.png" },
    pusheen_pizza: { label: "Pusheen Pizza", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-13.png" },
    cat_paw_fish: { label: "Cat Paw & Fish", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-14.png" },
    dreamsoda: { label: "Dreamsoda", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-15.png" },
    hk_kawaii_mouse: { label: "HK Kawaii Mouse", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-16.png" },
    hk_strawberry: { label: "HK Strawberry", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-17.png" },
    hk_watermelon: { label: "HK Watermelon", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-18.png" },
    spongebob_patrick: { label: "SpongeBob & Patrick", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-19.png" },
    pink_cutecore: { label: "Pink Cutecore", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-20.png" },
    cinnamoroll_white: { label: "Cinnamoroll Arrow", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-21.png" },
    hk_white_arrow: { label: "HK White Arrow", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-22.png" },
    my_melody_bow: { label: "My Melody Bow", w: 48, h: 48, frames: 1, durations: [100000], strip: "assets/cursors/cursor-23.png" },
};
