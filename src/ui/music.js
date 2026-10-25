// ===================================================================
// COZY BACKGROUND MUSIC
// ===================================================================
let musicTracks = [];        // [{ file, title }]
let musicCurrentFile = null; // currently selected file (may not be playing)
let musicIsPlaying = false;
let musicEl = null;
let musicDiscoveryDone = false;

function getMusicEl() {
    if (musicEl) return musicEl;
    musicEl = document.createElement('audio');
    musicEl.id = 'cozy-music-audio';
    musicEl.loop = true;
    musicEl.preload = 'metadata';
    document.body.appendChild(musicEl);
    musicEl.addEventListener('error', () => {
        if (musicIsPlaying) {
            toast("Couldn't play that track.");
            musicIsPlaying = false;
            updateMusicButtons();
        }
    });
    return musicEl;
}

let musicDiscoveryJob = null;
async function discoverMusicTracks() {
    if (musicDiscoveryDone) return musicTracks;
    if (musicDiscoveryJob) return musicDiscoveryJob;
    musicDiscoveryJob = (async () => {
        try {
            const res = await fetch('music/playlist.json', {signal:AbortSignal.timeout(8000)});
            if (!res.ok) throw new Error('Playlist unavailable');
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid playlist');
            musicTracks = data.slice(0,500).flatMap(entry => {
                const file = typeof entry === 'string' ? entry : entry?.file || entry?.name;
                if (typeof file !== 'string' || !/^[^/\\]+\.(mp3|ogg|wav|m4a)$/i.test(file)) return [];
                return [{file:'music/'+file,title:typeof entry?.title === 'string' ? entry.title.slice(0,200) : prettifyTrackName(file)}];
            });
            musicDiscoveryDone = true;
            return musicTracks;
        } catch { return musicTracks; } // A later opening can retry a transient failure.
        finally { musicDiscoveryJob = null; }
    })();
    return musicDiscoveryJob;
}

function prettifyTrackName(filename) {
    return String(filename).replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Track';
}

function loadMusicPrefs() {
    try {
        const savedTrack = localStorage.getItem('twoplay_music_track');
        if (savedTrack) musicCurrentFile = savedTrack;
    } catch (e) {}
}
loadMusicPrefs();

function saveMusicPrefs() {
    try {
        localStorage.setItem('twoplay_music_track', musicCurrentFile || '');
        localStorage.setItem('twoplay_music_playing', musicIsPlaying ? '1' : '0');
    } catch (e) {}
}

async function openMusicPicker() {
    document.getElementById('music-picker-overlay').classList.remove('hidden');
    const listEl = document.getElementById('music-track-list');
    listEl.innerHTML = '<p class="music-empty-msg">Looking for tracks…</p>';
    const tracks = await discoverMusicTracks();
    buildMusicTrackList();
    if (!tracks.length) {
        listEl.innerHTML = '<p class="music-empty-msg">No tracks found. Add mp3 files to a <code>music/</code> folder in the repo (optionally with a <code>playlist.json</code>).</p>';
    }
}
function closeMusicPicker() { document.getElementById('music-picker-overlay').classList.add('hidden'); }

function buildMusicTrackList() {
    const listEl = document.getElementById('music-track-list');
    if (!musicTracks.length) return;
    listEl.innerHTML = '';
    musicTracks.forEach(track => {
        const row = document.createElement('button');
        row.className = 'music-track-row' + (track.file === musicCurrentFile ? ' active' : '');
        const name = document.createElement('span');
        name.className = 'music-track-name';
        name.innerText = track.title;
        row.appendChild(name);
        if (track.file === musicCurrentFile && musicIsPlaying) {
            const playIcon = document.createElement('span');
            playIcon.className = 'music-track-playicon';
            playIcon.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><path d="M9 18V6l11-2v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/></svg>';
            row.appendChild(playIcon);
        }
        row.addEventListener('click', () => playMusicTrack(track.file));
        listEl.appendChild(row);
    });
}

// A monotonically increasing token, not a single shared boolean. The old
// code used one `musicLoadPending` flag and just dropped any click that
// arrived while a previous track was still loading — so picking a track
// while an earlier pick hadn't finished buffering did nothing at all, with
// no error and no feedback ("sometimes doesn't play"). With a token, a
// newer pick always proceeds and simply invalidates the older in-flight
// one instead of being silently swallowed by it.
//
// This also used to wait for the element's 'canplay' event before calling
// play() at all, on the theory that calling play() before the browser had
// buffered enough would get rejected. That wait is what was actually
// breaking playback: play() must run inside (or directly chained from) the
// click handler to count as triggered by a user gesture. Waiting on an
// async, network-driven 'canplay' event breaks that chain, and several
// browsers (Safari/iOS in particular, and Chrome under some autoplay-policy
// states) then reject the later play() call outright — silently, or with a
// generic error, regardless of whether the file is fine. Calling play()
// immediately and letting the element buffer in the background is both the
// correct and the more compatible approach; the returned promise still
// tells us if it actually failed.
let musicLoadToken = 0;
// fromRemote: true when this call is applying the opponent's broadcasted
// choice rather than a local click — suppresses re-broadcasting it back.
function playMusicTrack(file, fromRemote) {
    const el = getMusicEl();
    const isNewTrack = musicCurrentFile !== file || el.getAttribute('src') !== file;
    const token = ++musicLoadToken;

    if (isNewTrack) {
        musicCurrentFile = file;
        el.src = file;
    }

    el.play().then(() => {
        if (token !== musicLoadToken) return; // superseded by a newer pick meanwhile
        musicIsPlaying = true;
        saveMusicPrefs();
        activateCozyPlayer();
        updateMusicButtons();
        buildMusicTrackList();
        startCozyNoteDrip();
        if (!fromRemote) broadcastMusicState();
    }).catch(e => {
        if (token !== musicLoadToken) return; // this attempt is stale; a newer one is in flight
        console.error('Music playback failed:', e);
        if (fromRemote) {
            // No click happened on this side — some browsers (Safari/iOS
            // especially) block programmatic play() without a fresh user
            // gesture even though the file itself is fine. musicCurrentFile
            // is already set to the synced track, so tapping the button
            // now just resumes it rather than erroring again.
            toast(oppName + " started music — tap \u266A to join in.");
        } else {
            toast("Couldn't play that track.");
        }
    });
}

function stopMusic(fromRemote) {
    if (musicEl) musicEl.pause();
    musicIsPlaying = false;
    saveMusicPrefs();
    updateMusicButtons();
    buildMusicTrackList();
    if (!fromRemote) broadcastMusicState();
}

// ---- Sync cozy music between the two players over the game data channel ----
// Both players' browsers already have the same music/ files at the same
// relative URL (same deployment), so syncing just means telling the other
// side which file to play (or to stop) — no audio itself crosses the wire.
function broadcastMusicState() {
    if (!conn || !conn.open) return;
    safeSend(musicIsPlaying && musicCurrentFile
        ? { type: 'music_signal', kind: 'play', file: musicCurrentFile }
        : { type: 'music_signal', kind: 'stop' });
}
async function handleMusicSignal(data) {
    if (data.kind === 'play') await discoverMusicTracks();
    if (data.kind === 'play' && typeof data.file === 'string' && musicTracks.some(t => t.file === data.file)) playMusicTrack(data.file, true);
    else if (data.kind === 'stop') stopMusic(true);
}

function updateMusicButtons() {
    [document.getElementById('music-btn-landing'), document.getElementById('music-btn-game')].forEach(btn => {
        if (!btn) return;
        btn.classList.toggle('playing', musicIsPlaying);
        btn.querySelector('.icon-music-off').classList.toggle('hidden', musicIsPlaying);
        btn.querySelector('.icon-music-on').classList.toggle('hidden', !musicIsPlaying);
        btn.title = musicIsPlaying ? 'Cozy music (playing)' : 'Cozy music';
    });
    updateCozyPlayer();
}

// ===================================================================
// COZY DESKTOP MUSIC PLAYER — floating widget, PC/pointer-fine only.
// Reuses the existing <audio> element (getMusicEl()) and existing
// playMusicTrack()/stopMusic() functions as its single source of
// truth, so this is purely a richer control surface — it never owns
// playback state itself and stays correct whether music was started
// from here, the header note button, the picker overlay, or synced
// in from the opponent's side.
// ===================================================================
let cozyPlayerBound = false;
let cozyPlayerCollapsed = false;
let cozyPlayerRafPending = false;

function cozyPlayerEl() { return document.getElementById('cozy-player'); }

// Once true, the widget stays mounted for the rest of the room session
// even while paused — set the moment the user opens the picker or hits
// play from any entry point, cleared per-room in enterGame() so a fresh
// room that never touched music doesn't get an empty player sitting on
// screen. cozyPlayerDismissed lets the user explicitly close it (the ×
// button) without that being undone by the next timeupdate tick; the
// header note button (or reopening the picker) reactivates it.
let cozyPlayerActivated = false;
let cozyPlayerDismissed = false;
// Separate from cozyPlayerActivated: this one is NOT cleared by the ×
// close button, only by a genuinely new room (resetCozyPlayerForNewRoom).
// It answers "has this player touched cozy music at all this room" so
// applyDesktopArenaDefaults() (PC only) can bring the widget back after
// a reconnect/enterGame() re-run even if it was manually dismissed
// earlier — matching how the header note button and chat both still
// work normally after being closed.
let cozyPlayerEverTouchedThisRoom = false;

// Mirrors isDesktopPointer() from the cursor-picker feature above —
// same signal (fine pointer + real hover), same reasoning: never show
// a mouse-oriented floating widget to a touch device, regardless of
// viewport width (a fine-pointer tablet in narrow split-screen should
// still get it if it clears the CSS breakpoint; a wide phone in
// landscape should not, since pointer stays coarse).
// Persists across play/pause (was previously musicIsPlaying-only, which
// made the widget vanish on pause and forced re-opening the picker just
// to get it back). It only requires: desktop pointer, tracks exist, the
// player has been activated this room, and the user hasn't closed it.
function cozyPlayerShouldShow() {
    return isDesktopPointer() && musicTracks.length > 0 && cozyPlayerActivated && !cozyPlayerDismissed;
}

function activateCozyPlayer() {
    cozyPlayerActivated = true;
    cozyPlayerDismissed = false;
    cozyPlayerEverTouchedThisRoom = true;
    updateCozyPlayer();
}

function dismissCozyPlayer() {
    cozyPlayerDismissed = true;
    updateCozyPlayer();
}

// Called from enterGame() so each fresh room starts clean — the widget
// shouldn't carry over "activated" from a previous room, and shouldn't
// appear pre-emptively before the user has touched cozy music at all.
function resetCozyPlayerForNewRoom() {
    cozyPlayerActivated = false;
    cozyPlayerDismissed = false;
    cozyPlayerEverTouchedThisRoom = false;
    updateCozyPlayer();
}

function ensureCozyPlayerBound() {
    if (cozyPlayerBound) return;
    cozyPlayerBound = true;
    const seek = document.getElementById('cozy-player-seek');
    const vol = document.getElementById('cozy-player-vol');
    const el = getMusicEl();

    let seekDragging = false;
    seek.addEventListener('input', () => {
        seekDragging = true;
        const pct = Number(seek.value);
        seek.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface-3) ${pct}%, var(--surface-3) 100%)`;
        document.getElementById('cozy-player-time-cur').innerText = formatCozyTime((pct / 100) * (el.duration || 0));
    });
    seek.addEventListener('change', () => {
        if (el.duration) el.currentTime = (Number(seek.value) / 100) * el.duration;
        seekDragging = false;
    });
    seek._dragging = () => seekDragging;

    vol.addEventListener('input', () => {
        el.volume = Number(vol.value) / 100;
        updateCozyVolIcon();
        try { localStorage.setItem('twoplay_music_volume', vol.value); } catch (e) {}
    });

    // restore saved volume (defaults to 70 set in markup)
    try {
        const savedVol = localStorage.getItem('twoplay_music_volume');
        if (savedVol != null) { vol.value = savedVol; el.volume = Number(savedVol) / 100; }
        else { el.volume = Number(vol.value) / 100; }
    } catch (e) { el.volume = Number(vol.value) / 100; }
    updateCozyVolIcon();

    el.addEventListener('timeupdate', () => {
        if (seek._dragging && seek._dragging()) return;
        if (!el.duration) return;
        const pct = (el.currentTime / el.duration) * 100;
        seek.value = pct;
        seek.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface-3) ${pct}%, var(--surface-3) 100%)`;
        document.getElementById('cozy-player-time-cur').innerText = formatCozyTime(el.currentTime);
    });
    el.addEventListener('loadedmetadata', () => {
        document.getElementById('cozy-player-time-dur').innerText = formatCozyTime(el.duration);
    });
    el.addEventListener('ended', () => {
        // el.loop is normally true (ambient tracks repeat), but if a
        // future track ever has loop disabled, advance instead of
        // just going silent.
        if (!el.loop) cozyPlayerNext();
    });
}

function formatCozyTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
}

function updateCozyVolIcon() {
    const vol = document.getElementById('cozy-player-vol');
    const icon = document.getElementById('cozy-player-vol-icon');
    if (!vol || !icon) return;
    const v = Number(vol.value);
    icon.innerHTML = v === 0
        ? '<path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
        : '<path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' + (v > 55 ? '<path d="M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>' : '');
}

function updateCozyPlayer() {
    const wrap = cozyPlayerEl();
    if (!wrap) return;
    const show = cozyPlayerShouldShow();
    wrap.classList.toggle('hidden', !show);
    if (!show) return;

    ensureCozyPlayerBound();
    wrap.classList.toggle('is-playing', musicIsPlaying);

    const track = musicTracks.find(t => t.file === musicCurrentFile);
    document.getElementById('cozy-player-track').innerText = track ? track.title : 'Cozy music';

    const playBtn = document.getElementById('cozy-player-playpause-btn');
    playBtn.querySelector('.icon-cozy-play').classList.toggle('hidden', musicIsPlaying);
    playBtn.querySelector('.icon-cozy-pause').classList.toggle('hidden', !musicIsPlaying);
    playBtn.title = musicIsPlaying ? 'Pause' : 'Play';

    if (musicIsPlaying) spawnCozyNote();
}

function toggleCozyPlayerCollapse() {
    cozyPlayerCollapsed = !cozyPlayerCollapsed;
    const wrap = cozyPlayerEl();
    if (wrap) wrap.classList.toggle('collapsed', cozyPlayerCollapsed);
    const btn = document.getElementById('cozy-player-collapse-btn');
    if (btn) btn.title = cozyPlayerCollapsed ? 'Expand' : 'Collapse';
}

function cozyPlayerTogglePlay() {
    if (musicIsPlaying) {
        stopMusic();
    } else if (musicCurrentFile) {
        playMusicTrack(musicCurrentFile);
    } else if (musicTracks.length) {
        playMusicTrack(musicTracks[0].file);
    }
}

function cozyPlayerStep(dir) {
    if (!musicTracks.length) return;
    let idx = musicTracks.findIndex(t => t.file === musicCurrentFile);
    if (idx === -1) idx = 0;
    idx = (idx + dir + musicTracks.length) % musicTracks.length;
    playMusicTrack(musicTracks[idx].file);
}
function cozyPlayerNext() { cozyPlayerStep(1); }
function cozyPlayerPrev() { cozyPlayerStep(-1); }

// A few little music-note particles that drift up from the album art
// while a track plays — purely decorative, capped so they never pile
// up if updateCozyPlayer() fires in a tight loop.
let cozyNoteCount = 0;
function spawnCozyNote() {
    if (cozyNoteCount >= 2) return;
    const art = document.getElementById('cozy-player-art');
    if (!art) return;
    cozyNoteCount++;
    const note = document.createElement('span');
    note.className = 'cozy-note';
    note.textContent = Math.random() < 0.5 ? '♪' : '♫';
    note.style.left = (40 + Math.random() * 20) + '%';
    art.appendChild(note);
    setTimeout(() => { note.remove(); cozyNoteCount--; }, 1800);
}
// Gentle drip of notes while a track is actually playing (not just on
// every state change, which would only fire once per play/pause).
// Gated to the music play/pause lifecycle rather than polling forever —
// most sessions never touch music, so an unconditional interval would
// tick every 2.2s for the whole session for zero visible effect.
let cozyNoteInterval = null;
function startCozyNoteDrip() {
    if (cozyNoteInterval) return;
    cozyNoteInterval = setInterval(() => {
        const wrap = cozyPlayerEl();
        if (wrap && !wrap.classList.contains('hidden') && musicIsPlaying) spawnCozyNote();
        else stopCozyNoteDrip();
    }, 2200);
}
function stopCozyNoteDrip() {
    if (cozyNoteInterval) { clearInterval(cozyNoteInterval); cozyNoteInterval = null; }
}
