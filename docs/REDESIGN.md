# Twoplay Lounge redesign

Baseline: `f9610e2`. TURN configuration retained byte-for-byte.

## What changed

- Responsive full-width lounge, generated clay-art hero, eight illustrated game
  cards, game filters, room creation/joining, local play, how-it-works and footer.
- Room/board, player cards, actions, dialogs, chat, music and pickers use a shared
  restrained cream/lavender/sage visual system. Existing board/room skins remain.
- Keyboard focus, dialog focus trapping/return, live chat/status labels, a skip
  link and user zoom. Motion respects the browser's reduced-motion preference.
- Monolithic executable and CSS extracted into maintained domain files. Production
  hashes/minifies scripts/styles; PeerJS and fonts are served locally.
- 23 embedded cursor strips extracted to cacheable images. Hero is approximately
  33 KB. No background video, large animation framework or upfront music download.

## Correctness and input handling

- Validate peer envelopes, message size/rate, game IDs, board snapshots, coordinates,
  turn-sensitive moves, media IDs, queues, chat and supported reactions.
- Derive video thumbnail URLs from validated IDs. Peer data cannot become arbitrary
  image HTML attributes. Queue metadata is bounded; chat retains 200 entries.
- Require active-opponent identity and Accept/Decline for voice. Release a microphone
  stream if the caller/session becomes stale while permission is pending.
- Bound/cancel joins; reject self-joins and stale connection events. Keep authoritative
  resync on the host and accept board snapshots only during initialization/recovery.
- Reject unsolicited draw/rematch/takeback responses. Record a result once per game.
- Scope delayed board actions to a game epoch. Stop the chess clock and deactivate
  outgoing activities. Pause hidden Watch Together playback/countdowns.
- Uniform cryptographic Ludo dice replace the previous undisclosed tactical bias.
  Validate remote rolls/moves; prevent landing on protected opposing stacks.
- Validate FEN before touching live chess state. Reset local turn identity when
  switching games. Bound custom clocks to the supported protocol ranges.
- Load search-key configuration on demand. Bound search/playlist network waits,
  share concurrent playlist requests and permit retry after a transient failure.

## Validation

- `npm test`: eight focused protocol, dice, chess, TURN-retention and join tests.
- Production build succeeded.
- Chromium checks at 320, 390, 768 and 1440 CSS pixels: lounge/filter flow, local
  Tic-Tac-Toe win and all eight activity panels. No horizontal overflow or uncaught
  JavaScript errors in the checked flows.
- Controlled two-peer browser transport: two-way moves, illegal overwrite rejection,
  voice identity/consent and crafted queue rendering. This fixture exercises the
  real app dispatcher/controllers but does not emulate ICE or TURN.
- Actual PeerJS/WebRTC two-browser attempts timed out for **both the unchanged
  baseline and the redesigned source** in this execution environment. The cause
  is not established. Real cross-network play, voice audio, TURN availability,
  provider quota and video synchronization still need a live device/network check.
- No assertion that every possible bug is fixed or that this is production-certified.

## Source organization

Game controllers remain classic deferred scripts sharing session bindings. This
preserves the existing event/canvas logic while separating files by responsibility.
The historical alternative Ludo module is explicitly archived in
`docs/archive/ludo-prototype.js`; it is not a second active game or dynamic loader.
The application always loads the complete controller list from the HTML entry.
