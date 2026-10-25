// ===================================================================
// GAME: TIC-TAC-TOE
// myColor 'w' = X (goes first), 'b' = O
// ===================================================================
(function () {
    let board = Array(9).fill(null);
    let turn = 'w'; // 'w' plays X, 'b' plays O
    let lastPlaced = null;
    const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

    function init(isHostOrLocal, resetState) {
        if (resetState) { board = Array(9).fill(null); turn = 'w'; lastPlaced = null; }
        render();
        if (amHost && resetState && !localMode) gameSend({ kind: 'sync', board, turn });
    }
    function render() {
        const el = document.getElementById('ttt-board');
        el.innerHTML = '';
        const winLine = getWinLine();
        board.forEach((v, i) => {
            const cell = document.createElement('div');
            cell.className = 'ttt-cell' + (v ? ' ' + (v === 'X' ? 'x' : 'o') : '');
            if (!v && !gameEnded && canIPlay()) cell.classList.add('playable');
            if (winLine && winLine.includes(i)) cell.classList.add('win');
            if (v) {
                const mark = document.createElement('span');
                mark.className = i === lastPlaced ? 'ttt-mark mark-intro' : 'ttt-mark';
                mark.innerText = v;
                cell.appendChild(mark);
            }
            cell.addEventListener('click', () => onCellClick(i));
            el.appendChild(cell);
        });
        lastPlaced = null;
    }
    function canIPlay() { return localMode ? true : turn === myColor; }
    function mySymbol() { return myColor === 'w' ? 'X' : 'O'; }

    function onCellClick(i) {
        if (gameEnded || board[i] || !canIPlay()) return;
        const sym = localMode ? (turn === 'w' ? 'X' : 'O') : mySymbol();
        board[i] = sym;
        lastPlaced = i;
        sndMove();
        gameSend({ kind: 'move', i, sym });
        turn = turn === 'w' ? 'b' : 'w';
        if (localMode) { myColor = turn; updateAvatars(); }
        render();
        resolveEnd();
        setStatusLine();
    }
    function getWinLine() {
        for (const line of WINS) { const [a,b,c] = line; if (board[a] && board[a] === board[b] && board[a] === board[c]) return line; }
        return null;
    }
    function resolveEnd() {
        const line = getWinLine();
        if (line) {
            const winnerSym = board[line[0]];
            const winnerColor = winnerSym === 'X' ? 'w' : 'b';
            const iWon = winnerColor === myColor;
            const title = localMode ? (winnerSym + ' wins!') : (iWon ? 'You win' : 'You lose');
            gameTimeout(() => endGame(title, 'Three in a row.', localMode ? 'win' : (iWon ? 'win' : 'lose'), winnerColor), 200);
            return;
        }
        if (board.every(v => v)) { gameTimeout(() => endGame('Draw', "Board's full — no winner.", 'draw'), 200); }
    }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        if (payload.kind === 'sync') { board = payload.board; turn = payload.turn; render(); }
        else if (payload.kind === 'move') {
            if (gameEnded || turn === myColor || board[payload.i] || payload.sym !== (turn === 'w' ? 'X' : 'O')) return;
            board[payload.i] = payload.sym;
            lastPlaced = payload.i;
            turn = turn === 'w' ? 'b' : 'w';
            sndNotify();
            render();
            resolveEnd();
            setStatusLine();
        }
    }
    GameControllers.ttt = {
        init, render, onData,
        statusText() {
            if (gameEnded) return '';
            if (localMode) return (turn === 'w' ? 'X' : 'O') + "'s turn";
            return canIPlay() ? 'Your turn (' + mySymbol() + ')' : oppName + '\u2019s turn';
        },
        canTakeback() { return false; },
        resync() { if (!localMode) gameSend({ kind: 'sync', board, turn }); }
    };
})();
