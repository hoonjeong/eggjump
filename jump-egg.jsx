import { useState, useEffect, useRef, useCallback } from "react";

const W = 400;
const H = 650;
const GRAVITY = 0.28;
const MAX_JUMP_VEL = 11.5;
const PLATFORM_GAP = 80;
const EGG_R = 18;

const STAGES = [
  { emoji: "🥚", name: "알", need: 0, color: "#F9E4B7" },
  { emoji: "🐣", name: "병아리", need: 15, color: "#FFEB3B" },
  { emoji: "🐥", name: "아기새", need: 40, color: "#FFC107" },
  { emoji: "🐔", name: "닭", need: 75, color: "#FF9800" },
  { emoji: "🦅", name: "독수리", need: 120, color: "#8D6E63" },
  { emoji: "🐉", name: "드래곤", need: 180, color: "#E53935" },
  { emoji: "🔥", name: "피닉스", need: 260, color: "#FFD700" },
];

function getStage(jumps) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (jumps >= STAGES[i].need) return i;
  }
  return 0;
}

function createPlatform(y, index) {
  // Height in meters
  const heightM = Math.max(0, Math.floor((540 - y) / 12));
  
  // Width: starts wide, VERY slowly narrows (min 50)
  const widthBase = Math.max(50, 130 - heightM * 0.35);
  const widthVariance = Math.max(10, 25 - heightM * 0.08);
  const w = widthBase + Math.random() * widthVariance;
  
  // Speed: zigzag pattern, VERY slowly increases with height
  const baseSpeed = 0.6 + Math.min(1.2, heightM * 0.008);
  const zigzag = index % 2 === 0 ? 0.6 : 1.0;
  const speed = baseSpeed * zigzag * (0.8 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1);
  
  // Platform type based on height - very gradual introduction
  let type = "normal";
  if (heightM >= 15) {
    const timedChance = Math.min(0.18, (heightM - 15) * 0.003);
    const fragileChance = Math.min(0.15, (heightM - 15) * 0.002);
    const roll = Math.random();
    if (roll < timedChance) type = "timed";
    else if (roll < timedChance + fragileChance) type = "fragile";
  }
  
  return {
    x: 30 + Math.random() * (W - 60 - w),
    y,
    w,
    h: 11,
    speed,
    hue: type === "timed" ? 0 : type === "fragile" ? 270 : (index * 37) % 360,
    type,
    timer: type === "timed" ? 300 : 0,
    landed: false,
    removing: false,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function JumpEggGame() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const evolveFlashRef = useRef(false);

  const game = useRef({
    state: "idle",
    egg: { x: W / 2, y: 0, vx: 0, vy: 0, onPlatform: null },
    platforms: [],
    camera: { y: 0 },
    power: { value: 50, dir: 1, speed: 1.6 },
    score: 0,
    highScore: 0,
    xp: 0,
    xpDecayTimer: 0,
    stageIdx: 0,
    prevStageIdx: 0,
    particles: [],
    birds: [],
    birdTimer: 0,
    perfectFlash: 0,
    landingFx: null,
    heightReached: 0,
    highestPlatformY: 540,
  });

  const [uiScore, setUiScore] = useState(0);
  const [uiStage, setUiStage] = useState(0);
  const [uiXP, setUiXP] = useState(0.0);
  const [uiGameOver, setUiGameOver] = useState(false);
  const [uiHighScore, setUiHighScore] = useState(0);

  const initGame = useCallback(() => {
    const g = game.current;
    const platforms = [];
    platforms.push({ x: W / 2 - 90, y: 540, w: 180, h: 11, speed: 0, hue: 140, type: "normal", timer: 0, landed: false, removing: false });
    for (let i = 1; i <= 25; i++) {
      platforms.push(createPlatform(540 - i * PLATFORM_GAP, i));
    }
    g.platforms = platforms;
    g.egg = { x: W / 2, y: 540 - EGG_R, vx: 0, vy: 0, onPlatform: platforms[0] };
    g.camera = { y: 0 };
    g.power = { value: 50, dir: 1, speed: 1.6 };
    g.score = 0;
    g.xp = 0;
    g.xpDecayTimer = 0;
    g.stageIdx = 0;
    g.prevStageIdx = 0;
    g.state = "idle";
    g.particles = [];
    g.birds = [];
    g.birdTimer = 0;
    g.perfectFlash = 0;
    g.landingFx = null;
    g.heightReached = 540;
    g.highestPlatformY = 540;
    evolveFlashRef.current = false;
    setUiScore(0);
    setUiStage(0);
    setUiXP(0);
    setUiGameOver(false);
  }, []);

  const startCharging = useCallback(() => {
    const g = game.current;
    if (g.state !== "idle") return;
    g.power.value = 0;
    g.power.dir = 1;
    g.state = "charging";
  }, []);

  const releaseJump = useCallback(() => {
    const g = game.current;
    if (g.state !== "charging") return;
    const power = g.power.value / 100;
    const stageBonus = 1 + g.stageIdx * 0.12; // 12% more jump per level
    const jumpVel = MAX_JUMP_VEL * Math.max(0.15, power) * stageBonus;
    const egg = g.egg;
    const platVx = egg.onPlatform ? egg.onPlatform.speed * 0.35 : 0;
    
    // Remove fragile platform after jumping off
    if (egg.onPlatform && egg.onPlatform.type === "fragile") {
      egg.onPlatform.removing = true;
      g.platforms = g.platforms.filter((p) => !p.removing);
    }
    
    egg.vy = -jumpVel;
    egg.vx = platVx;
    egg.onPlatform = null;
    g.state = "jumping";

    const isPerfect = g.power.value >= 99;

    if (isPerfect) {
      // Screen flash
      g.perfectFlash = 30;
      // Bonus XP
      g.xp += 5;
      // Massive starburst particles
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const speed = 3 + Math.random() * 4;
        g.particles.push({
          x: egg.x, y: egg.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 35 + Math.random() * 20,
          maxLife: 55,
          size: 3 + Math.random() * 5,
          hue: 45 + Math.random() * 30,
        });
      }
      // Sparkle ring
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        g.particles.push({
          x: egg.x + Math.cos(angle) * 25,
          y: egg.y + Math.sin(angle) * 25,
          vx: Math.cos(angle) * 1.5,
          vy: Math.sin(angle) * 1.5 - 1,
          life: 25 + Math.random() * 15,
          maxLife: 40,
          size: 2 + Math.random() * 3,
          hue: 180 + Math.random() * 60,
        });
      }
      // "PERFECT!" text effect
      g.landingFx = { y: egg.y, x: egg.x, timer: 40, text: "✨ PERFECT! +5 XP ✨" };
    } else {
      for (let i = 0; i < 6; i++) {
        g.particles.push({
          x: egg.x + (Math.random() - 0.5) * 16,
          y: egg.y + EGG_R,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 2 + 1,
          life: 25 + Math.random() * 15,
          maxLife: 40,
          size: 2 + Math.random() * 3,
          hue: 45,
        });
      }
    }
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    let lastTime = 0;
    function loop(time) {
      const dt = Math.min((time - lastTime) / 16.67, 2.5);
      lastTime = time;
      update(dt);
      render(ctx);
      frameRef.current = requestAnimationFrame(loop);
    }

    function update(dt) {
      const g = game.current;
      if (g.state === "gameover") return;

      const { egg, platforms, camera, power } = g;

      // Power bar - only moves while charging (spacebar held)
      if (g.state === "charging") {
        power.value += power.dir * power.speed * dt;
        if (power.value >= 100) { power.value = 100; power.dir = -1; }
        if (power.value <= 0) { power.value = 0; power.dir = 1; }
      }

      // Platforms move
      for (const p of platforms) {
        if (p.speed === 0) continue;
        p.x += p.speed * dt;
        if (p.x <= 8) { p.x = 8; p.speed = Math.abs(p.speed); }
        if (p.x + p.w >= W - 8) { p.x = W - 8 - p.w; p.speed = -Math.abs(p.speed); }
      }

      // Timed platform countdown - only when egg is ON the platform
      for (const p of platforms) {
        if (p.type === "timed" && p.landed && egg.onPlatform === p) {
          p.timer -= dt;
          if (p.timer <= 0 && !p.removing) {
            p.timer = 0;
            p.removing = true;
            // If egg is on this platform, fall
            if (egg.onPlatform === p) {
              egg.onPlatform = null;
              egg.vy = 0;
              g.state = "jumping";
            }
          }
        }
      }
      // Remove expired timed platforms
      g.platforms = g.platforms.filter((p) => !(p.type === "timed" && p.removing));

      // Bird spawning - more frequent as height increases
      g.birdTimer += dt;
      const height = Math.max(0, Math.floor((540 - g.heightReached) / 12));
      // No birds below 40m, then VERY gradually increase
      let birdInterval = 99999;
      if (height >= 40 && height < 80) birdInterval = 500;        // very rare
      else if (height >= 80 && height < 130) birdInterval = 350;   // rare
      else if (height >= 130 && height < 200) birdInterval = 250;  // occasional
      else if (height >= 200 && height < 300) birdInterval = 170;  // frequent
      else if (height >= 300) birdInterval = 120;                   // intense
      
      if (g.birdTimer > birdInterval) {
        g.birdTimer = 0;
        const birdY = camera.y + 80 + Math.random() * (H - 200);
        g.birds.push({
          x: W + 30,
          y: birdY,
          speed: 1.5 + Math.random() * 1.2 + Math.min(2, height * 0.01),
          frame: 0,
        });
      }

      // Update birds
      for (const b of g.birds) {
        b.x -= b.speed * dt;
        b.frame += dt * 0.15;
        
        // Collision with egg
        const dx = egg.x - b.x;
        const dy = egg.y - b.y;
        if (Math.abs(dx) < EGG_R + 14 && Math.abs(dy) < EGG_R + 8) {
          egg.vx = -4; // push left
          if (g.state === "idle" || g.state === "charging") {
            egg.onPlatform = null;
            egg.vy = -2;
            g.state = "jumping";
          }
          b.x = -100; // remove bird
          // Hit particles
          for (let i = 0; i < 6; i++) {
            g.particles.push({
              x: egg.x, y: egg.y,
              vx: -(Math.random() * 3 + 1),
              vy: (Math.random() - 0.5) * 3,
              life: 15, maxLife: 15,
              size: 2 + Math.random() * 3, hue: 30,
            });
          }
        }
      }
      g.birds = g.birds.filter((b) => b.x > -50);

      // XP decay when idle or charging - smooth tiny drain
      if ((g.state === "idle" || g.state === "charging") && g.xp > 0) {
        g.xpDecayTimer += dt;
        g.xp = Math.max(0, g.xp - 0.008 * dt);
        const newStage = getStage(Math.floor(g.xp));
        if (newStage < g.stageIdx) {
          // De-evolution!
          for (let i = 0; i < 10; i++) {
            g.particles.push({
              x: g.egg.x + (Math.random() - 0.5) * 30,
              y: g.egg.y + (Math.random() - 0.5) * 30,
              vx: (Math.random() - 0.5) * 3,
              vy: -(Math.random() * 2),
              life: 20 + Math.random() * 15,
              maxLife: 35,
              size: 2 + Math.random() * 3,
              hue: 0,
            });
          }
        }
        g.stageIdx = newStage;
        setUiXP(g.xp);
        setUiStage(g.stageIdx);
      }

      // Egg on platform
      if ((g.state === "idle" || g.state === "charging") && egg.onPlatform) {
        const platScreenY = egg.onPlatform.y - camera.y;
        // If platform scrolled off screen, fall
        if (platScreenY > H) {
          egg.onPlatform = null;
          egg.vy = 0;
          g.state = "jumping";
        } else {
          egg.x += egg.onPlatform.speed * dt;
          egg.x = Math.max(EGG_R, Math.min(W - EGG_R, egg.x));
          egg.y = egg.onPlatform.y - EGG_R;
        }
      }

      // Jumping physics
      if (g.state === "jumping") {
        egg.vy += GRAVITY * dt;
        egg.x += egg.vx * dt;
        egg.y += egg.vy * dt;

        if (egg.x < EGG_R) { egg.x = EGG_R; egg.vx = Math.abs(egg.vx) * 0.7; }
        if (egg.x > W - EGG_R) { egg.x = W - EGG_R; egg.vx = -Math.abs(egg.vx) * 0.7; }

        // Trail particles
        if (egg.vy < -1 && Math.random() > 0.5) {
          const isPerfectTrail = g.perfectFlash > 0;
          g.particles.push({
            x: egg.x + (Math.random() - 0.5) * 10,
            y: egg.y + EGG_R + 4,
            vx: (Math.random() - 0.5) * (isPerfectTrail ? 2 : 0.5),
            vy: Math.random() * 0.8 + 0.3,
            life: isPerfectTrail ? 25 : 15 + Math.random() * 10,
            maxLife: isPerfectTrail ? 35 : 25,
            size: isPerfectTrail ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2,
            hue: isPerfectTrail ? 45 + Math.random() * 20 : 200,
          });
        }

        // Landing check
        if (egg.vy > 0) {
          const eggScreenY = egg.y - camera.y;
          // Egg must be on screen to land
          if (eggScreenY < H + 10) {
            for (const p of platforms) {
              const screenY = p.y - camera.y;
              // Only allow landing on platforms visible on screen
              if (screenY < -20 || screenY > H) continue;
              if (p.removing) continue;
            
            const prevY = egg.y - egg.vy * dt;
            if (
              prevY + EGG_R <= p.y + 4 &&
              egg.y + EGG_R >= p.y - 2 &&
              egg.x + EGG_R * 0.6 > p.x &&
              egg.x - EGG_R * 0.6 < p.x + p.w
            ) {
              egg.y = p.y - EGG_R;
              egg.vy = 0;
              egg.vx = 0;
              egg.onPlatform = p;
              g.state = "idle";
              
              // Mark timed platform as landed
              if (p.type === "timed") p.landed = true;
              
              // Only gain XP if landing higher than before
              if (p.y < g.highestPlatformY) {
                g.xp += 3;
                g.highestPlatformY = p.y;
                g.landingFx = { y: p.y, x: egg.x, timer: 20, text: `+3 XP` };
              } else {
                g.landingFx = { y: p.y, x: egg.x, timer: 20, text: `SAFE` };
              }
              
              g.score = Math.max(g.score, Math.floor((540 - p.y) / 12));
              g.xpDecayTimer = 0;
              setUiScore(g.score);
              setUiXP(g.xp);

              // Landing particles
              for (let i = 0; i < 8; i++) {
                g.particles.push({
                  x: egg.x + (Math.random() - 0.5) * 20,
                  y: p.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: -(Math.random() * 2 + 0.5),
                  life: 20 + Math.random() * 15,
                  maxLife: 35,
                  size: 2 + Math.random() * 3,
                  hue: p.hue,
                });
              }


              // Evolution check
              g.prevStageIdx = g.stageIdx;
              g.stageIdx = getStage(Math.floor(g.xp));
              if (g.stageIdx > g.prevStageIdx) {
                evolveFlashRef.current = true;
                setTimeout(() => { evolveFlashRef.current = false; }, 1200);
                for (let i = 0; i < 20; i++) {
                  const angle = (i / 20) * Math.PI * 2;
                  g.particles.push({
                    x: egg.x, y: egg.y,
                    vx: Math.cos(angle) * (2 + Math.random() * 3),
                    vy: Math.sin(angle) * (2 + Math.random() * 3),
                    life: 30 + Math.random() * 20,
                    maxLife: 50,
                    size: 3 + Math.random() * 4,
                    hue: 50,
                  });
                }
              }
              setUiStage(g.stageIdx);

              break;
            }
          }
          } // end eggScreenY check
        }

        // Game over - tighter boundary
        if (egg.y > camera.y + H + 20) {
          g.state = "gameover";
          g.highScore = Math.max(g.highScore, g.score);
          setUiHighScore(g.highScore);
          setUiGameOver(true);
        }
      }

      // Camera
      const targetCamY = egg.y - H * 0.55;
      if (targetCamY < camera.y) {
        camera.y += (targetCamY - camera.y) * 0.07 * dt;
      }
      g.heightReached = Math.min(g.heightReached, egg.y);

      // Platform management
      let minY = Math.min(...platforms.map((p) => p.y));
      while (minY > camera.y - 300) {
        const idx = platforms.length;
        const newY = minY - PLATFORM_GAP;
        platforms.push(createPlatform(newY, idx));
        minY = newY;
      }
      g.platforms = platforms.filter((p) => p.y < camera.y + H + 50);

      // Particles
      for (const p of g.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.05 * dt;
        p.life -= dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      // Landing FX
      if (g.landingFx) {
        g.landingFx.timer -= dt;
        if (g.landingFx.timer <= 0) g.landingFx = null;
      }

      // Perfect jump flash
      if (g.perfectFlash > 0) {
        g.perfectFlash -= dt;
      }
    }

    function render(ctx) {
      const g = game.current;
      const { egg, platforms, camera, power } = g;

      // BG
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#070714");
      bgGrad.addColorStop(0.4, "#0d0d24");
      bgGrad.addColorStop(1, "#141432");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Perfect jump screen flash
      if (g.perfectFlash > 0) {
        const flashAlpha = Math.min(0.5, g.perfectFlash / 20);
        const flashGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W);
        flashGrad.addColorStop(0, `rgba(255, 230, 100, ${flashAlpha})`);
        flashGrad.addColorStop(0.5, `rgba(255, 180, 50, ${flashAlpha * 0.5})`);
        flashGrad.addColorStop(1, `rgba(255, 100, 30, 0)`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, W, H);
      }

      // Stars
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97.3 + 30) % W;
        const sy = ((i * 137.5 + camera.y * 0.05 * ((i % 3) + 1)) % (H + 40) + H + 40) % (H + 40);
        ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 4) * 0.08})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Height
      const height = Math.max(0, Math.floor((540 - g.heightReached) / 12));
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${height}m`, W - 12, 20);

      // XP decay warning
      if ((g.state === "idle" || g.state === "charging") && g.xp > 0 && g.xpDecayTimer > 120) {
        const warnAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.3;
        ctx.fillStyle = `rgba(255, 80, 80, ${warnAlpha})`;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("⚠ XP DECAYING...", W / 2, 18);
      }

      ctx.save();
      ctx.translate(0, -camera.y);

      // Platforms
      for (const p of platforms) {
        const sy = p.y - camera.y;
        if (sy < -20 || sy > H + 20) continue;

        if (p.type === "timed") {
          // Timed platform - dark stone with big centered countdown
          const urgency = p.landed ? Math.max(0, p.timer / 300) : 1;
          const pulse = p.landed ? 0.5 + Math.sin(Date.now() / (80 + urgency * 150)) * 0.5 : 1;
          const secs = Math.max(0, Math.ceil(p.timer / 60));
          
          // Thicker platform for visibility
          const th = 22;
          const ty = p.y - 6;

          ctx.shadowColor = `rgba(255, 60, 40, ${0.25 * pulse})`;
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;

          // Dark stone base
          const pg = ctx.createLinearGradient(p.x, ty, p.x, ty + th);
          pg.addColorStop(0, `rgba(80, 70, 90, ${0.6 + urgency * 0.4})`);
          pg.addColorStop(0.5, `rgba(55, 45, 65, ${0.6 + urgency * 0.4})`);
          pg.addColorStop(1, `rgba(40, 30, 50, ${0.6 + urgency * 0.4})`);
          ctx.fillStyle = pg;
          roundRect(ctx, p.x, ty, p.w, th, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Border glow - red when urgent
          ctx.strokeStyle = p.landed 
            ? `rgba(255, ${50 + urgency * 120}, 50, ${0.3 + pulse * 0.5})`
            : "rgba(150, 140, 170, 0.3)";
          ctx.lineWidth = 1.5;
          roundRect(ctx, p.x, ty, p.w, th, 6);
          ctx.stroke();

          // Big centered number or label
          const isEggOnThis = egg.onPlatform === p;
          if (p.landed) {
            ctx.fillStyle = secs <= 2
              ? `rgba(255, 80, 60, ${0.7 + pulse * 0.3})`
              : `rgba(255, 220, 150, ${0.7 + pulse * 0.3})`;
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (isEggOnThis) {
              ctx.fillText(`${secs}`, p.x + p.w / 2, ty + th / 2);
            } else {
              // Paused - show dimmer number with pause icon
              ctx.globalAlpha = 0.5;
              ctx.fillText(`⏸${secs}`, p.x + p.w / 2, ty + th / 2);
              ctx.globalAlpha = 1.0;
            }
          } else {
            ctx.fillStyle = "rgba(200, 180, 220, 0.5)";
            ctx.font = "bold 10px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("5", p.x + p.w / 2, ty + th / 2);
          }

        } else if (p.type === "fragile") {
          // Fragile platform - bright eye-catching wooden plank
          const th = 18;
          const ty = p.y - 4;
          const wobble = Math.sin(Date.now() / 200) * 1;

          // Bright orange-gold glow
          ctx.shadowColor = "rgba(255, 180, 50, 0.55)";
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 3;

          // Bright warm wood body
          const pg = ctx.createLinearGradient(p.x, ty, p.x, ty + th);
          pg.addColorStop(0, "#F0C060");
          pg.addColorStop(0.15, "#E0A840");
          pg.addColorStop(0.5, "#CC8E30");
          pg.addColorStop(0.85, "#A06820");
          pg.addColorStop(1, "#7A4E18");
          ctx.fillStyle = pg;
          roundRect(ctx, p.x + wobble, ty, p.w, th, 3);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Orange border
          ctx.strokeStyle = "rgba(255, 150, 30, 0.6)";
          ctx.lineWidth = 1.5;
          roundRect(ctx, p.x + wobble, ty, p.w, th, 3);
          ctx.stroke();

          // Wood grain
          ctx.strokeStyle = "rgba(80, 45, 10, 0.25)";
          ctx.lineWidth = 0.7;
          for (let i = 0; i < 4; i++) {
            const ly = ty + 3 + i * (th - 4) / 4;
            ctx.beginPath();
            ctx.moveTo(p.x + wobble + 4, ly);
            for (let j = 0; j < p.w - 8; j += 8) {
              ctx.quadraticCurveTo(
                p.x + wobble + 4 + j + 4, ly + Math.sin(j * 0.3 + i) * 1.5,
                p.x + wobble + 4 + j + 8, ly
              );
            }
            ctx.stroke();
          }

          // Big crack
          ctx.strokeStyle = "rgba(40, 15, 5, 0.6)";
          ctx.lineWidth = 1.8;
          const cx = p.x + wobble + p.w * 0.48;
          ctx.beginPath();
          ctx.moveTo(cx, ty + 1);
          ctx.lineTo(cx + 3, ty + th * 0.35);
          ctx.lineTo(cx - 3, ty + th * 0.65);
          ctx.lineTo(cx + 1, ty + th - 1);
          ctx.stroke();

          // Nails
          ctx.fillStyle = "#AAA09A";
          ctx.strokeStyle = "rgba(60, 40, 20, 0.7)";
          ctx.lineWidth = 0.8;
          [p.x + wobble + 6, p.x + wobble + p.w - 6].forEach((nx) => {
            ctx.beginPath();
            ctx.arc(nx, ty + th / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });

          // Bright pulsing "1x" label
          const labelPulse = 0.7 + Math.sin(Date.now() / 250) * 0.3;
          ctx.fillStyle = `rgba(255, 240, 200, ${labelPulse})`;
          ctx.font = "bold 11px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("1×", p.x + wobble + p.w / 2, ty + th / 2);

          // Animated warning above
          ctx.fillStyle = `rgba(255, 200, 50, ${labelPulse})`;
          ctx.font = "10px serif";
          ctx.textAlign = "center";
          ctx.fillText("⚠", p.x + wobble + p.w / 2, ty - 6);

        } else {
          // Normal platform
          ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.35)`;
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 4;

          const pg = ctx.createLinearGradient(p.x, p.y - 2, p.x, p.y + p.h + 2);
          pg.addColorStop(0, `hsl(${p.hue}, 70%, 65%)`);
          pg.addColorStop(1, `hsl(${p.hue}, 60%, 45%)`);
          ctx.fillStyle = pg;
          roundRect(ctx, p.x, p.y, p.w, p.h, 5);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Top highlight
          ctx.fillStyle = `hsla(${p.hue}, 80%, 80%, 0.35)`;
          roundRect(ctx, p.x + 3, p.y + 1, p.w - 6, 3, 1.5);
          ctx.fill();
        }
      }

      // Birds
      for (const b of g.birds) {
        const bsy = b.y - camera.y;
        if (bsy < -30 || bsy > H + 30) continue;
        const wingUp = Math.sin(b.frame) > 0;
        ctx.font = "22px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(wingUp ? "🦅" : "🐦", b.x, b.y);
      }

      // Particles
      for (const p of g.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }

      // Landing FX text
      if (g.landingFx) {
        const fx = g.landingFx;
        const isPerfectFx = fx.text.includes("PERFECT");
        const maxTimer = isPerfectFx ? 40 : 20;
        const a = Math.min(1, Math.max(0, fx.timer / maxTimer));
        
        if (isPerfectFx) {
          // Big golden glowing perfect text
          ctx.save();
          ctx.shadowColor = `rgba(255, 200, 50, ${a * 0.8})`;
          ctx.shadowBlur = 20;
          ctx.fillStyle = `rgba(255, 230, 80, ${a})`;
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.fillText(fx.text, fx.x, fx.y - 30 + (1 - a) * -25);
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(255, 230, 100, ${a})`;
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.fillText(fx.text, fx.x, fx.y - 25 + (1 - a) * -15);
        }
      }

      // Egg
      const bobble = g.state === "idle" ? Math.sin(Date.now() / 350) * 3
        : g.state === "charging" ? Math.sin(Date.now() / 40) * 2 : 0;
      const stretch = g.state === "jumping" && egg.vy < -3 ? 0.82
        : g.state === "jumping" && egg.vy > 3 ? 1.18
        : 1;

      ctx.save();
      ctx.translate(egg.x, egg.y + bobble);

      // Evolve flash glow (separate save/restore to not affect emoji)
      if (evolveFlashRef.current) {
        ctx.save();
        const glowAlpha = 0.3 + Math.sin(Date.now() / 80) * 0.25;
        ctx.shadowColor = `rgba(255, 215, 0, ${glowAlpha})`;
        ctx.shadowBlur = 40;
        ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(0, 0, EGG_R * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw emoji - fully opaque, no shadows
      ctx.scale(1 / stretch, stretch);
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const currentEmoji = STAGES[g.stageIdx].emoji;
      ctx.font = `${EGG_R * 2.2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(currentEmoji, 0, -1);

      ctx.restore();

      ctx.restore(); // end camera

      // === UI Layer ===

      // Power bar (idle or charging)
      if (g.state === "idle" || g.state === "charging") {
        const barW = W - 80;
        const barH = 20;
        const barX = 40;
        const barY = H - 58;
        const pv = power.value;
        const isMax = pv >= 99;
        const maxPulse = isMax ? 0.6 + Math.sin(Date.now() / 80) * 0.4 : 0;

        // Bright container background
        ctx.fillStyle = isMax
          ? `rgba(255, 60, 40, ${0.25 + maxPulse * 0.15})`
          : "rgba(30, 40, 80, 0.85)";
        roundRect(ctx, barX - 8, barY - 26, barW + 16, barH + 46, 14);
        ctx.fill();
        // Container border
        ctx.strokeStyle = isMax
          ? `rgba(255, 80, 50, ${0.5 + maxPulse * 0.5})`
          : "rgba(100, 140, 255, 0.3)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, barX - 8, barY - 26, barW + 16, barH + 46, 14);
        ctx.stroke();

        // Max glow border
        if (isMax) {
          ctx.shadowColor = `rgba(255, 60, 40, ${maxPulse})`;
          ctx.shadowBlur = 20;
          roundRect(ctx, barX - 8, barY - 26, barW + 16, barH + 46, 14);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Label
        if (isMax) {
          ctx.fillStyle = `rgba(255, 100, 80, ${0.7 + maxPulse * 0.3})`;
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText("⚡ MAX POWER! RELEASE! ⚡", W / 2, barY - 9);
        } else {
          ctx.fillStyle = g.state === "charging" ? "rgba(255,220,80,0.85)" : "rgba(180,200,255,0.6)";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            g.state === "charging" ? "⚡ CHARGING... RELEASE!" : "⎵ HOLD SPACE",
            W / 2, barY - 9
          );
        }

        // Track - bright visible background
        const trackGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
        trackGrad.addColorStop(0, "rgba(40, 50, 90, 0.9)");
        trackGrad.addColorStop(0.5, "rgba(30, 35, 70, 0.9)");
        trackGrad.addColorStop(1, "rgba(20, 25, 55, 0.9)");
        ctx.fillStyle = trackGrad;
        roundRect(ctx, barX, barY, barW, barH, 10);
        ctx.fill();
        // Track inner border
        ctx.strokeStyle = "rgba(100, 130, 200, 0.25)";
        ctx.lineWidth = 1;
        roundRect(ctx, barX, barY, barW, barH, 10);
        ctx.stroke();

        // Fill - bright glowing gradient
        const fillW = (pv / 100) * barW;
        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        barGrad.addColorStop(0, "#22efb5");
        barGrad.addColorStop(0.35, "#40e070");
        barGrad.addColorStop(0.55, "#ffe040");
        barGrad.addColorStop(0.75, "#ff8c20");
        barGrad.addColorStop(0.9, "#ff4444");
        barGrad.addColorStop(1, "#ff2020");
        ctx.fillStyle = barGrad;

        if (isMax) {
          ctx.shadowColor = `rgba(255, 60, 40, ${0.5 + maxPulse * 0.5})`;
          ctx.shadowBlur = 25;
        } else {
          const glowColor = pv > 70 ? "rgba(255,140,30,0.4)" : "rgba(50,230,150,0.4)";
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 12;
        }
        roundRect(ctx, barX, barY, Math.max(8, fillW), barH, 10);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Fill top highlight
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        roundRect(ctx, barX + 2, barY + 2, Math.max(4, fillW - 4), barH * 0.35, 6);
        ctx.fill();

        // Fill edge glow dot
        const edgeColor = pv > 85 ? "#ff4444" : pv > 60 ? "#ff8c20" : "#22efb5";
        ctx.shadowColor = edgeColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(barX + fillW, barY + barH / 2, isMax ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Sweet spot zone highlight
        const s1 = barX + barW * 0.6;
        const s2 = barX + barW * 0.85;
        ctx.fillStyle = "rgba(255, 255, 100, 0.08)";
        roundRect(ctx, s1, barY, s2 - s1, barH, 0);
        ctx.fill();

        // Sweet spot markers
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        [s1, s2].forEach((sx) => {
          ctx.beginPath();
          ctx.moveTo(sx, barY - 2);
          ctx.lineTo(sx, barY + barH + 2);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Percentage
        if (isMax) {
          ctx.fillStyle = `rgba(255, 100, 80, ${0.8 + maxPulse * 0.2})`;
          ctx.font = "bold 14px monospace";
        } else {
          ctx.fillStyle = "rgba(220,230,255,0.8)";
          ctx.font = "bold 11px monospace";
        }
        ctx.textAlign = "center";
        ctx.fillText(`${Math.floor(pv)}%`, W / 2, barY + barH + 17);
      }

      // Game Over
      if (g.state === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, W, H);

        const finalStage = STAGES[g.stageIdx];

        ctx.font = "60px serif";
        ctx.textAlign = "center";
        ctx.fillText(finalStage.emoji, W / 2, H / 2 - 55);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px monospace";
        ctx.fillText("GAME OVER", W / 2, H / 2 + 5);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`${finalStage.name} · ${g.score}m · XP ${Math.floor(g.xp)}`, W / 2, H / 2 + 35);

        if (g.highScore > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "11px monospace";
          ctx.fillText(`BEST: ${g.highScore}m`, W / 2, H / 2 + 58);
        }

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "12px monospace";
        ctx.fillText("TAP or SPACE to retry", W / 2, H / 2 + 95);
      }
    }

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  // Input
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (e.repeat) return;
        if (game.current.state === "gameover") initGame();
        else startCharging();
      }
    }
    function onKeyUp(e) {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        releaseJump();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startCharging, releaseJump, initGame]);

  function handlePointerDown(e) {
    e.preventDefault();
    if (game.current.state === "gameover") initGame();
    else startCharging();
  }

  function handlePointerUp(e) {
    e.preventDefault();
    releaseJump();
  }

  const stageData = STAGES[uiStage];
  const nextStage = uiStage < STAGES.length - 1 ? STAGES[uiStage + 1] : null;
  const prevStageXP = STAGES[uiStage].need;
  const nextStageXP = nextStage ? nextStage.need : STAGES[STAGES.length - 1].need;
  const xpProgress = nextStage ? Math.min(100, ((uiXP - prevStageXP) / (nextStageXP - prevStageXP)) * 100) : 100;
  const displayXP = Math.floor(uiXP);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "#030308",
        padding: "12px 8px",
        fontFamily: "monospace",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      {/* Top Bar */}
      <div
        style={{
          width: W,
          maxWidth: "100%",
          padding: "8px 14px",
          marginBottom: 6,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          color: "#fff",
          fontSize: 12,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span>
            {stageData.emoji}{" "}
            <span style={{ color: stageData.color, fontWeight: "bold" }}>
              {stageData.name}
            </span>
          </span>
          <span style={{ color: "#fbbf24", fontWeight: "bold" }}>📏 {uiScore}m</span>
          <span style={{ opacity: 0.6, fontSize: 10, color: "#a78bfa" }}>
            XP {displayXP}
          </span>
        </div>
        {/* XP Progress Bar */}
        <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${xpProgress}%`,
            background: `linear-gradient(90deg, ${stageData.color}AA, ${stageData.color})`,
            borderRadius: 3,
            transition: "width 0.05s linear",
            boxShadow: `0 0 8px ${stageData.color}44`,
          }} />
        </div>
        {nextStage && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, opacity: 0.35 }}>
            <span>{prevStageXP} XP</span>
            <span>다음 진화: {nextStage.emoji} {nextStage.name} ({nextStageXP} XP)</span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        style={{
          borderRadius: 14,
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 4px 40px rgba(0,0,0,0.6)",
          maxWidth: "100%",
          touchAction: "manipulation",
        }}
      />

      {/* Evolution Roadmap */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 10,
          padding: "6px 14px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        {STAGES.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: uiXP >= s.need ? 1 : 0.25,
              transition: "all 0.4s",
            }}
          >
            <span
              style={{
                fontSize: i === uiStage ? "1.5rem" : "1rem",
                filter: uiXP >= s.need ? "none" : "grayscale(1)",
                transition: "font-size 0.3s",
              }}
            >
              {s.emoji}
            </span>
            {i === uiStage && (
              <span
                style={{
                  fontSize: 7,
                  color: s.color,
                  marginTop: 1,
                  fontWeight: "bold",
                }}
              >
                {s.name}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <p
        style={{
          color: "rgba(255,255,255,0.2)",
          fontSize: 10,
          marginTop: 10,
          textAlign: "center",
          fontFamily: "'Noto Sans KR', sans-serif",
          lineHeight: 1.6,
        }}
      >
        스페이스바를 꾹 누르면 파워 충전 · 떼면 점프!
        <br />
        ⏱ 시한부 발판 · 💔 일회용 발판 · 🦅 새 조심!
      </p>
    </div>
  );
}
