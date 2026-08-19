/* Duck Dash - screens and HUD. Everything the player touches outside the world. */

const UI = {
  screen: "title",
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $("hud"), level: $("hud-level"), dodges: $("hud-dodges"),
      time: $("hud-time"), goal: $("hud-goal"),
      barGoal: $("bar-goal"), barNext: $("bar-next"), toast: $("toast"),
      title: $("screen-title"), titleBest: $("title-best"),
      levels: $("screen-levels"), grid: $("level-grid"),
      board: $("screen-board"), boardList: $("board-list"), name: $("player-name"),
      pause: $("screen-pause"), over: $("screen-over"),
      overBadge: $("over-badge"), overTime: $("over-time"),
      overNote: $("over-note"), overRank: $("over-rank"),
    };

    $("btn-play").onclick = () => this.play(clamp(Save.unlocked - 1, 0, LEVELS.length - 1));
    $("btn-levels").onclick = () => this.show("levels");
    $("btn-board").onclick = () => this.show("board");
    $("btn-pause").onclick = () => this.show("pause");
    $("btn-resume").onclick = () => this.resume();
    $("btn-restart").onclick = () => this.play(Game.level);
    $("btn-again").onclick = () => this.play(Game.level);
    $("btn-over-levels").onclick = () => this.show("levels");
    $("btn-over-board").onclick = () => this.show("board");
    $("btn-clear-board").onclick = () => { Save.clearBoard(); this.refreshBoard(); };

    for (const b of document.querySelectorAll("[data-back]")) b.onclick = () => this.show("title");
    for (const b of document.querySelectorAll("[data-home]")) b.onclick = () => this.show("title");

    this.el.name.value = Save.player;
    this.el.name.oninput = () => {
      const v = this.el.name.value.trim();
      Save.player = v || "DUCK";
      Save.write();
    };
    // don't let typing in the name field drive the duck
    this.el.name.addEventListener("pointerdown", (e) => e.stopPropagation());

    this.buildLevels();
    this.refreshLevels();   // so lock states are right before the screen is opened

    Game.onDied = (t) => this.died(t);
    Game.onGoal = () => this.toast("LEVEL CLEARED");

    addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.screen === "play") this.show("pause");
        else if (this.screen === "pause") this.resume();
        else if (this.screen !== "title") this.show("title");
      }
    });

    this.show("title");
  },

  // ------------------------------------------------------------ routing

  show(name) {
    this.screen = name;
    const s = this.el;
    for (const k of ["title", "levels", "board", "pause", "over"]) {
      s[k].classList.toggle("hidden", k !== name);
    }
    s.hud.classList.toggle("hidden", name !== "play" && name !== "pause");

    Game.demo = (name === "title");

    if (name === "title") {
      Game.stop();
      Game.clear();
      Game.reviveDuck(Game.VW / 2);
      const b = Save.overallBest();
      s.titleBest.textContent = b > 0 ? "best  " + fmt(b) + " s" : "no runs yet";
    } else if (name === "levels") {
      Game.stop();
      this.refreshLevels();
    } else if (name === "board") {
      Game.stop();
      this.refreshBoard();
    } else if (name === "pause") {
      Game.running = false;
    }
  },

  resume() {
    if (!Game.duck.alive) { this.play(Game.level); return; }
    this.screen = "play";
    this.el.pause.classList.add("hidden");
    Game.running = true;
  },

  play(level) {
    this.screen = "play";
    for (const k of ["title", "levels", "board", "pause", "over"]) {
      this.el[k].classList.add("hidden");
    }
    this.el.hud.classList.remove("hidden");
    this.el.toast.classList.remove("show");
    Game.start(level);
    this.el.level.textContent = "LVL " + (level + 1) + "  " + LEVELS[level].name;
    this.el.goal.textContent = "survive " + LEVELS[level].goal + "s to clear";
  },

  // ------------------------------------------------------------ levels

  buildLevels() {
    this.el.grid.innerHTML = "";
    this.cards = LEVELS.map((lv, i) => {
      const b = document.createElement("button");
      b.className = "card-lvl";
      b.innerHTML =
        '<div class="top"><span class="n">' + String(i + 1).padStart(2, "0") +
        '</span><span class="star"></span></div>' +
        '<div class="nm"></div><div class="meta"></div><div class="best"></div>';
      b.querySelector(".nm").textContent = lv.name;
      b.onclick = () => { if (!b.disabled) this.play(i); };
      this.el.grid.appendChild(b);
      return b;
    });
  },

  refreshLevels() {
    this.cards.forEach((b, i) => {
      const open = Save.isUnlocked(i);
      const best = Save.bestFor(i);
      const goal = LEVELS[i].goal;
      b.disabled = !open;
      b.querySelector(".meta").textContent = "goal  " + goal + "s";
      const star = b.querySelector(".star");
      const bestEl = b.querySelector(".best");
      if (!open) {
        star.textContent = "🔒";
        bestEl.textContent = "locked";
      } else if (best <= 0) {
        star.textContent = "";
        bestEl.textContent = "not played";
      } else {
        star.textContent = best >= goal ? "★" : "";
        bestEl.textContent = "best  " + fmt(best) + " s";
      }
    });
  },

  // ------------------------------------------------------------ leaderboard

  refreshBoard() {
    const list = this.el.boardList;
    list.innerHTML = "";

    if (!Save.board.length) {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No runs yet. Survive something and you'll show up here.";
      list.appendChild(e);
      return;
    }

    Save.board.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "bd-row" + (i < 3 ? " p" + (i + 1) : "");
      const lv = LEVELS[entry.level] || LEVELS[0];
      row.innerHTML =
        '<div class="rank"></div>' +
        '<div class="who"><div class="nm"></div><div class="lv"></div></div>' +
        '<div class="t"></div>';
      row.querySelector(".rank").textContent = i + 1;
      row.querySelector(".nm").textContent = entry.name || "DUCK";
      row.querySelector(".lv").textContent = "lvl " + (entry.level + 1) + "  ·  " + lv.name;
      row.querySelector(".t").textContent = fmt(entry.time) + " s";
      list.appendChild(row);
    });
  },

  // ------------------------------------------------------------ events

  died(time) {
    const res = Save.submit(Game.level, time);
    const s = this.el;
    s.overTime.textContent = fmt(time);

    if (res.unlocked) {
      s.overBadge.textContent = "LEVEL " + (Game.level + 2) + " UNLOCKED";
      s.overBadge.classList.remove("hidden");
    } else if (res.best) {
      s.overBadge.textContent = "NEW PERSONAL BEST";
      s.overBadge.classList.remove("hidden");
    } else {
      s.overBadge.classList.add("hidden");
    }

    const goal = Game.goal();
    s.overNote.textContent = time >= goal
      ? "cleared " + LEVELS[Game.level].name + "  ·  " + Game.dodges + " dodged"
      : fmt(goal - time) + " s short of the goal  ·  " + Game.dodges + " dodged";
    s.overRank.textContent = res.rank ? "#" + res.rank + " on the leaderboard" : "";

    setTimeout(() => { if (this.screen === "play") this.show("over"); }, 750);
  },

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove("show"), 1200);
  },

  // ------------------------------------------------------------ per-frame

  tick() {
    if (this.screen !== "play") return;
    const s = this.el;
    s.time.textContent = fmt(Game.elapsed);
    s.time.classList.toggle("past-goal", Game.elapsed >= Game.goal());
    s.dodges.textContent = Game.dodges + " dodged";
    s.barGoal.style.width = (clamp(Game.elapsed / Game.goal(), 0, 1) * 100) + "%";
    s.barNext.style.width = (Game.nextDrop() * 100) + "%";
  },
};
