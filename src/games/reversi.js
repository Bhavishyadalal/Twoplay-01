// ===================================================================
// GAME: REVERSI (Othello)
// 8x8. myColor 'w' = p1 (light, moves first), 'b' = p2 (dark).
// Standard rules: must flip at least one line of opponent pieces to play;
// if a player has no legal move, turn passes automatically; game ends
// when neither player can move. Most discs on the board wins.
// ===================================================================
(function () {
    let board = [], turn = 'w', lastMove = null, moveCount = 0, history = [];
    let playIntroAnim = false, justPlaced = null, justFlipped = [];
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    function freshBoard() {
        const b = Array.from({ length: 8 }, () => Array(8).fill(null));
        b[3][3] = 'p2'; b[3][4] = 'p1'; b[4][3] = 'p1'; b[4][4] = 'p2';
        return b;
    }
    function init(isHostOrLocal, resetState) {
        if (resetState) { board = freshBoard(); turn = 'w'; lastMove = null; moveCount = 0; history = []; playIntroAnim = true; justPlaced = null; justFlipped = []; }
        render();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', board, turn });
    }
    function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    function pieceForTurn() { return turn === 'w' ? 'p1' : 'p2'; }
    function myPiece() { return myColor === 'w' ? 'p1' : 'p2'; }
    function canIPlay() { return localMode ? true : turn === myColor; }
    function opponentOf(p) { return p === 'p1' ? 'p2' : 'p1'; }

    function flipsFor(r, c, piece, b) {
        if (b[r][c]) return [];
        const opp = opponentOf(piece);
        let allFlips = [];
        for (const [dr, dc] of DIRS) {
            let rr = r + dr, cc = c + dc;
            const line = [];
            while (inB(rr, cc) && b[rr][cc] === opp) { line.push([rr, cc]); rr += dr; cc += dc; }
            if (line.length && inB(rr, cc) && b[rr][cc] === piece) allFlips = allFlips.concat(line);
        }
        return allFlips;
    }
    function legalMovesFor(piece, b) {
        const moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const flips = flipsFor(r, c, piece, b);
            if (flips.length) moves.push({ r, c, flips });
        }
        return moves;
    }
    function scores() {
        let p1 = 0, p2 = 0;
        for (const row of board) for (const cell of row) { if (cell === 'p1') p1++; else if (cell === 'p2') p2++; }
        return { p1, p2 };
    }

    function render() {
        const boardEl = document.getElementById('reversi-board');
        const scoreEl = document.getElementById('rev-score-row');
        boardEl.innerHTML = '';
        const doIntro = playIntroAnim; playIntroAnim = false;
        const moves = (!gameEnded && canIPlay()) ? legalMovesFor(pieceForTurn(), board) : [];
        let cellIdx = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement('div');
                sq.className = 'rev-sq';
                const isPlayable = moves.some(m => m.r === r && m.c === c);
                if (isPlayable) sq.classList.add('playable');
                if (lastMove && lastMove.r === r && lastMove.c === c) sq.classList.add('last-move');
                const piece = board[r][c];
                if (piece) {
                    const pd = document.createElement('div');
                    const wasJustFlipped = justFlipped.some(f => f[0] === r && f[1] === c);
                    const wasJustPlaced = justPlaced && justPlaced[0] === r && justPlaced[1] === c;
                    pd.className = 'rev-piece ' + piece + (wasJustFlipped ? ' flipping' : '') + (wasJustPlaced ? ' placed' : '');
                    if (doIntro) { pd.classList.add('piece-intro'); pd.style.animationDelay = (cellIdx * 4) + 'ms'; }
                    sq.appendChild(pd);
                }
                sq.addEventListener('click', () => onSquareClick(r, c));
                boardEl.appendChild(sq);
                cellIdx++;
            }
        }
        justPlaced = null; justFlipped = [];

        const { p1, p2 } = scores();
        const myScore = myColor === 'w' ? p1 : p2, oppScore = myColor === 'w' ? p2 : p1;
        scoreEl.innerHTML = `
            <span class="rev-score-chip${p1 >= p2 ? ' leading' : ''}"><span class="rev-score-dot p1"></span>${p1}</span>
            <span class="rev-score-chip${p2 >= p1 ? ' leading' : ''}"><span class="rev-score-dot p2"></span>${p2}</span>
        `;
    }

    function onSquareClick(r, c) {
        if (gameEnded || !canIPlay()) return;
        const flips = flipsFor(r, c, pieceForTurn(), board);
        if (!flips.length) return;
        playMove(r, c, flips);
        gameSend({ kind: 'move', r, c });
        advanceTurnAndRender();
    }
    function playMove(r, c, flips) {
        history.push({ board: board.map(row => row.slice()), turn });
        const piece = pieceForTurn();
        board[r][c] = piece;
        for (const [fr, fc] of flips) board[fr][fc] = piece;
        lastMove = { r, c };
        justPlaced = [r, c];
        justFlipped = flips;
        moveCount++;
        if (flips.length) sndCapture(); else sndMove();
    }
    function advanceTurnAndRender() {
        turn = turn === 'w' ? 'b' : 'w';
        if (localMode) { myColor = turn; updateAvatars(); }
        // Auto-pass if the new player has no legal moves but the other side does.
        if (legalMovesFor(pieceForTurn(), board).length === 0) {
            const otherHasMoves = legalMovesFor(opponentOf(pieceForTurn()), board).length > 0;
            if (otherHasMoves) {
                toast((turn === 'w' ? (localMode ? 'Light' : (canIPlay() ? 'You' : oppName)) : (localMode ? 'Dark' : (canIPlay() ? 'You' : oppName))) + ' had no legal move — turn passes.');
                turn = turn === 'w' ? 'b' : 'w';
                if (localMode) { myColor = turn; updateAvatars(); }
            }
        }
        render();
        resolveEnd();
        setStatusLine();
        updateActionButtons();
    }
    function resolveEnd() {
        const p1Moves = legalMovesFor('p1', board).length, p2Moves = legalMovesFor('p2', board).length;
        if (p1Moves > 0 || p2Moves > 0) return;
        const { p1, p2 } = scores();
        let winnerColor = null;
        if (p1 !== p2) winnerColor = p1 > p2 ? 'w' : 'b';
        gameTimeout(() => {
            if (!winnerColor) { endGame('Draw', `${p1}–${p2}. Board is even.`, 'draw'); return; }
            const iWon = winnerColor === myColor;
            const title = localMode ? ((winnerColor === 'w' ? 'Light' : 'Dark') + ' wins!') : (iWon ? 'You win' : 'You lose');
            endGame(title, `${Math.max(p1,p2)}–${Math.min(p1,p2)}. No moves left for either side.`, localMode ? 'win' : (iWon ? 'win' : 'lose'), winnerColor);
        }, 300);
    }
    function doLocalTakeback() {
        if (history.length === 0) return;
        const prev = history.pop();
        board = prev.board; turn = prev.turn;
        lastMove = null; justPlaced = null; justFlipped = [];
        moveCount = Math.max(0, moveCount - 1);
        gameEnded = false; finishedEpoch = -1;
        if (localMode) { myColor = turn; updateAvatars(); }
        render(); setStatusLine(); updateActionButtons();
    }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') { board = payload.board; turn = payload.turn; render(); }
        else if (payload.kind === 'move') {
            if (gameEnded || turn === myColor || board[payload.r][payload.c]) return;
            const flips = flipsFor(payload.r, payload.c, pieceForTurn(), board);
            if (!flips.length) return;
            playMove(payload.r, payload.c, flips);
            sndNotify();
            advanceTurnAndRender();
        }
    }
    GameControllers.reversi = {
        init, render, onData, doLocalTakeback,
        statusText() {
            if (gameEnded) return '';
            if (localMode) return (turn === 'w' ? 'Light' : 'Dark') + "'s turn";
            return canIPlay() ? 'Your turn' : oppName + '\u2019s turn';
        },
        canTakeback() { return moveCount > 0; },
        resync() { if (!localMode) gameSend({ kind: 'sync', board, turn }); }
    };
})();
