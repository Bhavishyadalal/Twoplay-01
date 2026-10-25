// ===================================================================
// GAME: CHECKERS
// 8x8, standard rules: forced captures, multi-jump, kinging on back row.
// board[r][c] = null | { color: 'p1'|'p2', king: bool }. p1 (light) starts
// on rows 5-7 and moves "up" (toward row 0); p2 (dark) starts rows 0-2 and
// moves "down". myColor 'w' = p1, 'b' = p2. Only dark squares are playable
// ((r+c) odd).
// ===================================================================
(function () {
    let board = [], turn = 'w', selected = null, legalMoves = [], lastMove = null;
    let moveCount = 0, history = [];
    let playIntroAnim = false;

    function freshBoard() {
        const b = Array.from({ length: 8 }, () => Array(8).fill(null));
        for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { color: 'p2', king: false };
        for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { color: 'p1', king: false };
        return b;
    }
    function init(isHostOrLocal, resetState) {
        if (resetState) { board = freshBoard(); turn = 'w'; selected = null; legalMoves = []; lastMove = null; moveCount = 0; history = []; playIntroAnim = true; justLanded = null; }
        render();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', board, turn });
    }
    function pieceColorForTurn() { return turn === 'w' ? 'p1' : 'p2'; }
    function myPiece() { return myColor === 'w' ? 'p1' : 'p2'; }
    function canIPlay() { return localMode ? true : turn === myColor; }
    function dirsFor(piece) {
        if (piece.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
        return piece.color === 'p1' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
    }
    function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    // Returns { simple: [{from,to}], capture: [{from,to,over,extra:[...]}] } for a color
    function allMovesFor(color) {
        let captures = [], simples = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p || p.color !== color) continue;
            const caps = capturesFrom(r, c, p, board);
            captures = captures.concat(caps);
            if (caps.length === 0) {
                for (const [dr, dc] of dirsFor(p)) {
                    const nr = r + dr, nc = c + dc;
                    if (inB(nr, nc) && !board[nr][nc]) simples.push({ from: [r,c], to: [nr,nc] });
                }
            }
        }
        return { captures, simples };
    }
    function capturesFrom(r, c, piece, b, visited) {
        const results = [];
        for (const [dr, dc] of dirsFor(piece)) {
            const mr = r + dr, mc = c + dc, jr = r + dr*2, jc = c + dc*2;
            if (!inB(jr, jc)) continue;
            const mid = b[mr] && b[mr][mc];
            if (mid && mid.color !== piece.color && !b[jr][jc]) {
                results.push({ from: [r,c], to: [jr,jc], over: [mr,mc] });
            }
        }
        return results;
    }
    // Find full multi-jump sequences from a square (for legal-move highlighting)
    function jumpSequences(r, c, piece, b) {
        const first = capturesFrom(r, c, piece, b);
        if (first.length === 0) return [];
        let sequences = [];
        for (const jump of first) {
            const b2 = cloneBoard(b);
            b2[jump.over[0]][jump.over[1]] = null;
            b2[jump.to[0]][jump.to[1]] = b2[r][c]; b2[r][c] = null;
            const [tr, tc] = jump.to;
            const kinged = maybeKing(b2[tr][tc], tr);
            const further = kinged ? [] : jumpSequences(tr, tc, b2[tr][tc], b2);
            if (further.length === 0) sequences.push([jump]);
            else for (const seq of further) sequences.push([jump, ...seq]);
        }
        return sequences;
    }
    function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { ...cell } : null)); }
    function maybeKing(piece, row) {
        if (!piece || piece.king) return false;
        if ((piece.color === 'p1' && row === 0) || (piece.color === 'p2' && row === 7)) { piece.king = true; return true; }
        return false;
    }

    function render() {
        const el = document.getElementById('checkers-board');
        el.innerHTML = '';
        const flipped = myColor === 'b' && !localMode;
        const doIntro = playIntroAnim; playIntroAnim = false;
        let cellIdx = 0;
        const screenPos = {}; // "r,c" -> {dr, dc}
        let landedHolder = null;
        for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
            const r = flipped ? 7 - dr : dr, c = flipped ? 7 - dc : dc;
            screenPos[r + ',' + c] = { dr, dc };
            const sq = document.createElement('div');
            sq.className = 'chk-sq ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
            if (selected && selected[0] === r && selected[1] === c) sq.classList.add('selected');
            if (lastMove && ((lastMove.from[0]===r&&lastMove.from[1]===c) || (lastMove.to[0]===r&&lastMove.to[1]===c))) sq.classList.add('last-move');
            const piece = board[r][c];
            if (piece) {
                // A translate-only holder carries the slide-in animation, kept separate from
                // the piece's own scale/bounce animation so the two transforms don't collide.
                const holder = document.createElement('div');
                holder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
                const pd = document.createElement('div');
                pd.className = 'chk-piece ' + piece.color + (piece.king ? ' king' : '');
                if (doIntro) { pd.classList.add('piece-intro'); pd.style.animationDelay = (cellIdx * 5) + 'ms'; }
                if (justLanded && justLanded.r === r && justLanded.c === c) {
                    pd.classList.add(justLanded.captured ? 'just-captured' : 'just-moved');
                    landedHolder = holder;
                }
                holder.appendChild(pd);
                sq.appendChild(holder);
            }
            if (selected && legalMoves.some(m => m.to[0] === r && m.to[1] === c)) {
                const dot = document.createElement('div'); dot.className = 'dot'; sq.appendChild(dot);
            }
            sq.addEventListener('click', () => onSquareClick(r, c));
            el.appendChild(sq);
            cellIdx++;
        }
        if (landedHolder && lastMove) {
            const from = screenPos[lastMove.from[0] + ',' + lastMove.from[1]];
            const to = screenPos[lastMove.to[0] + ',' + lastMove.to[1]];
            if (from && to && (from.dr !== to.dr || from.dc !== to.dc)) {
                const cell = el.getBoundingClientRect().width / 8;
                const dx = (from.dc - to.dc) * cell, dy = (from.dr - to.dr) * cell;
                landedHolder.style.transition = 'none';
                landedHolder.style.transform = `translate(${dx}px, ${dy}px)`;
                landedHolder.getBoundingClientRect(); // force reflow before transitioning
                requestAnimationFrame(() => {
                    landedHolder.style.transition = 'transform 0.24s cubic-bezier(.22,.75,.32,1)';
                    landedHolder.style.transform = 'translate(0, 0)';
                });
            }
        }
        justLanded = null;
    }

    let pendingMultiJump = null; // { sequences: [...], stepIndex, path: [] }

    function onSquareClick(r, c) {
        if (gameEnded || !canIPlay()) return;
        const piece = board[r][c];
        const myColorPiece = pieceColorForTurn();

        if (selected) {
            const move = legalMoves.find(m => m.to[0] === r && m.to[1] === c);
            if (move) { playSelectedMove(move); return; }
            if (piece && piece.color === myColorPiece) { selectSquare(r, c); return; }
            selected = null; legalMoves = []; render();
            return;
        }
        if (!piece || piece.color !== myColorPiece) return;
        selectSquare(r, c);
    }
    function selectSquare(r, c) {
        const { captures } = allMovesFor(pieceColorForTurn());
        const mustCapture = captures.length > 0;
        const piece = board[r][c];
        if (mustCapture) {
            const seqs = jumpSequences(r, c, piece, board);
            if (seqs.length === 0) { toast('A capture is available elsewhere — you must take it.'); return; }
            selected = [r, c];
            legalMoves = seqs.map(seq => ({ to: seq[seq.length-1].to, seq }));
        } else {
            selected = [r, c];
            legalMoves = [];
            for (const [dr, dc] of dirsFor(piece)) {
                const nr = r + dr, nc = c + dc;
                if (inB(nr, nc) && !board[nr][nc]) legalMoves.push({ from: [r,c], to: [nr,nc], seq: null });
            }
        }
        render();
    }
    function playSelectedMove(move) {
        const from = selected;
        applyMove(from, move);
        gameSend({ kind: 'move', from, moveTo: move.to, seq: move.seq || null });
        selected = null; legalMoves = [];
        moveCount++;
        turn = turn === 'w' ? 'b' : 'w';
        if (localMode) { myColor = turn; updateAvatars(); }
        render();
        resolveEnd();
        setStatusLine();
        updateActionButtons();
    }
    let justLanded = null; // {r,c,captured} — consumed once by render() for a landing flash
    function applyMove(from, move) {
        const [fr, fc] = from;
        const piece = board[fr][fc];
        history.push(cloneBoard(board));
        board[fr][fc] = null;
        if (move.seq) {
            let cur = piece;
            for (const jump of move.seq) {
                board[jump.over[0]][jump.over[1]] = null;
                board[jump.to[0]][jump.to[1]] = cur;
                maybeKing(cur, jump.to[0]);
            }
            lastMove = { from, to: move.seq[move.seq.length-1].to };
            justLanded = { r: lastMove.to[0], c: lastMove.to[1], captured: true };
            sndCapture();
        } else {
            board[move.to[0]][move.to[1]] = piece;
            maybeKing(piece, move.to[0]);
            lastMove = { from, to: move.to };
            justLanded = { r: move.to[0], c: move.to[1], captured: false };
            sndMove();
        }
    }
    function pieceCounts() {
        let p1 = 0, p2 = 0;
        for (const row of board) for (const cell of row) { if (cell) { if (cell.color === 'p1') p1++; else p2++; } }
        return { p1, p2 };
    }
    function resolveEnd() {
        const { captures, simples } = allMovesFor(pieceColorForTurn());
        const counts = pieceCounts();
        if (counts.p1 === 0 || counts.p2 === 0 || (captures.length === 0 && simples.length === 0)) {
            const winnerColor = counts.p1 === 0 ? 'b' : counts.p2 === 0 ? 'w' : (turn === 'w' ? 'b' : 'w');
            const iWon = winnerColor === myColor;
            const title = localMode ? ((winnerColor === 'w' ? 'Light' : 'Dark') + ' wins!') : (iWon ? 'You win' : 'You lose');
            gameTimeout(() => endGame(title, 'No moves or pieces remaining for the opponent.', localMode ? 'win' : (iWon ? 'win' : 'lose'), winnerColor), 250);
        }
    }
    function doLocalTakeback() {
        if (history.length === 0) return;
        board = history.pop();
        selected = null; legalMoves = []; lastMove = null;
        turn = turn === 'w' ? 'b' : 'w';
        moveCount = Math.max(0, moveCount - 1);
        gameEnded = false; finishedEpoch = -1;
        render(); setStatusLine(); updateActionButtons();
    }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') { board = payload.board; turn = payload.turn; render(); }
        else if (payload.kind === 'move') {
            if (gameEnded || turn === myColor) return;
            const [r,c] = payload.from, piece = board[r][c];
            if (!piece || piece.color !== pieceColorForTurn()) return;
            const forced = allMovesFor(piece.color).captures.length > 0;
            let legal;
            if (forced) {
                legal = jumpSequences(r,c,piece,board).map(seq => ({ to: seq[seq.length-1].to, seq })).find(m => JSON.stringify(m.to) === JSON.stringify(payload.moveTo) && JSON.stringify(m.seq) === JSON.stringify(payload.seq));
            } else {
                legal = allMovesFor(piece.color).simples.find(m => JSON.stringify(m.from) === JSON.stringify(payload.from) && JSON.stringify(m.to) === JSON.stringify(payload.moveTo) && !payload.seq);
            }
            if (!legal) return;
            applyMove(payload.from, legal);
            turn = turn === 'w' ? 'b' : 'w';
            sndNotify();
            moveCount++;
            render();
            resolveEnd();
            setStatusLine();
            updateActionButtons();
        }
    }
    GameControllers.checkers = {
        init, render, onData, doLocalTakeback,
        statusText() {
            if (gameEnded || board.length === 0) return '';
            const { captures } = allMovesFor(pieceColorForTurn());
            const forcedNote = captures.length > 0 ? ' — a capture is available' : '';
            if (localMode) return (turn === 'w' ? 'Light' : 'Dark') + "'s turn" + forcedNote;
            return canIPlay() ? ('Your turn' + forcedNote) : oppName + '\u2019s turn';
        },
        canTakeback() { return moveCount > 0; },
        onEscape() { selected = null; legalMoves = []; render(); },
        resync() { if (!localMode) gameSend({ kind: 'sync', board, turn }); }
    };
})();
