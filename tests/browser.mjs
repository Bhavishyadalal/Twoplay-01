import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const url = process.env.TWOPLAY_TEST_URL || "http://localhost:8860/";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const fixture = await readFile(
  new URL("./fixtures/peer.js", import.meta.url),
  "utf8",
);
const errors = [];
async function newPage(width = 1440) {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    /\/(?:src\/vendor\/peer\.js|static\/peer\.[a-z0-9]+\.js)/,
    (r) => r.fulfill({ contentType: "text/javascript", body: fixture }),
  );
  await page.goto(url);
  await page.waitForFunction(
    () => document.querySelectorAll(".lounge-card").length === 8,
  );
  return page;
}
await mkdir(".artifacts", { recursive: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await newPage(width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `lounge overflow at ${width}`,
    );
    await page
      .getByRole("button", { name: "Just hanging out", exact: true })
      .click();
    assert.equal(await page.locator(".lounge-card:visible").count(), 2);
    await page
      .getByRole("button", { name: "All the fun 8", exact: true })
      .click();
    assert.equal(await page.locator(".lounge-card:visible").count(), 8);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `.artifacts/lounge-${width}.png`,
        fullPage: true,
      });
    await page.getByRole("button", { name: "Just us, one device" }).click();
    await page.locator('#local-picker-grid [data-game="ttt"]').click();
    await page.waitForFunction(
      () =>
        document.getElementById("landing").getBoundingClientRect().height === 0,
    );
    assert.equal(
      await page.locator("#connection-label").textContent(),
      "On this device",
    );
    assert.equal(await page.locator("#chat-drawer").isVisible(), false);
    for (const cell of [0, 3, 1, 4, 2])
      await page.locator("#ttt-board .ttt-cell").nth(cell).click();
    await page.waitForFunction(
      () =>
        !document.getElementById("end-overlay").classList.contains("hidden"),
    );
    assert.match(await page.locator("#end-title").textContent(), /wins/);
    for (const game of [
      "chess",
      "c4",
      "checkers",
      "reversi",
      "ludo",
      "whiteboard",
      "ytsync",
    ]) {
      await page.evaluate((game) => {
        closeEndOverlay();
        initGame(game, true);
      }, game);
      assert.equal(
        await page.locator("#stage-" + game).isVisible(),
        true,
        game,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${game} overflow at ${width}`,
      );
    }
    await page.evaluate(() => initGame("chess", true));
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `.artifacts/arena-${width}.png`,
        fullPage: true,
      });
    await page.close();
    console.log(`Layout, filters, local win and all 8 activities: ${width}px`);
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const host = await context.newPage(),
    guest = await context.newPage();
  for (const page of [host, guest]) {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      /\/(?:src\/vendor\/peer\.js|static\/peer\.[a-z0-9]+\.js)/,
      (r) => r.fulfill({ contentType: "text/javascript", body: fixture }),
    );
    await page.goto(url);
    await page.waitForFunction(() => peer?.open);
  }
  const code = await host.locator("#my-id-display").textContent();
  await host.evaluate(() => {
    chosenColorPref = "w";
    chosenMinutes = 10;
    chosenInc = 2;
    document.querySelector('#host-game-pick [data-game="ttt"]').click();
  });
  await guest.evaluate((code) => {
    showRole("join");
    document.getElementById("join-code-input").value = code;
    doJoin();
  }, code);
  await guest.waitForFunction(
    () =>
      conn?.open &&
      currentGame === "ttt" &&
      document.querySelectorAll("#ttt-board .ttt-cell").length === 9,
  );
  await host.locator("#ttt-board .ttt-cell").nth(0).click();
  await guest.waitForFunction(
    () => document.querySelector("#ttt-board .ttt-cell").textContent === "X",
  );
  assert.equal(await guest.evaluate(() => chosenMinutes), 10);
  assert.equal(await guest.evaluate(() => chosenInc), 2);
  // The connected peer cannot overwrite an occupied square or move for our color.
  await host.evaluate(() =>
    handleData({
      type: "game",
      game: "ttt",
      payload: { kind: "move", i: 0, sym: "O" },
    }),
  );
  assert.equal(
    await host.locator("#ttt-board .ttt-cell").nth(0).textContent(),
    "X",
  );
  await guest.locator("#ttt-board .ttt-cell").nth(1).click();
  await host.waitForFunction(
    () =>
      document.querySelectorAll("#ttt-board .ttt-cell")[1].textContent === "O",
  );
  // Switch through the normal room protocol and verify actual chess input sync.
  await host.evaluate(() => {
    safeSend({ type: "switch_game", game: "chess" });
    initGame("chess", true);
  });
  await guest.waitForFunction(
    () => currentGame === "chess" && GameControllers.chess.chess.turn() === "w",
  );
  const board = host.locator("#chess-board");
  const box = await board.boundingBox();
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 6.5) / 8 },
  });
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 4.5) / 8 },
  });
  await guest.waitForFunction(
    () => GameControllers.chess.chess.get("e4")?.type === "p",
  );
  assert.equal(
    await guest.evaluate(() => GameControllers.chess.chess.turn()),
    "b",
  );
  // Old game timers are discarded after a switch.
  await host.evaluate(() => {
    gameTimeout(() => {
      window.staleGameRan = true;
    }, 20);
    initGame("c4", true);
  });
  await host.waitForTimeout(40);
  assert.equal(await host.evaluate(() => !!window.staleGameRan), false);
  // Stale callbacks from superseded connections cannot disconnect the current room.
  assert.equal(await host.evaluate(() => conn.open), true);
  // Calling requires both the active opponent identity and explicit acceptance.
  const voice = await host.evaluate(() => {
    let prompts = 0,
      unknownClosed = false,
      knownClosed = false;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        prompts++;
        throw Error("test permission denial");
      },
    });
    peer.emit("call", {
      peer: "intruder",
      close() {
        unknownClosed = true;
      },
    });
    peer.emit("call", {
      peer: conn.peer,
      on() {},
      close() {
        knownClosed = true;
      },
    });
    const shown = !document
      .getElementById("confirm-overlay")
      .classList.contains("hidden");
    closeConfirm();
    return { prompts, unknownClosed, knownClosed, shown };
  });
  assert.deepEqual(voice, {
    prompts: 0,
    unknownClosed: true,
    knownClosed: true,
    shown: true,
  });
  // Peer-controlled queue attributes cannot become HTML event handlers.
  await host.evaluate(() => {
    initGame("ytsync", true);
    GameControllers.ytsync.onData({
      kind: "queue_add",
      item: {
        id: "dQw4w9WgXcQ",
        uid: "test",
        title: '<img src=x onerror="window.injected=true">',
        thumb: 'x" onerror="window.injected=true',
      },
    });
  });
  assert.equal(await host.locator("#yts-queue .yts-queue-item").count(), 1);
  assert.equal(await host.evaluate(() => !!window.injected), false);
  assert.match(
    await host.locator("#yts-queue img").getAttribute("src"),
    /^https:\/\/img.youtube.com\/vi\/dQw4w9WgXcQ\//,
  );
  console.log(
    "Controlled two-peer transport: two-way moves, illegal move rejection, voice consent and safe queue rendering passed.",
  );
  assert.deepEqual(errors, []);
  console.log("No uncaught browser errors.");
  await context.close();
} finally {
  await browser.close();
}
