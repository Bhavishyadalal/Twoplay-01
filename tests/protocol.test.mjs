import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { webcrypto } from "node:crypto";
const scope = { crypto: webcrypto };
vm.createContext(scope);
vm.runInContext(
  readFileSync("src/core/protocol.js", "utf8") +
    "\nglobalThis.protocol=TwoplayProtocol;",
  scope,
);
const p = scope.protocol;
test("rejects malformed, oversized and off-board peer messages", () => {
  for (const d of [
    null,
    [],
    { type: "unknown" },
    { type: "chat", msg: "x".repeat(1001) },
    { type: "game", game: "ttt", payload: { kind: "move", i: 99, sym: "X" } },
    {
      type: "game",
      game: "ludo",
      payload: { kind: "roll", dice: NaN, consecutiveSixes: 0 },
    },
    {
      type: "game",
      game: "chess",
      payload: { kind: "move", from: "__proto__", to: "e4" },
    },
  ])
    assert.equal(p.message(d), false);
  assert.equal(
    p.message({
      type: "game",
      game: "ttt",
      payload: { kind: "move", i: 0, sym: "X" },
    }),
    true,
  );
  assert.equal(
    p.message({
      type: "game",
      game: "chess",
      payload: { kind: "move", from: "e2", to: "e4", promotion: null },
    }),
    true,
  );
});
test("normalizes peer thumbnails and bounds queue metadata", () => {
  const item = p.queueItem({
    id: "dQw4w9WgXcQ",
    uid: "one",
    thumb: 'x" onerror="alert(1)',
    title: "x".repeat(500),
  });
  assert.equal(
    item.thumb,
    "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  );
  assert.equal(item.title.length, 200);
  assert.equal(p.queueItem({ id: "<script>", uid: "two" }), null);
  assert.equal(
    p.gamePayload("ytsync", {
      kind: "queue_sync",
      queue: Array(101).fill(item),
    }),
    false,
  );
});
test("validates snapshots for every board and bounds whiteboard batches", () => {
  assert.equal(
    p.gamePayload("ttt", {
      kind: "sync",
      board: Array(9).fill(null),
      turn: "w",
    }),
    true,
  );
  assert.equal(
    p.gamePayload("checkers", {
      kind: "sync",
      board: Array.from({ length: 8 }, () => Array(8).fill(null)),
      turn: "w",
    }),
    true,
  );
  assert.equal(
    p.gamePayload("c4", {
      kind: "sync",
      grid: Array.from({ length: 7 }, () => []),
      turn: "b",
    }),
    true,
  );
  assert.equal(
    p.gamePayload("ludo", {
      kind: "sync",
      tokens: Object.fromEntries(
        ["teal", "mustard", "coral", "violet"].map((c) => [
          c,
          [-1, -1, -1, -1],
        ]),
      ),
      turn: "teal",
    }),
    true,
  );
  assert.equal(
    p.gamePayload("whiteboard", {
      kind: "batch",
      items: Array(257).fill({ kind: "clear" }),
    }),
    false,
  );
  assert.equal(
    p.gamePayload("whiteboard", {
      kind: "batch",
      items: [
        {
          kind: "start",
          x: 2,
          y: 3,
          w: 400,
          h: 400,
          size: 4,
          color: "#abcdef",
        },
      ],
    }),
    true,
  );
});
test("dice uses rejection sampling rather than a biased modulo or tactical weighting", () => {
  const draws = [4294967295, 0, 1, 2, 3, 4, 5];
  const fake = {
    crypto: {
      getRandomValues(a) {
        a[0] = draws.shift();
        return a;
      },
    },
  };
  vm.createContext(fake);
  vm.runInContext(
    readFileSync("src/core/protocol.js", "utf8") +
      "\nglobalThis.die=TwoplayProtocol.fairDie;",
    fake,
  );
  assert.deepEqual(
    Array.from({ length: 6 }, () => fake.die()),
    [1, 2, 3, 4, 5, 6],
  );
});
const chessScope = { window: {} };
vm.createContext(chessScope);
vm.runInContext(readFileSync("src/vendor/chess.js", "utf8"), chessScope);
const Chess = chessScope.window.Chess;
test("invalid chess snapshots do not corrupt the live board", () => {
  const chess = new Chess();
  const before = chess.fen();
  for (const bad of ["8/8 w - - 0 1", "8/8/8/8/8/8/8/8 w - - 0 1", "broken"])
    assert.throws(() => chess.load(bad));
  assert.equal(chess.fen(), before);
});
test("chess rejects impossible moves and recognizes Fool’s mate", () => {
  const c = new Chess();
  assert.equal(c.move({ from: "e2", to: "e5" }), null);
  for (const [from, to] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ])
    assert.ok(c.move({ from, to }));
  assert.equal(c.isCheckmate(), true);
});
test("source keeps TURN configuration byte-for-byte unchanged", () => {
  const current = readFileSync("src/core/connection.js", "utf8");
  const ice = current.slice(
    current.indexOf("const ICE_CONFIG ="),
    current.indexOf("function setMyIdDisplay"),
  );
  assert.equal(
    createHash("sha256").update(ice).digest("hex"),
    "183e32900c0695782d48ee545ee5ad7a7bde65c14f73c2dc020b76594d6b8cde",
  );
});
test("join waits have a deadline and a superseded attempt cannot dial", () => {
  const source = readFileSync("src/core/connection.js", "utf8");
  const fn = source.slice(
    source.indexOf("function attemptJoin(code)"),
    source.indexOf("function setupConnection"),
  );
  let time = 0,
    id = 0,
    calls = 0;
  const timers = new Map();
  const ctx = {
    peer: {
      open: false,
      connect() {
        calls++;
        return { open: false, close() {} };
      },
    },
    manualDisconnect: false,
    myPeerCode: "12345",
    joinGeneration: 0,
    joinTimer: null,
    Date: { now: () => time },
    setTimeout(fn) {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    resetJoinButton() {},
    setStatusLabel() {},
    setStatus() {},
    toast() {},
    setupConnection() {},
  };
  ctx.cancelJoin = () => {
    ctx.joinGeneration++;
    timers.delete(ctx.joinTimer);
    ctx.joinTimer = null;
  };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  ctx.attemptJoin("99999");
  const old = [...timers.values()][0];
  ctx.attemptJoin("88888");
  ctx.peer.open = true;
  old();
  assert.equal(calls, 0);
  ctx.peer.open = false;
  time = 16000;
  const [timerId, callback] = [...timers][0];
  timers.delete(timerId);
  callback();
  assert.equal(calls, 0);
  assert.equal(timers.size, 0);
});
