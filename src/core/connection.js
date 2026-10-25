// ===================================================================
// CONNECTION LAYER (WebRTC via PeerJS)
// All game traffic rides one data channel, wrapped in an envelope:
//   { type: 'game', game: 'chess'|'ttt'|'c4'|'checkers', payload: {...} }
// Non-game control messages (init, name, ping, chat, draw/resign/rematch/
// takeback, switch_game) use their own top-level `type` as before.
// ===================================================================
let peer = null;
let conn = null;
let joinTimer = null, joinGeneration = 0;
let gameEpoch = 0, expectedGameSync = null, activeControllerKey = null;
let pendingVoiceCall = null;
let awaitingRoomInit = true;
const pendingResponses = new Set();
function cancelJoin() { joinGeneration++; clearTimeout(joinTimer); joinTimer = null; }
function gameTimeout(callback, delay) {
    const epoch = gameEpoch;
    return setTimeout(() => { if (gameEpoch === epoch) callback(); }, delay);
}
function resetJoinButton() {
    const b = document.getElementById('join-btn');
    if (b) { b.disabled = false; b.textContent = 'Join room'; }
}

function safeSend(payload) {
    if (conn && conn.open) {
        const response = {draw_offer:'draw_response', rematch_request:'rematch_accept', takeback_request:'takeback_accept'}[payload.type];
        if (response) { pendingResponses.add(response); if (payload.type === 'takeback_request') pendingResponses.add('takeback_decline'); }
        try { conn.send(payload); } catch (e) { console.error('Send failed:', e); }
    }
}
// Send a message scoped to the currently active game.
function gameSend(payload) {
    safeSend({ type: 'game', game: currentGame, payload });
}

let lastJoinedCode = null;
let manualDisconnect = false;
let reconnectAttempts = 0;
let autoJoinAttempted = false;
let roomFromUrl = null;
try { roomFromUrl = new URLSearchParams(window.location.search).get('room'); } catch (e) {}

// ---- Reconnection state ----
// myPeerCode is the 5-digit code baked into this browser's own PeerJS id for
// the lifetime of the tab. It's generated once and reused on every peer
// rebuild so a host's room code never silently changes after a signaling
// drop — the other player can still find them at the same address.
let myPeerCode = null;
let inGameSession = false;   // true once enterGame() has run at least once
let reconnecting = false;
let reconnectTimer = null;
const RECONNECT_MAX_ATTEMPTS = 8;

function generateCode() {
    const a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= 4294890000);
    return String(10000 + a[0] % 90000);
}

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:in.relay.metered.ca:80', username: 'c81b9d3c66260e29759cd61f', credential: '4bNc9ueLEH0ocQTZ' },
        { urls: 'turn:in.relay.metered.ca:80?transport=tcp', username: 'c81b9d3c66260e29759cd61f', credential: '4bNc9ueLEH0ocQTZ' },
        { urls: 'turn:in.relay.metered.ca:443', username: 'c81b9d3c66260e29759cd61f', credential: '4bNc9ueLEH0ocQTZ' },
        { urls: 'turns:in.relay.metered.ca:443?transport=tcp', username: 'c81b9d3c66260e29759cd61f', credential: '4bNc9ueLEH0ocQTZ' },
        // ---- Express Turn (free tier) — two credential pairs on the same
        // shared relay host, added as extra fallback candidates alongside
        // the Metered servers above. Purely additive: if these are ever
        // unreachable or rate-limited, the browser just falls back to the
        // other entries in this list, same as it already does today. ----
        { urls: 'turn:free.expressturn.com:3478', username: '000000002101431517', credential: 'st6pOqjUb+CM0yv4KIKHWGoLu7s=' },
        { urls: 'turn:free.expressturn.com:3478?transport=tcp', username: '000000002101431517', credential: 'st6pOqjUb+CM0yv4KIKHWGoLu7s=' },
        { urls: 'turn:free.expressturn.com:3478', username: '000000002102780036', credential: 'fukpn7wwgsKVZ7IAFDkLIO1a3wo=' },
        { urls: 'turn:free.expressturn.com:3478?transport=tcp', username: '000000002102780036', credential: 'fukpn7wwgsKVZ7IAFDkLIO1a3wo=' }
    ]
};

function setMyIdDisplay(text, loading) {
    const full = document.getElementById('my-id-display');
    if (full) { full.innerText = text; full.classList.toggle('loading', !!loading); }
}

// Watchdog: if the signaling handshake (peer.on('open')) hasn't completed
// within a few seconds, PeerJS's own 'error' event doesn't always fire —
// on some networks the socket just sits half-open forever, leaving the UI
// stuck on "connecting…" with no code shown and no way to recover short of
// a manual refresh. This timer forces a retry (or a visible failure after
// enough tries) so a slow/flaky signaling server can't hang the app.
let peerOpenWatchdog = null;
let peerBootAttempts = 0;
const PEER_BOOT_TIMEOUT_MS = 9000;
const PEER_BOOT_MAX_ATTEMPTS = 4;

function clearPeerOpenWatchdog() {
    if (peerOpenWatchdog) { clearTimeout(peerOpenWatchdog); peerOpenWatchdog = null; }
}

function armPeerOpenWatchdog() {
    clearPeerOpenWatchdog();
    peerOpenWatchdog = setTimeout(() => {
        peerOpenWatchdog = null;
        if (peer && peer.open) return; // already connected, nothing to do
        peerBootAttempts++;
        if (peerBootAttempts >= PEER_BOOT_MAX_ATTEMPTS) {
            setMyIdDisplay('Connection timed out — tap to retry', true);
            const idEl = document.getElementById('my-id-display');
            if (idEl) { idEl.onclick = () => { peerBootAttempts = 0; retryPeerBoot(); }; idEl.classList.add('retryable'); }
            return;
        }
        setMyIdDisplay('Still connecting… retrying', true);
        retryPeerBoot();
    }, PEER_BOOT_TIMEOUT_MS);
}

// Tears down whatever's left of a stalled peer and starts fresh, keeping
// the same 5-digit code so an in-progress room invite link still works.
function retryPeerBoot() {
    { const old = peer; peer = null; try { old?.destroy(); } catch {} }
    initPeer(0);
}

function initPeer(attempt) {
    if (typeof Peer === 'undefined') {
        console.error('PeerJS failed to load.');
        setMyIdDisplay('Connection library failed to load', true);
        return;
    }
    // Reuse the same 5-digit code across rebuilds of the peer object (e.g.
    // after a signaling-server drop) so the room address doesn't change
    // mid-session — the other side can still dial the same id to reconnect.
    if (!myPeerCode) myPeerCode = generateCode();
    const code = myPeerCode;
    const previous = peer; peer = null;
    try { previous?.destroy(); } catch {}
    peer = new Peer('twoplay-' + code, { config: ICE_CONFIG, debug: 0 });
    const instance = peer;
    const onCurrentPeer = (event, callback) => instance.on(event, (...args) => { if (peer === instance) callback(...args); });
    armPeerOpenWatchdog();

    onCurrentPeer('open', id => {
        clearPeerOpenWatchdog();
        peerBootAttempts = 0;
        reconnectAttempts = 0;
        const idEl = document.getElementById('my-id-display');
        if (idEl) { idEl.onclick = null; idEl.classList.remove('retryable'); }
        setMyIdDisplay(code, false);
        if (amHost || !inGameSession) rememberRoomCode(code);
        if (roomFromUrl && !autoJoinAttempted) {
            autoJoinAttempted = true;
            showRole('join');
            document.getElementById('join-code-input').value = roomFromUrl;
            setTimeout(doJoin, 300);
        }
        // If we already had a live game session and the underlying peer/socket
        // was rebuilt (not just the data connection), the host side just needs
        // to wait for the joiner to redial — nothing else to do here.
        if (inGameSession) setStatusLabel(amHost ? 'Waiting…' : 'Reconnecting…');
        if (inGameSession && !amHost && lastJoinedCode) attemptJoin(lastJoinedCode);
    });
    onCurrentPeer('connection', c => {
        if ((conn && conn.open) || (inGameSession && lastJoinedCode && c.peer !== 'twoplay-' + lastJoinedCode)) { c.close(); return; }
        amHost = true;
        setupConnection(c);
    });
    // Incoming voice call — mirrors the game peer's own PeerJS call API
    // instead of a separate hand-rolled RTCPeerConnection, so voice rides
    // on the exact same, already-proven TURN path as the game data channel.
    onCurrentPeer('call', incoming => {
        if (!conn?.open || incoming.peer !== conn.peer || localMode || voiceInCall || pendingVoiceCall || !document.getElementById('confirm-overlay').classList.contains('hidden')) { incoming.close(); return; }
        pendingVoiceCall = incoming;
        let acceptedAttempt = 0;
        const dismiss = () => {
            if (pendingVoiceCall !== incoming) { if (acceptedAttempt && voiceCallId === acceptedAttempt && !voiceInCall) voiceCallId++; return; }
            pendingVoiceCall = null; clearTimeout(expiry);
            hideConfirmOverlay();
        };
        incoming.on('close', dismiss);
        incoming.on('error', dismiss);
        const expiry = setTimeout(() => { dismiss(); incoming.close(); }, 30000);
        showConfirm('Voice call', oppName + ' would like to talk.', 'Accept call', async () => {
            if (pendingVoiceCall !== incoming || !conn?.open || incoming.peer !== conn.peer) return;
            pendingVoiceCall = null; clearTimeout(expiry);
            const attempt = ++voiceCallId; acceptedAttempt = attempt;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (attempt !== voiceCallId || !conn?.open || incoming.peer !== conn.peer || voiceInCall) { stream.getTracks().forEach(t => t.stop()); incoming.close(); return; }
                localAudioStream = stream; voiceInCall = true; voiceMuted = false;
                setVoiceButtonState(); incoming.answer(stream); setupMediaVoiceCall(incoming); startVoiceLevelMonitor();
            } catch { incoming.close(); toast('Microphone access was not available.'); }
        }, () => { dismiss(); incoming.close(); });
    });
    onCurrentPeer('disconnected', () => {
        // The signaling socket dropped (peer itself, not the data channel).
        // The existing P2P data connection may still be alive; only rebuild
        // the peer if we truly need to (e.g. it's fully destroyed already).
        if (peer && !peer.destroyed) {
            try { peer.reconnect(); } catch (e) { scheduleFullPeerRebuild(); }
        }
    });
    onCurrentPeer('close', () => {
        if (!manualDisconnect) scheduleFullPeerRebuild();
    });
    onCurrentPeer('error', err => {
        console.error('Peer error:', err);
        // A real error means we don't need the boot watchdog firing on top
        // of whatever recovery path runs below.
        clearPeerOpenWatchdog();
        if (err.type === 'unavailable-id' && attempt < 5) {
            // Our own previous instance hasn't timed out on the signaling
            // server yet. Don't burn a new code — same id, brief retry with
            // an incrementing attempt counter so this eventually gives up.
            setTimeout(() => { if (peer === instance && !manualDisconnect) { if (!inGameSession && !lastJoinedCode) myPeerCode = null; initPeer(attempt + 1); } }, 400);
        } else if (err.type === 'peer-unavailable') {
            if (inGameSession && !amHost) {
                // Opponent hasn't come back online yet — keep retrying quietly
                // instead of surfacing this as a failed join.
                scheduleReconnectRetry();
            } else {
                toast('Room not found. Check the code and try again.');
                const joinBtn = document.getElementById('join-btn');
                if (joinBtn) { joinBtn.disabled = false; joinBtn.innerText = 'Join room'; }
            }
        } else if (inGameSession) {
            scheduleReconnectRetry();
        } else {
            setMyIdDisplay('Connection error — tap to retry', true);
            const idEl = document.getElementById('my-id-display');
            if (idEl) { idEl.onclick = () => { peerBootAttempts = 0; retryPeerBoot(); }; idEl.classList.add('retryable'); }
        }
    });
}

// Fully tears down and recreates the peer object, keeping the same 5-digit
// code, after the signaling connection is unrecoverably gone.
function scheduleFullPeerRebuild() {
    if (manualDisconnect || !inGameSession) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (manualDisconnect) return;
        { const old = peer; peer = null; try { old?.destroy(); } catch {} }
        initPeer(0);
    }, 800);
}

// Retries a join attempt with backoff, up to RECONNECT_MAX_ATTEMPTS, while a
// game is in progress and the connection has dropped.
function scheduleReconnectRetry() {
    if (manualDisconnect || !inGameSession) return;
    reconnectAttempts++;
    if (reconnectAttempts > RECONNECT_MAX_ATTEMPTS) {
        setStatusLabel('Disconnected');
        toast("Couldn't reconnect. " + oppName + ' may have left.', 6000);
        return;
    }
    setStatusLabel('Reconnecting ' + reconnectAttempts + '/' + RECONNECT_MAX_ATTEMPTS);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (manualDisconnect || !inGameSession) return;
        if (amHost) {
            // Host just waits for the joiner to redial; make sure our own
            // peer is actually still reachable.
            if (!peer || peer.destroyed) initPeer(0);
            else if (peer.disconnected) { try { peer.reconnect(); } catch (e) { initPeer(0); } }
        } else if (lastJoinedCode) {
            if (!peer || peer.destroyed) initPeer(0);
            else attemptJoin(lastJoinedCode);
        }
    }, Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), 6000));
}

function doJoin() {
    const codeInput = document.getElementById('join-code-input');
    const code = codeInput.value.trim();
    if (!/^\d{5}$/.test(code)) { toast('Enter a valid 5-digit room code.'); return; }
    myDisplayName = document.getElementById('display-name-input-join').value.trim().slice(0, 18);
    const joinBtn = document.getElementById('join-btn');
    joinBtn.disabled = true; joinBtn.innerText = 'Connecting…';
    lastJoinedCode = code;
    amHost = false;
    rememberRoomCode(code);

    cancelJoin();
    if (!peer || peer.destroyed) initPeer(0);
    attemptJoin(code);
}

// ===================================================================
// ROOM CODE PERSISTENCE — remembers the last room code (joined or
// hosted) so a refresh mid-game can prefill the join box instead of
// forcing the person to dig up the code again. Never auto-rejoins —
// the person still has to press Join.
// ===================================================================
function rememberRoomCode(code) {
    if (!/^\d{5}$/.test(code || '')) return;
    try { localStorage.setItem('twoplay_last_room', code); } catch (e) {}
}
function forgetRoomCode() {
    try { localStorage.removeItem('twoplay_last_room'); } catch (e) {}
}
function prefillLastRoomCode() {
    if (roomFromUrl) return; // an explicit ?room= link always wins
    let saved = null;
    try { saved = localStorage.getItem('twoplay_last_room'); } catch (e) {}
    if (!saved || !/^\d{5}$/.test(saved)) return;
    const input = document.getElementById('join-code-input');
    if (input && !input.value) input.value = saved;
}
function attemptJoin(code) {
    if (!/^\d{5}$/.test(code) || manualDisconnect) return;
    cancelJoin();
    const generation = joinGeneration, started = Date.now();
    function waitForPeer() {
        if (generation !== joinGeneration || manualDisconnect) return;
        if (Date.now() - started > 15000) { resetJoinButton(); setStatusLabel('Connection timed out'); toast('Could not connect. Check the code and try again.'); return; }
        if (!peer || !peer.open) { joinTimer = setTimeout(waitForPeer, 300); return; }
        if (code === myPeerCode) { resetJoinButton(); toast('That is your own room code.'); return; }
        const c = peer.connect('twoplay-' + code, { reliable: true });
        setupConnection(c);
        joinTimer = setTimeout(() => {
            if (generation !== joinGeneration || conn !== c || c.open) return;
            c.close(); resetJoinButton(); setStatus(false); toast('Room did not answer. Ask your friend to keep their tab open.');
        }, 15000);
    }
    waitForPeer();
}

function setupConnection(c) {
    const previous = conn;
    conn = c;
    if (previous && previous !== c) { try { previous.close(); } catch {} }
    manualDisconnect = false;
    setStatus(false);
    setStatusLabel(reconnecting ? 'Reconnecting…' : 'Connecting…');
    const dot = document.getElementById('status-dot');
    if (dot) dot.classList.add('connecting');

    conn.on('open', () => {
        if (conn !== c) return;
        cancelJoin();
        setStatus(true);
        sndConnect();
        const wasReconnect = inGameSession;
        reconnectAttempts = 0;
        reconnecting = false;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        startPing();
        detectConnPath(conn);
        const joinBtn = document.getElementById('join-btn');
        if (joinBtn) { joinBtn.disabled = false; joinBtn.innerText = 'Join room'; }

        if (wasReconnect) {
            // A game was already underway — this is a reconnect, not a fresh
            // room. Don't touch color/game selection or reset the board;
            // just re-announce ourselves and let the resync round-trip
            // restore state on both ends.
            toast('Reconnected!');
            expectedGameSync = currentGame;
            safeSend({ type: 'resync_hello', name: myDisplayName || null });
            if (musicIsPlaying) broadcastMusicState();
            return;
        }

        toast('Connected!');
        inGameSession = true;
        if (amHost) {
            currentGame = hostPickedGame || 'chess';
            const hostWantsColor = chosenColorPref === 'random'
                ? (Math.random() < 0.5 ? 'w' : 'b')
                : chosenColorPref;
            myColor = hostWantsColor;
        }

        enterGame();

        if (amHost) {
            const oppColor = myColor === 'w' ? 'b' : 'w';
            safeSend({
                type: 'room_init',
                game: currentGame,
                theirColor: oppColor,
                minutes: chosenMinutes,
                incSec: chosenInc,
                hostName: myDisplayName || null
            });
            initGame(currentGame, true);
        } else if (myDisplayName) {
            safeSend({ type: 'name', name: myDisplayName });
        }
        if (musicIsPlaying) broadcastMusicState();
    });
    c.on('close', () => { if (conn === c) handleConnClose(); });
    c.on('error', () => { if (conn === c) { resetJoinButton(); setStatusLabel('Connection error'); } });
    let burstStart = Date.now(), burst = 0;
    c.on('data', data => {
        if (conn !== c || !c.open) return;
        if (Date.now() - burstStart > 1000) { burstStart = Date.now(); burst = 0; }
        if (++burst > 300) return;
        handleData(data);
    });
}

function handleConnClose() {
    resetJoinButton();
    voiceCallId++;
    if (pendingVoiceCall) { pendingVoiceCall.close(); pendingVoiceCall = null; hideConfirmOverlay(); }
    stopPing();
    if (voiceInCall) endVoiceCallLocal(true);
    if (manualDisconnect) return;
    setStatus(false);
    if (inGameSession) {
        reconnecting = true;
        toast('Connection lost — reconnecting…', 4000);
        scheduleReconnectRetry();
    } else {
        toast('Connection lost.');
    }
}

function setStatus(isOpen) {
    const dot = document.getElementById('status-dot');
    if (dot) { dot.classList.toggle('on', isOpen); dot.classList.remove('connecting'); }
    setStatusLabel(isOpen ? 'Connected' : 'Disconnected');
    if (!isOpen) { const ping = document.getElementById('ping-display'); if (ping) ping.classList.add('hidden'); }
}
function setStatusLabel(text) { const el = document.getElementById('connection-label'); if (el) el.innerText = text; }

// ---- Latency ping ----
let pingInterval = null, pingSentAt = {}, pingSeq = 0, latencyHistory = [];
function startPing() {
    stopPing();
    pingInterval = setInterval(() => {
        if (!conn || !conn.open) return;
        pingSeq++; pingSentAt[pingSeq] = performance.now();
        safeSend({ type: 'ping', seq: pingSeq });
    }, 2000);
}
function stopPing() { if (pingInterval) clearInterval(pingInterval); pingInterval = null; pingSentAt = {}; }
// Matches the CSS breakpoint above (.ping-display { display:none }) where
// the standalone ping pill is hidden and its info gets folded into the
// status pill's own text instead, so the two pills never fight for space
// next to the logo on phone-width screens.
const MOBILE_PING_MQ = window.matchMedia ? window.matchMedia('(max-width: 520px)') : null;
// Short connection-path tag used only in the compact mobile label —
// "(D)" for a direct P2P route, "(R)" for relayed via TURN. Kept separate
// from connTypeSuffix()'s " · direct"/" · relay" (used in the full-size
// ping pill on wider screens) since there's no room for the full word here.
function connTypeShortTag() {
    if (connPathType === 'direct') return ' (D)';
    if (connPathType === 'relay') return ' (R)';
    return '';
}
function handlePong(seq) {
    const sentAt = pingSentAt[seq];
    if (sentAt == null) return;
    delete pingSentAt[seq];
    const rtt = Math.round(performance.now() - sentAt);
    latencyHistory.push(rtt);
    if (latencyHistory.length > 5) latencyHistory.shift();
    const avg = Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length);
    const isMobile = MOBILE_PING_MQ && MOBILE_PING_MQ.matches;
    const label = document.getElementById('connection-label');
    if (isMobile && label) {
        // e.g. "Connected (R) · 118ms" — one pill, no separate ping badge.
        label.innerText = 'Connected' + connTypeShortTag() + ' · ' + avg + 'ms';
        label.title = connTypeLabel();
    }
    const el = document.getElementById('ping-display');
    if (el) {
        if (isMobile) {
            el.classList.add('hidden');
        } else {
            el.classList.remove('hidden');
            el.innerText = avg + 'ms' + connTypeSuffix();
            el.classList.remove('good', 'ok', 'bad');
            el.classList.add(avg < 80 ? 'good' : avg < 180 ? 'ok' : 'bad');
            el.title = connTypeLabel();
        }
    }
}

// ---- Connection path diagnostic (direct P2P vs relayed via TURN) ----
// Lets you see, per session, whether the browser found a direct route to the
// other player or fell back to relaying through the TURN server. Direct is
// always faster; relay only kicks in when direct is blocked by NAT/firewall.
let connPathType = null; // 'direct' | 'relay' | null (still checking)
function connTypeSuffix() {
    if (connPathType === 'direct') return ' · direct';
    if (connPathType === 'relay') return ' · relay';
    return '';
}
function connTypeLabel() {
    if (connPathType === 'direct') return 'Direct peer-to-peer connection (fastest path)';
    if (connPathType === 'relay') return 'Relayed through TURN server (used when a direct connection is blocked)';
    return 'Detecting connection path…';
}
function detectConnPath(c) {
    connPathType = null;
    try {
        const pc = c && c.peerConnection;
        if (!pc || typeof pc.getStats !== 'function') return;
        const poll = () => {
            pc.getStats(null).then(stats => {
                let activePairId = null;
                stats.forEach(r => {
                    if (r.type === 'transport' && r.selectedCandidatePairId) activePairId = r.selectedCandidatePairId;
                });
                if (!activePairId) {
                    stats.forEach(r => { if (r.type === 'candidate-pair' && r.selected) activePairId = r.id; });
                }
                if (!activePairId) return;
                const pair = stats.get(activePairId);
                if (!pair) return;
                const local = stats.get(pair.localCandidateId);
                const remote = stats.get(pair.remoteCandidateId);
                const isRelay = (local && local.candidateType === 'relay') || (remote && remote.candidateType === 'relay');
                connPathType = isRelay ? 'relay' : 'direct';
            }).catch(() => {});
        };
        poll();
        setTimeout(poll, 2000); // candidate pair can change briefly after connect
    } catch (e) {}
}
