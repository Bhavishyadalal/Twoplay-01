// ===================================================================
// GAME: CONNECT 4
// 7 cols x 6 rows. myColor 'w' = p1 (yellow, goes first), 'b' = p2 (red).
// grid[col] = array of 'p1'/'p2' bottom-to-top.
// ===================================================================
(function () {
    const COLS = 7, ROWS = 6;
    let grid = [], turn = 'w', lastDrop = null;

    function init(isHostOrLocal, resetState) {
        if (resetState) { grid = Array.from({ length: COLS }, () => []); turn = 'w'; lastDrop = null; }
        render();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', grid, turn });
    }
    function canIPlay() { return localMode ? true : turn === myColor; }
    function myPiece() { return myColor === 'w' ? 'p1' : 'p2'; }

    let cellCache = null, colCache = null, hoverCache = null; // built once, reused across renders
    function buildBoardOnce() {
        const board = document.getElementById('c4-board');
        const hover = document.getElementById('c4-hover');
        board.innerHTML = ''; hover.innerHTML = '';
        cellCache = []; colCache = []; hoverCache = [];
        for (let c = 0; c < COLS; c++) {
            const colEl = document.createElement('div');
            colEl.className = 'c4-col';
            colEl.addEventListener('click', () => onColClick(c));
            colCache.push(colEl);
            cellCache.push([]);
            for (let r = 0; r < ROWS; r++) {
                const cell = document.createElement('div');
                cell.className = 'c4-cell';
                colEl.appendChild(cell);
                cellCache[c].push(cell);
            }
            board.appendChild(colEl);
            const hc = document.createElement('div'); hc.className = 'hover-cell'; hover.appendChild(hc);
            hoverCache.push(hc);
        }
    }
    function render() {
        if (!cellCache || !document.getElementById('c4-board').contains(colCache[0])) buildBoardOnce();
        const winCells = getWinCells();
        const playable = !gameEnded && canIPlay();
        for (let c = 0; c < COLS; c++) {
            colCache[c].classList.toggle('playable', playable && grid[c].length < ROWS);
            for (let r = 0; r < ROWS; r++) {
                const piece = grid[c][r];
                const cell = cellCache[c][r];
                cell.className = 'c4-cell' + (piece ? ' ' + piece : '');
                if (lastDrop && lastDrop.col === c && lastDrop.row === r) cell.classList.add('drop');
                if (winCells && winCells.some(w => w.col === c && w.row === r)) cell.classList.add('win');
            }
        }
    }
    function onColClick(c) {
        if (gameEnded || !canIPlay() || grid[c].length >= ROWS) return;
        const piece = localMode ? (turn === 'w' ? 'p1' : 'p2') : myPiece();
        dropPiece(c, piece);
        gameSend({ kind: 'move', col: c, piece });
        turn = turn === 'w' ? 'b' : 'w';
        if (localMode) { myColor = turn; updateAvatars(); }
        render();
        resolveEnd();
        setStatusLine();
    }
    function dropPiece(c, piece) {
        grid[c].push(piece);
        lastDrop = { col: c, row: grid[c].length - 1 };
        sndMove();
    }
    function getWinCells() {
        const at = (c, r) => (grid[c] && grid[c][r]) || null;
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
            const p = at(c, r); if (!p) continue;
            for (const [dc, dr] of [[1,0],[0,1],[1,1],[1,-1]]) {
                const cells = [{col:c,row:r}];
                for (let k = 1; k < 4; k++) {
                    const cc = c + dc*k, rr = r + dr*k;
                    if (at(cc, rr) === p) cells.push({col:cc,row:rr}); else break;
                }
                if (cells.length === 4) return cells;
            }
        }
        return null;
    }
    function resolveEnd() {
        const win = getWinCells();
        if (win) {
            const winnerPiece = grid[win[0].col][win[0].row];
            const winnerColor = winnerPiece === 'p1' ? 'w' : 'b';
            const iWon = winnerColor === myColor;
            const title = localMode ? (winnerPiece === 'p1' ? 'Yellow' : 'Red') + ' wins!' : (iWon ? 'You win' : 'You lose');
            gameTimeout(() => endGame(title, 'Four in a row.', localMode ? 'win' : (iWon ? 'win' : 'lose'), winnerColor), 250);
            return;
        }
        if (grid.every(col => col.length === ROWS)) { gameTimeout(() => endGame('Draw', 'Board is full.', 'draw'), 250); }
    }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') { grid = payload.grid; turn = payload.turn; render(); }
        else if (payload.kind === 'move') {
            if (gameEnded || turn === myColor || grid[payload.col].length >= ROWS || payload.piece !== (turn === 'w' ? 'p1' : 'p2')) return;
            dropPiece(payload.col, payload.piece);
            turn = turn === 'w' ? 'b' : 'w';
            sndNotify();
            render();
            resolveEnd();
            setStatusLine();
        }
    }
    GameControllers.c4 = {
        init, render, onData,
        statusText() {
            if (gameEnded) return '';
            if (localMode) return (turn === 'w' ? 'Yellow' : 'Red') + "'s turn";
            return canIPlay() ? 'Your turn' : oppName + '\u2019s turn';
        },
        canTakeback() { return false; },
        resync() { if (!localMode) gameSend({ kind: 'sync', grid, turn }); }
    };
})();
