// Chess rules engine — inlined, no CDN dependency, works fully offline.
// Minimal dependency-free chess engine implementing the chess.js API
// surface this app uses (get/move/moves/turn/inCheck/isCheckmate/
// isStalemate/isInsufficientMaterial/isThreefoldRepetition/isDraw/
// undo/reset/load/fen).
(function (global) {
    const FILES = 'abcdefgh';
    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    function sq(file, rank) { return FILES[file] + (rank + 1); }
    function fileOf(s) { return FILES.indexOf(s[0]); }
    function rankOf(s) { return parseInt(s[1], 10) - 1; }
    function inBounds(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }

    class Chess {
        constructor(fen) { this._history = []; this.load(fen || START_FEN); }
        load(fen) {
            if (typeof fen !== 'string' || fen.length > 120) throw new Error('Invalid FEN');
            const parts = fen.trim().split(/\s+/);
            const ranks = parts[0].split('/');
            if (parts.length !== 6 || ranks.length !== 8 || !ranks.every(r => /^[prnbqkPRNBQK1-8]+$/.test(r) && [...r].reduce((n,c) => n + (/\d/.test(c) ? Number(c) : 1),0) === 8) || !/^[wb]$/.test(parts[1]) || !/^(?:-|K?Q?k?q?)$/.test(parts[2]) || !/^(?:-|[a-h][36])$/.test(parts[3]) || !/^\d+$/.test(parts[4]) || !/^[1-9]\d*$/.test(parts[5]) || (parts[0].match(/K/g)||[]).length !== 1 || (parts[0].match(/k/g)||[]).length !== 1) throw new Error('Invalid FEN');
            const [board, turn, castling, ep, half, full] = parts;
            this._sq = {};
            const rows = board.split('/');
            for (let r = 0; r < 8; r++) {
                let f = 0;
                for (const ch of rows[r]) {
                    if (/\d/.test(ch)) { f += parseInt(ch, 10); continue; }
                    const color = ch === ch.toUpperCase() ? 'w' : 'b';
                    const type = ch.toLowerCase();
                    this._sq[sq(f, 7 - r)] = { type, color };
                    f++;
                }
            }
            this._turn = turn;
            this._castling = { K: castling.includes('K'), Q: castling.includes('Q'), k: castling.includes('k'), q: castling.includes('q') };
            this._ep = ep !== '-' ? ep : null;
            this._halfmove = parseInt(half || '0', 10);
            this._fullmove = parseInt(full || '1', 10);
            this._history = [];
            this._fenHistory = [this.fen()];
        }
        reset() { this.load(START_FEN); }
        fen() {
            let out = '';
            for (let r = 7; r >= 0; r--) {
                let empty = 0;
                for (let f = 0; f < 8; f++) {
                    const p = this._sq[sq(f, r)];
                    if (!p) { empty++; continue; }
                    if (empty) { out += empty; empty = 0; }
                    out += p.color === 'w' ? p.type.toUpperCase() : p.type;
                }
                if (empty) out += empty;
                if (r > 0) out += '/';
            }
            const c = this._castling;
            let castleStr = (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '');
            if (!castleStr) castleStr = '-';
            return `${out} ${this._turn} ${castleStr} ${this._ep || '-'} ${this._halfmove} ${this._fullmove}`;
        }
        turn() { return this._turn; }
        get(square) { return this._sq[square] || null; }
        board() {
            const out = [];
            for (let r = 7; r >= 0; r--) {
                const row = [];
                for (let f = 0; f < 8; f++) {
                    const s = sq(f, r);
                    const p = this._sq[s];
                    row.push(p ? { type: p.type, color: p.color, square: s } : null);
                }
                out.push(row);
            }
            return out;
        }
        inCheck() { return this._isAttacked(this._kingSquare(this._turn), this._turn === 'w' ? 'b' : 'w'); }
        _kingSquare(color) {
            for (const s in this._sq) if (this._sq[s].type === 'k' && this._sq[s].color === color) return s;
            return null;
        }
        _isAttacked(square, byColor) {
            if (!square) return false;
            const tf = fileOf(square), tr = rankOf(square);
            const pdir = byColor === 'w' ? -1 : 1;
            for (const df of [-1, 1]) {
                const f = tf + df, r = tr + pdir;
                if (inBounds(f, r)) { const p = this._sq[sq(f, r)]; if (p && p.color === byColor && p.type === 'p') return true; }
            }
            const knightMoves = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
            for (const [df, dr] of knightMoves) {
                const f = tf + df, r = tr + dr;
                if (inBounds(f, r)) { const p = this._sq[sq(f, r)]; if (p && p.color === byColor && p.type === 'n') return true; }
            }
            for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
                if (!df && !dr) continue;
                const f = tf + df, r = tr + dr;
                if (inBounds(f, r)) { const p = this._sq[sq(f, r)]; if (p && p.color === byColor && p.type === 'k') return true; }
            }
            for (const [df, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                let f = tf + df, r = tr + dr;
                while (inBounds(f, r)) {
                    const p = this._sq[sq(f, r)];
                    if (p) { if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true; break; }
                    f += df; r += dr;
                }
            }
            for (const [df, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
                let f = tf + df, r = tr + dr;
                while (inBounds(f, r)) {
                    const p = this._sq[sq(f, r)];
                    if (p) { if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true; break; }
                    f += df; r += dr;
                }
            }
            return false;
        }
        _pseudoMovesFrom(square) {
            const piece = this._sq[square];
            if (!piece) return [];
            const f0 = fileOf(square), r0 = rankOf(square);
            const moves = [];
            const addSlide = (dirs) => {
                for (const [df, dr] of dirs) {
                    let f = f0 + df, r = r0 + dr;
                    while (inBounds(f, r)) {
                        const target = sq(f, r);
                        const occ = this._sq[target];
                        if (!occ) { moves.push({ to: target }); }
                        else { if (occ.color !== piece.color) moves.push({ to: target, capture: true }); break; }
                        f += df; r += dr;
                    }
                }
            };
            if (piece.type === 'n') {
                for (const [df, dr] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) {
                    const f = f0 + df, r = r0 + dr;
                    if (!inBounds(f, r)) continue;
                    const target = sq(f, r);
                    const occ = this._sq[target];
                    if (!occ) moves.push({ to: target });
                    else if (occ.color !== piece.color) moves.push({ to: target, capture: true });
                }
            } else if (piece.type === 'b') { addSlide([[1,1],[1,-1],[-1,1],[-1,-1]]); }
            else if (piece.type === 'r') { addSlide([[1,0],[-1,0],[0,1],[0,-1]]); }
            else if (piece.type === 'q') { addSlide([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]); }
            else if (piece.type === 'k') {
                for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
                    if (!df && !dr) continue;
                    const f = f0 + df, r = r0 + dr;
                    if (!inBounds(f, r)) continue;
                    const target = sq(f, r);
                    const occ = this._sq[target];
                    if (!occ) moves.push({ to: target });
                    else if (occ.color !== piece.color) moves.push({ to: target, capture: true });
                }
                const rank = piece.color === 'w' ? 0 : 7;
                if (r0 === rank && f0 === 4 && !this._isAttacked(square, piece.color === 'w' ? 'b' : 'w')) {
                    const kFlag = piece.color === 'w' ? 'K' : 'k';
                    const qFlag = piece.color === 'w' ? 'Q' : 'q';
                    const oppColor = piece.color === 'w' ? 'b' : 'w';
                    if (this._castling[kFlag] && !this._sq[sq(5, rank)] && !this._sq[sq(6, rank)] &&
                        !this._isAttacked(sq(5, rank), oppColor) && !this._isAttacked(sq(6, rank), oppColor)) {
                        moves.push({ to: sq(6, rank), castle: 'k' });
                    }
                    if (this._castling[qFlag] && !this._sq[sq(3, rank)] && !this._sq[sq(2, rank)] && !this._sq[sq(1, rank)] &&
                        !this._isAttacked(sq(3, rank), oppColor) && !this._isAttacked(sq(2, rank), oppColor)) {
                        moves.push({ to: sq(2, rank), castle: 'q' });
                    }
                }
            } else if (piece.type === 'p') {
                const dir = piece.color === 'w' ? 1 : -1;
                const startRank = piece.color === 'w' ? 1 : 6;
                const promoRank = piece.color === 'w' ? 7 : 0;
                const oneF = f0, oneR = r0 + dir;
                if (inBounds(oneF, oneR) && !this._sq[sq(oneF, oneR)]) {
                    moves.push({ to: sq(oneF, oneR), promotion: oneR === promoRank });
                    if (r0 === startRank) {
                        const twoR = r0 + 2 * dir;
                        if (!this._sq[sq(oneF, twoR)]) moves.push({ to: sq(oneF, twoR), doubleStep: true });
                    }
                }
                for (const df of [-1, 1]) {
                    const f = f0 + df, r = r0 + dir;
                    if (!inBounds(f, r)) continue;
                    const target = sq(f, r);
                    const occ = this._sq[target];
                    if (occ && occ.color !== piece.color) moves.push({ to: target, capture: true, promotion: r === promoRank });
                    else if (!occ && target === this._ep) moves.push({ to: target, capture: true, enPassant: true });
                }
            }
            return moves;
        }
        _applyMoveRaw(from, to, opts, promotion) {
            const piece = this._sq[from];
            const captured = this._sq[to] || null;
            let epCaptureSquare = null;
            delete this._sq[from];
            if (opts.enPassant) { epCaptureSquare = sq(fileOf(to), rankOf(from)); delete this._sq[epCaptureSquare]; }
            this._sq[to] = { type: opts.promotion && promotion ? promotion : piece.type, color: piece.color };
            if (opts.castle) {
                const rank = rankOf(from);
                if (opts.castle === 'k') { this._sq[sq(5, rank)] = this._sq[sq(7, rank)]; delete this._sq[sq(7, rank)]; }
                else { this._sq[sq(3, rank)] = this._sq[sq(0, rank)]; delete this._sq[sq(0, rank)]; }
            }
            return { captured, epCaptureSquare };
        }
        _snapshot() {
            return { sq: Object.assign({}, this._sq), castling: Object.assign({}, this._castling), ep: this._ep, halfmove: this._halfmove, fullmove: this._fullmove, turn: this._turn };
        }
        _restore(s) { this._sq = s.sq; this._castling = s.castling; this._ep = s.ep; this._halfmove = s.halfmove; this._fullmove = s.fullmove; this._turn = s.turn; }
        moves(options) {
            const verbose = options && options.verbose;
            const filterSquare = options && options.square;
            const color = this._turn;
            const results = [];
            const squares = filterSquare ? [filterSquare] : Object.keys(this._sq);
            for (const from of squares) {
                const piece = this._sq[from];
                if (!piece || piece.color !== color) continue;
                for (const m of this._pseudoMovesFrom(from)) {
                    const snap = this._snapshot();
                    const { captured } = this._applyMoveRaw(from, m.to, m, 'q');
                    const kingSq = this._kingSquare(color);
                    const legal = !this._isAttacked(kingSq, color === 'w' ? 'b' : 'w');
                    this._restore(snap);
                    if (!legal) continue;
                    if (m.promotion) {
                        for (const promo of ['q', 'r', 'b', 'n']) {
                            results.push(verbose ? { from, to: m.to, promotion: promo, captured: !!m.capture || !!captured, san: null } : (from + m.to + promo));
                        }
                    } else {
                        results.push(verbose ? { from, to: m.to, promotion: null, captured: !!m.capture, castle: m.castle || null, enPassant: !!m.enPassant, san: null } : (from + m.to));
                    }
                }
            }
            return results;
        }
        move(input) {
            let from, to, promotion;
            if (typeof input === 'string') { from = input.slice(0, 2); to = input.slice(2, 4); promotion = input.slice(4) || undefined; }
            else { from = input.from; to = input.to; promotion = input.promotion; }
            const piece = this._sq[from];
            if (!piece || piece.color !== this._turn) return null;
            const legalMoves = this.moves({ square: from, verbose: true });
            const match = legalMoves.find(m => m.to === to && (!m.promotion || m.promotion === (promotion || 'q')));
            if (!match) return null;
            let disambig = '';
            if (piece.type !== 'p' && piece.type !== 'k') {
                const others = [];
                for (const s2 in this._sq) {
                    if (s2 === from) continue;
                    const p2 = this._sq[s2];
                    if (!p2 || p2.color !== piece.color || p2.type !== piece.type) continue;
                    const theirMoves = this.moves({ square: s2, verbose: true });
                    if (theirMoves.some(mv => mv.to === to)) others.push(s2);
                }
                if (others.length) {
                    const sameFile = others.some(s2 => fileOf(s2) === fileOf(from));
                    const sameRank = others.some(s2 => rankOf(s2) === rankOf(from));
                    if (!sameFile) disambig = from[0];
                    else if (!sameRank) disambig = from[1];
                    else disambig = from;
                }
            }
            const snap = this._snapshot();
            const opts = { enPassant: match.enPassant, castle: match.castle, promotion: !!match.promotion };
            const { captured, epCaptureSquare } = this._applyMoveRaw(from, to, opts, promotion || 'q');
            if (piece.type === 'k') { if (piece.color === 'w') { this._castling.K = false; this._castling.Q = false; } else { this._castling.k = false; this._castling.q = false; } }
            if (piece.type === 'r') {
                if (from === 'a1') this._castling.Q = false;
                if (from === 'h1') this._castling.K = false;
                if (from === 'a8') this._castling.q = false;
                if (from === 'h8') this._castling.k = false;
            }
            if (to === 'a1') this._castling.Q = false;
            if (to === 'h1') this._castling.K = false;
            if (to === 'a8') this._castling.q = false;
            if (to === 'h8') this._castling.k = false;
            this._ep = null;
            if (piece.type === 'p' && Math.abs(rankOf(to) - rankOf(from)) === 2) this._ep = sq(fileOf(from), (rankOf(from) + rankOf(to)) / 2);
            this._halfmove = (piece.type === 'p' || captured) ? 0 : this._halfmove + 1;
            if (this._turn === 'b') this._fullmove++;
            this._turn = this._turn === 'w' ? 'b' : 'w';
            const isCapture = !!captured || !!match.enPassant;
            let san;
            if (match.castle === 'k') san = 'O-O';
            else if (match.castle === 'q') san = 'O-O-O';
            else if (piece.type === 'p') { san = (isCapture ? from[0] + 'x' : '') + to; if (match.promotion) san += '=' + (promotion || 'q').toUpperCase(); }
            else { san = piece.type.toUpperCase() + disambig + (isCapture ? 'x' : '') + to; }
            if (this.isCheckmate()) san += '#'; else if (this.inCheck()) san += '+';
            const result = { from, to, color: piece.color, piece: piece.type, captured: captured ? captured.type : (match.enPassant ? 'p' : undefined), promotion: match.promotion ? (promotion || 'q') : undefined, san };
            this._history.push({ snap, result });
            this._fenHistory.push(this.fen());
            return result;
        }
        undo() { const last = this._history.pop(); if (!last) return null; this._restore(last.snap); this._fenHistory.pop(); return last.result; }
        isCheckmate() { return this.inCheck() && this.moves().length === 0; }
        isStalemate() { return !this.inCheck() && this.moves().length === 0; }
        isInsufficientMaterial() {
            const pieces = Object.values(this._sq);
            const nonKing = pieces.filter(p => p.type !== 'k');
            if (nonKing.length === 0) return true;
            if (nonKing.length === 1 && (nonKing[0].type === 'b' || nonKing[0].type === 'n')) return true;
            if (nonKing.length === 2 && nonKing.every(p => p.type === 'b')) {
                const squares = [];
                for (const s in this._sq) if (this._sq[s].type === 'b') squares.push(s);
                const colorOf = s => (fileOf(s) + rankOf(s)) % 2;
                if (squares.length === 2 && colorOf(squares[0]) === colorOf(squares[1])) return true;
            }
            return false;
        }
        isThreefoldRepetition() {
            const counts = {};
            for (const f of this._fenHistory) {
                const key = f.split(' ').slice(0, 4).join(' ');
                counts[key] = (counts[key] || 0) + 1;
                if (counts[key] >= 3) return true;
            }
            return false;
        }
        isDraw() { return this._halfmove >= 100 || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition(); }
    }
    global.Chess = Chess;
})(typeof window !== 'undefined' ? window : this);
