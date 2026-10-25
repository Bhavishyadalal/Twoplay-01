// ===================================================================
// GAME: WHITEBOARD
// Free-draw collaborative canvas — no turns, no win state. Local strokes
// are drawn immediately for zero-latency feel, then broadcast point-by-point
// (throttled) over the same gameSend/onData channel every other game uses.
// A lightweight history array lets a reconnecting peer replay everything.
// ===================================================================
(function () {
    const WB_COLORS = ['#2B2440', '#FF6FA5', '#FF9EBE', '#A06CFF', '#6C8BFF', '#2FBF83', '#FFB43D', '#FF5C5C', '#FFFFFF'];
    const WB_SIZES = [3, 6, 11];
    let canvas = null, ctx = null, wrap = null, dpr = 1, cssW = 0, cssH = 0;
    let color = WB_COLORS[1];
    let size = WB_SIZES[1];
    let erasing = false;
    let drawing = false;
    let lastPt = null;
    let strokes = [];      // history for redraw/resync: { points:[{x,y}], color, size, erase }
    let currentStroke = null;
    let sendQueue = [];
    let flushTimer = null;
    const FLUSH_MS = 35;   // throttle outgoing points so the data channel isn't flooded

    function ensureCanvas() {
        if (!canvas) canvas = document.getElementById('wb-canvas');
        if (!wrap) wrap = document.getElementById('wb-canvas-wrap');
        if (!canvas || !wrap) return false;
        // Never reset the canvas backing store while a stroke is actively
        // being drawn (locally or by the remote peer) — resizing the
        // element mid-stroke clears the in-progress path and was the
        // cause of stray connecting lines appearing on their own.
        if (drawing || remoteStroke) return true;
        const rect = wrap.getBoundingClientRect();
        const w = rect.width || 320, h = rect.height || 240;
        const newDpr = Math.min(window.devicePixelRatio || 1, 3);
        // Ignore sub-pixel jitter (mobile browser chrome show/hide, font
        // loading reflow, etc.) so a ~1px layout wobble doesn't trigger a
        // full canvas wipe+redraw — only react to a real size change.
        if (Math.abs(w - cssW) < 1 && Math.abs(h - cssH) < 1 && ctx) return true;
        if (w !== cssW || h !== cssH || !ctx) {
            cssW = w; cssH = h; dpr = newDpr;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            redrawAll();
        }
        return true;
    }

    function redrawAll() {
        if (!ctx) return;
        ctx.clearRect(0, 0, cssW, cssH);
        strokes.forEach(paintStroke);
    }
    function paintStroke(s) {
        if (!s.points || s.points.length === 0) return;
        ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        if (s.points.length === 1) {
            // a tap with no drag — draw a dot
            ctx.beginPath();
            ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.fill();
            return;
        }
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
    }
    function paintSegment(from, to, strokeColor, strokeSize, erase) {
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeSize;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }

    function ptFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    let activePointerId = null;

    function onPointerDown(e) {
        if (!ensureCanvas()) return;
        // Ignore a second finger touching down while a stroke is already
        // in progress (e.g. a palm touch on mobile) — only the pointer
        // that started the stroke should be able to continue it. Without
        // this, a stray second touch could start its own overlapping
        // stroke or yank lastPt to a far-away coordinate.
        if (drawing && e.pointerId !== activePointerId) return;
        e.preventDefault();
        drawing = true;
        activePointerId = e.pointerId;
        const p = ptFromEvent(e);
        lastPt = p;
        currentStroke = { points: [p], color: erasing ? '#000' : color, size: erasing ? size * 3 : size, erase: erasing };
        strokes.push(currentStroke);
        paintStroke({ points: [p], color: currentStroke.color, size: currentStroke.size, erase: erasing });
        queueSend({ kind: 'start', x: p.x, y: p.y, color: currentStroke.color, size: currentStroke.size, erase: erasing, w: cssW, h: cssH });
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onPointerMove(e) {
        if (!drawing || !currentStroke || e.pointerId !== activePointerId) return;
        e.preventDefault();
        const p = ptFromEvent(e);
        paintSegment(lastPt, p, currentStroke.color, currentStroke.size, currentStroke.erase);
        if (currentStroke.points.length >= 4000) return;
        currentStroke.points.push(p);
        lastPt = p;
        queueSend({ kind: 'pt', x: p.x, y: p.y });
    }
    function onPointerUp(e) {
        if (!drawing || e.pointerId !== activePointerId) return;
        drawing = false;
        activePointerId = null;
        currentStroke = null;
        lastPt = null;
        flushQueue();
        queueSend({ kind: 'end' });
    }

    function queueSend(msg) {
        sendQueue.push(msg);
        if (!flushTimer) flushTimer = setTimeout(flushQueue, FLUSH_MS);
    }
    function flushQueue() {
        flushTimer = null;
        if (sendQueue.length === 0) return;
        const batch = sendQueue; sendQueue = [];
        gameSend({ kind: 'batch', items: batch });
    }

    // ---- remote playback state (mirrors local pointer state, per-peer) ----
    let remoteStroke = null;
    let remoteLast = null;

    function applyRemoteItem(item) {
        if (!ensureCanvas()) return;
        if (item.kind === 'start') {
            const p = { x: item.x, y: item.y };
            // Scale incoming point if the two canvases differ in CSS size
            // (e.g. PC vs Android have different viewport widths) so
            // drawings still line up correctly instead of landing in the
            // wrong spot. The scale factors are stored on the stroke here
            // and reused for every subsequent 'pt' in this same stroke —
            // previously they were read but never actually saved, so
            // remote points silently fell back to an unscaled 1:1 factor
            // and drew in the wrong place whenever screen sizes differed.
            const sx = item.w ? cssW / item.w : 1;
            const sy = item.h ? cssH / item.h : 1;
            const sp = { x: p.x * sx, y: p.y * sy };
            remoteLast = sp;
            remoteStroke = { points: [sp], color: item.color, size: item.size * Math.min(sx, sy), erase: !!item.erase, _sx: sx, _sy: sy };
            strokes.push(remoteStroke);
            paintStroke({ points: [sp], color: remoteStroke.color, size: remoteStroke.size, erase: remoteStroke.erase });
        } else if (item.kind === 'pt') {
            if (!remoteStroke || !remoteLast) return;
            const sx = remoteStroke._sx || 1, sy = remoteStroke._sy || 1;
            const p = { x: item.x * sx, y: item.y * sy };
            paintSegment(remoteLast, p, remoteStroke.color, remoteStroke.size, remoteStroke.erase);
            if (remoteStroke.points.length >= 4000) return;
            remoteStroke.points.push(p);
            remoteLast = p;
        } else if (item.kind === 'end') {
            remoteStroke = null; remoteLast = null;
        } else if (item.kind === 'clear') {
            strokes = [];
            redrawAll();
        }
    }

    function buildSwatches() {
        const wrap = document.getElementById('wb-swatches');
        if (!wrap) return;
        wrap.innerHTML = '';
        WB_COLORS.forEach(c => {
            const b = document.createElement('button');
            b.className = 'wb-swatch' + (c === color && !erasing ? ' active' : '');
            b.style.background = c;
            if (c === '#FFFFFF') b.style.borderColor = 'rgba(43,36,64,0.22)';
            b.title = 'Pick color';
            b.setAttribute('aria-label', 'Pick color');
            b.onclick = () => { color = c; erasing = false; refreshToolbarState(); };
            wrap.appendChild(b);
        });
    }
    function buildSizes() {
        const wrap = document.getElementById('wb-sizes');
        if (!wrap) return;
        wrap.innerHTML = '';
        WB_SIZES.forEach(s => {
            const b = document.createElement('button');
            b.className = 'wb-size-btn' + (s === size ? ' active' : '');
            b.title = 'Brush size';
            b.setAttribute('aria-label', 'Brush size');
            const dot = document.createElement('span');
            dot.className = 'dot';
            const dpx = 4 + s * 0.7;
            dot.style.width = dpx + 'px'; dot.style.height = dpx + 'px';
            b.appendChild(dot);
            b.onclick = () => { size = s; refreshToolbarState(); };
            wrap.appendChild(b);
        });
    }
    function refreshToolbarState() {
        document.querySelectorAll('#wb-swatches .wb-swatch').forEach((el, i) => el.classList.toggle('active', WB_COLORS[i] === color && !erasing));
        document.querySelectorAll('#wb-sizes .wb-size-btn').forEach((el, i) => el.classList.toggle('active', WB_SIZES[i] === size));
        const eraserBtn = document.getElementById('wb-eraser-btn');
        if (eraserBtn) eraserBtn.classList.toggle('active', erasing);
    }
    window.wbSelectEraser = function () { erasing = true; refreshToolbarState(); };
    window.wbConfirmClear = function () {
        showConfirm('Clear the board?', "This wipes the drawing for both of you.", 'Clear', () => {
            strokes = [];
            redrawAll();
            gameSend({ kind: 'batch', items: [{ kind: 'clear' }] });
            toast('Board cleared.');
        });
    };

    let boundEvents = false;
    function bindEvents() {
        if (boundEvents || !canvas) return;
        boundEvents = true;
        canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
        canvas.addEventListener('pointermove', onPointerMove, { passive: false });
        canvas.addEventListener('pointerup', onPointerUp, { passive: false });
        canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
        canvas.addEventListener('pointerleave', onPointerUp, { passive: false });
    }

    // Debounced: ResizeObserver can fire many times in a burst (mobile
    // browser chrome sliding in/out, keyboard open/close, orientation
    // change settling) — collapsing those into one call, after a short
    // quiet period, avoids repeated canvas resets fighting an active
    // stroke or the remote-sync render.
    let resizeSettleTimer = null;
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
            resizeSettleTimer = setTimeout(() => {
                resizeSettleTimer = null;
                const stage = document.getElementById('stage-whiteboard');
                if (stage && !stage.classList.contains('hidden')) ensureCanvas();
            }, 120);
        });
        window.addEventListener('DOMContentLoaded', () => {
            const w = document.getElementById('wb-canvas-wrap');
            if (w) ro.observe(w);
        });
    }

    function init(isHostOrLocal, resetState) {
        if (resetState) { strokes = []; }
        buildSwatches();
        buildSizes();
        refreshToolbarState();
        ensureCanvas();
        bindEvents();
        redrawAll();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', strokes });
    }
    function render() { redrawAll(); }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') {
            strokes = payload.strokes || [];
            ensureCanvas();
            redrawAll();
        } else if (payload.kind === 'batch' && Array.isArray(payload.items)) {
            payload.items.forEach(applyRemoteItem);
        }
    }

    GameControllers.whiteboard = {
        init, render, onData,
        deactivate() { clearTimeout(flushTimer); flushTimer = null; sendQueue = []; drawing = false; currentStroke = null; activePointerId = null; remoteStroke = null; remoteLast = null; },
        statusText() { return localMode ? 'Draw together — pass it around!' : 'Draw together — it syncs live'; },
        canTakeback() { return false; },
        resync() { if (!localMode) gameSend({ kind: 'sync', strokes }); }
    };
})();
