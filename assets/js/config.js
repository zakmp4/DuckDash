/* Duck Dash - tuning. Every knob that shapes how the game feels lives here. */

const CFG = {
  // The world is drawn in logical units: 720 wide, height derived from the real
  // screen aspect, so the ground always sits on the bottom of the actual phone.
  W: 720,
  GROUND_DEPTH: 270,   // grass + soil, measured up from the bottom of the screen
  GRASS_H: 64,         // one 8px block scaled x8 - laid as a single row, never stacked
  GRASS_LIP: 26,       // the green part of that block
  DUCK_LIFT: 45,       // the duck's centre above the grass line
  DUCK_SCALE: 5,       // the 32x32 sheet frames draw at 160px
  LANE_INSET: 62,
  HIT_W: 52,           // slightly narrower than the duck, so near misses feel fair
  DRIFT: 30,           // how far the sky slides as the duck runs

  DUCK_SPEED: 1450,    // px/s toward the touch point
  DUCK_EASE: 10,

  // sprite sheet: 24x5 grid of 32x32 frames
  CELL: 32,
  ROW_HOP: 1, ROW_WALK: 3, ROW_IDLE: 4,
  FRAMES: { 0: 24, 1: 10, 2: 8, 3: 13, 4: 10 },

  BOARD_MAX: 12,
};

// cd*   = seconds between anvils (start / floor / decay per second survived)
// warn* = how long the red column shows before the anvil drops
// goal  = survive this long to clear the level and unlock the next
const LEVELS = [
  { name: "First Splash",    cd: 5.0, cdMin: 1.80, cdDecay: 0.050,
    warn: 3.00, warnMin: 1.80, warnDecay: 0.020, fall: 0.36,
    doubleAt: 9999, double: 0.00, wMin: 138, wMax: 186, goal: 20 },
  { name: "Morning Drizzle", cd: 4.2, cdMin: 1.50, cdDecay: 0.060,
    warn: 2.60, warnMin: 1.55, warnDecay: 0.025, fall: 0.34,
    doubleAt: 25, double: 0.15, wMin: 140, wMax: 192, goal: 25 },
  { name: "Pond Panic",      cd: 3.6, cdMin: 1.25, cdDecay: 0.070,
    warn: 2.30, warnMin: 1.35, warnDecay: 0.030, fall: 0.33,
    doubleAt: 18, double: 0.20, wMin: 144, wMax: 198, goal: 30 },
  { name: "Iron Rain",       cd: 3.0, cdMin: 1.05, cdDecay: 0.080,
    warn: 2.00, warnMin: 1.20, warnDecay: 0.035, fall: 0.32,
    doubleAt: 12, double: 0.25, wMin: 148, wMax: 206, goal: 35 },
  { name: "Hammerfall",      cd: 2.6, cdMin: 0.92, cdDecay: 0.090,
    warn: 1.80, warnMin: 1.05, warnDecay: 0.040, fall: 0.31,
    doubleAt: 8,  double: 0.30, wMin: 152, wMax: 212, goal: 40 },
  { name: "Sky Full",        cd: 2.2, cdMin: 0.82, cdDecay: 0.100,
    warn: 1.60, warnMin: 0.96, warnDecay: 0.045, fall: 0.30,
    doubleAt: 5,  double: 0.35, wMin: 156, wMax: 220, goal: 45 },
  { name: "Blacksmith",      cd: 1.9, cdMin: 0.72, cdDecay: 0.110,
    warn: 1.40, warnMin: 0.88, warnDecay: 0.050, fall: 0.29,
    doubleAt: 2,  double: 0.42, wMin: 162, wMax: 228, goal: 50 },
  { name: "Anvil Storm",     cd: 1.6, cdMin: 0.62, cdDecay: 0.120,
    warn: 1.20, warnMin: 0.78, warnDecay: 0.055, fall: 0.28,
    doubleAt: 0,  double: 0.50, wMin: 168, wMax: 240, goal: 60 },
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = (t) => t.toFixed(2);
