<div align="center">

<svg width="120" height="120" viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="21" cy="22" rx="12" ry="10.5" fill="#FFF3E4" stroke="#2B2440" stroke-width="1.1"/>
  <path d="M12 15 9 6l7 4Z" fill="#FFE3F0" stroke="#2B2440" stroke-width="1.1"/>
  <path d="M30 15l3-9-7 4Z" fill="#FFE3F0" stroke="#2B2440" stroke-width="1.1"/>
  <rect x="14.5" y="20" width="3.4" height="4.2" rx="1.7" fill="#2B2440"/>
  <rect x="24.1" y="20" width="3.4" height="4.2" rx="1.7" fill="#2B2440"/>
  <path d="M19.3 27c1 .9 2.4.9 3.4 0" stroke="#D14E82" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  <ellipse cx="21" cy="25.3" rx="1.1" ry="0.9" fill="#FF9EBE"/>
</svg>

# Two<em>play</em>

### games for two, no app needed 🎮

**One link. One 5‑digit code. Zero installs, zero sign‑ups, zero servers watching.**

<p>
<img src="https://img.shields.io/badge/single_file-HTML-FF6FA5?style=for-the-badge&labelColor=2B2440" alt="single file"/>
<img src="https://img.shields.io/badge/networking-WebRTC_P2P-6C8BFF?style=for-the-badge&labelColor=2B2440" alt="webrtc"/>
<img src="https://img.shields.io/badge/backend-none-2FBF83?style=for-the-badge&labelColor=2B2440" alt="no backend"/>
<img src="https://img.shields.io/badge/license-MIT-FFB43D?style=for-the-badge&labelColor=2B2440" alt="MIT"/>
</p>

<sub>Peer‑to‑peer · no signup · no server storage · close the tab and the room is gone</sub>

</div>

<br>

<p align="center">
<img src="https://img.shields.io/badge/●-FFF8EE?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-FFE6C4?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-FF6FA5?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-A06CFF?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-6C8BFF?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-2FBF83?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-FFB43D?style=flat-square" width="16" height="16"/><img src="https://img.shields.io/badge/●-FF5C7A?style=flat-square" width="16" height="16"/>
</p>

<br>

## What this actually is

Open the file. A 5‑digit room code appears. Send it to someone — text, call it out, whatever. They type it in, their browser dials yours directly over **WebRTC**, and a moment later you're both looking at the same board.

There's no account system because there are no accounts. There's no matchmaking server because there's no server — the two browsers just talk to each other. Refresh the tab and the game state is gone, exactly like a real board game left on a real table.

It's one `.html` file. Markup, styling, six full game engines, a P2P sync layer, synthesized sound effects, and a hand-drawn cat mascot — all of it, in one file, with no build step and no bundler standing between you and the source.

<br>

## The games

<table>
<tr>
<th align="left">Game</th>
<th align="left">What's inside</th>
</tr>
<tr>
<td valign="top">♞<br><b>Chess</b></td>
<td valign="top">

A complete rules engine written from scratch and inlined directly in the page — not a wrapper around a CDN library. Legal move generation, check/checkmate/stalemate detection, castling (both sides), en passant, promotion, threefold repetition, and insufficient‑material draws are all implemented by hand. Comes with configurable time controls (5 min, 10 min, 3+2, no limit, or fully custom), a move list, and a resign / draw‑offer flow. Because the engine has zero external dependencies, chess still works with **no internet connection** once the page has loaded.

</td>
</tr>
<tr>
<td valign="top">✕<br><b>Tic‑Tac‑Toe</b></td>
<td valign="top">The one everyone already knows. Instant, no ceremony, perfect for the thirty seconds before a call starts.</td>
</tr>
<tr>
<td valign="top">🔴<br><b>Connect&nbsp;4</b></td>
<td valign="top">Classic drop-and-stack gravity board with live piece animations synced between both players.</td>
</tr>
<tr>
<td valign="top">⛃<br><b>Checkers</b></td>
<td valign="top">Standard rules, forced captures, kinged pieces, full board sync.</td>
</tr>
<tr>
<td valign="top">⬤<br><b>Reversi</b></td>
<td valign="top">Othello rules with a satisfying flip animation — pieces visually rotate as they change color, timed to swap mid‑spin.</td>
</tr>
<tr>
<td valign="top">🎨<br><b>Whiteboard</b></td>
<td valign="top">A shared canvas, not a game exactly — pick a color, pick a brush size, draw, and watch strokes appear on the other screen in real time, point by point, with the pointer path faithfully reproduced even when the two screens are different sizes.</td>
</tr>
</table>

Every game shares the same `GameControllers` interface under the hood (`init`, `render`, `onData`) — so switching games mid‑session, or adding a new one, follows one consistent pattern instead of six different ones.

<br>

## Beyond the boards

This isn't just six games stapled together — the shell around them is where a lot of the craft actually lives.

- **Pass‑and‑play mode** — no second device, no connection needed. Hand the phone across the table and play locally.
- **Rematch, draw offers, and resign** — proper end‑of‑game flow with confirmation dialogs, not just a silent reset.
- **Session scoreboard** — tracks wins, losses, and draws across a whole sitting together, so "best of five" actually means something.
- **Live connection status** — a status pill and ping display show exactly what's happening: connecting, waiting for reconnection, or live — with automatic reconnect attempts if the link drops mid‑game.
- **In‑room chat** — a slide‑out drawer with quick‑send canned messages alongside free typing.
- **Optional voice call** — a mic toggle layered on top of the same peer connection, so you can actually talk while you play.
- **Board themes** — swap the visual skin of the board without leaving the game.
- **Cozy background music** — an in‑app music picker with track memory across sessions.
- **Sound effects with zero audio files** — every move, capture, check, and connect chime is synthesized live with the Web Audio API (raw oscillators — sine, square, sawtooth), including a tiny two‑note pitch‑bent "chirp" that plays when your opponent connects. Nothing to download, nothing to load.
- **A cat mascot with moods** — tap the logo in the corner and it winks; it also has hidden idle poses (hearts, flowers) that flip on independently of the base sprite, all built from a single reusable SVG.
- **Copy link / native share** — the room code doubles as a shareable URL, wired into the OS share sheet where available.
- **Mobile‑first responsive chrome** — the header actions collapse into an overflow menu on narrow screens instead of clipping; layout breakpoints specifically account for the room code getting tight on small phones.

<br>

## Getting it running

There is no install step. There is no `npm install`. There is one file.

```bash
git clone https://github.com/your-username/twoplay.git
cd twoplay

# just open it
open working-mainwebsite.html        # macOS
start working-mainwebsite.html       # Windows
xdg-open working-mainwebsite.html    # Linux
```

Prefer serving it over `http://` instead of `file://` (some browser features behave better that way):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Deployment is just as boring, in the best way — drop the file on **GitHub Pages**, **Netlify**, **Vercel**, **Cloudflare Pages**, or literally any static host. It's a static page. It needs nothing on the server side, ever.

<br>

## How a room actually works

```
 you                                          your friend
  │                                                 │
  │  open the page → get a 5-digit code             │
  │───────────────────────────────────────────────► │  "12345"
  │                                                  │
  │                                    types the code, hits Join
  │ ◄─────────────── WebRTC handshake ───────────────│
  │                                                  │
  │ ◄══════════ direct P2P data channel ════════════►│
  │        (moves · chat · draws · voice audio)      │
```

The 5‑digit code is derived from the browser's own PeerJS identity and deliberately kept **stable across reconnects** — so if a host's connection blips, the same code still works to reconnect, instead of silently changing underneath them. Every move, chat message, and whiteboard stroke travels over that one data channel, batched and lightly debounced so play stays smooth even on so‑so connections.

<br>

## What's under the hood

| Layer | Approach |
|---|---|
| **Networking** | [PeerJS](https://peerjs.com/) over WebRTC — a direct browser‑to‑browser data channel, no relay server in the game loop |
| **Chess rules** | Hand‑written, dependency‑free engine inlined in the page — works fully offline |
| **Rendering** | Vanilla JavaScript and CSS — no framework, no virtual DOM, no bundler |
| **Audio** | Web Audio API oscillators, synthesized on the fly — no `.mp3`/`.wav` assets for effects |
| **Persistence** | `localStorage` only, and only for local preferences — sound on/off, board theme, move‑animation style, last music track. Nothing about the game itself is ever stored anywhere |
| **Fonts** | `Baloo 2` for display headlines, `Nunito` for body text, `JetBrains Mono` for room codes, clocks, and the move list |
| **Sync model** | Per‑game controllers speak a tiny shared protocol (`init` / `render` / `onData`) over batched, queued messages |

<br>

## The visual language

Everything is driven by one block of CSS custom properties — a warm, cream "candy shop" palette with a signature pink accent, no dark mode, and a distinctive **wobbly, hand‑rounded shape system** instead of uniform border‑radius. Shadows are solid offset blocks ("sticker shadows") rather than blurred drop shadows, which is most of why the whole thing reads as tactile rather than flat.

```css
:root {
  /* candy-shop palette — cream base, ink text, no dark-mode felt */
  --bg: #FFF8EE;
  --surface: #FFFFFF;
  --text: #2B2440;
  --accent: #FF6FA5;

  /* one signature color per game, used on pick cards and boards */
  --g-chess: #A06CFF;   /* violet   */
  --g-ttt:   #6C8BFF;   /* blue     */
  --g-c4:    #FFB43D;   /* amber    */
  --g-chk:   #FF5C7A;   /* rose     */
  --g-rev:   #2FBF83;   /* green    */
  --g-wb:    #FF8FC0;   /* pink     */

  /* wobbly, hand-rounded blob radii — the signature shape language */
  --blob-lg: 32px 24px 36px 20px;
  --blob-md: 22px 16px 24px 14px;
  --blob-sm: 14px 10px 16px 9px;

  /* sticker-shadow: a solid offset color instead of a gray blur */
  --shadow-lift: 5px 6px 0 rgba(43,36,64,0.14);
  --shadow-pop:  4px 5px 0 var(--accent);
}
```

Because every color and shape lives in one variable block, re‑skinning the entire app — new palette, new accent, new corner style — is mostly a matter of editing this one `:root` and letting it cascade.

<br>

## Repository layout

```
twoplay/
└── working-mainwebsite.html   ← everything: markup, styles, six game
                                   engines, P2P sync layer, audio, all of it
```

One file, on purpose. It keeps the whole project trivially portable — copy it anywhere, open it anywhere, host it anywhere — at the cost of scrolling a bit to find things. The `GameControllers` registry near the bottom of the `<script>` is the map: each game is a self‑contained block registered under its own key, so finding (or adding) a game means searching for `GameControllers.<name>`.

<br>

## Contributing

Bug fixes and new games are both welcome. Since it's a single file, the fastest way in is usually:

1. Find the matching `GameControllers.<name> = { ... }` block for whatever you're touching.
2. Match the existing controller shape (`init`, `render`, `onData`, plus a `statusText()` and `canTakeback()` if relevant).
3. If you're adding a new game, add an entry to the `GAMES` config object and it'll pick up the shared UI (pick grid, switcher, local mode) automatically.

<br>

## License

MIT. Take it, fork it, re‑skin it, ship it.

<br>

<div align="center">
<sub>Built for two people, a shared code, and nothing else in between.</sub>
</div>
