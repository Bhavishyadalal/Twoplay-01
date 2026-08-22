<div align="center">

<img src="https://img.shields.io/badge/🍬_TWOPLAY-FF6FA5?style=for-the-badge&labelColor=FFF8EE&color=FF6FA5" alt="Twoplay" height="60"/>

### games for two, no app needed

**Pick a game → share a 5-digit code → play in real time. That's it.**

[![Made with HTML5](https://img.shields.io/badge/HTML5-single_file-FF6FA5?style=flat-square&logo=html5&logoColor=white)](.)
[![PeerJS](https://img.shields.io/badge/P2P-PeerJS-6C8BFF?style=flat-square&logo=webrtc&logoColor=white)](https://peerjs.com/)
[![No Backend](https://img.shields.io/badge/backend-none-2FBF83?style=flat-square)](.)
[![License](https://img.shields.io/badge/license-MIT-FFB43D?style=flat-square)](LICENSE)

<br/>

<img src="https://img.shields.io/badge/●-FFF8EE?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-FFE6C4?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-FF6FA5?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-A06CFF?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-6C8BFF?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-2FBF83?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-FFB43D?style=flat-square" width="18"/><img src="https://img.shields.io/badge/●-FF5C7A?style=flat-square" width="18"/>

</div>

<br/>

## ✨ What is this

**Twoplay** is a single self-contained HTML file that turns into a whole little arcade for two people. No install, no account, no server to stand up — open it in a browser, generate a room code, send it to a friend, and you're playing. Every move syncs live over a direct **peer‑to‑peer** connection (WebRTC via PeerJS), so there's nothing to host and nothing to maintain.

It ships with a hand-rounded, candy-shop visual language — soft cream surfaces, wobbly "blob" corners, sticker-style offset shadows, and a punchy pastel palette — built to feel more like a toy than a tool.

<br/>

## 🎮 Games on board

<table>
<tr>
<td width="33%" valign="top">

### ⭕ Tic-Tac-Toe
Quick, classic, zero learning curve.

</td>
<td width="33%" valign="top">

### 🔴 Connect 4
Drop discs, sync live, four in a row wins.

</td>
<td width="33%" valign="top">

### ♟️ Chess
Full rules engine — check, checkmate, castling, en passant, threefold repetition — **inlined and dependency-free**, so it plays completely offline.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🔺 Checkers
Traditional board, forced captures, kinged pieces.

</td>
<td width="33%" valign="top">

### 🟢 Reversi / Othello
Flip the board, out-think your opponent.

</td>
<td width="33%" valign="top">

### 🎨 Whiteboard
A shared canvas that draws in real time — pick a color, pick a brush size, doodle together from two different screens.

</td>
</tr>
</table>

<br/>

## 🚀 Getting started

There's no build step. There's no `npm install`. There's one file.

```bash
# Clone it
git clone https://github.com/your-username/twoplay.git
cd twoplay

# Open it — literally just open the HTML file
open working-mainwebsite.html      # macOS
start working-mainwebsite.html     # Windows
xdg-open working-mainwebsite.html  # Linux
```

Or serve it locally if you'd rather not deal with `file://` restrictions:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Deploying is just as simple — drop the file on **GitHub Pages**, **Netlify**, **Vercel**, or any static host. It's one page; it needs nothing else.

<br/>

## 🕹️ How it works

<table>
<tr><td width="60px" align="center"><b>1</b></td><td>Open the site — you're instantly assigned a <b>5-digit room code</b>, generated locally and kept stable across reconnects.</td></tr>
<tr><td align="center"><b>2</b></td><td>Pick a game from the dashboard.</td></tr>
<tr><td align="center"><b>3</b></td><td>Send your friend the code. They type it in and connect directly to you — <b>peer-to-peer</b>, no game server in the middle.</td></tr>
<tr><td align="center"><b>4</b></td><td>Play. Every move, click, and stroke streams over the connection in real time.</td></tr>
</table>

No sign-up. No matchmaking queue. No data leaves your two browsers except the moves you make.

<br/>

## 🛠️ Under the hood

| | |
|---|---|
| **Networking** | [PeerJS](https://peerjs.com/) over WebRTC — direct browser-to-browser data channels |
| **Chess engine** | Custom, dependency-free rules engine inlined in the page — no CDN required, works fully offline |
| **Rendering** | Vanilla JS + CSS, no framework, no bundler |
| **Fonts** | `Baloo 2` (display), `Nunito` (body), `JetBrains Mono` (codes & stats) |
| **State** | LocalStorage for preferences (sound, board theme, move animation, music) |
| **Sync strategy** | Batched, debounced event queues — smooth even on flaky connections |

<br/>

## 🎨 Design language

Twoplay uses a consistent "candy-shop" visual system defined entirely in CSS custom properties — so re-skinning it is mostly a matter of swapping variables.

```css
:root {
  --bg: #FFF8EE;        /* cream base            */
  --surface: #FFFFFF;   /* card surfaces         */
  --text: #2B2440;      /* ink text              */
  --accent: #FF6FA5;    /* signature pink        */

  /* one accent color per game */
  --g-ttt: #6C8BFF;     /* tic-tac-toe — blue    */
  --g-c4: #FFB43D;      /* connect 4 — amber     */
  --g-chk: #FF5C7A;     /* checkers — rose       */
  --g-chess: #A06CFF;   /* chess — violet        */
  --g-rev: #2FBF83;     /* reversi — green       */
  --g-wb: #FF8FC0;      /* whiteboard — pink     */

  /* hand-rounded, wobbly corners instead of uniform border-radius */
  --blob-lg: 32px 24px 36px 20px;

  /* sticker shadows: solid offset color, not a blurred gray */
  --shadow-lift: 5px 6px 0 rgba(43,36,64,0.14);
}
```

No dark mode — by design. It's meant to feel like one warm, consistent room.

<br/>

## 📁 Structure

```
twoplay/
└── working-mainwebsite.html   # everything: markup, styles, game logic, P2P sync
```

Yes, really — one file. Every game controller lives under a shared `GameControllers` registry inside the script, each exposing the same small interface (`init`, `render`, `onData`), which is what makes adding a new game mostly a matter of dropping in a new controller.

<br/>

## 🤝 Contributing

Found a bug, or want to add a game? PRs welcome. Since everything lives in one file, the easiest way in is to find the matching `GameControllers.<name>` block and follow the pattern already there.

<br/>

## 📄 License

MIT — do whatever you'd like with it.

<br/>

<div align="center">

**Built for two people, a shared code, and nothing else.**

</div>
