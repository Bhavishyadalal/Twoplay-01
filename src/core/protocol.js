/* Untrusted peer input is checked before it can mutate a board or reach the DOM. */
const TwoplayProtocol = (() => {
  const games = new Set([
    "chess",
    "ttt",
    "c4",
    "checkers",
    "reversi",
    "ludo",
    "whiteboard",
    "ytsync",
  ]);
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const finite = (v, lo, hi) =>
    typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  const text = (v, n) => typeof v === "string" && v.length <= n;
  const color = (v) => v === "w" || v === "b";
  const square = (v) => text(v, 2) && /^[a-h][1-8]$/.test(v);
  const coord = (v) =>
    Array.isArray(v) && v.length === 2 && v.every((n) => int(n, 0, 7));
  const matrix = (v, test) =>
    Array.isArray(v) &&
    v.length === 8 &&
    v.every((row) => Array.isArray(row) && row.length === 8 && row.every(test));
  const videoId = (v) => typeof v === "string" && /^[\w-]{11}$/.test(v);
  const queueItem = (item) => {
    if (!item || !videoId(item.id) || !text(item.uid, 100) || !item.uid)
      return null;
    return {
      id: item.id,
      uid: item.uid,
      title:
        typeof item.title === "string"
          ? item.title.slice(0, 200)
          : "YouTube video",
      thumb: `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
    };
  };
  const point = (p) =>
    p && finite(p.x, -10000, 10000) && finite(p.y, -10000, 10000);
  const stroke = (s) =>
    s &&
    /^#[0-9a-f]{3,8}$/i.test(s.color) &&
    finite(s.size, 0.1, 200) &&
    Array.isArray(s.points) &&
    s.points.length <= 10000 &&
    s.points.every(point);
  function gamePayload(game, p) {
    if (!p || typeof p !== "object" || !text(p.kind, 30)) return false;
    if (game === "ytsync") {
      switch (p.kind) {
        case "video":
          return videoId(p.id);
        case "sync":
          return (
            ["play", "pause", "seek"].includes(p.action) &&
            finite(p.time, 0, 86400)
          );
        case "play_together":
          return (
            (!p.videoId || videoId(p.videoId)) &&
            finite(p.target, 0, 1e15) &&
            (!p.startTime || finite(p.startTime, 0, 86400))
          );
        case "queue_add":
          return !!queueItem(p.item);
        case "queue_update":
          return text(p.uid, 100) && text(p.title, 200);
        case "queue_remove":
          return text(p.uid, 100);
        case "queue_sync":
          return (
            Array.isArray(p.queue) &&
            p.queue.length <= 100 &&
            p.queue.every(queueItem)
          );
        default:
          return false;
      }
    }
    if (game === "whiteboard") {
      if (p.kind === "sync")
        return (
          Array.isArray(p.strokes) &&
          p.strokes.length <= 2000 &&
          p.strokes.every(stroke)
        );
      if (p.kind !== "batch" || !Array.isArray(p.items) || p.items.length > 256)
        return false;
      return p.items.every(
        (i) =>
          i &&
          (["end", "clear", "undo"].includes(i.kind) ||
            (i.kind === "pt" && point(i)) ||
            (i.kind === "start" &&
              point(i) &&
              /^#[0-9a-f]{3,8}$/i.test(i.color) &&
              finite(i.size, 0.1, 200) &&
              finite(i.w, 1, 10000) &&
              finite(i.h, 1, 10000))),
      );
    }
    if (p.kind === "sync") {
      if (game === "chess")
        return (
          text(p.fen, 120) &&
          /^[prnbqkPRNBQK1-8/]+ [wb] [-KQkq]+ (?:-|[a-h][36]) \d+ \d+$/.test(
            p.fen,
          )
        );
      if (game === "ludo")
        return (
          ["teal", "mustard"].includes(p.turn) &&
          p.tokens &&
          ["teal", "mustard", "coral", "violet"].every(
            (c) =>
              Array.isArray(p.tokens[c]) &&
              p.tokens[c].length === 4 &&
              p.tokens[c].every((v) => int(v, -1, 57)),
          )
        );
      if (!color(p.turn)) return false;
      if (game === "ttt")
        return (
          Array.isArray(p.board) &&
          p.board.length === 9 &&
          p.board.every((v) => v === null || v === "X" || v === "O")
        );
      if (game === "c4")
        return (
          Array.isArray(p.grid) &&
          p.grid.length === 7 &&
          p.grid.every(
            (c) =>
              Array.isArray(c) &&
              c.length <= 6 &&
              c.every((v) => ["p1", "p2"].includes(v)),
          )
        );
      if (game === "checkers")
        return matrix(
          p.board,
          (v) =>
            v === null ||
            (v &&
              ["p1", "p2"].includes(v.color) &&
              typeof v.king === "boolean"),
        );
      if (game === "reversi")
        return matrix(p.board, (v) => v === null || ["p1", "p2"].includes(v));
      return false;
    }
    if (game === "ludo") {
      if (p.kind === "roll")
        return int(p.dice, 1, 6) && int(p.consecutiveSixes, 0, 3);
      if (p.kind === "no_moves")
        return (
          typeof p.rerollable === "boolean" &&
          ["teal", "mustard"].includes(p.turn)
        );
      return (
        p.kind === "move" &&
        ["teal", "mustard"].includes(p.color) &&
        int(p.idx, 0, 3) &&
        int(p.newStep, 0, 57)
      );
    }
    if (p.kind !== "move") return false;
    if (game === "chess")
      return (
        square(p.from) &&
        square(p.to) &&
        (!p.promotion || ["q", "r", "b", "n"].includes(p.promotion))
      );
    if (game === "ttt") return int(p.i, 0, 8) && ["X", "O"].includes(p.sym);
    if (game === "c4")
      return int(p.col, 0, 6) && ["p1", "p2"].includes(p.piece);
    if (game === "reversi") return int(p.r, 0, 7) && int(p.c, 0, 7);
    if (game === "checkers")
      return (
        coord(p.from) &&
        coord(p.moveTo) &&
        (!p.seq ||
          (Array.isArray(p.seq) &&
            p.seq.length <= 12 &&
            p.seq.every(
              (j) => j && coord(j.from) && coord(j.to) && coord(j.over),
            )))
      );
    return false;
  }
  function message(d) {
    if (!d || typeof d !== "object" || Array.isArray(d) || !text(d.type, 40))
      return false;
    try {
      if (JSON.stringify(d).length > 512 * 1024) return false;
    } catch {
      return false;
    }
    switch (d.type) {
      case "game":
        return games.has(d.game) && gamePayload(d.game, d.payload);
      case "room_init":
        return (
          games.has(d.game) &&
          color(d.theirColor) &&
          finite(d.minutes, 0, 180) &&
          finite(d.incSec, 0, 300) &&
          (!d.hostName || text(d.hostName, 18))
        );
      case "name":
        return text(d.name, 18);
      case "chat":
        return text(d.msg, 1000);
      case "reaction":
        return ["😂", "😮", "🔥", "❤️", "👏", "😢", "😡", "🎉"].includes(
          d.emoji,
        );
      case "switch_game":
        return games.has(d.game);
      case "ping":
      case "pong":
        return int(d.seq, 0, Number.MAX_SAFE_INTEGER);
      case "resync_hello":
        return !d.name || text(d.name, 18);
      case "resync_state":
        return (
          (d.chosenMinutes === undefined || finite(d.chosenMinutes, 0, 180)) &&
          (d.chosenInc === undefined || finite(d.chosenInc, 0, 300)) &&
          games.has(d.game) &&
          color(d.theirColor) &&
          finite(d.whiteMs, 0, 1e9) &&
          finite(d.blackMs, 0, 1e9) &&
          finite(d.incrementMs, 0, 300000) &&
          typeof d.noTimeLimit === "boolean" &&
          typeof d.gameEnded === "boolean" &&
          d.sessionScore &&
          ["me", "opp", "draws"].every((k) => int(d.sessionScore[k], 0, 100000))
        );
      case "draw_response":
        return typeof d.accepted === "boolean";
      case "timeout_claim":
        return color(d.winner);
      case "draw_offer":
      case "resign":
      case "rematch_request":
      case "rematch_accept":
      case "takeback_request":
      case "takeback_accept":
      case "takeback_decline":
        return true;
      case "music_signal":
        return (
          d.kind === "stop" ||
          (d.kind === "play" &&
            text(d.file, 250) &&
            /^music\/[^/\\]+\.(mp3|ogg|wav|m4a)$/i.test(d.file))
        );
      default:
        return false;
    }
  }
  function fairDie() {
    const a = new Uint32Array(1);
    do {
      crypto.getRandomValues(a);
    } while (a[0] >= 4294967292);
    return 1 + (a[0] % 6);
  }
  return { message, gamePayload, queueItem, videoId, fairDie };
})();
