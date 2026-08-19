/* Progress + local leaderboard, kept in localStorage. Nothing leaves the device. */

const Save = {
  KEY: "duckdash.v1",

  player: "DUCK",
  unlocked: 1,          // how many levels are playable
  bests: {},            // level index -> best seconds
  board: [],            // [{name, time, level}] best first

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.player = String(d.player || "DUCK");
      this.unlocked = Number(d.unlocked) || 1;
      this.bests = d.bests && typeof d.bests === "object" ? d.bests : {};
      this.board = Array.isArray(d.board) ? d.board : [];
    } catch (e) {
      // corrupt or unavailable storage shouldn't stop anyone playing
      console.warn("could not read save:", e);
    }
  },

  write() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({
        player: this.player, unlocked: this.unlocked,
        bests: this.bests, board: this.board,
      }));
    } catch (e) {
      console.warn("could not write save:", e);
    }
  },

  bestFor(level) { return Number(this.bests[level]) || 0; },
  isUnlocked(level) { return level < this.unlocked; },
  overallBest() {
    return LEVELS.reduce((m, _, i) => Math.max(m, this.bestFor(i)), 0);
  },

  // returns { best, rank (1-based, 0 = did not place), unlocked }
  submit(level, time) {
    const res = { best: false, rank: 0, unlocked: false };

    if (time > this.bestFor(level)) {
      this.bests[level] = time;
      res.best = true;
    }

    if (time >= LEVELS[level].goal && level + 1 >= this.unlocked && level + 1 < LEVELS.length) {
      this.unlocked = level + 2;
      res.unlocked = true;
    }

    const entry = { name: this.player, time: time, level: level };
    this.board.push(entry);
    this.board.sort((a, b) => b.time - a.time);
    if (this.board.length > CFG.BOARD_MAX) this.board.length = CFG.BOARD_MAX;
    res.rank = this.board.indexOf(entry) + 1;

    this.write();
    return res;
  },

  clearBoard() { this.board = []; this.write(); },
};
