/* Duck Dash - the world. Canvas painting, entities, timing, hit detection.
   Screens and the HUD live in ui.js and listen to the callbacks at the bottom. */

const Game = {
  canvas: null, ctx: null, img: {},

  // logical space: always 720 wide, height derived from the real screen aspect
  VW: CFG.W, VH: 1280, scale: 1,
  groundTop: 1010, duckY: 965, zoneTop: 908, zoneH: 114,
  laneL: 62, laneR: 658,

  duck: { x: 360, targetX: 360, alive: true, row: CFG.ROW_IDLE, frame: 0,
          flip: false, bob: 0, sx: 1, sy: 1, rot: 0, offY: 0, death: 0 },
  zones: [], anvils: [], parts: [],

  level: 0, cfg: LEVELS[0],
  running: false, elapsed: 0, dodges: 0, goalDone: false,
  spawnT: 0, shake: 0, demo: false,

  onDied: null, onGoal: null,

  // ------------------------------------------------------------ setup

  init(canvas, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.img = images;
    this.grassPat = this.ctx.createPattern(images.grass, "repeat");
    this.dirtPat = this.ctx.createPattern(images.dirt, "repeat");
    this.layout();
    addEventListener("resize", () => this.layout());
    addEventListener("orientationchange", () => setTimeout(() => this.layout(), 120));
  },

  layout() {
    // The game is portrait. On anything wider than 9:16 (a desktop window, a
    // tablet) it plays in a centred phone-shaped column rather than stretching -
    // otherwise the ground would swallow half the screen. The UI is pinned to the
    // same column through these two custom properties.
    const boxH = innerHeight;
    const boxW = Math.min(innerWidth, Math.round(boxH * 0.5625));
    const left = Math.round((innerWidth - boxW) / 2);

    const dpr = Math.min(devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(boxW * dpr));
    this.canvas.height = Math.max(1, Math.round(boxH * dpr));
    this.canvas.style.width = boxW + "px";
    this.canvas.style.height = boxH + "px";
    this.canvas.style.left = left + "px";

    const root = document.documentElement.style;
    root.setProperty("--game-w", boxW + "px");
    root.setProperty("--game-left", left + "px");

    // one logical unit system regardless of device: 720 across, ground on the floor
    this.scale = this.canvas.width / CFG.W;
    this.VW = CFG.W;
    this.VH = this.canvas.height / this.scale;
    this.groundTop = this.VH - CFG.GROUND_DEPTH;
    this.duckY = this.groundTop - CFG.DUCK_LIFT;
    this.zoneTop = this.duckY - 57;
    this.laneL = CFG.LANE_INSET;
    this.laneR = this.VW - CFG.LANE_INSET;
    this.duck.x = clamp(this.duck.x, this.laneL, this.laneR);
    this.duck.targetX = clamp(this.duck.targetX, this.laneL, this.laneR);

    this.ctx.imageSmoothingEnabled = false;
  },

  // ------------------------------------------------------------ run control

  start(level) {
    this.level = level;
    this.cfg = LEVELS[level];
    this.elapsed = 0;
    this.dodges = 0;
    this.goalDone = false;
    this.shake = 0;
    this.demo = false;
    this.clear();
    this.reviveDuck(this.VW / 2);
    this.spawnT = this.cfg.cd;
    this.running = true;
  },

  stop() { this.running = false; },

  clear() { this.zones.length = 0; this.anvils.length = 0; this.parts.length = 0; },

  reviveDuck(x) {
    const d = this.duck;
    d.x = x; d.targetX = x; d.alive = true; d.death = 0;
    d.rot = 0; d.offY = 0; d.sx = 1; d.sy = 1;
    d.row = CFG.ROW_IDLE; d.frame = 0;
  },

  aim(x) {
    if (this.running && this.duck.alive) {
      this.duck.targetX = clamp(x, this.laneL, this.laneR);
    }
  },

  goal() { return this.cfg.goal; },
  cooldown() { return Math.max(this.cfg.cdMin, this.cfg.cd - this.elapsed * this.cfg.cdDecay); },
  warnTime() { return Math.max(this.cfg.warnMin, this.cfg.warn - this.elapsed * this.cfg.warnDecay); },
  nextDrop() { return 1 - clamp(this.spawnT / Math.max(this.cooldown(), 0.001), 0, 1); },

  // ------------------------------------------------------------ update

  update(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 78);

    this.updateDuck(dt);

    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (!z.spent) {
        z.t += dt;
        if (z.t >= z.warn) { z.spent = true; this.dropAnvil(z); }
      } else {
        z.fade -= dt * 2.2;
        if (z.fade <= 0) this.zones.splice(i, 1);
      }
    }

    for (let i = this.anvils.length - 1; i >= 0; i--) {
      const a = this.anvils[i];
      if (!a.done) {
        a.t += dt;
        const p = clamp(a.t / a.fall, 0, 1);
        a.y = lerp(a.startY, a.landY, p * p);        // gravity-ish
        a.rot = (1 - p) * 0.18;
        if (p >= 1) { a.done = true; this.land(a); }
      } else {
        a.life += dt;
        a.rot = 0;
        if (a.life > 0.85) {
          a.alpha = Math.max(0, 1 - (a.life - 0.85) / 0.5);
          a.y += dt * 26;
          if (a.alpha <= 0) this.anvils.splice(i, 1);
        }
      }
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (!this.running) return;

    this.elapsed += dt;
    if (!this.goalDone && this.elapsed >= this.goal()) {
      this.goalDone = true;
      if (this.onGoal) this.onGoal();
    }

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.cooldown();
      this.spawnZone();
    }
  },

  updateDuck(dt) {
    const d = this.duck;

    if (!d.alive) {
      d.death += dt;
      d.frame += dt * 14;
      d.row = CFG.ROW_HOP;
      d.rot = lerp(d.rot, 1.5, dt * 5);
      d.offY = Math.min(d.death * d.death * 260, 46);
      return;
    }

    const dx = d.targetX - d.x;
    let step = dx * clamp(CFG.DUCK_EASE * dt, 0, 1);
    step = clamp(step, -CFG.DUCK_SPEED * dt, CFG.DUCK_SPEED * dt);
    d.x += step;

    const spd = Math.abs(step) / Math.max(dt, 0.0001);
    const moving = spd > 26;

    if (moving) {
      d.flip = step < 0;
      d.row = CFG.ROW_WALK;
      d.frame += dt * (7 + spd * 0.011);
    } else {
      d.row = CFG.ROW_IDLE;
      d.frame += dt * 6;
    }

    d.bob += dt * (5 + spd * 0.014);
    d.offY = moving ? -Math.abs(Math.sin(d.bob)) * Math.min(spd * 0.004, 3) : 0;

    const t = clamp(spd / 1300, 0, 1);
    d.sx = lerp(d.sx, 1 + t * 0.12, dt * 12);
    d.sy = lerp(d.sy, 1 - t * 0.10, dt * 12);
    d.rot = lerp(d.rot, clamp(dx, -300, 300) * 0.00055, dt * 9);
  },

  // ------------------------------------------------------------ hazards

  spawnZone(pairedWith) {
    const w = rand(this.cfg.wMin, this.cfg.wMax);
    const lo = this.laneL - 40, hi = this.laneR + 40 - w;
    let x = rand(lo, hi);

    // when two land together, keep them apart so there is always a way out
    if (pairedWith !== undefined) {
      const gap = w + 150;
      x = clamp(pairedWith < (lo + hi) / 2 ? pairedWith + gap : pairedWith - gap, lo, hi);
    }

    this.zones.push({ x: x, w: w, t: 0, warn: this.warnTime(), spent: false, fade: 1 });

    if (pairedWith === undefined && this.elapsed >= this.cfg.doubleAt && Math.random() < this.cfg.double) {
      this.spawnZone(x);
    }
  },

  dropAnvil(z) {
    const block = z.w * 0.94;
    this.anvils.push({
      x: z.x + z.w / 2, zx: z.x, zw: z.w, block: block,
      startY: -block, y: -block, landY: this.groundTop + 22 - block / 2,
      t: 0, fall: this.cfg.fall, rot: 0, done: false, life: 0, alpha: 1,
    });
  },

  land(a) {
    this.shake = Math.max(this.shake, 17);
    this.burst(a.zx + a.zw / 2);
    if (!this.running || !this.duck.alive) return;

    // one flat lane, so only the horizontal overlap can matter
    const half = CFG.HIT_W / 2;
    if (this.duck.x + half > a.zx && this.duck.x - half < a.zx + a.zw) {
      this.duck.alive = false;
      this.duck.death = 0;
      this.duck.frame = 0;
      this.running = false;
      this.shake = 30;
      if (this.onDied) this.onDied(this.elapsed);
    } else {
      this.dodges++;
    }
  },

  burst(x) {
    for (let i = 0; i < 24; i++) {
      const a = -Math.PI / 2 + rand(-0.7, 0.7);
      const v = rand(160, 460);
      this.parts.push({
        x: x + rand(-40, 40), y: this.groundTop + 12,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(0.35, 0.7), size: rand(3, 8),
      });
    }
  },

  // ------------------------------------------------------------ render

  render() {
    const c = this.ctx;
    const sx = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) * 0.6 : 0;

    c.setTransform(this.scale, 0, 0, this.scale, sx * this.scale, sy * this.scale);
    c.imageSmoothingEnabled = false;

    this.drawBackdrop();
    this.drawGround();
    for (const z of this.zones) this.drawZone(z);
    this.drawShadow();
    this.drawDuck();
    for (const a of this.anvils) this.drawAnvil(a);
    this.drawParts();
  },

  drawBackdrop() {
    const c = this.ctx, im = this.img.backdrop;
    const tw = this.VW + CFG.DRIFT * 2, th = this.groundTop + 24;
    // aspect-cover, so a tall phone crops the painting instead of stretching it
    const s = Math.max(tw / im.width, th / im.height);
    const dw = im.width * s, dh = im.height * s;
    const focus = clamp((this.duck.x - this.laneL) / (this.laneR - this.laneL), 0, 1);
    const drift = (0.5 - focus) * CFG.DRIFT * 1.6;

    c.save();
    c.beginPath(); c.rect(0, 0, this.VW, th); c.clip();
    c.drawImage(im, -CFG.DRIFT + (tw - dw) / 2 + drift, (th - dh) / 2, dw, dh);
    // haze where the painting meets the real ground
    const g = c.createLinearGradient(0, this.groundTop - 44, 0, this.groundTop);
    g.addColorStop(0, "rgba(220,236,255,0)");
    g.addColorStop(1, "rgba(220,236,255,0.15)");
    c.fillStyle = g;
    c.fillRect(0, this.groundTop - 44, this.VW, 44);
    c.restore();
  },

  drawGround() {
    const c = this.ctx;
    const soilTop = this.groundTop + CFG.GRASS_H;

    // soil first: a plain grass-free tile, so the ground never looks like a stack
    c.save();
    c.translate(0, soilTop);
    c.fillStyle = this.dirtPat;
    c.fillRect(0, 0, this.VW, this.VH - soilTop);
    c.restore();

    // depth gradient stops the tile repeat from reading
    const g = c.createLinearGradient(0, soilTop, 0, this.VH);
    g.addColorStop(0, "rgba(8,5,0,0.10)");
    g.addColorStop(1, "rgba(8,5,0,0.55)");
    c.fillStyle = g;
    c.fillRect(0, soilTop, this.VW, this.VH - soilTop);

    // exactly one row of grass blocks along the surface
    c.save();
    c.translate(0, this.groundTop);
    c.fillStyle = this.grassPat;
    c.fillRect(0, 0, this.VW, CFG.GRASS_H);
    c.restore();

    c.fillStyle = "rgba(0,0,0,0.22)";
    c.fillRect(0, this.groundTop + CFG.GRASS_LIP, this.VW, 6);
  },

  drawZone(z) {
    const c = this.ctx;
    const p = clamp(z.t / Math.max(z.warn, 0.001), 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(z.t * (7 + p * 26));
    const gy = this.groundTop + 4;
    const f = z.fade;

    // shaft of light marking the column the anvil will drop down, faded out at
    // the top so it never fights with the HUD
    const beam = c.createLinearGradient(0, 0, 0, gy);
    beam.addColorStop(0, "rgba(229,72,77,0)");
    beam.addColorStop(1, "rgba(229,72,77," + (0.06 + 0.20 * p) * f + ")");
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(z.x + z.w * 0.20, 0);
    c.lineTo(z.x + z.w * 0.80, 0);
    c.lineTo(z.x + z.w, gy);
    c.lineTo(z.x, gy);
    c.closePath();
    c.fill();

    // the marked patch, sitting on the green lip rather than down in the soil
    const py = this.groundTop - 5, ph = CFG.GRASS_LIP + 12;
    c.fillStyle = "rgba(229,72,77," + (0.22 + 0.32 * p + 0.12 * pulse) * f + ")";
    c.fillRect(z.x, py, z.w, ph);

    c.strokeStyle = "rgba(255,140,110," + (0.6 + 0.4 * pulse) * f + ")";
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(z.x, gy); c.lineTo(z.x + z.w, gy); c.stroke();

    c.lineWidth = 3;
    c.globalAlpha = 0.55 * f;
    const up = 150 * (0.35 + 0.65 * p);
    c.beginPath();
    c.moveTo(z.x, gy); c.lineTo(z.x, gy - up);
    c.moveTo(z.x + z.w, gy); c.lineTo(z.x + z.w, gy - up);
    c.stroke();
    c.globalAlpha = 1;

    // countdown closing in from both sides
    const run = z.w * 0.5 * (1 - p);
    const by = this.groundTop + CFG.GRASS_LIP + 2;
    c.strokeStyle = "rgba(232,151,122," + 0.95 * f + ")";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(z.x, by); c.lineTo(z.x + run, by);
    c.moveTo(z.x + z.w - run, by); c.lineTo(z.x + z.w, by);
    c.stroke();

    if (p > 0.86) {
      c.fillStyle = "rgba(240,238,230," + ((p - 0.86) / 0.14) * 0.38 * f + ")";
      c.fillRect(z.x, py, z.w, ph);
    }
  },

  drawShadow() {
    const c = this.ctx;
    c.save();
    c.translate(this.duck.x, this.groundTop + 10);
    for (let i = 0; i < 4; i++) {
      const rx = 34 * (1 - i * 0.16);
      c.fillStyle = "rgba(12,15,8,0.11)";
      c.beginPath();
      c.ellipse(0, 0, rx, rx * 0.34, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  },

  drawDuck() {
    const c = this.ctx, d = this.duck;
    const size = CFG.CELL * CFG.DUCK_SCALE;
    const n = CFG.FRAMES[d.row] || 10;
    const f = Math.floor(d.frame) % n;

    c.save();
    c.translate(d.x, this.duckY + d.offY);
    c.rotate(d.rot);
    c.scale(d.sx * (d.flip ? -1 : 1), d.sy);
    if (!d.alive) c.globalAlpha = 0.92;
    c.drawImage(this.img.duck, f * CFG.CELL, d.row * CFG.CELL, CFG.CELL, CFG.CELL,
      -size / 2, -size / 2, size, size);
    c.restore();
  },

  drawAnvil(a) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = a.alpha;

    if (!a.done) {
      // shadow on the grass, tightening as the anvil closes in
      const p = clamp(a.t / a.fall, 0, 1);
      const w = a.zw * (1.22 - 0.34 * p);
      c.fillStyle = "rgba(0,0,0," + (0.20 + 0.34 * p) + ")";
      c.beginPath();
      c.ellipse(a.x, this.groundTop + 14, w / 2, w * 0.16, 0, 0, Math.PI * 2);
      c.fill();
    }

    let sx = 1, sy = 1;
    if (a.done) {                                  // slam squash, then settle
      const k = clamp(a.life / 0.13, 0, 1);
      sx = lerp(1.22, 1, k);
      sy = lerp(0.74, 1, k);
    }
    c.translate(a.x, a.y);
    c.rotate(a.rot);
    c.scale(sx, sy);
    c.drawImage(this.img.anvil, -a.block / 2, -a.block / 2, a.block, a.block);
    c.restore();
  },

  drawParts() {
    const c = this.ctx;
    c.fillStyle = "#6b4a2a";
    for (const p of this.parts) {
      c.globalAlpha = clamp(p.life * 2, 0, 1);
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
  },

  // the title screen lets the duck pootle about behind the menu
  demoTick(t) {
    if (this.demo) this.duck.targetX = this.VW / 2 + Math.sin(t * 0.7) * 170;
  },
};
