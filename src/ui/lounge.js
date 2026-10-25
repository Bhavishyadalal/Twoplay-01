/* The public lounge UI. Game actions use the same controllers as room play. */
(() => {
  const illustrations = {
    chess: `<g transform="translate(50 18) rotate(-8 60 60)"><path d="M15 110h112v12H15z" fill="#c2b2df"/><path d="M40 105q-5-26 16-48L44 47l4-21 24 5 5-16 17 15q23 14 19 33l-19 6-16-9q4 24 22 45Z" fill="#8e72b6" stroke="#705699" stroke-width="2"/><path d="M57 33 72 38M44 100h57" stroke="#bda5d8" stroke-width="4" stroke-linecap="round"/><circle cx="90" cy="43" r="3" fill="#443555"/><path d="M132 48v48m-16-24h32" stroke="#c5b3dd" stroke-width="2"/></g>`,
    ttt: `<g transform="translate(49 15) rotate(7 65 60)" stroke-linecap="round"><rect width="133" height="119" rx="17" fill="#fafaf1"/><path d="M44 10v99M89 10v99M10 40h113M10 80h113" stroke="#a2beb0" stroke-width="3"/><g stroke="#619784" stroke-width="7"><path d="m16 13 15 15m0-15L16 28m44 26 15 15m0-15L60 69m43 25 15 15m0-15-15 15"/></g><g stroke="#dfa08b" fill="none" stroke-width="6"><circle cx="67" cy="20" r="10"/><circle cx="23" cy="60" r="10"/></g></g>`,
    c4: `<g transform="translate(55 15) rotate(-6 60 60)"><rect x="-6" y="108" width="141" height="12" rx="5" fill="#cf9d48"/><rect width="130" height="113" rx="14" fill="#eac66e"/>${Array.from({ length: 20 }, (_, i) => `<circle cx="${17 + (i % 5) * 24}" cy="${17 + Math.floor(i / 5) * 26}" r="9" fill="${i > 13 ? "#da8c77" : i > 8 ? "#8ca599" : "#f6e9c7"}"/>`).join("")}</g>`,
    checkers: `<g transform="translate(48 16) rotate(8 65 60)"><rect width="138" height="116" rx="10" fill="#f1c8b7"/>${Array.from({ length: 16 }, (_, i) => `<rect x="${8 + (i % 4) * 31}" y="${7 + Math.floor(i / 4) * 25}" width="31" height="25" fill="${(i + Math.floor(i / 4)) % 2 ? "#cd8e7e" : "#f8e4d8"}"/>`).join("")}<ellipse cx="56" cy="73" rx="25" ry="16" fill="#864f4b"/><ellipse cx="56" cy="65" rx="25" ry="16" fill="#b16b60" stroke="#dba08c" stroke-width="3"/><ellipse cx="101" cy="38" rx="21" ry="14" fill="#fbf0d5" stroke="#e8c8a9" stroke-width="3"/></g>`,
    reversi: `<g transform="translate(45 19) rotate(-6 70 55)"><rect width="145" height="111" rx="13" fill="#91a389"/><path d="M36 0v111M72 0v111M108 0v111M0 37h145M0 74h145" stroke="#b2c0a6" stroke-width="2"/>${[
      [53, 53, "#f7f1da"],
      [91, 53, "#434b42"],
      [53, 88, "#434b42"],
      [91, 88, "#f7f1da"],
    ]
      .map(
        ([x, y, c]) =>
          `<ellipse cx="${x}" cy="${y}" rx="15" ry="12" fill="${c}"/>`,
      )
      .join("")}</g>`,
    ludo: `<g transform="translate(60 21) rotate(10 55 55)"><rect width="110" height="110" rx="21" fill="#a5bbbc"/><rect x="-8" y="-8" width="110" height="110" rx="21" fill="#f5fcf5" stroke="#dce5d9" stroke-width="2"/><g fill="#72989b"><circle cx="18" cy="18" r="8"/><circle cx="76" cy="18" r="8"/><circle cx="47" cy="47" r="8"/><circle cx="18" cy="76" r="8"/><circle cx="76" cy="76" r="8"/></g><path d="M130 23v26m-13-13h26" stroke="#a7bfc0" stroke-width="3"/></g>`,
    whiteboard: `<g transform="translate(46 18) rotate(-5 70 60)"><rect x="0" y="0" width="143" height="114" rx="13" fill="#fffdf5"/><path d="M20 79q5-50 27-32t23-8q15-30 41 15" fill="none" stroke="#d990a2" stroke-width="8" stroke-linecap="round"/><path d="m102 82 25-10-18 25-14 4Z" fill="#8d84b6"/><path d="m126 71 18-26" stroke="#8d84b6" stroke-width="13" stroke-linecap="round"/><path d="m25 20 8 8m0-8-8 8" stroke="#dbc57b" stroke-width="3"/></g>`,
    ytsync: `<g transform="translate(44 19) rotate(5 70 55)"><rect x="4" y="8" width="142" height="98" rx="14" fill="#c2b3bd"/><rect width="142" height="98" rx="14" fill="#f9e5db"/><path d="m58 27 35 22-35 22Z" fill="#c78072"/><path d="M25 86h92" stroke="#dfb6aa" stroke-width="3"/><circle cx="40" cy="86" r="5" fill="#c78072"/><path d="M53 115h36" stroke="#b79ea8" stroke-width="5" stroke-linecap="round"/></g>`,
  };
  const cards = [
    [
      "chess",
      "Chess",
      "A classic. A worthy opponent.",
      "THE THINKING ONE",
      "#eae3f1",
      "classics",
    ],
    [
      "ttt",
      "Tic-Tac-Toe",
      "Little game. Big rematch energy.",
      "QUICK & LOVELY",
      "#e5eddf",
      "classics",
    ],
    [
      "c4",
      "Connect 4",
      "Four in a row. Just one more go.",
      "DROP INTO IT",
      "#f5ecd5",
      "classics",
    ],
    [
      "checkers",
      "Checkers",
      "A few clever moves between friends.",
      "OLD-SCHOOL GOOD",
      "#f3e1d8",
      "classics",
    ],
    [
      "reversi",
      "Reversi",
      "Turn the tables. Literally.",
      "PLOT A LITTLE",
      "#e3e9dd",
      "classics",
    ],
    [
      "ludo",
      "Ludo",
      "Roll with your favorite person.",
      "LET LUCK DECIDE",
      "#e2eded",
      "classics",
    ],
    [
      "whiteboard",
      "Whiteboard",
      "No rules. Just your imagination.",
      "MAKE SOMETHING",
      "#f0e3e9",
      "chill",
    ],
    [
      "ytsync",
      "Watch Together",
      "Different places. Same popcorn.",
      "PRESS PLAY, TOGETHER",
      "#efe3df",
      "chill",
    ],
  ];
  const musicButton = document.getElementById("music-btn-landing");
  if (musicButton) document.querySelector(".site-nav").appendChild(musicButton);
  const grid = document.getElementById("lounge-games");
  cards.forEach(([id, name, desc, tag, bg, category]) => {
    const card = document.createElement("button");
    card.className = "lounge-card" + (id === hostPickedGame ? " selected" : "");
    card.dataset.game = id;
    card.dataset.category = category;
    card.type = "button";
    card.setAttribute("aria-pressed", String(id === hostPickedGame));
    // Every value in this template is a local design constant, never peer data.
    card.innerHTML = `<div class="game-illustration" style="--card-bg:${bg}"><span class="game-label">${tag}</span><svg viewBox="0 0 240 155" aria-hidden="true">${illustrations[id]}</svg></div><div class="game-card-info"><div><h3>${name}</h3><p>${desc}</p></div><span class="card-arrow" aria-hidden="true"><svg class="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>`;
    card.addEventListener("click", () => {
      showRole("host");
      document.querySelector(`#host-game-pick [data-game="${id}"]`).click();
      document
        .getElementById("room-panel")
        .scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "nearest",
        });
    });
    grid.appendChild(card);
  });
  function syncSelection() {
    grid.querySelectorAll(".lounge-card").forEach((c) => {
      const active = c.dataset.game === hostPickedGame;
      c.classList.toggle("selected", active);
      c.setAttribute("aria-pressed", String(active));
    });
  }
  document
    .getElementById("host-game-pick")
    .addEventListener("click", syncSelection);
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach((b) => {
        const on = b === button;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      grid
        .querySelectorAll(".lounge-card")
        .forEach(
          (c) =>
            (c.hidden =
              button.dataset.filter !== "all" &&
              c.dataset.category !== button.dataset.filter),
        );
    }),
  );
  document
    .getElementById("join-code-input")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !document.getElementById("join-btn").disabled)
        doJoin();
    });
  // Accessible dialogs: focus enters once, stays inside, and returns to its trigger.
  let active = null,
    trigger = null;
  function trackDialog() {
    const open =
      [...document.querySelectorAll(".overlay:not(.hidden)")]
        .filter((e) => getComputedStyle(e).display !== "none")
        .at(-1) || null;
    if (open === active) return;
    if (open) {
      if (!active) trigger = document.activeElement;
      active = open;
      open.setAttribute("role", "dialog");
      open.setAttribute("aria-modal", "true");
      const heading = open.querySelector("h2,h3");
      if (heading) {
        heading.id ||= open.id + "-heading";
        open.setAttribute("aria-labelledby", heading.id);
      }
      const first = open.querySelector('input,button,[tabindex="0"]');
      first?.focus({ preventScroll: true });
    } else {
      active = null;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      trigger = null;
    }
  }
  new MutationObserver(trackDialog).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  document.addEventListener("keydown", (e) => {
    if (!active) return;
    if (e.key === "Tab") {
      const items = [
        ...active.querySelectorAll(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === "Escape") {
      if (active.id === "confirm-overlay") closeConfirm();
      else {
        const close = active.querySelector(
          '.overlay-close,.close-btn,[aria-label*="Close"],button[onclick^="close"]',
        );
        if (close) close.click();
      }
    }
  });
  document.querySelectorAll('[role="button"]:not(button)').forEach((el) => {
    el.tabIndex = 0;
    el.addEventListener("keydown", (e) => {
      if (e.target === el && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        el.click();
      }
    });
  });
  document.querySelectorAll("input").forEach((input) => {
    if (!input.labels?.length && !input.hasAttribute("aria-label"))
      input.setAttribute(
        "aria-label",
        input.placeholder || input.id.replaceAll("-", " "),
      );
  });
})();
