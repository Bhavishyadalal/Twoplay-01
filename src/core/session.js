// ===================================================================
// SETUP CONTROLS (landing page)
// ===================================================================
let myDisplayName = '';
document.getElementById('display-name-input').addEventListener('input', e => { myDisplayName = e.target.value.trim().slice(0, 18); });

let hostPickedGame = 'chess';
buildGamePickGrid('host-game-pick', (key, card, grid) => {
    grid.querySelectorAll('.game-pick-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    hostPickedGame = key;
    document.getElementById('chess-options').classList.toggle('hidden', key !== 'chess');
});
document.querySelector('#host-game-pick .game-pick-card[data-game="chess"]').classList.add('active');
document.getElementById('chess-options').classList.remove('hidden');

let chosenMinutes = 5, chosenInc = 0;
document.querySelectorAll('.time-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.time-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const customRow = document.getElementById('custom-time-row');
        if (btn.id === 'custom-time-opt') {
            customRow.classList.remove('hidden'); customRow.style.display = 'flex'; readCustomTime();
        } else {
            customRow.classList.add('hidden');
            chosenMinutes = parseInt(btn.dataset.min, 10);
            chosenInc = parseInt(btn.dataset.inc, 10);
        }
    });
});
function readCustomTime() {
    const m = parseInt(document.getElementById('custom-min').value, 10);
    const i = parseInt(document.getElementById('custom-inc').value, 10);
    chosenMinutes = Number.isFinite(m) && m > 0 ? Math.min(m,180) : 5;
    chosenInc = Number.isFinite(i) && i >= 0 ? Math.min(i,300) : 0;
}
document.getElementById('custom-min').addEventListener('input', readCustomTime);
document.getElementById('custom-inc').addEventListener('input', readCustomTime);

let chosenColorPref = 'random';
document.querySelectorAll('.color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chosenColorPref = btn.dataset.color;
    });
});

// ===================================================================
// HUB STATE — shared across all games
// ===================================================================
let amHost = false;
let myColor = 'w';        // 'w' = player 1 / goes first, 'b' = player 2
let oppName = 'Opponent';
let gameEnded = false;
let currentGame = 'chess';
let localMode = false;    // true = solo pass-and-play, no PeerJS involved

let whiteMs = 5 * 60 * 1000, blackMs = 5 * 60 * 1000, incrementMs = 0, noTimeLimit = false;
let clockInterval = null, clockLastTick = null;

// Per-game controller objects populate this. Each must implement:
//   init(isHost), render(), onData(payload), destroy(), usesClock,
//   requestTakeback() [optional], localReset()
const GameControllers = {};
window.GameControllers = GameControllers; // top-level const isn't a window property by default — external modules write via window.GameControllers[ID], so bridge it explicitly

function openLocalPicker() {
    buildGamePickGrid('local-picker-grid', (key) => { closeLocalPicker(); enterLocalMode(key); });
    document.getElementById('local-picker-overlay').classList.remove('hidden');
}
function closeLocalPicker() { document.getElementById('local-picker-overlay').classList.add('hidden'); }

function enterLocalMode(game) {
    if (conn?.open) { toast('Leave your online room before playing locally.'); return; }
    cancelJoin(); manualDisconnect = true; clearPeerOpenWatchdog();
    const previous = peer; peer = null; try { previous?.destroy(); } catch {}
    // Bypasses initPeer/connectToPeer entirely — no signaling server, no
    // waiting on a friend. safeSend() stays a no-op since conn is never
    // set, so existing move/game-end code needs no branching to work locally.
    localMode = true;
    currentGame = game;
    myDisplayName = document.getElementById('display-name-input').value.trim();
    oppName = 'Player 2';
    myColor = 'w';

    if (game === 'chess') {
        const selected = document.querySelector('.time-opt.active');
        if (selected) {
            const min = parseInt(selected.dataset.min, 10);
            const inc = parseInt(selected.dataset.inc, 10) || 0;
            if (min === -1) {
                readCustomTime();
            } else { chosenMinutes = min; chosenInc = inc; }
        }
        noTimeLimit = chosenMinutes === 0;
        whiteMs = blackMs = chosenMinutes * 60 * 1000;
        incrementMs = chosenInc * 1000;
    }

    lastJoinedCode = 'LOCAL';
    enterGame();
    document.getElementById('opp-name').innerText = oppName;
    const banner = document.getElementById('preview-banner');
    if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = 'Solo mode — pass the device to play both sides. <button onclick="location.reload()">Exit</button>';
    }
    initGame(currentGame, true);
    setStatusLabel('On this device');
    document.getElementById('chat-drawer').classList.add('hidden');
}

function enterGame() {
    document.body.classList.add('playing');
    window.scrollTo({top:0,behavior:'instant'});
    const landing = document.getElementById('landing');
    landing.classList.add('leaving');
    setTimeout(() => { landing.style.display = 'none'; }, 240);
    const landingSig = document.getElementById('landing-signature');
    if (landingSig) landingSig.style.display = 'none';
    document.getElementById('app').classList.add('live');
    document.getElementById('mini-room-code').innerText = 'Room ' + (lastJoinedCode || document.getElementById('my-id-display').innerText);
    loadRoomThemeForCurrentRoom();
    document.getElementById('me-name').innerText = myDisplayName || 'You';
    document.getElementById('opp-name').innerText = oppName;
    resetSessionScore();
    updateAvatars();
    setStatusLine();
    updateVoiceButtonVisibility();
    updateCursorButtonVisibility();
    const landingMusicBtn = document.getElementById('music-btn-landing');
    if (landingMusicBtn) landingMusicBtn.classList.add('hidden');
    resetCozyPlayerForNewRoom();
    applyDesktopArenaDefaults();
}

// PC-only conveniences applied the moment either player lands in the game
// arena — gated on isDesktopPointer() so touch devices keep the normal
// tap-to-open chat and tap-cozy-music-to-summon-widget flow untouched.
// 1) Auto-opens the chat drawer for both players so nobody has to click
//    the chat icon first — on wide desktop viewports this is the docked
//    side panel (see the 1240px "Desktop docked chat" rule above), so it
//    doesn't eat into the board area even left open the whole game.
// 2) Re-shows the cozy player if this player already touched music
//    earlier in the room (see cozyPlayerEverTouchedThisRoom below) —
//    without this, resetCozyPlayerForNewRoom() above would otherwise
//    only reset at the true start of a room, but a first-time desktop
//    visitor who turned music on, then reloaded/reconnected mid-room,
//    would have to reopen the picker again for no reason.
function applyDesktopArenaDefaults() {
    if (localMode || !isDesktopPointer()) return;
    const chatDrawer = document.getElementById('chat-drawer');
    if (chatDrawer) chatDrawer.classList.remove('hidden');
    if (cozyPlayerEverTouchedThisRoom) activateCozyPlayer();
}

function updateAvatars() {
    const meAv = document.getElementById('me-avatar');
    const oppAv = document.getElementById('opp-avatar');
    const meP = myColor === 'w' ? 'p1' : 'p2';
    const oppP = myColor === 'w' ? 'p2' : 'p1';
    const glyphs = { chess: ['♔', '♚'], ttt: ['✕', '○'], c4: ['●', '●'], checkers: ['⛀', '⛂'], reversi: ['⚪', '⚫'], whiteboard: ['🖌️', '🖌️'], ytsync: ['🍿', '🍿'], ludo: ['🔵', '🟡'] };
    const g = glyphs[currentGame] || ['●', '●'];
    meAv.className = 'player-avatar ' + (myColor === 'w' ? 'white' : 'black');
    meAv.innerText = myColor === 'w' ? g[0] : g[1];
    oppAv.className = 'player-avatar ' + (myColor === 'w' ? 'black' : 'white');
    oppAv.innerText = myColor === 'w' ? g[1] : g[0];
}

// ===================================================================
// GAME LIFECYCLE — swap the active game panel in/out
// ===================================================================
function initGame(key, resetState) {
    if (!Object.hasOwn(GAMES, key)) return;
    if (activeControllerKey) GameControllers[activeControllerKey]?.deactivate?.();
    activeControllerKey = key;
    pendingResponses.clear();
    gameEpoch++; stopClock();
    if (resetState) { expectedGameSync = amHost ? null : key; if (localMode) myColor = 'w'; }
    Object.keys(GAMES).forEach(k => document.getElementById('stage-' + k).classList.add('hidden'));
    document.getElementById('stage-' + key).classList.remove('hidden');
    currentGame = key;
    gameEnded = false;
    updateAvatars();

    const usesClock = key === 'chess';
    document.querySelectorAll('.player-clock').forEach(el => el.style.display = usesClock ? '' : 'none');
    document.getElementById('takeback-btn').style.display = (key === 'chess' || key === 'checkers' || key === 'reversi') ? '' : 'none';

    // Whiteboard and Watch Together are free-form shared panels, not
    // win/lose games — the Draw/Takeback/Resign row and quick-chat "gg"
    // style actions don't apply, so hide the whole action row instead of
    // leaving dead buttons.
    const actionRow = document.getElementById('action-row');
    if (actionRow) actionRow.style.display = (key === 'whiteboard' || key === 'ytsync') ? 'none' : '';

    if (!GameControllers[key]) { toast('That game isn\'t ready yet.'); return; }
    GameControllers[key].init(amHost || localMode, resetState !== false);
    updateActionButtons();
    setStatusLine();
    if (usesClock) startClockIfNeeded(); else stopClock();
}

// ---- Game switcher overlay (mid-room) ----
function openGameSwitcher() {
    if (localMode) { openLocalSwitcherDirect(); return; }
    buildGamePickGrid('switcher-grid', (key) => {
        closeSwitcher();
        showConfirm('Switch to ' + GAMES[key].name + '?', 'This starts a fresh game for both players.', 'Switch', () => {
            safeSend({ type: 'switch_game', game: key });
            currentGame = key;
            initGame(key, true);
            resetSessionScore();
            toast('Switched to ' + GAMES[key].name);
        });
    });
    const grid = document.getElementById('switcher-grid');
    const activeCard = grid.querySelector(`[data-game="${currentGame}"]`);
    if (activeCard) activeCard.classList.add('active');
    document.getElementById('switcher-overlay').classList.remove('hidden');
}
function openLocalSwitcherDirect() {
    buildGamePickGrid('switcher-grid', (key) => {
        closeSwitcher();
        currentGame = key;
        initGame(key, true);
        resetSessionScore();
        toast('Switched to ' + GAMES[key].name);
    });
    document.getElementById('switcher-overlay').classList.remove('hidden');
}
function closeSwitcher() { document.getElementById('switcher-overlay').classList.add('hidden'); }

// ===================================================================
// INCOMING DATA DISPATCH
// ===================================================================
function handleData(data) {
    try {
        if (!TwoplayProtocol.message(data)) return;
        if (['draw_response','rematch_accept','takeback_accept','takeback_decline'].includes(data.type)) {
            if (!pendingResponses.delete(data.type)) return;
            if (data.type.startsWith('takeback_')) { pendingResponses.delete('takeback_accept'); pendingResponses.delete('takeback_decline'); }
        }
        switch (data.type) {
            case 'room_init':
                if (amHost || !awaitingRoomInit) return;
                awaitingRoomInit = false; expectedGameSync = data.game;
                myColor = data.theirColor;
                chosenMinutes = data.minutes; chosenInc = data.incSec;
                if (data.hostName) { oppName = data.hostName; document.getElementById('opp-name').innerText = oppName; }
                if (myDisplayName) safeSend({ type: 'name', name: myDisplayName });
                if (data.game === 'chess') {
                    whiteMs = data.minutes * 60 * 1000; blackMs = data.minutes * 60 * 1000;
                    incrementMs = (data.incSec || 0) * 1000; noTimeLimit = data.minutes === 0;
                }
                enterGame();
                initGame(data.game, false); // board state arrives via the game's own init payload next
                break;
            case 'name':
                oppName = data.name || 'Opponent';
                document.getElementById('opp-name').innerText = oppName;
                break;
            case 'ping': safeSend({ type: 'pong', seq: data.seq }); break;
            case 'pong': handlePong(data.seq); break;
            case 'chat': displayChat(data.msg, false); sndNotify(); break;
            case 'reaction': spawnFloatingReaction(data.emoji, false); break;
            case 'switch_game':
                currentGame = data.game;
                initGame(data.game, true);
                resetSessionScore();
                toast(oppName + ' switched the game to ' + GAMES[data.game].name);
                break;
            case 'draw_offer':
                showConfirm('Draw offer', `${oppName} is offering a draw.`, 'Accept', () => {
                    safeSend({ type: 'draw_response', accepted: true });
                    endGame('Draw', 'Agreed by both players.', 'draw');
                });
                sndNotify();
                break;
            case 'draw_response':
                if (data.accepted) endGame('Draw', 'Agreed by both players.', 'draw');
                else { setStatusLineText('Draw offer declined.'); toast('Draw declined.'); }
                break;
            case 'resign':
                endGame('You win', `${oppName} resigned.`, 'win');
                break;
            case 'rematch_request':
                showConfirm('Rematch?', `${oppName} wants to play again.`, 'Accept', () => {
                    safeSend({ type: 'rematch_accept' });
                    startRematch(false);
                });
                sndNotify();
                break;
            case 'rematch_accept': startRematch(true); break;
            case 'takeback_request':
                showConfirm('Takeback request', `${oppName} wants to undo the last move.`, 'Accept', () => {
                    safeSend({ type: 'takeback_accept' });
                    if (GameControllers[currentGame] && GameControllers[currentGame].doLocalTakeback) GameControllers[currentGame].doLocalTakeback();
                }, () => { safeSend({ type: 'takeback_decline' }); });
                sndNotify();
                break;
            case 'takeback_accept':
                if (GameControllers[currentGame] && GameControllers[currentGame].doLocalTakeback) GameControllers[currentGame].doLocalTakeback();
                toast('Takeback accepted.');
                break;
            case 'takeback_decline': toast('Takeback declined.'); break;
            case 'timeout_claim':
                endGame(data.winner === myColor ? 'You win' : 'You lose', 'On time.', data.winner === myColor ? 'win' : 'lose');
                break;
            case 'game':
                if (data.game !== currentGame) return;
                if (data.payload.kind === 'sync' && data.game !== 'ytsync') {
                    if (expectedGameSync !== data.game) return;
                    expectedGameSync = null;
                }
                if (GameControllers[data.game] && GameControllers[data.game].onData) GameControllers[data.game].onData(data.payload);
                break;
            case 'music_signal': handleMusicSignal(data); break;
            case 'resync_hello':
                if (amHost) expectedGameSync = null;
                if (!amHost) { if (myDisplayName) safeSend({type:'name', name:myDisplayName}); return; }
                // The other side just reconnected. Send them everything needed
                // to restore the session without resetting anything on our end:
                // name, current game + board state, clock, and score.
                if (data.name) { oppName = data.name; document.getElementById('opp-name').innerText = oppName; }
                if (myDisplayName) safeSend({ type: 'name', name: myDisplayName });
                safeSend({
                    type: 'resync_state',
                    game: currentGame,
                    theirColor: myColor === 'w' ? 'b' : 'w',
                    whiteMs, blackMs, incrementMs, noTimeLimit, chosenMinutes, chosenInc,
                    sessionScore: { me: sessionScore.opp, opp: sessionScore.me, draws: sessionScore.draws },
                    gameEnded
                });
                {
                    const ctrl = GameControllers[currentGame];
                    if (ctrl && ctrl.resync) ctrl.resync();
                }
                break;
            case 'resync_state':
                if (amHost || !expectedGameSync) return;
                // We reconnected mid-session (same tab, JS state intact) and
                // the other side sent us the live session state. Restore it
                // without resetting anything — the game's own resync
                // sync-payload (sent alongside this) fills in the board.
                myColor = data.theirColor;
                currentGame = data.game;
                whiteMs = data.whiteMs; blackMs = data.blackMs;
                incrementMs = data.incrementMs; noTimeLimit = data.noTimeLimit;
                if (Number.isFinite(data.chosenMinutes)) chosenMinutes = data.chosenMinutes;
                if (Number.isFinite(data.chosenInc)) chosenInc = data.chosenInc;
                if (data.sessionScore) sessionScore = data.sessionScore;
                updateAvatars();
                initGame(currentGame, false);
                gameEnded = data.gameEnded;
                updateSessionScoreUI();
                updateClockDisplay();
                if (currentGame === 'chess' && !noTimeLimit && !gameEnded) startClockIfNeeded();
                updateActionButtons();
                setStatusLine();
                break;
        }
    } catch (e) { console.error('Failed to handle incoming data:', e, data); }
}

// ---- Clocks (chess only) ----
function startClockIfNeeded() {
    stopClock();
    if (currentGame !== 'chess' || noTimeLimit) { updateClockDisplay(); return; }
    clockLastTick = Date.now();
    clockInterval = setInterval(tickClock, 150);
}
function stopClock() { if (clockInterval) clearInterval(clockInterval); clockInterval = null; }
function tickClock() {
    if (gameEnded || noTimeLimit || currentGame !== 'chess') { stopClock(); return; }
    const chessCtrl = GameControllers.chess;
    if (!chessCtrl || !chessCtrl.chess) return;
    const now = Date.now();
    const delta = now - clockLastTick;
    clockLastTick = now;
    if (chessCtrl.chess.turn() === 'w') whiteMs = Math.max(0, whiteMs - delta);
    else blackMs = Math.max(0, blackMs - delta);
    updateClockDisplay();
    if (whiteMs === 0 || blackMs === 0) {
        const loser = whiteMs === 0 ? 'w' : 'b';
        const winner = loser === 'w' ? 'b' : 'w';
        stopClock(); gameEnded = true;
        safeSend({ type: 'timeout_claim', winner });
        endGame(winner === myColor ? 'You win' : 'You lose', 'On time.', winner === myColor ? 'win' : 'lose');
    }
}
function fmtClock(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
}
function updateClockDisplay() {
    const usesClock = currentGame === 'chess';
    const meEl = document.getElementById('me-clock'), oppEl = document.getElementById('opp-clock');
    if (!usesClock) { meEl.innerText = ''; oppEl.innerText = ''; return; }
    const meMs = myColor === 'w' ? whiteMs : blackMs;
    const oppMs = myColor === 'w' ? blackMs : whiteMs;
    meEl.innerText = noTimeLimit ? '∞' : fmtClock(meMs);
    oppEl.innerText = noTimeLimit ? '∞' : fmtClock(oppMs);
    meEl.classList.toggle('low', !noTimeLimit && meMs < 20000);
    oppEl.classList.toggle('low', !noTimeLimit && oppMs < 20000);
    const chessCtrl = GameControllers.chess;
    const myTurn = chessCtrl && chessCtrl.chess ? chessCtrl.chess.turn() === myColor : false;
    meEl.classList.toggle('active', myTurn && !gameEnded);
    oppEl.classList.toggle('active', !myTurn && !gameEnded);
    document.getElementById('me-card').classList.toggle('turn', myTurn && !gameEnded);
    document.getElementById('opp-card').classList.toggle('turn', !myTurn && !gameEnded);
}

// ---- Status line ----
function setStatusLine() {
    if (gameEnded) { updateHandoffBanner(); return; }
    const ctrl = GameControllers[currentGame];
    const text = (ctrl && ctrl.statusText) ? ctrl.statusText() : '';
    setStatusLineText(text);
    updateHandoffBanner();
}
function setStatusLineText(text) { document.getElementById('status-line').innerText = text || ''; }

// ---- Pass-and-play turn handoff (local mode only) ----
// Local-mode game controllers set myColor to whoever's turn it is and call
// updateAvatars()/setStatusLine() on every turn change (see e.g. chess's
// `if (localMode) { myColor = chess.turn(); updateAvatars(); }`), so hooking
// this into setStatusLine() covers every game without touching each one.
const HANDOFF_GLYPHS = { chess: ['♔ White', '♚ Black'], ttt: ['✕', '○'], c4: ['Yellow', 'Red'], checkers: ['Light', 'Dark'], reversi: ['Light', 'Dark'], ludo: ['🔵 Teal', '🟡 Mustard'] };
function updateHandoffBanner() {
    const banner = document.getElementById('handoff-banner');
    if (!banner) return;
    const glyphs = HANDOFF_GLYPHS[currentGame];
    if (!localMode || gameEnded || !glyphs) { banner.classList.add('hidden'); return; }
    const whoseTurn = myColor === 'w' ? glyphs[0] : glyphs[1];
    banner.innerText = 'Pass the device — ' + whoseTurn + "'s turn";
    banner.classList.remove('hidden');
}

// ---- End game / overlay ----
let finishedEpoch = -1;
function endGame(title, sub, kind, winnerColor) {
    if (finishedEpoch === gameEpoch) return;
    finishedEpoch = gameEpoch;
    gameEnded = true;
    stopClock();
    sndEnd();
    vibrate(kind === 'win' || (localMode && kind === 'win') ? [30, 40, 30, 40, 80] : kind === 'draw' ? [40] : [15]);
    const h2 = document.getElementById('end-title');
    h2.innerText = title;
    h2.className = kind || '';
    document.getElementById('end-sub').innerText = sub;

    const summary = document.getElementById('end-summary');
    const g = { chess: ['♔', '♚'], ttt: ['✕', '○'], c4: ['●', '●'], checkers: ['⛀', '⛂'], reversi: ['⚪', '⚫'], ludo: ['🔵', '🟡'] }[currentGame] || ['●', '●'];
    const meGlyph = myColor === 'w' ? g[0] : g[1];
    const oppGlyph = myColor === 'w' ? g[1] : g[0];

    // In local (pass-and-play) mode there's no "me" — determine who actually
    // won from winnerColor so the correct avatar lights up. Online, kind
    // ('win'/'lose'/'draw') already reflects this player's outcome.
    let meWins, oppWins;
    if (kind === 'draw') { meWins = true; oppWins = true; }
    else if (localMode && winnerColor) { meWins = winnerColor === myColor; oppWins = !meWins; }
    else { meWins = kind === 'win'; oppWins = kind === 'lose'; }

    if (kind === 'win' || (localMode && meWins && !oppWins)) { fireConfetti(); setCatPose('heart', 4000); }
    recordSessionResult(kind, winnerColor);

    summary.innerHTML = `
        <div class="end-avatar ${meWins ? 'winner' : ''}" style="${meWins ? '' : 'opacity:0.5;'}">${meGlyph}</div>
        <span class="vs">VS</span>
        <div class="end-avatar ${oppWins ? 'winner' : ''}" style="${oppWins ? '' : 'opacity:0.5;'}">${oppGlyph}</div>
    `;
    document.getElementById('end-overlay').classList.add('show');
    document.getElementById('end-overlay').classList.remove('hidden');
    updateActionButtons();
}
function closeEndOverlay() { document.getElementById('end-overlay').classList.add('hidden'); }

function updateActionButtons() {
    const ctrl = GameControllers[currentGame];
    document.getElementById('draw-btn').disabled = gameEnded;
    document.getElementById('resign-btn').disabled = gameEnded;
    const canTakeback = ctrl && ctrl.canTakeback ? ctrl.canTakeback() : false;
    document.getElementById('takeback-btn').disabled = gameEnded || !canTakeback;
}

// ---- Game actions ----
function offerDraw() {
    if (gameEnded) return;
    if (localMode) { endGame('Draw', 'Agreed by both players.', 'draw'); return; }
    safeSend({ type: 'draw_offer' });
    setStatusLineText('Draw offer sent.');
    toast('Draw offer sent.');
}
function confirmResign() {
    if (gameEnded) return;
    showConfirm('Resign?', "You'll lose this game immediately.", 'Resign', () => {
        if (!localMode) safeSend({ type: 'resign' });
        stopClock();
        endGame('You lose', 'You resigned.', 'lose');
    });
}
function requestTakeback() {
    if (gameEnded) return;
    const ctrl = GameControllers[currentGame];
    if (!ctrl || !ctrl.canTakeback || !ctrl.canTakeback()) return;
    if (localMode) { ctrl.doLocalTakeback(); return; }
    safeSend({ type: 'takeback_request' });
    toast('Takeback request sent.');
}
function requestRematch() {
    closeEndOverlay();
    if (localMode) { startRematch(true); return; }
    safeSend({ type: 'rematch_request' });
    setStatusLineText('Rematch request sent.');
    toast('Rematch request sent.');
}
function confirmLeaveRoom() {
    showConfirm('Leave room?', "You'll return to the home screen and the connection will end.", 'Leave', leaveRoom);
}
function leaveRoom() {
    cancelJoin(); gameEpoch++; voiceCallId++;
    if (pendingVoiceCall) { pendingVoiceCall.close(); pendingVoiceCall = null; }
    manualDisconnect = true;
    inGameSession = false;
    reconnecting = false;
    reconnectAttempts = 0;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopClock();
    stopPing();
    if (voiceInCall) endVoiceCallLocal(true);
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null;
    forgetRoomCode();
    Object.keys(ROOM_THEMES).forEach(k => document.body.classList.remove('room-theme-' + k));
    // A fresh reload is the simplest reliable way back to a clean landing
    // state — the app's boot path already handles first-load setup, so we
    // don't need to hand-unwind every piece of live-game UI/state here.
    location.href = location.pathname;
}
function startRematch(iAmInitiator) {
    gameEnded = false;
    closeEndOverlay();
    if (!localMode) myColor = myColor === 'w' ? 'b' : 'w'; // swap colors each rematch for fairness
    if (currentGame === 'chess') { whiteMs = noTimeLimit ? 0 : chosenMinutes * 60 * 1000; blackMs = whiteMs; }
    updateAvatars();
    initGame(currentGame, true);
    setCatPose('flowers', 3400);
    toast(localMode ? 'Rematch started.' : 'Rematch started — colors swapped.');
}

// ---- Confirm overlay (generic) ----
let confirmCallback = null, confirmCancelCallback = null;
function showConfirm(title, sub, yesLabel, onYes, onCancel) {
    if (pendingVoiceCall && yesLabel !== 'Accept call') { const call = pendingVoiceCall; pendingVoiceCall = null; call.close(); }
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-sub').innerText = sub;
    document.getElementById('confirm-yes-btn').innerText = yesLabel;
    confirmCallback = onYes;
    confirmCancelCallback = onCancel || null;
    document.getElementById('confirm-overlay').classList.remove('hidden');
}
function hideConfirmOverlay() { document.getElementById('confirm-overlay').classList.add('hidden'); confirmCallback = null; confirmCancelCallback = null; }
function closeConfirm() { const cb = confirmCancelCallback; hideConfirmOverlay(); if (cb) cb(); }
document.getElementById('confirm-yes-btn').addEventListener('click', () => { const cb = confirmCallback; hideConfirmOverlay(); if (cb) cb(); });

// ---- Chat ----
function toggleChat() { document.getElementById('chat-drawer').classList.toggle('hidden'); }
function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    if (!localMode) safeSend({ type: 'chat', msg });
    displayChat(msg, true);
    input.value = '';
}
function sendQuickChat(msg) {
    if (localMode) { toast('No opponent to chat with in solo mode.'); return; }
    safeSend({ type: 'chat', msg });
    displayChat(msg, true);
}
function displayChat(msg, isMe) {
    if (typeof msg !== 'string' || !msg.trim()) return;
    msg = msg.slice(0, 1000);
    const log = document.getElementById('chat-log');
    const empty = log.querySelector('.chat-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isMe ? ' me' : '');
    div.innerText = msg;
    log.appendChild(div);
    while (log.children.length > 200) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
}

// ===================================================================
// FLOATING REACTIONS
// ===================================================================
const REACTION_EMOJIS = ['😂', '😮', '🔥', '❤️', '👏', '😢', '😡', '🎉'];

function buildReactionTray() {
    const el = document.getElementById('reaction-tray');
    if (!el) return;
    el.innerHTML = '';
    REACTION_EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerText = emoji;
        btn.setAttribute('aria-label', 'Send ' + emoji);
        btn.addEventListener('click', () => sendReaction(emoji));
        el.appendChild(btn);
    });
}
function openReactionsPicker() {
    buildReactionTray();
    document.getElementById('reactions-overlay').classList.remove('hidden');
}
function closeReactionsPicker() { document.getElementById('reactions-overlay').classList.add('hidden'); }

function sendReaction(emoji) {
    if (!localMode) safeSend({ type: 'reaction', emoji });
    spawnFloatingReaction(emoji, true);
    closeReactionsPicker();
}
// isMe just biases the horizontal spawn spot (left for opponent, right for
// you) so simultaneous reactions from both sides don't stack on top of
// each other; the reaction layer itself never blocks the board or
// bottom UI (see #reaction-layer's `bottom` inset).
function spawnFloatingReaction(emoji, isMe) {
    const layer = document.getElementById('reaction-layer');
    if (!layer || !emoji) return;
    const span = document.createElement('span');
    span.className = 'floating-reaction';
    span.innerText = emoji;
    const side = isMe ? (60 + Math.random() * 24) : (16 + Math.random() * 24); // % from left
    span.style.left = side + '%';
    span.style.animationDuration = (2.2 + Math.random() * 0.8) + 's';
    layer.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
    // Safety net in case animationend never fires (e.g. tab backgrounded).
    setTimeout(() => { if (span.isConnected) span.remove(); }, 3600);
}

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', e => {
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (!document.getElementById('app').classList.contains('live')) return;
    if (e.key === 'Escape') { const ctrl = GameControllers[currentGame]; if (ctrl && ctrl.onEscape) ctrl.onEscape(); }
    else if (e.key.toLowerCase() === 'f') { const ctrl = GameControllers[currentGame]; if (ctrl && ctrl.flip) ctrl.flip(); }
});
