<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:FFF8EE,50:FFE6C4,100:FF9EBE&height=220&section=header&text=Twoplay&fontSize=72&fontColor=2B2440&fontAlignY=42&animation=fadeIn&desc=games%20for%20two%2C%20no%20app%20needed&descAlignY=62&descSize=22&descColor=6B6180"/>

<br>

<a href="#">
  <img src="https://readme-typing-svg.demolab.com?font=Baloo+2&weight=700&size=26&duration=2600&pause=900&color=FF6FA5&center=true&vCenter=true&width=560&lines=One+link.+One+5-digit+code.;No+installs.+No+sign-ups.;No+server+watching+you+play.;Just+open+it+and+go." alt="Typing SVG" />
</a>

<br><br>

<img src="https://img.shields.io/badge/single_file-HTML-FF6FA5?style=for-the-badge&labelColor=2B2440" alt="single file"/>
<img src="https://img.shields.io/badge/networking-WebRTC_P2P-6C8BFF?style=for-the-badge&labelColor=2B2440" alt="webrtc"/>
<img src="https://img.shields.io/badge/backend-none-2FBF83?style=for-the-badge&labelColor=2B2440" alt="no backend"/>
<img src="https://img.shields.io/badge/license-MIT-FFB43D?style=for-the-badge&labelColor=2B2440" alt="MIT"/>

<br>

<sub>Peer‑to‑peer · no signup · no server storage · close the tab and the room is gone</sub>

<br><br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FF6FA5,50:A06CFF,100:6C8BFF&height=3&section=header"/>

</div>

<br>

## 🐈 Meet the mascot

<table>
<tr>
<td width="160" align="center">
<img src="assets/mascot.svg" width="120" alt="animated cat mascot"/>
</td>
<td valign="middle">

That's the header‑bar mascot, redrawn here with its actual idle motion — tail sways, ears twitch, and it blinks on a loop, exactly like it does live in the app. Tap the real one in‑app and it winks; leave it alone and it occasionally strikes a hidden pose (hearts, flowers) before settling back down.

</td>
</tr>
</table>

<br>

## 🕹️ What this actually is

Open the file. A **5‑digit room code** appears. Send it to someone — text it, call it out, whatever. They type it in, their browser dials yours directly over **WebRTC**, and a moment later you're both looking at the same board.

No account system, because there are no accounts. No matchmaking server, because there's no server — the two browsers just talk to each other. Refresh the tab and the game is gone, exactly like a real board game left on a real table.

It's one `.html` file. Markup, styling, six full game engines, a P2P sync layer, synthesized sound effects, and this cat, all in one file — no build step, no bundler, nothing standing between you and the source.

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:6C8BFF,50:2FBF83,100:FFB43D&height=3&section=header"/>

## 🎲 The games

<div align="center">

| | Game | What makes it worth playing |
|:---:|:---|:---|
| ♞ | **Chess** | Hand‑written rules engine, inlined — check, checkmate, castling, en passant, promotion, threefold repetition, all implemented from scratch. Configurable clocks (5 min / 10 min / 3+2 / no limit / custom). Works **fully offline** once loaded. |
| ✕ | **Tic‑Tac‑Toe** | Instant, zero ceremony — perfect for the 30 seconds before a call starts. |
| 🔴 | **Connect 4** | Classic gravity‑drop board, live piece animations synced both ways. |
| ⛃ | **Checkers** | Forced captures, kinged pieces, full board sync. |
| ⬤ | **Reversi** | Pieces visually flip mid‑spin as they change color when captured. |
| 🎨 | **Whiteboard** | Not a game — a shared live canvas. Pick a color, pick a brush, draw; strokes appear on the other screen point‑by‑point, correctly scaled even across mismatched screen sizes. |

</div>

Every one of these speaks the same tiny internal protocol — `init`, `render`, `onData` — registered under a shared `GameControllers` object. One consistent pattern, six games.

<br>

<div align="center">
<img src="assets/pick-card-demo.svg" width="480" alt="game pick card hover animation demo"/>
<br><sub>The actual card‑lift + icon‑spin hover effect from the game picker, looping here so you can see it without opening the app.</sub>
</div>

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FF5C7A,50:FF9EBE,100:FF6FA5&height=3&section=header"/>

## ✨ Beyond the boards

<table>
<tr><td width="50%" valign="top">

**🀄 Pass‑and‑play**
No second device needed — hand the phone across the table.

**🤝 Rematch / draw / resign**
Proper end‑of‑game flow with confirmation dialogs.

**🏆 Session scoreboard**
Wins, losses, and draws tracked across a whole sitting.

**📶 Live connection status**
A status pill + ping display, with automatic reconnect on drop.

</td><td width="50%" valign="top">

**💬 In‑room chat**
Slide‑out drawer, quick‑send presets, free typing.

**🎙️ Optional voice call**
A mic toggle riding the same peer connection.

**🎨 Board themes**
Re‑skin the board without leaving the game.

**🎵 Cozy background music**
In‑app picker that remembers your last track.

</td></tr>
</table>

<div align="center">

**🔊 Zero audio files.** Every move, capture, check, and connect chime is a **Web Audio oscillator synthesized live** — sine, square, sawtooth — including a two‑note pitch‑bent "chirp" when your opponent connects. Nothing to download, nothing to buffer.

</div>

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FFB43D,50:2FBF83,100:6C8BFF&height=3&section=header"/>

## 🚀 Getting it running

No install step. No `npm install`. One file.

```bash
git clone https://github.com/your-username/twoplay.git
cd twoplay

open working-mainwebsite.html        # macOS
start working-mainwebsite.html       # Windows
xdg-open working-mainwebsite.html    # Linux
```

Prefer serving over `http://` instead of `file://`:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Deploy it anywhere static — **GitHub Pages**, **Netlify**, **Vercel**, **Cloudflare Pages**. It's a static page. Nothing runs server‑side, ever.

<br>

## 🔗 How a room actually connects

<div align="center">
<img src="assets/connection-flow.svg" width="640" alt="animated P2P connection diagram"/>
</div>

The 5‑digit code comes from the browser's own PeerJS identity and stays **stable across reconnects** — if the connection blips, the same code still works, instead of silently changing underneath you. Every move, chat line, and whiteboard stroke rides that one channel, batched and debounced so play stays smooth even on a shaky connection.

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:2FBF83,50:6C8BFF,100:A06CFF&height=3&section=header"/>

## 🧱 What's under the hood

| Layer | Approach |
|---|---|
| 🌐 **Networking** | [PeerJS](https://peerjs.com/) over WebRTC — a direct browser‑to‑browser data channel |
| ♟️ **Chess rules** | Hand‑written, dependency‑free engine inlined in the page — offline‑capable |
| 🎨 **Rendering** | Vanilla JavaScript + CSS — no framework, no virtual DOM, no bundler |
| 🔊 **Audio** | Web Audio API oscillators, synthesized on the fly — zero audio assets |
| 💾 **Persistence** | `localStorage` only, only for local prefs — sound, board theme, music track. Game state itself is never stored |
| 🔤 **Fonts** | `Baloo 2` display · `Nunito` body · `JetBrains Mono` codes, clocks, move list |

<br>

## 🎨 The visual language

<div align="center">
<table>
<tr>
<td align="center" width="70"><img src="https://img.shields.io/badge/-FFF8EE?style=for-the-badge" width="60"/><br><sub><code>#FFF8EE</code></sub><br><sub>bg</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-FFFFFF?style=for-the-badge" width="60"/><br><sub><code>#FFFFFF</code></sub><br><sub>surface</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-FF6FA5?style=for-the-badge" width="60"/><br><sub><code>#FF6FA5</code></sub><br><sub>accent</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-A06CFF?style=for-the-badge" width="60"/><br><sub><code>#A06CFF</code></sub><br><sub>chess</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-6C8BFF?style=for-the-badge" width="60"/><br><sub><code>#6C8BFF</code></sub><br><sub>ttt</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-FFB43D?style=for-the-badge" width="60"/><br><sub><code>#FFB43D</code></sub><br><sub>c4</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-2FBF83?style=for-the-badge" width="60"/><br><sub><code>#2FBF83</code></sub><br><sub>reversi</sub></td>
<td align="center" width="70"><img src="https://img.shields.io/badge/-FF5C7A?style=for-the-badge" width="60"/><br><sub><code>#FF5C7A</code></sub><br><sub>checkers</sub></td>
</tr>
</table>
</div>

A warm "candy shop" palette — cream base, ink text, one signature color per game — with no dark mode by design. The shape language is **wobbly, hand‑rounded blobs** instead of uniform `border-radius`, and shadows are solid offset blocks ("sticker shadows") instead of blurred drop shadows, which is most of why the whole UI reads as tactile rather than flat.

```css
:root {
  --bg: #FFF8EE;  --surface: #FFFFFF;  --text: #2B2440;  --accent: #FF6FA5;

  --g-chess: #A06CFF;  --g-ttt: #6C8BFF;  --g-c4: #FFB43D;
  --g-chk:   #FF5C7A;  --g-rev: #2FBF83;  --g-wb: #FF8FC0;

  --blob-lg: 32px 24px 36px 20px;              /* wobbly, hand-rounded */
  --shadow-lift: 5px 6px 0 rgba(43,36,64,0.14); /* solid, not blurred  */
}
```

One variable block, and the entire look cascades from it — re‑skin the app by editing `:root`.

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:A06CFF,50:FF6FA5,100:FFB43D&height=3&section=header"/>

## 📁 Repository layout

```
twoplay/
├── working-mainwebsite.html   ← everything: markup, styles, six game
│                                  engines, P2P sync layer, audio, all of it
└── assets/                    ← animated SVGs used by this README
    ├── mascot.svg
    ├── pick-card-demo.svg
    └── connection-flow.svg
```

The app itself is one file, on purpose — trivially portable, at the cost of some scrolling. The `GameControllers` registry near the bottom of the `<script>` is the map: search `GameControllers.<name>` to find or add a game.

<br>

## 🤝 Contributing

1. Find the matching `GameControllers.<name> = { ... }` block.
2. Match the existing shape — `init`, `render`, `onData`, plus `statusText()` / `canTakeback()` where relevant.
3. Adding a new game? Add it to the `GAMES` config object and the shared UI (pick grid, switcher, local mode) picks it up automatically.

<br>

## 📄 License

MIT — take it, fork it, re‑skin it, ship it.

<br>

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Nunito&weight=600&size=15&duration=3200&pause=1200&color=6B6180&center=true&vCenter=true&width=460&lines=Built+for+two+people%2C+a+shared+code%2C;and+nothing+else+in+between." alt="footer typing" />

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:FF9EBE,50:FFE6C4,100:FFF8EE&height=140&section=footer"/>

</div>
