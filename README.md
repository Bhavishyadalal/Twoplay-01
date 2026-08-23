# 🐾 Twoplay — Design & Animation Bible

> *Games for two, no app needed.* One self-contained HTML file, zero build step, and an obsessive amount of hand-tuned motion, sound, and color hiding inside it. This document is the complete map of every visual, audio, and interaction system in the codebase — what exists, why it exists, and exactly where to find it.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Shape Language — "Wobbly Blobs"](#4-shape-language--wobbly-blobs)
5. [Shadow & Depth System](#5-shadow--depth-system)
6. [The Cat Mascot](#6-the-cat-mascot)
7. [Full Animation Catalog (49 keyframes)](#7-full-animation-catalog-49-keyframes)
8. [Board Themes (20 total)](#8-board-themes-20-total)
9. [Chess Move-Animation Engine (9 physics curves)](#9-chess-move-animation-engine-9-physics-curves)
10. [Room Themes](#10-room-themes)
11. [Sound Design — Synthesized WebAudio](#11-sound-design--synthesized-webaudio)
12. [Haptics](#12-haptics)
13. [Per-Game Visual Systems](#13-per-game-visual-systems)
14. [Floating Reactions](#14-floating-reactions)
15. [Ambient & Desktop Decoration](#15-ambient--desktop-decoration)
16. [Glassmorphism & Adaptive Rendering](#16-glassmorphism--adaptive-rendering)
17. [Motion & Performance Discipline](#17-motion--performance-discipline)
18. [Responsive & Accessibility Design](#18-responsive--accessibility-design)
19. [Feature Index](#19-feature-index)
20. [File Map (where to find things)](#20-file-map-where-to-find-things)

---

## 1. Design Philosophy

Twoplay's visual identity is **"candy-shop cozy"** — a warm, cream-and-pink palette with hand-rounded, slightly imperfect shapes (never a perfect `border-radius: 50%` rectangle when a wobbly blob will do), sticker-style offset shadows instead of soft gray blur, and a mascot that actually reacts to what's happening in the game.

Every animation in this app answers one question: **does this make the moment feel better, or is it just motion for motion's sake?** Confetti fires on a win. The cat winks when you tap it. A captured chess piece doesn't just vanish — it bursts. Nothing animates infinitely without a reason (see [§17](#17-motion--performance-discipline)), and everything respects `prefers-reduced-motion`.

There is **no dark mode** by design — `color-scheme: light` is hardcoded at the `<html>` level. The room-theme system (§10) is the closest thing to a "theme switcher," and even its darkest option (Midnight) is a deliberate reskin, not a true dark-mode pass.

---

## 2. Color System

All colors live as CSS custom properties on `:root`, so every component reads from the same palette — nothing is hardcoded inline except a handful of intentional one-offs (board squares, confetti particles, piece gradients).

### Core palette

| Token | Value | Role |
|---|---|---|
| `--bg` | `#FFF8EE` | Page background — warm cream |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--surface-2` | `#FFF1DC` | Secondary surfaces (inputs, chips) |
| `--surface-3` | `#FFE6C4` | Tertiary / hover states |
| `--text` | `#2B2440` | Primary ink — deep plum, not black |
| `--text-dim` | `#6B6180` | Secondary text |
| `--text-faint` | `#9C93AC` | Placeholder / disabled |
| `--accent` | `#FF6FA5` | Signature bubblegum pink |
| `--live` | `#2FBF83` | Online / success green |
| `--danger` | `#FF5C5C` | Destructive actions |
| `--info` | `#6C8BFF` | Informational blue |

### Per-game accent colors

Each game gets its own identity color, used for its icon, active-state glow, and board frame:

| Game | Token | Color |
|---|---|---|
| Tic-Tac-Toe | `--g-ttt` | `#6C8BFF` (blue) |
| Connect 4 | `--g-c4` | `#FFB43D` (amber) |
| Checkers | `--g-chk` | `#FF5C7A` (rose) |
| Chess | `--g-chess` | `#A06CFF` (violet) |
| Reversi | `--g-rev` | `#2FBF83` (green) |
| Whiteboard | `--g-wb` | `#FF8FC0` (candy pink) |
| Watch Together | `--g-yt` | `#FF4D6D` (red) |

Every accent also ships a `-dim` variant (e.g. `--accent-dim: rgba(255,111,165,0.16)`) — a translucent wash used for active-state backgrounds, focus rings, and glows, so accent colors never need a second hardcoded value for their "soft" version.

Game-picker cards use a scoped CSS variable trick: `--gc`/`--gc-dim` are set per `[data-game]` attribute and consumed generically by `.game-pick-card.active`, so one rule handles all seven games' active states.

---

## 3. Typography

Three typefaces, each with a specific job:

- **`Baloo 2`** (`--font-display`) — rounded, chunky, playful. Used for the logo, headings, and anything that should feel like a sticker.
- **`Nunito`** (`--font-body`) — the workhorse body font. Rounded terminals keep it visually consistent with Baloo 2 without competing for attention.
- **`JetBrains Mono`** (`--font-mono`) — chess move notation, the room code, ping display. Anything that's technically "data" gets a monospace treatment for scannability.

Fonts load via `<link rel="preconnect">` to Google Fonts for fast first paint, with a local `@font-face` fallback (`local('Arial Rounded MT Bold')`) so the display font degrades gracefully offline.

---

## 4. Shape Language — "Wobbly Blobs"

Instead of uniform `border-radius`, most cards and buttons use **asymmetric four-corner radii** to feel hand-drawn rather than machine-perfect:

```css
--blob-lg: 32px 24px 36px 20px;   /* large cards, overlays */
--blob-md: 22px 16px 24px 14px;   /* medium panels, avatars */
--blob-sm: 14px 10px 16px 9px;    /* buttons, chips, pills */
```

Standard symmetric radii (`--radius-xl` through `--radius-sm`) exist alongside these for elements that genuinely need to look uniform (inputs, board cells). The blend of "wobbly where it's decorative, precise where it's functional" is deliberate.

---

## 5. Shadow & Depth System

No soft gray `box-shadow` blur anywhere. Twoplay uses **sticker shadows** — solid-color offset shadows that mimic a die-cut sticker sitting slightly above the page:

```css
--shadow-lift: 5px 6px 0 rgba(43,36,64,0.14);   /* overlays, floating cards */
--shadow-soft: 3px 4px 0 rgba(43,36,64,0.10);   /* buttons, chips */
--shadow-pop:  4px 5px 0 var(--accent);          /* accent-colored pop */
```

Primary buttons take this further with a **pressable shadow**: `.btn-primary` has `box-shadow: 0 4px 0 #D14E82` (a darker shade of the accent) and on `:active` the button translates down while the shadow disappears — a tactile "button is being pushed into the page" effect, all in pure CSS.

---

## 6. The Cat Mascot

The header logo isn't a static image — it's an inline SVG with a full micro-animation rig:

- **Idle loop**: subtle sway (`catSway`), independent left/right ear twitch (`catEarL`/`catEarR`), a blink cycle (`catBlink`), and a tail curl (`catTail`) — four separate small keyframes running concurrently so the idle state never looks robotic or perfectly looped.
- **Tap-to-wink**: tapping the mascot badge fires `toggleCatWink()`, layering a one-shot `catWink` + `catBounce` class for a single satisfied blink-and-bounce, independent of the idle-loop animations underneath.
- **Reactive poses**: `setCatPose(pose, holdMs)` swaps the cat's paws and held item for a timed duration. Two poses currently exist:
  - **`heart`** — paws hold a heart charm; triggered on winning a game (`fireConfetti()` calls `setCatPose('heart', 4000)`) and on starting a rematch.
  - **`flowers`** — paws hold a small flower bouquet; triggered on other celebratory moments (e.g. rematch starts).
- **Cost-aware**: the mascot's animations are explicitly *excluded* from the touch-device "kill infinite animations" rule (see [§17](#17-motion--performance-discipline)) — it's judged cheap enough (two small transform/opacity loops on a tiny SVG) to be worth keeping even on low-power phones, because it's core to the "calm and playful" identity.

---

## 7. Full Animation Catalog (49 keyframes)

Every `@keyframes` block in the file, grouped by purpose:

### Ambient / background
`daFloat1`, `daFloat2`, `daFloat3`, `daDrift1`, `daDrift2` — slow-drifting decorative blobs and ghost-piece glyphs for wide desktop viewports (see [§15](#15-ambient--desktop-decoration)).

### Mascot
`catSway`, `catEarL`, `catEarR`, `catBlink`, `catTail`, `catBounce`, `catWink`, `catHeartBeat` — the cat's idle rig and reactive poses (see [§6](#6-the-cat-mascot)).

### Page & panel transitions
`dropIn` (header brand entrance), `appIn` (game shell mount), `landingOut` (landing screen exit when a room starts), `fadeUp`, `bounceIn` (overlay cards), `overlayBgIn` (modal scrim fade), `iconPop`.

### Status & connection
`pulseDot` (connecting state), `dotSteady` (steady "live" pulse once connected), `scorePop` (session score bump).

### Interaction feedback
`optSelect` (time/color option picked), `animDotPreview` (move-animation picker preview dots), `toastIn`/`toastOut` (notification toasts), `chatDrawerIn`/`chatMsgIn` (chat panel + message bubbles), `pickBounce` (countdown number bounce for "Play together" sync).

### Chess board
`checkPulse` (red radial pulse on a king in check), `selectPulse` (square selection flash), `lastFade` (last-move highlight fade-in), `markerPop` (legal-move dot pop-in), `pieceIntro` (piece drop-in on board load).

### Game-specific
`markIntro` (Tic-Tac-Toe ✕/○ placement), `winCellGlow` (Tic-Tac-Toe winning line), `c4Drop` (Connect 4 disc physics drop), `c4WinGlow` (Connect 4 winning line), `chkPieceIntro`/`chkSettle`/`chkCaptureBurst` (Checkers piece entrance, landing settle, capture burst), `revPieceIntro`/`revPlace`/`revFlip` (Reversi piece entrance, placement pop, the signature flip-in-place animation for captured discs).

### Watch Together
`ytsFloat`, `ytsPulse` (live "now playing" pulse).

### Quality-of-life additions
`floatReaction` — the rising, fading, rotating arc floating reaction emoji travel through (2.2–3.0s randomized duration, eased with a 3-keyframe scale/opacity curve so emoji pop in, hold, then dissolve near the top).
`handoffPulse` — the soft glow-ring pulse on the "pass the device" banner in solo pass-and-play mode, so the turn prompt stays noticeable without being obnoxious.

---

## 8. Board Themes (20 total)

Chess board appearance is fully swappable, independently per player (each side sees their own choice — it's a personal display preference, never synced over the connection). Each theme defines light/dark square colors plus matching last-move, selection, and check-highlight tints so nothing clashes:

`Classic` · `Midnight` · `Candy Pop` · `Royal Marble` · `Wood Deluxe` · `Mono Ink` · `Neon Grid` · `Sunset` · `Fresh Mint` · `Lavender Dream` · `Deep Ocean` · `Forest Floor` · `Desert Dune` · `Glacier Ice` · `Molten Lava` · `Sakura` · `Gemstone` · `Autumn Leaves` · `Vintage Sepia` · `High Contrast`

Each renders as a live 4×4 checkerboard swatch in the picker grid (built dynamically, not pre-rendered images) — what you see in the swatch is generated from the exact same color values the board itself uses.

---

## 9. Chess Move-Animation Engine (9 physics curves)

This isn't CSS transitions — it's a **hand-written easing/offset engine** driving canvas-rendered piece movement, with 9 selectable feels:

| Key | Name | Duration | Character |
|---|---|---|---|
| `slide` | Smooth Slide | 160ms | Cubic ease-out glide |
| `snap` | Quick Snap | 90ms | Linear, instant-feeling |
| `bounce` | Bouncy | 320ms | Elastic overshoot via exponential-decay sine |
| `hop` | Arc Hop | 260ms | Parabolic arc — piece lifts mid-move |
| `elastic` | Elastic | 380ms | Full spring elastic-out curve |
| `spin` | Spin Drop | 300ms | Piece scales up from 70% *and* rotates a full 360° while sliding |
| `pop` | Pop In | 180ms | Overshoots past 100% scale then settles |
| `glide` | Floaty Glide | 420ms | Smoothstep easing with a gentle vertical float |
| `teleport` | Teleport | 200ms | Piece shrinks to nothing, then grows back in at the destination |
| `none` | Instant | 1ms | No animation, for competitive/low-motion preference |

Each entry defines its own `ease(t)` timing function *and* its own `offset(t, dx, dy)` position function — meaning duration, easing curve, and motion path (straight line vs. arc vs. scale-and-rotate vs. teleport) are all independently swappable per style. The picker grid previews each with a small pulsing dot so you can preview the *feel*, not just read a name.

---

## 10. Room Themes

A separate, lighter-weight theming layer from board themes — this one recolors the **entire game shell** (background + accent color) for a room, saved per-room-code so different games with different friends can remember different looks:

| Theme | Background | Accent |
|---|---|---|
| Classic | `#FFF8EE` cream | `#FF6FA5` pink |
| Sunset | `#FFF3E9` peach | `#FF7A45` orange |
| Mint | `#EAFBF3` pale green | `#1FAE7A` emerald |
| Lavender | `#F4F0FF` pale violet | `#8A63F2` purple |
| Midnight | `#232041` deep indigo | `#7FA8FF` periwinkle |
| Sun | `#FFF9E3` pale yellow | `#F2B705` gold |

Implemented as CSS custom-property overrides on `<body>` (e.g. `body.room-theme-sunset { --bg: ...; --accent: ...; }`), so every component that already reads `var(--bg)`/`var(--accent)` — buttons, highlights, chat bubbles — recolors automatically with zero additional per-component CSS. Midnight deliberately *doesn't* touch `--text`/`--surface`, keeping modal/overlay text readable against their hardcoded white glass background.

---

## 11. Sound Design — Synthesized WebAudio

**Zero audio files.** Every sound effect is a synthesized tone generated live via the Web Audio API (`AudioContext` + `OscillatorNode`), keeping the whole app to one HTML file with no asset folder for SFX.

| Sound | Trigger | Character |
|---|---|---|
| `sndMove()` | Any piece/mark placed | Short 520Hz sine tick |
| `sndCapture()` | A piece is captured | Lower 340Hz square wave — deliberately harsher than a move |
| `sndCheck()` | King put in check | Two-tone rising sawtooth (720Hz → 880Hz) — urgent |
| `sndEnd()` | Game ends | Descending two-tone sine (300Hz → 200Hz) — resolving/final |
| `sndNotify()` | Chat message received | Bright 660Hz sine ping |
| `sndConnect()` | Peer connects | Rising two-tone chime, followed by... |
| `sndCatChirp()` | ...chained after connect | A little mascot "chirp," synced to the cat's own reactive pose |

All tones are generated with configurable waveform (`sine`/`square`/`sawtooth`), frequency, duration, and gain — meaning the entire sound palette is a few lines of oscillator math, not a single downloaded `.mp3`. A master toggle (`toggleSound()`) persists via `localStorage`.

Separately, **Cozy Music** is a real optional ambient background track system (actual audio files, auto-discovered from a `music/playlist.json` or sequential filename guessing), synced across both players so you hear the same track together.

---

## 12. Haptics

Every sound effect pairs with a matching `vibrate()` pattern on supporting devices — not just an on/off buzz, but rhythm that matches the sound:

- Move: single short `10ms` pulse
- Capture: `[12, 30, 12]` — pulse, pause, pulse (feels like an impact)
- Check: `[15, 40, 15, 40, 15]` — an alarmed triple-pulse
- Win: `[30, 40, 30, 40, 80]` — a longer celebratory pattern

---

## 13. Per-Game Visual Systems

Each of the seven games has its own bespoke rendering approach:

- **♞ Chess** — Canvas-rendered board (not DOM squares) for smooth piece animation, with the full move-animation engine from [§9](#9-chess-move-animation-engine-9-physics-curves), check-pulse glow, last-move highlighting, and a move-list sidebar in monospace notation.
- **✕ Tic-Tac-Toe** — DOM grid with a bouncy mark-placement intro and a glowing winning-line highlight.
- **🔴 Connect 4** — Discs physically *drop* (`c4Drop` — a real gravity-style ease-in fall, not a fade), with radial-gradient shading (`radial-gradient(circle at 35% 30%, ...)`) to fake a glossy 3D disc look, and a hover-column preview showing where your piece will land.
- **⛃ Checkers** — Piece intro, a settle "thud" on landing, and a capture-burst particle flash when a piece is jumped.
- **⬤ Reversi** — The signature move here is `revFlip`: captured discs visually flip in place (`scaleX(1) → scaleX(0) → scaleX(1)` with a color swap at the midpoint) rather than just recoloring — mimicking a real physical disc flip.
- **🎨 Whiteboard** — Freeform collaborative canvas with color swatches (including a dedicated eraser swatch), adjustable brush-size buttons, and a clear-all action — synced stroke-by-stroke between both players.
- **📺 Watch Together** — Embedded, synced YouTube playback: search, paste-a-link, a shared queue with thumbnail previews, and a synchronized "Play together" countdown (`pickBounce`-animated numbers) so both screens start the video at the same instant.

All seven share one **avatar system**: each player gets a glyph (piece-appropriate per game — ♔/♚ for chess, ✕/○ for tic-tac-toe, etc.) and a "speaking" glow ring that lights up in real time during voice calls, driven by a live WebAudio frequency analyser on each side's mic stream.

---

## 14. Floating Reactions

Tap the Reactions button in the header menu to send one of 8 emoji (😂 😮 🔥 ❤️ 👏 😢 😡 🎉) floating up the screen on **both** players' devices simultaneously, broadcast over the same P2P data channel as game moves.

- Rendered in a dedicated `#reaction-layer` — `position: fixed`, `pointer-events: none`, and inset from the bottom edge so the rising emoji never intercept taps on the board, action row, or chat.
- Each emoji gets a randomized horizontal spawn position and animation duration (2.2–3.0s) so a burst of reactions never looks like a mechanical repeat.
- Spawn side is biased — your own reactions lean right, your opponent's lean left — so simultaneous reactions from both players visually separate instead of stacking.

---

## 15. Ambient & Desktop Decoration

On wide desktop viewports (`min-width: 701px` with a fine pointer — i.e. not touch), the empty gutters beside the centered 560px app column fill with slow-drifting decorative elements:

- Soft candy-colored blobs in each game's accent color, positioned around the edges and animated with independent drift keyframes (`daFloat1/2/3`) so they never move in visible sync.
- Ghost piece glyphs drifting even more slowly (`daDrift1/2`), reinforcing the "games" theme without competing for attention.

This entire layer is `aria-hidden`, `pointer-events: none`, and completely absent from the DOM's interactive surface — pure desktop ambiance, and explicitly disabled on mobile/tablet both for layout reasons (no gutter space) and performance (see next section).

---

## 16. Glassmorphism & Adaptive Rendering

Overlay cards, the player-info cards, the action row, and toasts use a **glass effect** by default — `backdrop-filter: blur(20px) saturate(120%)` over a translucent white background, giving that frosted-glass modal look.

But this is **adaptively downgraded** on mobile/touch devices (`max-width: 700px` or `pointer: coarse`): the blur is stripped entirely and swapped for a cheap solid `var(--surface)` background. `backdrop-filter` blur is one of the most expensive things a mobile GPU can composite, especially during a game with its own animation loops running — so the "glass" look is a desktop-only luxury, and touch devices get a look that reads as "glass-ish" without the compositing cost.

---

## 17. Motion & Performance Discipline

A few explicit engineering rules govern *how much* motion the app allows itself, all documented in the CSS with inline reasoning:

- **No `requestAnimationFrame` competition.** The voice-call "speaking" indicator deliberately polls on a slow `setInterval(150ms)` instead of `rAF`, so it never fights the chess canvas's own animation loop for frame budget.
- **Infinite ambient animations die on touch.** Anything that loops forever purely for decoration (`.id-box`, `.status-dot.on`, `.player-card.turn` pulses) gets `animation: none !important` on touch devices — the compositor shouldn't wake every frame just to pulse a dot while someone's trying to drag a checker piece.
- **The cat is exempt from that rule** — see [§6](#6-the-cat-mascot) — judged cheap enough to be worth the exception.
- **`prefers-reduced-motion` is respected globally**, freezing the desktop ambient decoration layer entirely for anyone who's opted out of motion at the OS level.
- **Reaction emoji have a JS-side safety net.** `floatReaction`'s `animationend` cleans up the DOM node, but a `setTimeout` backup also removes it in case the tab is backgrounded mid-animation and the event never fires — no silent DOM leak from repeated reactions.

---

## 18. Responsive & Accessibility Design

- **Viewport-aware layout collapse**: below ~460px width, the room-code display and status-pill text shrink or hide, relying on the status dot's color alone to convey connection state — designed and commented explicitly for narrow phone screens.
- **`env(safe-area-inset-*)`** padding throughout, so the app respects notches, home indicators, and rounded corners on modern phones.
- **`touch-action: manipulation`** globally, removing the 300ms tap-delay and double-tap-zoom on every interactive element.
- **`:focus-visible` outlines** in the accent color on every focusable element, for keyboard navigation.
- **`aria-label`s** on every icon-only button (mute, hang up, leave room, switch game, etc.) — nothing is icon-only *and* unlabeled.
- **Semantic live regions implicitly respected**: toasts, status labels, and connection state all update via direct text content changes rather than opaque re-renders, keeping screen-reader announcements coherent.

---

## 19. Feature Index

Quick reference for *what the app does*, alongside all the *how it looks/feels* covered above:

- **P2P multiplayer** over WebRTC via PeerJS — no backend server, no accounts; a 5-digit room code is the entire pairing mechanism.
- **7 games**: Chess, Tic-Tac-Toe, Connect 4, Checkers, Reversi, Whiteboard, Watch Together.
- **Solo pass-and-play mode** for any game, with a turn-handoff banner reminding you whose turn it is.
- **Room persistence**: last room code remembered locally so a reload doesn't lose your way back in (you still confirm by pressing Join).
- **Voice calling** over the same proven PeerJS connection as gameplay — mute, hang up, live speaking indicators, and a connection timeout with a clear error if it can't get through.
- **Text chat** with quick-reply chips (GL / Nice / Oof / One sec) plus a full chat drawer.
- **Floating emoji reactions**, broadcast live.
- **Session scoring**, rematch flow with automatic color-swap for fairness.
- **Draw offers, resignation, and takebacks** where the game rules support them.
- **Cozy background music**, synced between both players.
- **Full reconnection handling** — dropped connections auto-retry with backoff, and games resume mid-session rather than resetting.

---

## 20. File Map (where to find things)

Everything lives in **one HTML file** — here's where each system is physically located, by rough line-number neighborhood:

| System | Roughly where |
|---|---|
| CSS custom properties (`:root`) | Top of `<style>` |
| Cat mascot SVG + animation CSS | Near top of `<style>`, mascot markup in `<header>` |
| Board themes (`BOARD_THEMES`) | Mid-file JS, alongside `buildOneThemeGrid()` |
| Move animations (`MOVE_ANIMS`) | Just above board themes |
| Room themes (`ROOM_THEMES`) | Alongside `applyRoomTheme()`/`setRoomTheme()` |
| Sound engine (`sndMove`, etc.) | `SOUND (WebAudio synthesized)` section |
| Voice call system | `VOICE CALL` section, uses `peer.call()`/`peer.on('call')` |
| Floating reactions | `FLOATING REACTIONS` section, `spawnFloatingReaction()` |
| Chess engine (rules) | Inlined dependency-free `Chess` class at the very top of `<script>` |
| Per-game controllers | `GameControllers.<game>.init/onData/render` objects, one block per game |
| Watch Together / YouTube sync | `YTSync` module near the bottom of the file |

---

<p align="center"><em>Built as one file, on purpose. Every animation here exists because someone decided it should — nothing is a framework default.</em></p>
