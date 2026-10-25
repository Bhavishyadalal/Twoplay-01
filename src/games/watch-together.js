// ===================================================================
// WATCH TOGETHER (ytsync) — YouTube IFrame API, synced over the room's
// existing PeerJS data channel via gameSend/onData (kind-tagged payloads,
// same envelope convention as every other GameControllers module).
// Ported from a standalone sync-watch build: keeps the drift-corrected
// sync loop, stuck-buffer recovery, and countdown "Play together" start,
// since those fix real mobile playback bugs rather than being decorative.
// ===================================================================
(function () {
    let player = null;
    let playerReady = false;
    let apiLoading = false;
    let currentVideoId = null;
    let queue = []; // { uid, id, title, thumb }

    let syncGeneration = 0;
    let ignoreStateChangeGen = -1;
    const SYNC_DRIFT_THRESHOLD = 2; // seconds — only hard-seek if actually this far off
    const STUCK_BUFFER_MS = 9000;
    let stuckCheckHandle = null;

    const PLAY_TOGETHER_COUNTDOWN_MS = 3000;
    let playTogetherTimer = null;

    function uid() { return 'yt' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
    function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function extractId(raw) {
        const url = (raw || '').trim();
        const patterns = [
            /(?:youtube\.com\/watch\?.*v=)([\w-]{11})/,
            /(?:youtu\.be\/)([\w-]{11})/,
            /(?:youtube\.com\/embed\/)([\w-]{11})/
        ];
        for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
        return /^[\w-]{11}$/.test(url) ? url : null;
    }

    function loadYouTubeApiOnce() {
        if (window.YT && window.YT.Player) { setupPlayer(); return; }
        if (apiLoading) return;
        apiLoading = true;
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            if (typeof prevReady === 'function') prevReady();
            if (currentGame === 'ytsync') setupPlayer();
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => { apiLoading = false; tag.remove(); if (currentGame !== 'ytsync') return; toast('Could not load the video player. Check your connection and try again.'); };
        document.head.appendChild(tag);
    }

    function setupPlayer() {
        if (player) return;
        // origin must be a real http(s) origin YouTube can validate — when
        // this page is opened via file:// or content:// (e.g. straight from
        // a downloaded HTML file rather than a real web server),
        // location.origin is "null" or a non-http scheme, which the iframe
        // API rejects outright with Error 153. Omitting origin entirely in
        // that case still lets the embed work; only pass it when we're
        // actually on http(s).
        const isHttp = /^https?:$/.test(window.location.protocol);
        const vars = { enablejsapi: 1, playsinline: 1, rel: 0 };
        if (isHttp) vars.origin = window.location.origin;
        else console.warn('Twoplay: page is not served over http(s) (protocol is "' + window.location.protocol + '") — YouTube embeds may still fail to load. Serve this file from a real web server (e.g. `npx serve`) instead of opening it directly.');
        player = new YT.Player('yts-player', {
            playerVars: vars,
            events: {
                onReady: () => { playerReady = true; if (currentGame === 'ytsync' && currentVideoId) player.cueVideoById(currentVideoId); },
                onStateChange: onPlayerStateChange,
                onError: onPlayerError
            }
        });
    }

    function onPlayerError(e) {
        const code = e && e.data;
        let msg = 'That video could not be played.';
        if (code === 101 || code === 150) msg = "This video's owner disabled it from playing elsewhere — try another.";
        else if (code === 100) msg = 'That video is private or was removed.';
        else if (code === 2) msg = "That link doesn't point to a valid video.";
        else if (code === 153) msg = /^https?:$/.test(window.location.protocol)
            ? "YouTube blocked embedding here — try another video."
            : "YouTube can't embed video on a page opened this way — open Twoplay from a real web link instead of a downloaded file.";
        toast(msg, code === 153 ? 6000 : 3200);
    }

    function setNowShowing(title) {
        const el = document.getElementById('yts-now-title');
        if (el) el.innerText = title || 'Pick something to watch together';
        const empty = document.getElementById('yts-empty');
        if (empty) empty.style.display = currentVideoId ? 'none' : 'flex';
    }

    function setPlayPauseIcon(isPlaying) {
        const play = document.getElementById('yts-play-icon');
        const pause = document.getElementById('yts-pause-icon');
        if (play) play.classList.toggle('hidden', isPlaying);
        if (pause) pause.classList.toggle('hidden', !isPlaying);
    }

    function onPlayerStateChange(e) {
        if (currentGame !== 'ytsync') return;
        if (e.data === YT.PlayerState.BUFFERING) { armStuckBufferWatch(); return; }
        if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) {
            clearStuckBufferWatch();
            const playing = e.data === YT.PlayerState.PLAYING;
            document.body.classList.toggle('video-playing', playing);
            setPlayPauseIcon(playing);
            if (ignoreStateChangeGen === syncGeneration) { ignoreStateChangeGen = -1; return; }
        }
        if (e.data === YT.PlayerState.PLAYING) {
            gameSend({ kind: 'sync', action: 'play', time: player.getCurrentTime() });
        } else if (e.data === YT.PlayerState.PAUSED) {
            gameSend({ kind: 'sync', action: 'pause', time: player.getCurrentTime() });
        } else if (e.data === YT.PlayerState.ENDED) {
            playNextInQueue();
        }
    }

    function armStuckBufferWatch() {
        clearStuckBufferWatch();
        stuckCheckHandle = setTimeout(() => {
            if (!player || typeof player.getPlayerState !== 'function') return;
            if (player.getPlayerState() === YT.PlayerState.BUFFERING) {
                const hint = document.getElementById('yts-stuck-hint');
                if (hint) hint.classList.remove('hidden');
            }
        }, STUCK_BUFFER_MS);
    }
    function clearStuckBufferWatch() {
        if (stuckCheckHandle) clearTimeout(stuckCheckHandle);
        stuckCheckHandle = null;
        const hint = document.getElementById('yts-stuck-hint');
        if (hint) hint.classList.add('hidden');
    }
    function retryStuck() {
        const hint = document.getElementById('yts-stuck-hint');
        if (hint) hint.classList.add('hidden');
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const t = player.getCurrentTime();
        player.seekTo(t, true);
        player.playVideo();
    }

    function applyRemoteSync(action, time) {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        syncGeneration++;
        ignoreStateChangeGen = syncGeneration;
        const current = player.getCurrentTime();
        if (typeof time === 'number' && Math.abs(current - time) > SYNC_DRIFT_THRESHOLD) player.seekTo(time, true);
        if (action === 'play') player.playVideo();
        else if (action === 'pause') player.pauseVideo();
    }

    function togglePlay() {
        if (!player || typeof player.getPlayerState !== 'function') return;
        if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
        else player.playVideo();
    }
    function seekBy(deltaSec) {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const t = Math.max(0, player.getCurrentTime() + deltaSec);
        player.seekTo(t, true);
        gameSend({ kind: 'sync', action: 'seek', time: t });
    }

    function playTogether() {
        if (!player || typeof player.playVideo !== 'function' || !currentVideoId) { toast('Load a video first.'); return; }
        const startTime = (typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : 0;
        const target = Date.now() + PLAY_TOGETHER_COUNTDOWN_MS;
        gameSend({ kind: 'play_together', target, startTime, videoId: currentVideoId });
        beginCountdown(target, startTime);
    }
    function beginCountdown(target, startTime) {
        if (playTogetherTimer) { clearInterval(playTogetherTimer); playTogetherTimer = null; }
        const overlay = document.getElementById('yts-countdown');
        const numEl = document.getElementById('yts-countdown-num');
        if (overlay) overlay.classList.remove('hidden');
        if (player && typeof player.seekTo === 'function') player.seekTo(startTime, true);
        const tick = () => {
            const msLeft = target - Date.now();
            const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
            if (numEl) numEl.innerText = secLeft > 0 ? secLeft : '▶';
            if (msLeft <= 0) {
                clearInterval(playTogetherTimer); playTogetherTimer = null;
                if (overlay) setTimeout(() => overlay.classList.add('hidden'), 260);
                if (player && typeof player.playVideo === 'function') player.playVideo();
            }
        };
        tick();
        playTogetherTimer = setInterval(tick, 200);
    }

    function playId(id) {
        if (!TwoplayProtocol.videoId(id)) return;
        currentVideoId = id;
        loadYouTubeApiOnce();
        if (player && typeof player.cueVideoById === 'function') player.loadVideoById(id);
        gameSend({ kind: 'video', id });
        fetchVideoMeta(id).then(meta => { if (currentVideoId === id && currentGame === 'ytsync') setNowShowing(meta.title); });
    }

    function loadFromInput() {
        const input = document.getElementById('yts-url-input');
        const id = extractId(input.value);
        if (!id) { toast("Couldn't find a video in that link."); return; }
        input.value = '';
        playId(id);
    }
    function addFromInput() {
        const input = document.getElementById('yts-url-input');
        const id = extractId(input.value);
        if (!id) { toast("Couldn't find a video in that link."); return; }
        input.value = '';
        addToQueue(id);
    }

    function addToQueue(id) {
        if (!TwoplayProtocol.videoId(id) || queue.length >= 100) { toast('Queue is full or the video link is invalid.'); return; }
        const item = { uid: uid(), id, title: null, thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg` };
        queue.push(item);
        renderQueue();
        gameSend({ kind: 'queue_add', item });
        fetchVideoMeta(id).then(meta => {
            item.title = meta.title;
            renderQueue();
            gameSend({ kind: 'queue_update', uid: item.uid, title: meta.title });
        });
    }
    function playNextInQueue() {
        if (queue.length === 0) return;
        const next = queue.shift();
        gameSend({ kind: 'queue_remove', uid: next.uid });
        renderQueue();
        playId(next.id);
    }
    function playQueueItem(uidVal) {
        const item = queue.find(q => q.uid === uidVal);
        if (!item) return;
        queue = queue.filter(q => q.uid !== uidVal);
        gameSend({ kind: 'queue_remove', uid: uidVal });
        renderQueue();
        playId(item.id);
    }
    function removeQueueItem(uidVal) {
        queue = queue.filter(q => q.uid !== uidVal);
        renderQueue();
        gameSend({ kind: 'queue_remove', uid: uidVal });
    }
    function renderQueue() {
        queue = queue.filter(item => { const clean = TwoplayProtocol.queueItem(item); if (!clean) return false; Object.assign(item,clean); return true; }).slice(0,100);
        const wrap = document.getElementById('yts-queue');
        const empty = document.getElementById('yts-queue-empty');
        const count = document.getElementById('yts-queue-count');
        if (!wrap) return;
        if (count) count.innerText = queue.length;
        wrap.querySelectorAll('.yts-queue-item').forEach(el => el.remove());
        if (empty) empty.style.display = queue.length ? 'none' : 'block';
        queue.forEach(item => {
            const row = document.createElement('div');
            row.className = 'yts-queue-item';
            row.innerHTML = `
                <img alt="" loading="lazy">
                <div class="yts-queue-item-meta"><div class="yts-queue-item-title">${escapeHtml(item.title || 'Loading title…')}</div></div>
                <div class="yts-queue-item-btns">
                    <button class="yts-queue-item-btn play" title="Play now" aria-label="Play now">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="yts-queue-item-btn remove" title="Remove" aria-label="Remove">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                </div>`;
            const image = row.querySelector('img');
            image.src = item.thumb;
            image.onerror = () => { image.onerror = null; image.src = `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`; };
            row.querySelector('.play').onclick = () => playQueueItem(item.uid);
            row.querySelector('.remove').onclick = () => removeQueueItem(item.uid);
            wrap.appendChild(row);
        });
    }

    async function fetchVideoMeta(id) {
        try {
            const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
            const data = await res.json();
            if (data && data.title) return { title: data.title };
            throw new Error('no title');
        } catch (e) {
            try {
                const res2 = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
                if (!res2.ok) throw new Error('fallback failed');
                const data2 = await res2.json();
                return { title: data2.title || id };
            } catch (e2) { return { title: id }; }
        }
    }

    /* ---- Search (same GitHub-hosted rotating-key approach as the standalone build) ---- */
    const YT_API_KEY_FILE_URL = 'https://raw.githubusercontent.com/Bhavishyadalal/youtube-sharing/main/api-key.txt';
    let apiKeys = [];
    let currentKeyIndex = 0;
    let keysLoaded = false;
    let keysJob = null;
    function loadApiKeys() {
        if (apiKeys.length) return Promise.resolve();
        if (keysJob) return keysJob;
        keysJob = (async () => {
            try {
                const res = await fetch(YT_API_KEY_FILE_URL, {signal:AbortSignal.timeout(8000)});
                if (!res.ok) return;
                const text = await res.text();
                apiKeys = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).slice(0,20);
            } catch {} finally { keysLoaded = true; keysJob = null; }
        })();
        return keysJob;
    }

    async function ytApiFetch(buildUrl) {
        if (apiKeys.length === 0) return null;
        let tried = 0;
        while (tried < apiKeys.length) {
            const key = apiKeys[currentKeyIndex];
            try {
                const res = await fetch(buildUrl(key),{signal:AbortSignal.timeout(10000)});
                if (res.status === 403 || res.status === 429) {
                    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                    tried++; continue;
                }
                if (!res.ok) return { _httpError: res.status };
                return await res.json();
            } catch (e) { return null; }
        }
        return { _quotaExhausted: true };
    }

    let searchInFlight = false;
    let pendingPick = null;
    let overlayClickBound = false;
    function bindOverlayDismiss() {
        if (overlayClickBound) return;
        overlayClickBound = true;
        const so = document.getElementById('yts-search-overlay');
        const po = document.getElementById('yts-pick-overlay');
        if (so) so.addEventListener('click', e => { if (e.target === so) closeSearch(); });
        if (po) po.addEventListener('click', e => { if (e.target === po) closePick(); });
    }
    function openSearch() {
        bindOverlayDismiss();
        document.getElementById('yts-search-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('yts-search-input').focus(), 50);
    }
    function closeSearch() { document.getElementById('yts-search-overlay').classList.add('hidden'); }
    function setSearchStatus(msg) {
        const el = document.getElementById('yts-search-status');
        el.innerText = msg || '';
    }
    async function runSearch() {
        const q = document.getElementById('yts-search-input').value.trim();
        const resultsEl = document.getElementById('yts-search-results');
        if (!q) { setSearchStatus('Type something to search for.'); return; }
        if (searchInFlight) return;
        searchInFlight = true;
        await loadApiKeys();
        if (currentGame !== 'ytsync') { searchInFlight = false; return; }
        if (keysLoaded && apiKeys.length === 0) { searchInFlight = false; setSearchStatus('Search is unavailable right now — try pasting a link instead.'); return; }
        searchInFlight = true;
        resultsEl.innerHTML = '';
        setSearchStatus('Searching…');
        const data = await ytApiFetch(key =>
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`
        );
        if (currentGame !== 'ytsync') { searchInFlight = false; return; }
        if (!data) setSearchStatus("Couldn't reach YouTube. Check your connection and try again.");
        else if (data._quotaExhausted) setSearchStatus('Search is out of quota for today — try pasting a link instead.');
        else if (data._httpError) setSearchStatus('Search failed. Try again in a moment.');
        else {
            const items = Array.isArray(data.items) ? data.items : [];
            if (items.length === 0) setSearchStatus('No results for "' + q + '".');
            else { setSearchStatus(''); renderSearchResults(items); }
        }
        searchInFlight = false;
    }
    function renderSearchResults(items) {
        const resultsEl = document.getElementById('yts-search-results');
        resultsEl.innerHTML = '';
        items.forEach(it => {
            if (!it.id || !TwoplayProtocol.videoId(it.id.videoId)) return;
            const id = it.id.videoId;
            const title = (it.snippet && it.snippet.title) || id;
            const channel = (it.snippet && it.snippet.channelTitle) || '';
            const thumb = (it.snippet && it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default || {}).url)
                || `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'yts-search-result-card';
            card.innerHTML = `
                <img alt="" loading="lazy">
                <div><div class="yts-sr-title">${escapeHtml(title)}</div><div class="yts-sr-channel">${escapeHtml(channel)}</div></div>`;
            card.querySelector('img').src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
            card.onclick = () => openPick({ id, title, channel, thumb });
            resultsEl.appendChild(card);
        });
    }
    function openPick(item) {
        pendingPick = item;
        document.getElementById('yts-pick-thumb').src = item.thumb;
        document.getElementById('yts-pick-title').innerText = item.title;
        document.getElementById('yts-pick-channel').innerText = item.channel || '';
        document.getElementById('yts-pick-overlay').classList.remove('hidden');
    }
    function closePick() { document.getElementById('yts-pick-overlay').classList.add('hidden'); pendingPick = null; }
    function confirmPick(mode) {
        if (!pendingPick) return;
        const id = pendingPick.id;
        closePick();
        closeSearch();
        if (mode === 'play') playId(id); else addToQueue(id);
    }

    /* ---- GameControllers wiring ---- */
    function init(isHostOrLocal, resetState) {
        loadYouTubeApiOnce();
        if (resetState) { queue = []; currentVideoId = null; setNowShowing(null); }
        renderQueue();
        setPlayPauseIcon(false);
    }
    function onData(payload) {
        if (!payload || typeof payload.kind !== 'string') return;
        switch (payload.kind) {
            case 'video':
                currentVideoId = payload.id;
                loadYouTubeApiOnce();
                if (player && typeof player.cueVideoById === 'function') player.cueVideoById(payload.id);
                fetchVideoMeta(payload.id).then(meta => { if (currentVideoId === payload.id && currentGame === 'ytsync') setNowShowing(meta.title); });
                break;
            case 'sync': applyRemoteSync(payload.action, payload.time); break;
            case 'play_together':
                if (payload.videoId && payload.videoId !== currentVideoId) {
                    currentVideoId = payload.videoId;
                    loadYouTubeApiOnce();
                    if (player && typeof player.cueVideoById === 'function') player.cueVideoById(payload.videoId);
                    fetchVideoMeta(payload.videoId).then(meta => { if (currentVideoId === payload.videoId && currentGame === 'ytsync') setNowShowing(meta.title); });
                }
                beginCountdown(payload.target, payload.startTime || 0);
                break;
            case 'queue_add':
                if (payload.item && !queue.some(q => q.uid === payload.item.uid)) { queue.push(TwoplayProtocol.queueItem(payload.item)); renderQueue(); }
                break;
            case 'queue_remove': queue = queue.filter(q => q.uid !== payload.uid); renderQueue(); break;
            case 'queue_update': { const f = queue.find(q => q.uid === payload.uid); if (f) { f.title = payload.title; renderQueue(); } break; }
            case 'queue_sync': queue = Array.isArray(payload.queue) ? payload.queue.map(TwoplayProtocol.queueItem).filter(Boolean).slice(0,100) : queue; renderQueue(); break;
        }
    }

    function deactivate() {
        clearTimeout(stuckCheckHandle); stuckCheckHandle = null;
        clearInterval(playTogetherTimer); playTogetherTimer = null;
        document.getElementById('yts-countdown')?.classList.add('hidden');
        document.body.classList.remove('video-playing');
        if (playerReady && player?.pauseVideo) player.pauseVideo();
    }
    GameControllers.ytsync = {
        init, onData, deactivate,
        statusText() { return localMode ? 'Solo watch mode' : 'Watching together — it syncs live'; },
        canTakeback() { return false; },
        resync() {
            if (localMode) return;
            gameSend({ kind: 'queue_sync', queue });
            if (currentVideoId) gameSend({ kind: 'video', id: currentVideoId });
            if (playerReady && player && typeof player.getCurrentTime === 'function') {
                const isPlaying = typeof player.getPlayerState === 'function' && player.getPlayerState() === YT.PlayerState.PLAYING;
                const t = player.getCurrentTime();
                gameTimeout(() => gameSend({ kind: 'sync', action: isPlaying ? 'play' : 'pause', time: t }), currentVideoId ? 600 : 0);
            }
        }
    };

    window.YTSync = {
        loadFromInput, addFromInput, togglePlay, seekBy, playTogether, retryStuck,
        openSearch, closeSearch, runSearch, confirmPick, closePick
    };
})();
