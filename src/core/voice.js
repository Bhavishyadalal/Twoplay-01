// ===================================================================
// VOICE CALL — uses PeerJS's own peer.call()/peer.on('call') media-call
// API on the same "peer" object and ICE_CONFIG/TURN already used for the
// game data connection (the proven-working path), instead of a separate
// hand-rolled RTCPeerConnection. Fully independent of the game state:
// never touched by initGame()/switch_game, only torn down on
// leaveRoom() or an explicit "leave call".
// ===================================================================
let voiceMediaCall = null;    // the active PeerJS MediaConnection for voice
let localAudioStream = null;
let voiceInCall = false;
let voiceMuted = false;
let voiceCallId = 0;          // bumped on every setup/teardown so stale async callbacks (mic prompt, negotiation) can detect they're for a dead call
let voiceConnectTimer = null; // if a call never actually connects, tell the user instead of leaving it silently "in call" forever

let voiceLevelInterval = null;
let localAnalyser = null, remoteAnalyser = null;

function voiceSupported() { return !localMode && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

function updateVoiceButtonVisibility() {
    const btn = document.getElementById('voice-call-btn');
    const hangupBtn = document.getElementById('voice-hangup-btn');
    if (btn) btn.classList.toggle('hidden', !voiceSupported());
    if (hangupBtn) hangupBtn.classList.toggle('hidden', !voiceSupported() || !voiceInCall);
}

function setVoiceButtonState() {
    const btn = document.getElementById('voice-call-btn');
    const hangupBtn = document.getElementById('voice-hangup-btn');
    if (!btn) return;
    const onIcon = btn.querySelector('.icon-mic-on');
    const offIcon = btn.querySelector('.icon-mic-off');
    const mutedIcon = btn.querySelector('.icon-mic-muted');
    onIcon.classList.add('hidden'); offIcon.classList.add('hidden'); mutedIcon.classList.add('hidden');
    btn.classList.remove('in-call', 'muted');
    if (hangupBtn) hangupBtn.classList.toggle('hidden', !voiceSupported() || !voiceInCall);
    if (!voiceInCall) {
        offIcon.classList.remove('hidden');
        btn.title = btn.setAttribute('aria-label', 'Start voice call');
        btn.title = 'Start voice call';
    } else if (voiceMuted) {
        mutedIcon.classList.remove('hidden');
        btn.classList.add('in-call', 'muted');
        btn.title = 'Muted — tap to unmute';
        btn.setAttribute('aria-label', 'Muted — tap to unmute');
    } else {
        onIcon.classList.remove('hidden');
        btn.classList.add('in-call');
        btn.title = 'In call — tap to mute';
        btn.setAttribute('aria-label', 'In call — tap to mute');
    }
}

function toggleVoiceCall() {
    if (!voiceSupported()) return;
    if (!voiceInCall) { startVoiceCall(); return; }
    // Already in a call: tapping the header button toggles mute
    // (a long-press-free, single-button control — simplest for mobile).
    toggleVoiceMute();
}

async function startVoiceCall() {
    if (voiceInCall) return;
    if (!conn || !conn.open) { toast('Not connected to your opponent yet.'); return; }
    if (!peer || !peer.open) { toast('Not connected yet — try again in a moment.'); return; }
    const myCallAttempt = ++voiceCallId;
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        console.error('Mic permission denied or unavailable:', e);
        toast("Couldn't access your microphone.");
        return;
    }
    // The mic prompt above can take a while (or the user can meanwhile cancel,
    // or the opponent's own call can arrive and set things up for us). If
    // this attempt is no longer the current one, or we're already in a call,
    // don't clobber it — just release this now-unneeded stream.
    if (myCallAttempt !== voiceCallId || voiceInCall) {
        stream.getTracks().forEach(t => t.stop());
        return;
    }
    localAudioStream = stream;
    voiceInCall = true;
    voiceMuted = false;
    setVoiceButtonState();
    // Use PeerJS's own call() — the exact same signaling/negotiation path
    // (and the exact same PeerJS "peer" object + ICE_CONFIG/TURN) already
    // proven to work for the game's data connection, instead of a second,
    // hand-rolled RTCPeerConnection on a separate TURN provider. This is
    // the same approach the working youtube-sharing call feature uses.
    const remoteId = conn.peer;
    const mediaCall = peer.call(remoteId, stream);
    setupMediaVoiceCall(mediaCall);
    startVoiceLevelMonitor();
    toast('Voice call started.');
}

function setupMediaVoiceCall(call) {
    voiceMediaCall = call;

    call.on('stream', remoteStream => {
        let audioEl = document.getElementById('voice-remote-audio');
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'voice-remote-audio';
            audioEl.autoplay = true;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        // Some mobile browsers hold back autoplay even for a muted-by-default
        // <audio> el created outside a direct user gesture chain; explicitly
        // kick playback so "connected but silent" can't happen here.
        const p = audioEl.play();
        if (p && p.catch) p.catch(() => {});
        setupRemoteLevelAnalyser(remoteStream);
        if (voiceConnectTimer) { clearTimeout(voiceConnectTimer); voiceConnectTimer = null; }
    });

    call.on('close', () => { if (voiceInCall) endVoiceCallLocal(false); });
    call.on('error', e => {
        console.error('Voice call error:', e);
        if (voiceInCall) endVoiceCallLocal(false);
    });

    // Previously a call that never actually connected (e.g. both TURN
    // relays unreachable on a restrictive network) just sat there — the mic
    // icon showed "in call" indefinitely with no error, no audio, and
    // nothing telling the user it had failed. Time out and say so instead.
    if (voiceConnectTimer) clearTimeout(voiceConnectTimer);
    voiceConnectTimer = setTimeout(() => {
        voiceConnectTimer = null;
        const audioEl = document.getElementById('voice-remote-audio');
        if (voiceInCall && (!audioEl || !audioEl.srcObject)) {
            toast("Call couldn't connect. This can happen on some networks — try a different network or Wi-Fi.", 6000);
            endVoiceCallLocal(true);
        }
    }, 20000);
}

function toggleVoiceMute() {
    if (!voiceInCall || !localAudioStream) return;
    voiceMuted = !voiceMuted;
    localAudioStream.getAudioTracks().forEach(t => { t.enabled = !voiceMuted; });
    setVoiceButtonState();
}

function endVoiceCall() {
    if (!voiceInCall) return;
    endVoiceCallLocal(true);
    toast('Left the call.');
}

// silent = don't toast here (caller already toasted, or the caller left first)
function endVoiceCallLocal(silent) {
    voiceCallId++; // invalidate any in-flight getUserMedia()/negotiation from this call
    voiceInCall = false;
    voiceMuted = false;
    if (voiceConnectTimer) { clearTimeout(voiceConnectTimer); voiceConnectTimer = null; }
    stopVoiceLevelMonitor();
    if (voiceMediaCall) { try { voiceMediaCall.close(); } catch (e) {} voiceMediaCall = null; }
    if (localAudioStream) { localAudioStream.getTracks().forEach(t => t.stop()); localAudioStream = null; }
    const audioEl = document.getElementById('voice-remote-audio');
    if (audioEl) { audioEl.srcObject = null; audioEl.remove(); }
    document.querySelectorAll('.player-avatar.speaking').forEach(el => el.classList.remove('speaking'));
    setVoiceButtonState();
}

// ---- Talking indicator: cheap, low-frequency volume polling ----
// Deliberately NOT requestAnimationFrame — polled on a slow setInterval so
// it never competes with the chess canvas's own rAF slide-animation loop.
function setupRemoteLevelAnalyser(stream) {
    try {
        const ctx = ensureAudio();
        if (!ctx) return;
        const src = ctx.createMediaStreamSource(stream);
        remoteAnalyser = ctx.createAnalyser();
        remoteAnalyser.fftSize = 256;
        src.connect(remoteAnalyser);
    } catch (e) { console.error('Remote analyser setup failed:', e); }
}
function setupLocalLevelAnalyser() {
    try {
        const ctx = ensureAudio();
        if (!ctx || !localAudioStream) return;
        const src = ctx.createMediaStreamSource(localAudioStream);
        localAnalyser = ctx.createAnalyser();
        localAnalyser.fftSize = 256;
        src.connect(localAnalyser);
    } catch (e) { console.error('Local analyser setup failed:', e); }
}
function readLevel(analyser) {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / data.length;
}
function startVoiceLevelMonitor() {
    stopVoiceLevelMonitor();
    setupLocalLevelAnalyser();
    const SPEAK_THRESHOLD = 12;
    voiceLevelInterval = setInterval(() => {
        const meEl = document.getElementById('me-avatar');
        const oppEl = document.getElementById('opp-avatar');
        if (meEl) meEl.classList.toggle('speaking', !voiceMuted && readLevel(localAnalyser) > SPEAK_THRESHOLD);
        if (oppEl) oppEl.classList.toggle('speaking', readLevel(remoteAnalyser) > SPEAK_THRESHOLD);
    }, 150);
}
function stopVoiceLevelMonitor() {
    if (voiceLevelInterval) clearInterval(voiceLevelInterval);
    voiceLevelInterval = null;
    localAnalyser = null;
    remoteAnalyser = null;
}

function showRole(role) {
    document.getElementById('tab-host').classList.toggle('active', role === 'host');
    document.getElementById('tab-join').classList.toggle('active', role === 'join');
    document.getElementById('host-panel').style.display = role === 'host' ? 'block' : 'none';
    document.getElementById('join-panel').style.display = role === 'join' ? 'block' : 'none';
}

function copyRoomLink() {
    const id = document.getElementById('my-id-display').innerText;
    const url = `${location.origin}${location.pathname}?room=${id}`;
    if (!/^\d{5}$/.test(id)) { toast('Your room is still connecting. Try again in a moment.'); return; }
    if (!navigator.clipboard?.writeText) { toast('Copy this link: ' + url, 6000); return; }
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copy-link-btn');
        const original = btn.innerHTML;
        btn.innerHTML = '<svg class="btn-icon-sm" style="margin:0 4px 0 0;" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.5 17 19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 1500);
    }).catch(() => toast('Could not copy — select and copy manually.'));
}
function shareRoomLink() {
    const id = document.getElementById('my-id-display').innerText;
    const url = `${location.origin}${location.pathname}?room=${id}`;
    if (!/^\d{5}$/.test(id)) { toast('Your room is still connecting.'); return; }
    if (navigator.share) navigator.share({ title: 'Play with me on Twoplay', url }).catch(() => {});
    else copyRoomLink();
}
