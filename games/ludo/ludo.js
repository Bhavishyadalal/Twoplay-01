/* Twoplay — Ludo module
 * Self-contained game module. Registers itself via registerGame('ludo', ...).
 * Classic 2-player Ludo: each side controls 4 tokens of their color around a
 * standard cross-shaped 52-square outer track plus a 6-square home stretch.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------
    if (!document.getElementById('ludo-styles')) {
        var style = document.createElement('style');
        style.id = 'ludo-styles';
        style.textContent = [
            '.ludo-frame{display:flex;flex-direction:column;align-items:center;gap:10px;background:var(--surface);border-radius:var(--blob-lg);box-shadow:var(--shadow-soft);padding:14px;}',
            '.ludo-board{position:relative;width:min(92vw,420px);height:min(92vw,420px);background:var(--surface-2);border-radius:var(--blob-md);border:2px solid var(--border);overflow:hidden;}',
            '.ludo-cell{position:absolute;box-sizing:border-box;border:1px solid var(--border-soft);display:flex;align-items:center;justify-content:center;background:var(--surface);}',
            '.ludo-cell.safe{background:var(--surface-3);}',
            '.ludo-cell.path-w{background:color-mix(in srgb, var(--accent) 18%, var(--surface));}',
            '.ludo-cell.path-b{background:color-mix(in srgb, var(--text) 14%, var(--surface));}',
            '.ludo-home-yard{position:absolute;border-radius:var(--blob-sm);}',
            '.ludo-home-yard.w{background:color-mix(in srgb, var(--accent) 22%, var(--surface));}',
            '.ludo-home-yard.b{background:color-mix(in srgb, var(--text) 16%, var(--surface));}',
            '.ludo-center{position:absolute;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--surface-3);border-radius:var(--blob-sm);}',
            '.ludo-token{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;font-family:var(--font-body);color:#fff;cursor:pointer;box-shadow:var(--shadow-soft);transition:left .18s ease, top .18s ease;z-index:5;border:2px solid rgba(255,255,255,.7);}',
            '.ludo-token.w{background:var(--accent);}',
            '.ludo-token.b{background:var(--text);}',
            '.ludo-token.movable{outline:3px solid var(--live);outline-offset:1px;animation:ludo-pulse 1s infinite;}',
            '.ludo-token.disabled{cursor:default;}',
            '@keyframes ludo-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}',
            '.ludo-controls{display:flex;align-items:center;gap:14px;}',
            '.ludo-die{width:52px;height:52px;border-radius:var(--blob-sm);background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:26px;font-family:var(--font-mono);box-shadow:var(--shadow-soft);user-select:none;}',
            '.ludo-die.rolling{animation:ludo-roll .45s ease;}',
            '@keyframes ludo-roll{0%{transform:rotate(0);}50%{transform:rotate(180deg) scale(1.1);}100%{transform:rotate(360deg);}}',
            '.ludo-roll-btn{padding:10px 18px;border-radius:var(--blob-sm);border:none;background:var(--accent);color:#fff;font-family:var(--font-display);font-weight:700;font-size:14px;cursor:pointer;box-shadow:var(--shadow-soft);}',
            '.ludo-roll-btn:disabled{opacity:.4;cursor:default;}',
            '.ludo-hint{font-family:var(--font-body);color:var(--text-dim);font-size:12px;min-height:16px;}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------------
    // Board geometry — 15x15 grid, classic ludo layout.
    // We precompute pixel-free grid coordinates (col,row in 0..14) for:
    //  - the 52-cell outer ring path (shared by both colors, entry offset differs)
    //  - each color's 6-cell home stretch (their private lane to center)
    //  - each color's 4-cell yard "parking" positions
    // ---------------------------------------------------------------

    // Standard ring path (52 cells), traced starting at white's entry square,
    // going clockwise. Coordinates in 15x15 grid units (0-indexed).
    var RING = [
        [1,6],[2,6],[3,6],[4,6],[5,6],           // 0-4
        [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],     // 5-10
        [7,0],                                    // 11
        [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],     // 12-17
        [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],// 18-23
        [14,7],                                   // 24
        [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],// 25-30
        [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],// 31-36
        [7,14],                                   // 37
        [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],// 38-43
        [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],     // 44-49
        [0,7],                                    // 50
        [0,6]                                     // 51
    ];
    // Sanity: 52 cells total (0..51)

    // Each color's start index on the ring (where token 0 enters after leaving yard)
    var START_INDEX = { w: 0, b: 26 };
    // Each color's home-stretch entry: the ring index just before turning into
    // their private lane (i.e. after this index, next step goes off-ring).
    var HOME_ENTRY_INDEX = { w: 50, b: 24 };

    // Home stretch (6 cells) per color, in grid coords, leading into center.
    var HOME_STRETCH = {
        w: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
        b: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
    };

    // Yard parking spots (4 per color) in grid coords, within the big colored
    // corner squares. White = bottom-left (rows 9-14, cols 0-5), Black = top-right.
    var YARD = {
        w: [[1.5,10.5],[3.5,10.5],[1.5,12.5],[3.5,12.5]],
        b: [[10.5,2.5],[12.5,2.5],[10.5,4.5],[12.5,4.5]]
    };

    // Safe squares (star cells) — indices on the ring that are safe from capture.
    var SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

    var CELL_PX = null; // computed at mount time based on board size

    // ---------------------------------------------------------------
    // Game state
    // ---------------------------------------------------------------
    // Each token: { pos: -1 (in yard) | 0..51 (ring index) | 100..105 (home stretch index) | 200 (finished) }
    function freshTokens() {
        return [
            { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }
        ];
    }

    var state = {
        tokens: { w: freshTokens(), b: freshTokens() },
        turn: 'w',
        dice: null,          // last rolled value, or null if not yet rolled this turn
        rolling: false,
        extraTurnQueued: false,
        moveHistory: []      // for takeback: stack of snapshots
    };

    function cloneTokens(t) {
        return {
            w: t.w.map(function (x) { return { pos: x.pos }; }),
            b: t.b.map(function (x) { return { pos: x.pos }; })
        };
    }

    function snapshot() {
        return {
            tokens: cloneTokens(state.tokens),
            turn: state.turn,
            dice: state.dice
        };
    }

    // ---------------------------------------------------------------
    // DOM refs
    // ---------------------------------------------------------------
    var els = {};

    function canIPlay() {
        if (localMode) return true;
        return state.turn === myColor;
    }

    // ---------------------------------------------------------------
    // Mount / render
    // ---------------------------------------------------------------
    function mount(stageEl) {
        stageEl.innerHTML =
            '<div class="board-frame ludo-frame">' +
                '<div class="ludo-board" id="ludo-board"></div>' +
                '<div class="ludo-controls">' +
                    '<div class="ludo-die" id="ludo-die">-</div>' +
                    '<button class="ludo-roll-btn" id="ludo-roll-btn">Roll</button>' +
                '</div>' +
                '<div class="ludo-hint" id="ludo-hint"></div>' +
            '</div>';

        els.board = stageEl.querySelector('#ludo-board');
        els.die = stageEl.querySelector('#ludo-die');
        els.rollBtn = stageEl.querySelector('#ludo-roll-btn');
        els.hint = stageEl.querySelector('#ludo-hint');

        els.rollBtn.addEventListener('click', handleRollClick);

        buildStaticBoard();
    }

    function gridToPct(col, row) {
        // 15x15 grid -> percentage
        return { left: (col / 15) * 100, top: (row / 15) * 100, size: (1 / 15) * 100 };
    }

    function buildStaticBoard() {
        var board = els.board;
        board.innerHTML = '';

        // Corner yard backgrounds
        addYardBackground('w', 0, 9, 6, 6);
        addYardBackground('b', 9, 0, 6, 6);

        // Ring cells
        for (var i = 0; i < RING.length; i++) {
            var c = RING[i];
            var cell = document.createElement('div');
            cell.className = 'ludo-cell' + (SAFE_INDICES.indexOf(i) !== -1 ? ' safe' : '');
            var p = gridToPct(c[0], c[1]);
            cell.style.left = p.left + '%';
            cell.style.top = p.top + '%';
            cell.style.width = p.size + '%';
            cell.style.height = p.size + '%';
            if (SAFE_INDICES.indexOf(i) !== -1) cell.textContent = '\u2605';
            cell.style.fontSize = '10px';
            cell.style.color = 'var(--text-faint)';
            board.appendChild(cell);
        }

        // Home stretch cells
        ['w', 'b'].forEach(function (color) {
            HOME_STRETCH[color].forEach(function (c) {
                var cell = document.createElement('div');
                cell.className = 'ludo-cell path-' + color;
                var p = gridToPct(c[0], c[1]);
                cell.style.left = p.left + '%';
                cell.style.top = p.top + '%';
                cell.style.width = p.size + '%';
                cell.style.height = p.size + '%';
                board.appendChild(cell);
            });
        });

        // Center triangle/home
        var center = document.createElement('div');
        center.className = 'ludo-center';
        var pc = gridToPct(6, 6);
        center.style.left = pc.left + '%';
        center.style.top = pc.top + '%';
        center.style.width = (3 / 15 * 100) + '%';
        center.style.height = (3 / 15 * 100) + '%';
        center.textContent = '\ud83c\udfc1';
        board.appendChild(center);

        els.tokenEls = { w: [], b: [] };
        ['w', 'b'].forEach(function (color) {
            for (var i = 0; i < 4; i++) {
                var tok = document.createElement('div');
                tok.className = 'ludo-token ' + color;
                tok.textContent = String(i + 1);
                var sz = (0.72 / 15 * 100);
                tok.style.width = sz + '%';
                tok.style.height = sz + '%';
                tok.dataset.color = color;
                tok.dataset.idx = String(i);
                tok.addEventListener('click', function (e) {
                    var el = e.currentTarget;
                    onTokenClick(el.dataset.color, parseInt(el.dataset.idx, 10));
                });
                board.appendChild(tok);
                els.tokenEls[color].push(tok);
            }
        });
    }

    function addYardBackground(color, colStart, rowStart, w, h) {
        var yard = document.createElement('div');
        yard.className = 'ludo-home-yard ' + color;
        var p = gridToPct(colStart, rowStart);
        yard.style.left = p.left + '%';
        yard.style.top = p.top + '%';
        yard.style.width = (w / 15 * 100) + '%';
        yard.style.height = (h / 15 * 100) + '%';
        els.board.appendChild(yard);
    }

    function tokenGridPos(color, idx) {
        var pos = state.tokens[color][idx].pos;
        if (pos === -1) {
            return YARD[color][idx];
        }
        if (pos === 200) {
            // finished — stack near center on their side
            var cx = color === 'w' ? 6.6 : 7.4;
            return [cx, 7 + (idx % 4) * 0.0]; // stacked, offset applied below
        }
        if (pos >= 100) {
            var hs = HOME_STRETCH[color][pos - 100];
            return hs;
        }
        return RING[pos];
    }

    function render() {
        if (!els.board) return;

        // Group tokens sharing a cell so we can offset them slightly.
        var occupancy = {};
        ['w', 'b'].forEach(function (color) {
            state.tokens[color].forEach(function (t, idx) {
                var key = color + ':' + t.pos;
                if (t.pos === -1) return; // yard tokens don't stack-share visually beyond their fixed slot
                if (!occupancy[key]) occupancy[key] = [];
                occupancy[key].push({ color: color, idx: idx });
            });
        });

        ['w', 'b'].forEach(function (color) {
            state.tokens[color].forEach(function (t, idx) {
                var el = els.tokenEls[color][idx];
                var g = tokenGridPos(color, idx);
                var col = g[0], row = g[1];

                if (t.pos !== -1) {
                    var key = color + ':' + t.pos;
                    var group = occupancy[key];
                    var n = group.length;
                    var pos = group.findIndex(function (g2) { return g2.color === color && g2.idx === idx; });
                    if (n > 1) {
                        var offsets = [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]];
                        col += offsets[pos % 4][0];
                        row += offsets[pos % 4][1];
                    }
                }

                var p = gridToPct(col, row);
                el.style.left = p.left + '%';
                el.style.top = p.top + '%';

                var movable = canIPlay() && !gameEnded && state.dice != null &&
                    color === state.turn && isTokenMovable(color, idx, state.dice);
                el.classList.toggle('movable', movable);
                el.classList.toggle('disabled', !movable);
            });
        });

        els.die.textContent = state.dice != null ? diceGlyph(state.dice) : '-';
        var canRoll = canIPlay() && !gameEnded && state.dice == null && !state.rolling;
        els.rollBtn.disabled = !canRoll;

        renderHint();
    }

    function diceGlyph(n) {
        var glyphs = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
        return glyphs[n] || String(n);
    }

    function renderHint() {
        if (!els.hint) return;
        if (gameEnded) { els.hint.textContent = ''; return; }
        if (!canIPlay()) { els.hint.textContent = ''; return; }
        if (state.dice == null) {
            els.hint.textContent = 'Roll the die';
        } else {
            var anyMove = [0,1,2,3].some(function (i) { return isTokenMovable(state.turn, i, state.dice); });
            els.hint.textContent = anyMove ? 'Tap a highlighted token to move it' : 'No legal move — passing turn';
        }
    }

    // ---------------------------------------------------------------
    // Rules
    // ---------------------------------------------------------------
    function isTokenMovable(color, idx, dice) {
        var t = state.tokens[color][idx];
        if (t.pos === 200) return false; // already finished
        if (t.pos === -1) return dice === 6;
        if (t.pos >= 100) {
            var stepIdx = t.pos - 100;
            return (stepIdx + dice) <= 5 || (stepIdx + dice) === 6; // 6 stretch cells (0..5), need to land exactly on "finish" (index 6 == home)
        }
        // On ring: check we don't overshoot home entry without an exact-ish path;
        // ludo home stretch requires exact count, but overshoot just isn't allowed.
        var stepsFromEntry = ringStepsRemainingToStretch(color, t.pos, dice);
        return stepsFromEntry !== null;
    }

    // Returns null if the move (dice steps from ring pos) can't be resolved
    // (i.e., would overshoot the final home cell). Otherwise no error — moves
    // along the ring are always legal unless they'd overshoot into/through home.
    function ringStepsRemainingToStretch(color, ringPos, dice) {
        var entry = HOME_ENTRY_INDEX[color];
        // distance from ringPos to entry, walking forward around the ring
        var dist = (entry - ringPos + 52) % 52;
        if (dice <= dist) {
            return dice; // still on ring or lands exactly on entry
        }
        var intoStretch = dice - dist - 1; // steps into the 6-cell home stretch (0-indexed), -1 removed for entry step itself
        // home stretch has 6 cells (0..5); intoStretch must be 0..5 to be legal
        if (intoStretch >= 0 && intoStretch <= 5) return dice;
        return null;
    }

    function applyMove(color, idx, dice) {
        var t = state.tokens[color][idx];
        var captured = false;

        if (t.pos === -1) {
            if (dice !== 6) return false;
            t.pos = START_INDEX[color];
        } else if (t.pos >= 100) {
            var stepIdx = t.pos - 100;
            var dest = stepIdx + dice;
            if (dest > 5 && dest !== 6) return false;
            if (dest === 5 && dice === (5 - stepIdx)) {
                // land on last stretch cell, not yet finished unless dice exactly completes final cell->home
            }
            if (dest > 5) return false;
            if (stepIdx + dice === 6) {
                t.pos = 200; // finished (exact count reaches beyond last cell = home)
            } else if (stepIdx + dice === 5) {
                t.pos = 105; // sits on last stretch cell
            } else if (stepIdx + dice < 5) {
                t.pos = 100 + stepIdx + dice;
            } else {
                return false;
            }
        } else {
            var entry = HOME_ENTRY_INDEX[color];
            var dist = (entry - t.pos + 52) % 52;
            if (dice <= dist) {
                var newPos = (t.pos + dice) % 52;
                // capture check
                captured = tryCapture(color, newPos);
                t.pos = newPos;
            } else {
                var intoStretch = dice - dist - 1;
                if (intoStretch < 0 || intoStretch > 5) return false;
                if (intoStretch === 5) {
                    t.pos = 200;
                } else {
                    t.pos = 100 + intoStretch;
                }
            }
        }
        return { captured: captured };
    }

    function tryCapture(movingColor, ringPos) {
        if (SAFE_INDICES.indexOf(ringPos) !== -1) return false;
        var oppColor = movingColor === 'w' ? 'b' : 'w';
        var captured = false;
        state.tokens[oppColor].forEach(function (t) {
            if (t.pos === ringPos) {
                t.pos = -1;
                captured = true;
            }
        });
        return captured;
    }

    function allHome(color) {
        return state.tokens[color].every(function (t) { return t.pos === 200; });
    }

    // ---------------------------------------------------------------
    // Turn flow
    // ---------------------------------------------------------------
    function handleRollClick() {
        if (gameEnded || !canIPlay() || state.dice != null || state.rolling) return;
        var value = 1 + Math.floor(Math.random() * 6);
        performRoll(value, true);
    }

    function performRoll(value, isLocalRoll) {
        state.rolling = true;
        els.die.classList.add('rolling');
        setTimeout(function () {
            els.die.classList.remove('rolling');
            state.rolling = false;
            state.dice = value;
            vibrate([10]);

            if (isLocalRoll && !localMode) {
                gameSend({ kind: 'roll', value: value });
            }

            var anyMove = [0,1,2,3].some(function (i) { return isTokenMovable(state.turn, i, value); });
            if (!anyMove) {
                // no legal move; pass turn after a short beat
                setTimeout(function () { passTurn(); }, 550);
            }
            render();
            setStatusLine();
        }, 420);
    }

    function onTokenClick(color, idx) {
        if (gameEnded || !canIPlay()) return;
        if (color !== state.turn) return;
        if (state.dice == null) return;
        if (!isTokenMovable(color, idx, state.dice)) return;

        pushHistory();

        var dice = state.dice;
        var result = applyMove(color, idx, dice);
        if (!result) { state.moveHistory.pop(); return; }

        if (!localMode) {
            gameSend({ kind: 'move', color: color, idx: idx, dice: dice });
        }

        sndMove();
        if (result.captured) { sndCapture(); vibrate([15, 40, 15]); }

        var justFinished = state.tokens[color][idx].pos === 200;
        if (justFinished) { sndNotify(); }

        checkWinAndAdvance(color, dice, result.captured, justFinished);
    }

    function checkWinAndAdvance(color, dice, captured, justFinished) {
        if (allHome(color)) {
            finishGame(color);
            return;
        }

        var extraTurn = (dice === 6) || captured || justFinished;
        if (!extraTurn) {
            switchTurn();
        } else {
            state.dice = null;
        }

        render();
        setStatusLine();
        updateActionButtons();
    }

    function switchTurn() {
        state.turn = state.turn === 'w' ? 'b' : 'w';
        state.dice = null;
        if (localMode) { myColor = state.turn; updateAvatars(); }
    }

    function passTurn() {
        switchTurn();
        render();
        setStatusLine();
    }

    function finishGame(winnerColor) {
        sndEnd();
        if (localMode) {
            endGame(
                (winnerColor === 'w' ? 'Pink' : 'Dark') + ' wins!',
                'All four tokens made it home.',
                'win',
                winnerColor
            );
        } else {
            var iWon = winnerColor === myColor;
            endGame(
                iWon ? 'You win' : 'You lose',
                iWon ? 'All your tokens made it home first.' : 'Opponent got all tokens home first.',
                iWon ? 'win' : 'lose'
            );
        }
    }

    // ---------------------------------------------------------------
    // Takeback
    // ---------------------------------------------------------------
    function pushHistory() {
        state.moveHistory.push(snapshot());
        if (state.moveHistory.length > 40) state.moveHistory.shift();
    }

    function doLocalTakeback() {
        if (!state.moveHistory.length) return;
        var prev = state.moveHistory.pop();
        state.tokens = prev.tokens;
        state.turn = prev.turn;
        state.dice = prev.dice;
        if (localMode) { myColor = state.turn; updateAvatars(); }
        render();
        setStatusLine();
        updateActionButtons();
    }

    function canTakeback() {
        return state.moveHistory.length > 0;
    }

    // ---------------------------------------------------------------
    // Networking
    // ---------------------------------------------------------------
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        try {
            switch (payload.kind) {
                case 'roll': {
                    if (typeof payload.value !== 'number' || payload.value < 1 || payload.value > 6) return;
                    state.dice = payload.value;
                    render();
                    setStatusLine();
                    break;
                }
                case 'move': {
                    var color = payload.color, idx = payload.idx, dice = payload.dice;
                    if (color !== 'w' && color !== 'b') return;
                    if (typeof idx !== 'number' || idx < 0 || idx > 3) return;
                    if (typeof dice !== 'number' || dice < 1 || dice > 6) return;
                    pushHistory();
                    var result = applyMove(color, idx, dice);
                    if (!result) { state.moveHistory.pop(); return; }
                    sndMove();
                    if (result.captured) sndCapture();
                    var justFinished = state.tokens[color][idx].pos === 200;
                    if (allHome(color)) {
                        finishGame(color);
                        return;
                    }
                    var extraTurn = (dice === 6) || result.captured || justFinished;
                    if (!extraTurn) { switchTurn(); } else { state.dice = null; }
                    render();
                    setStatusLine();
                    updateActionButtons();
                    break;
                }
                case 'sync': {
                    if (!payload.tokens || !payload.turn) return;
                    state.tokens = cloneTokens(payload.tokens);
                    state.turn = payload.turn;
                    state.dice = payload.dice || null;
                    render();
                    setStatusLine();
                    break;
                }
            }
        } catch (e) {
            // swallow — malformed payload should never break dispatch
        }
    }

    function resync() {
        if (!localMode) {
            gameSend({ kind: 'sync', tokens: state.tokens, turn: state.turn, dice: state.dice });
        }
    }

    // ---------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------
    function init(isHostOrLocal, resetState) {
        if (resetState) {
            state.tokens = { w: freshTokens(), b: freshTokens() };
            state.turn = 'w';
            state.dice = null;
            state.rolling = false;
            state.moveHistory = [];
        }
        render();
        setStatusLine();
    }

    function statusText() {
        if (gameEnded) return '';
        if (state.rolling) return 'Rolling\u2026';
        if (!canIPlay()) return oppName + '\u2019s turn';
        if (state.dice == null) return 'Your turn \u2014 roll the die';
        return 'Move a token';
    }

    // ---------------------------------------------------------------
    // Register
    // ---------------------------------------------------------------
    registerGame('ludo', {
        name: 'Ludo',
        icon: '\ud83c\udfb2',
        color: 'g-ludo',
        usesClock: false,
        canTakeback: true
    }, {
        mount: mount,
        init: init,
        render: render,
        onData: onData,
        statusText: statusText,
        doLocalTakeback: doLocalTakeback,
        canTakeback: canTakeback,
        resync: resync
    });
})();
