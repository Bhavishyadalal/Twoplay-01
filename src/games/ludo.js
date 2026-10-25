// ===================================================================
// GAME: LUDO
// 2-player (teal vs mustard) pass-and-play / online Ludo on a classic
// 4-seat 15x15 board (coral & violet sit in base as decoration only).
// myColor 'w' = teal (goes first), 'b' = mustard — same w/b convention
// as every other game here, so takeback/resign/rematch/handoff all
// plug in for free.
//
// Each token's position is a single integer "path step" relative to
// its own color's entry point:
//   -1        => sitting in base, not yet on the board
//   0 .. 50   => index along the shared 52-cell outer ring
//   51 .. 56  => index into this color's 6-cell home stretch
//   57        => finished (reached the center)
//
// Rules implemented:
//   - A 6 is required to bring a token out of base.
//   - Rolling a 6 grants an extra roll; three 6's in a row forfeits
//     the turn (classic rule, prevents infinite stalling).
//   - A token needs the exact roll to land on/at the final step —
//     overshooting the finish is not a legal move.
//   - Landing exactly on an opponent's token sends it back to base,
//     UNLESS that cell is a safe cell (any color's entry square, or
//     a star cell) or the opponent has 2+ tokens stacked there.
//   - If any legal move exists it must be taken; otherwise the turn
//     passes automatically. A single legal move auto-plays.
//   - First player to get all 4 tokens home wins.
//
// DICE FAIRNESS: uniformly sampled crypto.getRandomValues, no hidden bias.
// ===================================================================
const LudoDice = (function () {
    // ---- Ring path: 52 cells, [row, col] on the 15x15 grid ----
    const RING = [
        [6,1],[6,2],[6,3],[6,4],[6,5],
        [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
        [0,7],
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
        [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
        [7,14],
        [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
        [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [14,7],
        [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
        [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
        [7,0],
        [6,0]
    ];
    const ENTRY_IDX = { teal: 0, coral: 13, mustard: 26, violet: 39 };
    const HOME_STRETCH = {
        teal:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
        coral:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
        mustard: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
        violet:  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
    };
    function computeBaseOffsets() {
        const CELL = 100 / 15;
        const quad = 6 * CELL;
        const dotsBox = quad * 0.6;
        const gap = dotsBox * 0.12;
        const cell = (dotsBox - gap) / 2;
        const inset = quad * 0.20;
        const near = (inset + cell / 2) / CELL;
        const far  = (inset + cell + gap + cell / 2) / CELL;
        return { near, far, dotSize: cell / CELL };
    }
    const { near: BASE_NEAR, far: BASE_FAR, dotSize: BASE_DOT_SIZE } = computeBaseOffsets();
    const BASE_SPOTS = {
        teal:    [[BASE_NEAR,BASE_NEAR],[BASE_NEAR,BASE_FAR],[BASE_FAR,BASE_NEAR],[BASE_FAR,BASE_FAR]],
        coral:   [[BASE_NEAR,9+BASE_NEAR],[BASE_NEAR,9+BASE_FAR],[BASE_FAR,9+BASE_NEAR],[BASE_FAR,9+BASE_FAR]],
        mustard: [[9+BASE_NEAR,9+BASE_NEAR],[9+BASE_NEAR,9+BASE_FAR],[9+BASE_FAR,9+BASE_NEAR],[9+BASE_FAR,9+BASE_FAR]],
        violet:  [[9+BASE_NEAR,BASE_NEAR],[9+BASE_NEAR,BASE_FAR],[9+BASE_FAR,BASE_NEAR],[9+BASE_FAR,BASE_FAR]]
    };
    const HOME_QUADS = [
        { color:'teal',    row:0, col:0 },
        { color:'coral',   row:0, col:9 },
        { color:'mustard', row:9, col:9 },
        { color:'violet',  row:9, col:0 }
    ];
    const ALL_COLORS = ['teal','coral','mustard','violet'];
    const LIVE_COLORS = ['teal','mustard'];
    const RING_LEN = RING.length;
    const HOME_LEN = 6;

    const SAFE_KEYS = new Set();
    Object.keys(ENTRY_IDX).forEach(c => {
        SAFE_KEYS.add(RING[ENTRY_IDX[c]].join(','));
        SAFE_KEYS.add(RING[(ENTRY_IDX[c] + 8) % RING_LEN].join(','));
    });
    function isSafeCell(r, c) { return SAFE_KEYS.has(r + ',' + c); }
    function isEntryCell(r, c, color) {
        const e = RING[ENTRY_IDX[color]];
        return e[0] === r && e[1] === c;
    }
    function cellForStep(color, step) {
        if (step === -1) return null;
        if (step <= 50) return RING[(ENTRY_IDX[color] + step) % RING_LEN];
        if (step <= 56) return HOME_STRETCH[color][step - 51];
        return [7,7];
    }
    // Direction (in degrees, 0 = pointing right/east, clockwise-positive to
    // match screen coordinates) the token should visually point while
    // sitting at `step` — i.e. toward wherever it will travel to *next*,
    // not a fixed orientation. Tokens in base point toward the board
    // center (their eventual entry direction); a finished token keeps its
    // last heading into the center.
    function headingForStep(color, step) {
        if (step === -1) {
            // point from this color's home quadrant toward the center
            const quad = HOME_QUADS.find(h => h.color === color);
            const cx = quad.col + 3, cy = quad.row + 3; // quad center in grid units
            const dx = 7.5 - cx, dy = 7.5 - cy;
            return Math.atan2(dy, dx) * 180 / Math.PI;
        }
        const nextStep = Math.min(step + 1, 57);
        const cur = cellForStep(color, step === 57 ? 56 : step);
        const next = cellForStep(color, step === 57 ? 57 : nextStep);
        if (!cur || !next) return 0;
        const dx = next[1] - cur[1], dy = next[0] - cur[0];
        if (dx === 0 && dy === 0) return 0;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    // ---- Game state ----
    let tokens = {};
    let turn = 'teal';       // color whose turn it is
    let dice = 1;
    let hasRolled = false;
    let consecutiveSixes = 0;
    let legalMoves = [];
    let localGameOver = false;

    function colorForW(w) { return w === 'w' ? 'teal' : 'mustard'; }
    function wForColor(color) { return color === 'teal' ? 'w' : 'b'; }
    function freshTokens() {
        const t = {};
        ALL_COLORS.forEach(c => { t[c] = [-1, -1, -1, -1]; });
        return t;
    }
    function canIPlay() { return localMode ? true : turn === colorForW(myColor); }

    function tryMove(color, idx, roll) {
        const cur = tokens[color][idx];
        if (cur === -1) return roll === 6 ? { newStep: 0 } : null;
        if (cur === 57) return null;
        const newStep = cur + roll;
        if (newStep > 57) return null;
        if (newStep <= 50) {
            const [r,c] = cellForStep(color,newStep);
            if (!isSafeCell(r,c) && LIVE_COLORS.some(oc => oc !== color && tokens[oc].filter(step => {
                if (step < 0 || step > 50) return false;
                const [or,co] = cellForStep(oc,step); return or === r && co === c;
            }).length >= 2)) return null;
        }
        return { newStep };
    }
    function computeLegalMoves(color, roll) {
        const moves = [];
        tokens[color].forEach((step, idx) => { if (tryMove(color, idx, roll)) moves.push(idx); });
        return moves;
    }
    function applyCaptures(color, newStep) {
        if (newStep > 50) return;
        const [r, c] = cellForStep(color, newStep);
        if (isSafeCell(r, c)) return;
        LIVE_COLORS.forEach(oc => {
            if (oc === color) return;
            const occupants = [];
            tokens[oc].forEach((s, i) => {
                if (s >= 0 && s <= 50) {
                    const [or_, oc_] = cellForStep(oc, s);
                    if (or_ === r && oc_ === c) occupants.push(i);
                }
            });
            if (occupants.length > 0 && occupants.length < 2) {
                occupants.forEach(i => { tokens[oc][i] = -1; });
                setMsg((color[0].toUpperCase()+color.slice(1)) + ' sent a ' + oc + ' token home!');
                sndCapture();
            }
        });
    }
    function allHome(color) { return tokens[color].every(s => s === 57); }

    // Uniform cryptographic dice. No hidden tactical bias.
    function rollForColor() { return TwoplayProtocol.fairDie(); }

    function init(isHostOrLocal, resetState) {
        if (resetState) {
            tokens = freshTokens();
            turn = 'teal';
            dice = 1; hasRolled = false; consecutiveSixes = 0; legalMoves = []; localGameOver = false;
        }
        renderBoardOnce();
        render();
        updateDiceEnabled();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', tokens, turn });
    }

    function roll() {
        if (hasRolled || gameEnded || localGameOver) return;
        if (!canIPlay()) return;
        const btn = document.getElementById('ludo-dice-btn');
        btn.classList.add('rolling');
        gameTimeout(() => btn.classList.remove('rolling'), 400);

        dice = rollForColor(turn);
        hasRolled = true;
        if (dice === 6) consecutiveSixes++; else consecutiveSixes = 0;
        renderDicePips();
        gameSend({ kind: 'roll', dice, consecutiveSixes });

        if (consecutiveSixes === 3) {
            setMsg("Three 6's in a row — turn forfeited!");
            gameTimeout(() => {
                consecutiveSixes = 0;
                endTurn();
                gameSend({ kind: 'no_moves', rerollable: false, turn });
            }, 700);
            return;
        }

        legalMoves = computeLegalMoves(turn, dice);
        if (legalMoves.length === 0) {
            setMsg('No legal move for that roll.');
            gameTimeout(() => {
                if (dice === 6) {
                    hasRolled = false; setStatusLine();
                    gameSend({ kind: 'no_moves', rerollable: true, turn });
                } else {
                    endTurn();
                    gameSend({ kind: 'no_moves', rerollable: false, turn });
                }
            }, 650);
            render();
            return;
        }
        setMsg('');
        if (legalMoves.length === 1) {
            gameTimeout(() => moveToken(turn, legalMoves[0], dice, true), 280);
        } else {
            setStatusLine();
        }
        render();
        updateDiceEnabled();
    }

    function onTokenClick(color, idx) {
        if (gameEnded || localGameOver || color !== turn || !hasRolled || !canIPlay()) return;
        if (!legalMoves.includes(idx)) return;
        moveToken(color, idx, dice, true);
        updateDiceEnabled();
    }

    function moveToken(color, idx, roll, isLocalAction) {
        const result = tryMove(color, idx, roll);
        if (!result) return;
        tokens[color][idx] = result.newStep;
        if (result.newStep <= 50) applyCaptures(color, result.newStep);
        else sndMove();
        render();

        if (isLocalAction) gameSend({ kind: 'move', color, idx, newStep: result.newStep });

        if (allHome(color)) {
            localGameOver = true;
            const iWon = wForColor(color) === myColor;
            const title = localMode ? (color === 'teal' ? 'Teal' : 'Mustard') + ' wins!' : (iWon ? 'You win' : 'You lose');
            gameTimeout(() => endGame(title, 'All four tokens made it home.', localMode ? 'win' : (iWon ? 'win' : 'lose'), wForColor(color)), 250);
            return;
        }

        if (roll === 6 && consecutiveSixes < 3) {
            hasRolled = false;
            legalMoves = [];
            setMsg('');
            setStatusLine();
        } else {
            endTurn();
        }
        updateDiceEnabled();
    }

    function endTurn() {
        consecutiveSixes = 0;
        hasRolled = false;
        legalMoves = [];
        turn = turn === 'teal' ? 'mustard' : 'teal';
        if (localMode) { myColor = wForColor(turn); updateAvatars(); }
        setMsg('');
        setStatusLine();
        updateDiceEnabled();
    }

    function setMsg(t) { const el = document.getElementById('ludo-msg'); if (el) el.textContent = t; }
    function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

    function updateDiceEnabled() {
        const btn = document.getElementById('ludo-dice-btn');
        if (!btn) return;
        btn.classList.toggle('disabled', hasRolled || gameEnded || localGameOver || !canIPlay());
    }

    // ---- Board construction (built once per stage entry) ----
    let boardEl, tokenEls = {}, built = false;
    function renderBoardOnce() {
        boardEl = document.getElementById('ludo-board');
        if (!boardEl) return;
        if (built && boardEl.childElementCount) { return; } // already built, just re-render tokens
        boardEl.innerHTML = '';
        const CELL = 100 / 15;

        HOME_QUADS.forEach(h => {
            const div = document.createElement('div');
            div.className = 'ludo-home-quad ludo-home-' + h.color;
            div.style.left = (h.col * CELL) + '%';
            div.style.top = (h.row * CELL) + '%';
            div.style.width = (6 * CELL) + '%';
            div.style.height = (6 * CELL) + '%';
            boardEl.appendChild(div);
            const dots = document.createElement('div');
            dots.className = 'ludo-home-dots';
            for (let i = 0; i < 4; i++) {
                const d = document.createElement('div');
                d.className = 'ludo-home-dot ' + h.color;
                dots.appendChild(d);
            }
            div.appendChild(dots);
        });

        const pathCells = new Map();
        RING.forEach(([r,c]) => pathCells.set(r+','+c, [r,c]));
        Object.values(HOME_STRETCH).flat().forEach(([r,c]) => pathCells.set(r+','+c, [r,c]));
        pathCells.forEach(([r,c]) => {
            const div = document.createElement('div');
            div.className = 'ludo-cell';
            div.style.left = (c*CELL)+'%';
            div.style.top = (r*CELL)+'%';
            div.style.width = CELL+'%';
            div.style.height = CELL+'%';
            Object.keys(HOME_STRETCH).forEach(col => {
                if (HOME_STRETCH[col].some(rc => rc[0]===r && rc[1]===c)) div.classList.add('stretch-'+col);
            });
            Object.keys(ENTRY_IDX).forEach(col => {
                if (isEntryCell(r,c,col)) div.classList.add('entry-'+col);
            });
            if (isSafeCell(r,c)) {
                div.classList.add('safe');
                const star = document.createElement('span');
                star.className='ludo-star'; star.textContent='\u2605';
                div.appendChild(star);
            }
            boardEl.appendChild(div);
        });

        const center = document.createElement('div');
        center.className = 'ludo-center-hub';
        center.style.left = (6*CELL)+'%';
        center.style.top = (6*CELL)+'%';
        center.style.width = (3*CELL)+'%';
        center.style.height = (3*CELL)+'%';
        center.innerHTML = `<svg viewBox="0 0 100 100">
            <polygon points="0,0 100,0 50,50" fill="#FF6F61"></polygon>
            <polygon points="100,0 100,100 50,50" fill="#FFC93C"></polygon>
            <polygon points="100,100 0,100 50,50" fill="#8A63F2"></polygon>
            <polygon points="0,100 0,0 50,50" fill="#2FA8A0"></polygon>
        </svg>`;
        boardEl.appendChild(center);

        const layer = document.createElement('div');
        layer.className = 'ludo-token-layer';
        boardEl.appendChild(layer);
        tokenEls = {};
        ALL_COLORS.forEach(color => {
            tokenEls[color] = [];
            for (let i=0;i<4;i++) {
                const t = document.createElement('div');
                t.className = 'ludo-token ludo-token-'+color;
                t.innerHTML = '<div class="ludo-piece"><div class="ludo-piece-dot"></div></div>';
                if (LIVE_COLORS.includes(color)) {
                    t.addEventListener('click', () => onTokenClick(color, i));
                }
                layer.appendChild(t);
                tokenEls[color].push(t);
            }
        });
        built = true;
    }

    function render() {
        if (!boardEl || !document.body.contains(boardEl)) { built = false; renderBoardOnce(); }
        const CELL = 100/15;
        ALL_COLORS.forEach(color => {
            const cellGroups = {};
            tokens[color].forEach((step, idx) => { (cellGroups[step] = cellGroups[step] || []).push(idx); });
            tokens[color].forEach((step, idx) => {
                const el = tokenEls[color][idx];
                if (!el) return;
                let r, c, isBase = false;
                if (step === -1) { [r, c] = BASE_SPOTS[color][idx]; isBase = true; }
                else if (step === 57) { r = 7; c = 7; }
                else { [r, c] = cellForStep(color, step); }
                const group = cellGroups[step];
                const groupIdx = group.indexOf(idx);
                const groupSize = group.length;
                let offR = 0, offC = 0;
                if (!isBase && groupSize > 1) {
                    const fan = [[-0.15,-0.15],[0.15,-0.15],[-0.15,0.15],[0.15,0.15]];
                    [offR, offC] = fan[groupIdx % 4];
                }
                const BASE_SIZE = CELL * BASE_DOT_SIZE;
                const size = isBase ? BASE_SIZE : CELL;
                const baseLeft = isBase ? (c*CELL - size/2) : (c*CELL + offC*CELL);
                const baseTop  = isBase ? (r*CELL - size/2) : (r*CELL + offR*CELL);
                el.style.left = baseLeft + '%';
                el.style.top  = baseTop + '%';
                el.style.width = size+'%';
                el.style.height = size+'%';
                el.style.setProperty('--heading', headingForStep(color, step) + 'deg');

                const hideStaticBase = isBase && !LIVE_COLORS.includes(color);
                el.style.display = hideStaticBase ? 'none' : 'flex';

                const canMove = LIVE_COLORS.includes(color) && color===turn && hasRolled && legalMoves.includes(idx) && !gameEnded && !localGameOver && canIPlay();
                el.classList.toggle('movable', canMove);
                el.classList.toggle('done', step===57);

                const badge = el.querySelector('.ludo-stack-badge');
                if (groupSize > 1 && !isBase) {
                    if (!badge) {
                        const b = document.createElement('div');
                        b.className='ludo-stack-badge';
                        b.textContent = groupSize;
                        el.appendChild(b);
                    } else { badge.textContent = groupSize; }
                } else if (badge) { badge.remove(); }
            });
        });
        updateProgress();
        renderDicePips();
        updateDiceEnabled();
    }

    function updateProgress() {
        const tealEl = document.getElementById('ludo-progress-teal');
        const mustEl = document.getElementById('ludo-progress-mustard');
        if (tealEl) {
            tealEl.querySelector('span:last-child').textContent = tokens.teal.filter(s=>s===57).length + '/4';
            tealEl.classList.toggle('active', turn === 'teal' && !gameEnded && !localGameOver);
        }
        if (mustEl) {
            mustEl.querySelector('span:last-child').textContent = tokens.mustard.filter(s=>s===57).length + '/4';
            mustEl.classList.toggle('active', turn === 'mustard' && !gameEnded && !localGameOver);
        }
    }

    function renderDicePips() {
        const layout = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
        const on = new Set(layout[dice] || [4]);
        const grid = document.getElementById('ludo-pip-grid');
        if (!grid) return;
        grid.innerHTML = '';
        for (let i=0;i<9;i++) {
            const p = document.createElement('div');
            p.className = 'ludo-pip' + (on.has(i) ? ' on' : '');
            grid.appendChild(p);
        }
    }

    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') {
            tokens = payload.tokens; turn = payload.turn;
            renderBoardOnce(); render(); setStatusLine();
        } else if (payload.kind === 'roll') {
            if (gameEnded || localGameOver || canIPlay() || hasRolled || payload.consecutiveSixes !== (payload.dice === 6 ? consecutiveSixes + 1 : 0)) return;
            dice = payload.dice; consecutiveSixes = payload.consecutiveSixes;
            hasRolled = true;
            legalMoves = computeLegalMoves(turn, dice);
            renderDicePips();
            sndNotify();
            if (legalMoves.length === 0) {
                setMsg('No legal move for that roll.');
            } else {
                setMsg('');
            }
            setStatusLine();
            updateDiceEnabled();
        } else if (payload.kind === 'no_moves') {
            if (canIPlay() || !hasRolled || (consecutiveSixes < 3 && computeLegalMoves(turn,dice).length > 0) || payload.rerollable !== (dice === 6 && consecutiveSixes < 3)) return;
            // Mirrors the roller's own resolution of a dice-with-no-legal-move
            // roll (including the three-6s forfeit case): either the turn
            // passes, or (rolled a 6 but still blocked) the same player gets
            // to roll again. No board state changes here — just hasRolled/turn.
            if (payload.rerollable) {
                hasRolled = false;
                setMsg('');
            } else {
                consecutiveSixes = 0;
                hasRolled = false;
                legalMoves = [];
                turn = turn === 'teal' ? 'mustard' : 'teal';
                setMsg('');
            }
            setStatusLine();
            updateDiceEnabled();
        } else if (payload.kind === 'move') {
            const { color, idx, newStep } = payload;
            if (gameEnded || localGameOver || canIPlay() || !hasRolled || consecutiveSixes >= 3 || color !== turn) return;
            const legal = tryMove(color,idx,dice);
            if (!legal || legal.newStep !== newStep) return;
            tokens[color][idx] = newStep;
            if (newStep <= 50) applyCaptures(color, newStep); else sndMove();
            render();
            if (allHome(color)) {
                localGameOver = true;
                const iWon = wForColor(color) === myColor;
                const title = iWon ? 'You win' : 'You lose';
                gameTimeout(() => endGame(title, 'All four tokens made it home.', iWon ? 'win' : 'lose', wForColor(color)), 250);
                return;
            }
            if (dice === 6 && consecutiveSixes < 3) {
                hasRolled = false; legalMoves = []; setMsg('');
            } else {
                consecutiveSixes = 0; hasRolled = false; legalMoves = [];
                turn = turn === 'teal' ? 'mustard' : 'teal';
            }
            setStatusLine();
            updateDiceEnabled();
        }
    }

    GameControllers.ludo = {
        init, render, onData,
        statusText() {
            if (gameEnded || localGameOver) return '';
            const whoseName = localMode ? capitalize(turn) : (canIPlay() ? 'Your' : oppName + '\u2019s');
            if (!hasRolled) return whoseName + (localMode ? "'s" : '') + ' turn \u2014 roll the dice';
            return whoseName + (localMode ? "'s" : '') + ' turn \u2014 rolled ' + dice + (legalMoves.length > 1 ? ', tap a token' : '');
        },
        canTakeback() { return false; },
        resync() { if (!localMode) gameSend({ kind: 'sync', tokens, turn }); }
    };

    return { roll };
})();
