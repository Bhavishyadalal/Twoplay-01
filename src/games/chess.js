// ===================================================================
// GAME: CHESS (High-Performance Hardware-Accelerated Engine & Board)
// ===================================================================
(function () {
    const PIECE_SVG = {
        wp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="#fff" stroke="#000" stroke-width="1.5" d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/></svg>`,
        wn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path fill="#fff" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path fill="#fff" d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/></g></svg>`,
        wb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5"/></g></svg>`,
        wr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9zm3-3v-4h21v4zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/><path d="m34 14-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="m31 29.5 1.5 2.5h-20l1.5-2.5"/><path fill="none" d="M11 14h23"/></g></svg>`,
        wq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0m16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0M16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path fill="none" d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/></g></svg>`,
        wk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path fill="#fff" d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path fill="#fff" d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
        bp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path stroke="#000" stroke-width="1.5" d="M22.5 9a4 4 0 0 0-3.22 6.38 6.48 6.48 0 0 0-.87 10.65c-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47a6.46 6.46 0 0 0-.87-10.65A4.01 4.01 0 0 0 22.5 9z"/></svg>`,
        bn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path fill="#000" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path fill="#000" d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3"/></g></svg>`,
        bb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000"><path d="M9 36c3.4-1 10.1.4 13.5-2 3.4 2.4 10.1 1 13.5 2 0 0 1.6.5 3 2-.7 1-1.6 1-3 .5-3.4-1-10.1.5-13.5-1-3.4 1.5-10.1 0-13.5 1-1.4.5-2.3.5-3-.5 1.4-2 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path stroke="#ececec" d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5"/></g></svg>`,
        br: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9zm3.5-7 1.5-2.5h17l1.5 2.5zm-.5 4v-4h21v4z"/><path d="M14 29.5v-13h17v13z"/><path d="M14 16.5 11 14h23l-3 2.5zM11 14V9h4v2h5V9h5v2h5V9h4v5z"/><path fill="none" stroke="#ececec" stroke-width="1" d="M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23"/></g></svg>`,
        bq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path fill="none" d="M11 38.5a35 35 1 0 0 23 0"/><path fill="none" stroke="#ececec" d="M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0"/></g></svg>`,
        bk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.6V6"/><path fill="#000" d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path fill="#000" d="M11.5 37a22.3 22.3 0 0 0 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z"/><path d="M20 8h5"/><path stroke="#ececec" d="M32 29.5s8.5-4 6-9.7C34.1 14 25 18 22.5 24.6v2.1-2.1C20 18 9.9 14 7 19.9c-2.5 5.6 4.8 9 4.8 9"/><path stroke="#ececec" d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`
    };
    const FILES = ['a','b','c','d','e','f','g','h'];
    let chess = new Chess();
    let selectedSquare = null, legalTargets = [], lastMoveSquares = [], premove = null;
    let boardFlipped = false, userFlippedManually = false;
    let moveHistoryForList = [], moveNumCounter = 0;
    let slideAnim = null; // { fromDr, fromDc, toDr, toDc, piece, startTs, durationMs }
    let animRafId = null;

    // ---- Hardware-Accelerated Piece Sprites ----
    const pieceCanvases = {};
    let piecesReady = false;

    function rasterizePieceSprites() {
        const keys = Object.keys(PIECE_SVG);
        let loaded = 0;
        const targetDpr = Math.min(window.devicePixelRatio || 1, 3);
        const spriteSize = Math.round(128 * targetDpr);

        keys.forEach(k => {
            const img = new Image();
            const svgData = 'data:image/svg+xml;utf8,' + encodeURIComponent(PIECE_SVG[k]);
            img.onload = () => {
                const off = document.createElement('canvas');
                off.width = spriteSize;
                off.height = spriteSize;
                const octx = off.getContext('2d');
                // Pre-bake soft shadow directly onto sprite (0 runtime shadow cost)
                octx.shadowColor = 'rgba(0,0,0,0.42)';
                octx.shadowBlur = 4 * targetDpr;
                octx.shadowOffsetY = 3 * targetDpr;
                octx.drawImage(img, 6 * targetDpr, 6 * targetDpr, spriteSize - 12 * targetDpr, spriteSize - 12 * targetDpr);
                pieceCanvases[k] = off;
                loaded++;
                if (loaded === keys.length) {
                    piecesReady = true;
                    render();
                }
            };
            img.src = svgData;
        });
    }
    rasterizePieceSprites();

    // ---- Canvas Setup & High-DPI Scaling ----
    let ctx = null, canvasSizeCss = 0, cellPx = 0, dpr = 1;
    let canvasEl = null;

    let canvasSizeDirty = true; // set true on resize/orientation change/first paint; avoids
                                 // calling getBoundingClientRect() (forces layout) on every
                                 // animation frame, which was capping slide-animation FPS
                                 // well below 60 even on low-latency connections
    function ensureCanvasSetup() {
        if (!canvasEl) canvasEl = document.getElementById('chess-board');
        if (!canvasEl) return false;
        if (!canvasSizeDirty && ctx) return true;
        canvasSizeDirty = false;

        const rect = canvasEl.getBoundingClientRect();
        const cssSize = rect.width || canvasEl.clientWidth || 360;
        const newDpr = Math.min(window.devicePixelRatio || 1, 3);

        if (canvasEl.width !== Math.round(cssSize * newDpr) || !ctx || canvasSizeCss !== cssSize) {
            dpr = newDpr;
            canvasSizeCss = cssSize;
            canvasEl.width = Math.round(cssSize * dpr);
            canvasEl.height = Math.round(cssSize * dpr);
            ctx = canvasEl.getContext('2d', { alpha: false });
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            cellPx = cssSize / 8;
            bindCanvasInput(canvasEl);
        }
        return true;
    }

    let inputBound = false;
    function bindCanvasInput(canvas) {
        if (inputBound || !canvas) return;
        inputBound = true;

        const handlePointer = (e) => {
            if (e.pointerType === 'touch') e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const dc = Math.floor(x / cellPx), dr = Math.floor(y / cellPx);
            if (dr < 0 || dr > 7 || dc < 0 || dc > 7) return;
            const flipped = isFlipped();
            const rankIdx = flipped ? 7 - dr : dr;
            const fileIdx = flipped ? 7 - dc : dc;
            const square = FILES[fileIdx] + (8 - rankIdx);
            onSquareClick(square);
        };

        canvas.addEventListener('pointerdown', handlePointer, { passive: false });
    }

    // Auto resize watcher
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            if (currentGame !== 'chess' || !document.getElementById('app').classList.contains('live')) return;
            if (document.getElementById('stage-chess') && !document.getElementById('stage-chess').classList.contains('hidden')) {
                canvasSizeDirty = true;
                ensureCanvasSetup();
                render();
            }
        });
        window.addEventListener('DOMContentLoaded', () => {
            const boardEl = document.getElementById('chess-board');
            if (boardEl) ro.observe(boardEl);
        });
    }

    function init(isHostOrLocal, resetState) {
        if (resetState) {
            chess = new Chess();
            moveHistoryForList = [];
            moveNumCounter = 0;
            slideAnim = null;
        }
        selectedSquare = null;
        legalTargets = [];
        lastMoveSquares = [];
        premove = null;
        canvasSizeDirty = true; // board may have been hidden/resized since last measurement
        rebuildMoveListUI();
        render();
        updateClockDisplay();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', fen: chess.fen() });
    }

    function isFlipped() {
        return userFlippedManually ? boardFlipped : (myColor === 'b');
    }

    function flip() {
        const frame = document.getElementById('chess-board').closest('.board-frame');
        if (frame) frame.classList.add('flipping');
        boardFlipped = !boardFlipped;
        userFlippedManually = true;
        gameTimeout(() => {
            render();
            if (frame) requestAnimationFrame(() => frame.classList.remove('flipping'));
        }, 120);
    }

    function paintFrame() {
        if (!ctx || !ensureCanvasSetup()) return;

        const board = chess.board();
        const flipped = isFlipped();
        const inCheck = chess.inCheck();
        const kingSq = inCheck ? findKingSquare(chess.turn()) : null;

        // Precompute quick lookups
        const lastMoveSet = new Set(lastMoveSquares);
        const targetMap = new Map();
        for (let i = 0; i < legalTargets.length; i++) {
            targetMap.set(legalTargets[i].to, legalTargets[i]);
        }

        // Animation progress calculation
        let slideProgress = null;
        const activeAnim = MOVE_ANIMS[currentMoveAnim] || MOVE_ANIMS.slide;
        if (slideAnim) {
            const elapsed = performance.now() - slideAnim.startTs;
            const t = Math.min(1, elapsed / slideAnim.durationMs);
            slideProgress = activeAnim.ease(t);
            if (t >= 1) slideAnim = null;
        }

        // 1. Draw 64 Squares (Batch Base)
        for (let dr = 0; dr < 8; dr++) {
            for (let dc = 0; dc < 8; dc++) {
                const rankIdx = flipped ? 7 - dr : dr;
                const fileIdx = flipped ? 7 - dc : dc;
                const square = FILES[fileIdx] + (8 - rankIdx);
                const isLight = (rankIdx + fileIdx) % 2 === 0;
                const x = dc * cellPx, y = dr * cellPx;
                const theme = BOARD_THEMES[currentBoardTheme] || BOARD_THEMES.classic;

                ctx.fillStyle = isLight ? theme.light : theme.dark;
                ctx.fillRect(x, y, cellPx, cellPx);

                if (lastMoveSet.has(square)) {
                    ctx.fillStyle = isLight ? theme.lastMoveLight : theme.lastMoveDark;
                    ctx.fillRect(x, y, cellPx, cellPx);
                }
                if (square === selectedSquare) {
                    ctx.fillStyle = theme.select;
                    ctx.fillRect(x, y, cellPx, cellPx);
                }
                if (square === kingSq) {
                    const grad = ctx.createRadialGradient(x + cellPx / 2, y + cellPx / 2, 0, x + cellPx / 2, y + cellPx / 2, cellPx * 0.6);
                    grad.addColorStop(0, 'rgba(235,55,55,0.9)');
                    grad.addColorStop(1, 'rgba(235,55,55,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, cellPx, cellPx);
                }
                if (premove && (square === premove.from || square === premove.to)) {
                    ctx.strokeStyle = '#5f9bb0';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x + 1.5, y + 1.5, cellPx - 3, cellPx - 3);
                }
            }
        }

        // 2. Draw Coordinates on Edges (Set Font ONCE)
        ctx.font = '700 9px monospace';
        {
            const theme = BOARD_THEMES[currentBoardTheme] || BOARD_THEMES.classic;
            for (let dr = 0; dr < 8; dr++) {
                const rankIdx = flipped ? 7 - dr : dr;
                const isLight = (rankIdx + (flipped ? 7 : 0)) % 2 === 0;
                ctx.fillStyle = isLight ? theme.dark : theme.light;
                ctx.fillText(8 - rankIdx, 3, dr * cellPx + 11);
            }
            for (let dc = 0; dc < 8; dc++) {
                const fileIdx = flipped ? 7 - dc : dc;
                const isLight = ((flipped ? 0 : 7) + fileIdx) % 2 === 0;
                ctx.fillStyle = isLight ? theme.dark : theme.light;
                ctx.fillText(FILES[fileIdx], (dc + 1) * cellPx - 9, 8 * cellPx - 3);
            }
        }


        // 3. Draw Legal Move Markers
        for (let dr = 0; dr < 8; dr++) {
            for (let dc = 0; dc < 8; dc++) {
                const rankIdx = flipped ? 7 - dr : dr;
                const fileIdx = flipped ? 7 - dc : dc;
                const square = FILES[fileIdx] + (8 - rankIdx);
                const target = targetMap.get(square);
                if (target) {
                    const cx = dc * cellPx + cellPx / 2, cy = dr * cellPx + cellPx / 2;
                    const hasPiece = !!board[rankIdx][fileIdx];
                    ctx.fillStyle = 'rgba(20,24,20,0.24)';
                    ctx.strokeStyle = 'rgba(20,24,20,0.24)';
                    if (hasPiece) {
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(cx, cy, cellPx * 0.44, 0, Math.PI * 2);
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.arc(cx, cy, cellPx * 0.14, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        // 4. Draw Hardware-Accelerated Piece Bitmaps
        const pieceSize = cellPx * 0.88;
        const pieceOffset = (cellPx - pieceSize) / 2;

        for (let dr = 0; dr < 8; dr++) {
            for (let dc = 0; dc < 8; dc++) {
                const rankIdx = flipped ? 7 - dr : dr;
                const fileIdx = flipped ? 7 - dc : dc;
                const piece = board[rankIdx][fileIdx];
                if (!piece) continue;

                const key = piece.color + piece.type;
                const sprite = pieceCanvases[key];
                if (!sprite) continue;

                let drawX = dc * cellPx + pieceOffset;
                let drawY = dr * cellPx + pieceOffset;
                let drawScale = 1, drawRot = 0, drawAlpha = 1;

                // Handle move animation (style-dependent: slide/bounce/hop/spin/etc.)
                if (slideAnim && slideProgress != null && dr === slideAnim.toDr && dc === slideAnim.toDc) {
                    const targetX = drawX, targetY = drawY;
                    const fromX = slideAnim.fromDc * cellPx + pieceOffset;
                    const fromY = slideAnim.fromDr * cellPx + pieceOffset;
                    const dx = targetX - fromX, dy = targetY - fromY;
                    const off = activeAnim.offset(slideProgress, dx, dy);
                    drawX = targetX - off.x;
                    drawY = targetY - off.y;
                    drawScale = off.scale != null ? off.scale : 1;
                    drawRot = off.rot || 0;
                    if (off.alpha != null) drawAlpha = off.alpha;
                }

                if (drawScale !== 1 || drawRot !== 0 || drawAlpha !== 1) {
                    const cx = drawX + pieceSize / 2, cy = drawY + pieceSize / 2;
                    ctx.save();
                    ctx.globalAlpha = drawAlpha;
                    ctx.translate(cx, cy);
                    if (drawRot) ctx.rotate(drawRot);
                    if (drawScale !== 1) ctx.scale(drawScale, drawScale);
                    ctx.drawImage(sprite, -pieceSize / 2, -pieceSize / 2, pieceSize, pieceSize);
                    ctx.restore();
                } else {
                    ctx.drawImage(sprite, drawX, drawY, pieceSize, pieceSize);
                }
            }
        }

        // Continue animation loop if still in flight
        if (slideAnim) {
            animRafId = requestAnimationFrame(paintFrame);
        } else {
            animRafId = null;
        }
    }

    function render() {
        if (animRafId) {
            cancelAnimationFrame(animRafId);
            animRafId = null;
        }
        paintFrame();
    }

    function findKingSquare(color) {
        const board = chess.board();
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = board[r][f];
                if (p && p.type === 'k' && p.color === color) return p.square;
            }
        }
        return null;
    }

    function onSquareClick(square) {
        if (gameEnded) return;
        const isMyTurn = localMode ? true : (chess.turn() === myColor);
        const piece = chess.get(square);

        // Premove staging
        if (!isMyTurn && !localMode) {
            if (selectedSquare) {
                if (square === selectedSquare) { selectedSquare = null; legalTargets = []; render(); return; }
                if (piece && piece.color === myColor) {
                    selectedSquare = square; legalTargets = premoveTargetsFrom(square); render(); return;
                }
                setPremove(selectedSquare, square);
                selectedSquare = null; legalTargets = []; render();
                return;
            }
            if (piece && piece.color === myColor) {
                selectedSquare = square;
                legalTargets = premoveTargetsFrom(square);
                render();
            }
            return;
        }

        if (selectedSquare) {
            const target = legalTargets.find(t => t.to === square);
            if (target) {
                if (target.promotion) showPromoChoice(selectedSquare, square);
                else makeLocalMove(selectedSquare, square, null);
                selectedSquare = null; legalTargets = [];
                return;
            }
            if (piece && isMyTurn && piece.color === chess.turn()) {
                selectedSquare = square;
                legalTargets = chess.moves({ square, verbose: true });
                render();
                return;
            }
            selectedSquare = null; legalTargets = []; render();
            return;
        }

        if (!piece || piece.color !== chess.turn()) return;
        selectedSquare = square;
        legalTargets = chess.moves({ square, verbose: true });
        render();
    }

    function premoveTargetsFrom(square) {
        const piece = chess.get(square);
        if (!piece) return [];
        const f0 = FILES.indexOf(square[0]), r0 = parseInt(square[1], 10) - 1;
        const targets = [];
        const push = (f, r) => { if (f >= 0 && f < 8 && r >= 0 && r < 8) targets.push({ to: FILES[f] + (r + 1) }); };
        if (piece.type === 'n') {
            [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([df,dr]) => push(f0+df, r0+dr));
        } else if (piece.type === 'k') {
            for (let df=-1; df<=1; df++) for (let dr=-1; dr<=1; dr++) if (df||dr) push(f0+df, r0+dr);
        } else {
            const dirs = piece.type === 'b' ? [[1,1],[1,-1],[-1,1],[-1,-1]]
                : piece.type === 'r' ? [[1,0],[-1,0],[0,1],[0,-1]]
                : piece.type === 'q' ? [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
                : [[0, piece.color === 'w' ? 1 : -1]];
            for (const [df, dr] of dirs) {
                let f = f0 + df, r = r0 + dr, steps = 0;
                const maxSteps = piece.type === 'p' ? 2 : 8;
                while (f >= 0 && f < 8 && r >= 0 && r < 8 && steps < maxSteps) { push(f, r); f += df; r += dr; steps++; if (piece.type === 'p') break; }
            }
        }
        return targets;
    }

    function setPremove(from, to) {
        const piece = chess.get(from);
        const promotion = piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
        premove = { from, to, promotion };
        toast('Premove set');
        render();
    }

    function showPromoChoice(from, to) {
        const overlay = document.getElementById('promo-overlay');
        const choices = document.getElementById('promo-choices');
        choices.innerHTML = '';
        ['q','r','b','n'].forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm promo-btn';
            btn.innerHTML = PIECE_SVG[chess.turn() + p];
            btn.onclick = () => { overlay.classList.add('hidden'); makeLocalMove(from, to, p); };
            choices.appendChild(btn);
        });
        overlay.classList.remove('hidden');
    }

    function triggerSlideAnim(from, to, piece) {
        const flipped = isFlipped();
        const f0 = FILES.indexOf(from[0]), r0 = parseInt(from[1], 10) - 1;
        const f1 = FILES.indexOf(to[0]), r1 = parseInt(to[1], 10) - 1;
        const fromDr = flipped ? r0 : 7 - r0, fromDc = flipped ? 7 - f0 : f0;
        const toDr = flipped ? r1 : 7 - r1, toDc = flipped ? 7 - f1 : f1;
        const anim = MOVE_ANIMS[currentMoveAnim] || MOVE_ANIMS.slide;

        slideAnim = {
            fromDr, fromDc, toDr, toDc, piece,
            startTs: performance.now(),
            durationMs: anim.durationMs
        };
    }

    function makeLocalMove(from, to, promotion) {
        const piece = chess.get(from);
        const result = chess.move({ from, to, promotion: promotion || undefined });
        if (!result) return;
        lastMoveSquares = [from, to];
        if (incrementMs) { if (result.color === 'w') whiteMs += incrementMs; else blackMs += incrementMs; }
        gameSend({ kind: 'move', from, to, promotion: promotion || null });
        appendMoveToList(result);
        playMoveSound(result);
        if (localMode) { myColor = chess.turn(); updateAvatars(); }

        triggerSlideAnim(from, to, piece);
        render();
        updateClockDisplay();
        updateActionButtons();
        checkGameEnd();
        setStatusLine();
    }

    function makeLocalMoveFromPremove(result) {
        lastMoveSquares = [result.from, result.to];
        gameSend({ kind: 'move', from: result.from, to: result.to, promotion: result.promotion || null });
        appendMoveToList(result);
        playMoveSound(result);
        triggerSlideAnim(result.from, result.to, result);
        render();
        updateClockDisplay();
        updateActionButtons();
        checkGameEnd();
        setStatusLine();
    }

    function applyRemoteMove(from, to, promotion) {
        if (gameEnded || chess.turn() === myColor) return;
        const piece = chess.get(from);
        const result = chess.move({ from, to, promotion: promotion || undefined });
        if (!result) return;
        lastMoveSquares = [from, to];
        if (incrementMs) { if (result.color === 'w') whiteMs += incrementMs; else blackMs += incrementMs; }
        appendMoveToList(result);
        playMoveSound(result);

        triggerSlideAnim(from, to, piece);
        render();
        updateClockDisplay();
        updateActionButtons();
        checkGameEnd();
        setStatusLine();

        if (premove && !localMode && !gameEnded && chess.turn() === myColor) {
            const pm = premove; premove = null;
            gameTimeout(() => {
                const r = chess.move({ from: pm.from, to: pm.to, promotion: pm.promotion || undefined });
                if (r) makeLocalMoveFromPremove(r);
                else toast('Premove was no longer legal.');
                render();
            }, 120);
        }
    }

    function playMoveSound(result) {
        if (chess.inCheck() && !chess.isCheckmate()) sndCheck();
        else if (result.captured) sndCapture();
        else sndMove();
    }

    function appendMoveToList(result) {
        moveHistoryForList.push(result);
        const list = document.getElementById('move-list');
        const empty = list.querySelector('.move-empty');
        if (empty) empty.remove();
        if (result.color === 'w') {
            moveNumCounter++;
            const num = document.createElement('span');
            num.className = 'move-num';
            num.innerText = moveNumCounter + '.';
            list.appendChild(num);
        }
        const entry = document.createElement('span');
        entry.className = 'move-entry';
        entry.innerText = result.san;
        list.appendChild(entry);
        list.scrollTop = list.scrollHeight;
        document.getElementById('move-count-badge').innerText = moveHistoryForList.length + (moveHistoryForList.length === 1 ? ' ply' : ' plies');
    }

    function rebuildMoveListUI() {
        const list = document.getElementById('move-list');
        list.innerHTML = '';
        moveNumCounter = 0;
        if (moveHistoryForList.length === 0) {
            list.innerHTML = '<div class="move-empty">No moves yet</div>';
        } else {
            const hist = [...moveHistoryForList];
            moveHistoryForList = [];
            hist.forEach(m => appendMoveToList(m));
        }
        document.getElementById('move-count-badge').innerText = moveHistoryForList.length + (moveHistoryForList.length === 1 ? ' ply' : ' plies');
    }

    function checkGameEnd() {
        if (gameEnded) return;
        if (chess.isCheckmate()) {
            const winnerColor = chess.turn() === 'w' ? 'b' : 'w';
            const iWon = winnerColor === myColor;
            const title = localMode ? (winnerColor === 'w' ? 'White wins' : 'Black wins') : (iWon ? 'You win' : 'You lose');
            endGame(title, 'Checkmate.', localMode ? 'win' : (iWon ? 'win' : 'lose'), winnerColor);
        } else if (chess.isStalemate()) { endGame('Draw', 'Stalemate — no legal moves.', 'draw'); }
        else if (chess.isThreefoldRepetition()) { endGame('Draw', 'Threefold repetition.', 'draw'); }
        else if (chess.isInsufficientMaterial()) { endGame('Draw', 'Insufficient material to checkmate.', 'draw'); }
        else if (chess.isDraw()) { endGame('Draw', '50-move rule.', 'draw'); }
    }

    function doLocalTakeback() {
        const undone = chess.undo();
        if (!undone) return;
        moveHistoryForList.pop();
        if (incrementMs) {
            if (undone.color === 'w') whiteMs = Math.max(0, whiteMs - incrementMs);
            else blackMs = Math.max(0, blackMs - incrementMs);
        }
        rebuildMoveListUI();
        selectedSquare = null;
        legalTargets = [];
        premove = null;
        lastMoveSquares = moveHistoryForList.length ? [moveHistoryForList[moveHistoryForList.length-1].from, moveHistoryForList[moveHistoryForList.length-1].to] : [];
        slideAnim = null;
        gameEnded = false; finishedEpoch = -1;
        render();
        setStatusLine();
        updateClockDisplay();
        updateActionButtons();
        startClockIfNeeded();
    }

    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        switch (payload.kind) {
            case 'sync': chess.load(payload.fen); render(); break;
            case 'move': applyRemoteMove(payload.from, payload.to, payload.promotion); break;
        }
    }

    GameControllers.chess = {
        init, render, onData, flip,
        get chess() { return chess; },
        statusText() {
            if (gameEnded) return '';
            const isMyTurn = localMode ? true : chess.turn() === myColor;
            if (chess.inCheck()) return (isMyTurn ? 'You are' : (localMode ? (chess.turn()==='w'?'White':'Black') : oppName) + ' is') + ' in check!';
            return localMode ? ((chess.turn() === 'w' ? 'White' : 'Black') + ' to move') : (isMyTurn ? 'Your turn' : oppName + '\u2019s turn');
        },
        canTakeback() { return moveHistoryForList.length > 0; },
        doLocalTakeback,
        onEscape() { selectedSquare = null; legalTargets = []; premove = null; render(); },
        resync() { if (!localMode) gameSend({ kind: 'sync', fen: chess.fen() }); }
    };
})();
