/* Duck Dash - boot: load the art, wire input, run the loop. */

(function () {
  const SOURCES = {
    duck: "img/duck_sheet.png",
    anvil: "img/anvil.png",
    grass: "img/grass_top.png",
    dirt: "img/dirt.png",
    backdrop: "img/backdrop.png",
  };

  function loadImages(srcs) {
    const names = Object.keys(srcs);
    return Promise.all(names.map((n) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res([n, im]);
      im.onerror = () => rej(new Error("could not load " + srcs[n]));
      im.src = srcs[n];
    }))).then((pairs) => Object.fromEntries(pairs));
  }

  function input(canvas) {
    // one flat lane, so only the horizontal position of the touch matters
    const toLogical = (clientX) => {
      const r = canvas.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * Game.VW;
    };
    let down = false;

    const move = (e) => {
      if (UI.screen !== "play") return;
      Game.aim(toLogical(e.clientX));
    };

    canvas.addEventListener("pointerdown", (e) => {
      down = true;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      move(e);
    });
    canvas.addEventListener("pointermove", (e) => { if (down) move(e); });
    addEventListener("pointerup", () => { down = false; });
    addEventListener("pointercancel", () => { down = false; });

    // keyboard, for playing at a desk
    const keys = {};
    addEventListener("keydown", (e) => { keys[e.key] = true; });
    addEventListener("keyup", (e) => { keys[e.key] = false; });
    Game.keyStep = (dt) => {
      if (UI.screen !== "play") return;
      let dir = 0;
      if (keys.ArrowLeft || keys.a || keys.A) dir -= 1;
      if (keys.ArrowRight || keys.d || keys.D) dir += 1;
      if (dir) Game.aim(Game.duck.targetX + dir * 900 * dt);
    };

    // stop iOS from rubber-banding or zooming the page under the game
    document.addEventListener("touchmove", (e) => {
      if (e.target === canvas) e.preventDefault();
    }, { passive: false });
    document.addEventListener("gesturestart", (e) => e.preventDefault());
  }

  function loop() {
    let last = performance.now(), t = 0;
    function frame(now) {
      // clamp dt so a backgrounded tab doesn't resume with a giant time step
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      t += dt;

      Game.demoTick(t);
      if (Game.keyStep) Game.keyStep(dt);
      Game.update(dt);
      Game.render();
      UI.tick();

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  Save.load();

  loadImages(SOURCES).then((images) => {
    const canvas = document.getElementById("stage");
    Game.init(canvas, images);
    UI.init();
    input(canvas);
    document.getElementById("loading").remove();
    loop();
  }).catch((err) => {
    document.getElementById("loading").textContent = err.message;
    console.error(err);
  });

  // Only registers on a secure origin (https or localhost). Plain http on a LAN
  // address still plays fine - it just won't install to the home screen.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("sw:", e.message));
    });
  }
})();
