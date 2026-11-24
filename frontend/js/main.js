(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const $ = (id) => document.getElementById(id);

  let state = 'loading'; // loading | menu | story | playing | draft | pause | over
  let profile = null;
  let leaderboard = [];
  let selectedHeroId = 'knight';
  let runTime = 0;
  let spawnAcc = 0;
  let activeBoss = null;
  const triggeredBosses = new Set();
  const triggeredChapters = new Set();
  let collectedScrollsRun = new Set();

  // Input State
  const keys = {};
  let joyX = 0;
  let joyZ = 0;
  const raycaster = new THREE.Raycaster();
  const mouseNdc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3();

  function hideAllOverlays() {
    ['menuScr', 'storyScr', 'shopScr', 'codexScr', 'draftScr', 'pauseScr', 'overScr'].forEach((id) => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
  }

  function refreshMenu() {
    DS.ui.renderMenu(profile, selectedHeroId, leaderboard, async (heroId) => {
      const unlocked = new Set(profile.unlockedHeroes || ['knight', 'wizard', 'archer']);
      if (unlocked.has(heroId)) {
        selectedHeroId = heroId;
        refreshMenu();
        return;
      }
      const h = DS.HEROES[heroId];
      if ((profile.gold || 0) >= h.cost) {
        unlocked.add(heroId);
        profile = await DS.api.saveProfile({
          gold: profile.gold - h.cost,
          unlockedHeroes: Array.from(unlocked)
        });
        selectedHeroId = heroId;
        refreshMenu();
      }
    });
  }

  function beginPlay(heroOverride) {
    if (heroOverride && DS.HEROES[heroOverride]) selectedHeroId = heroOverride;
    hideAllOverlays();
    $('hud').classList.remove('hidden');
    DS.audio.unlock();
    runTime = 0;
    spawnAcc = 0;
    activeBoss = null;
    triggeredBosses.clear();
    triggeredChapters.clear();
    collectedScrollsRun = new Set((profile && profile.discoveredScrolls) || []);
    DS.world.resetArenaObjects(profile ? profile.discoveredScrolls : []);
    DS.entities.resetEntities(selectedHeroId, profile);
    DS.entities.spawnPack('slime', 6, 14);
    state = 'playing';

    triggeredChapters.add(0);
    DS.ui.showStoryBanner(DS.STORY.chapters[0]);
    DS.ui.updateHud(runTime, activeBoss, collectedScrollsRun.size, profile ? profile.quality : 'balanced');
    DS.ui.drawMinimap(activeBoss);
  }

  function startRequested() {
    let seen = false;
    try {
      seen = !!localStorage.getItem('ds3d_story_seen');
    } catch {}
    if (!seen) {
      state = 'story';
      hideAllOverlays();
      DS.ui.showStoryModal(profile, true, () => beginPlay());
    } else {
      beginPlay();
    }
  }

  async function finishRun(win) {
    if (state === 'over') return;
    state = 'over';
    DS.entities.clearDmgNumbers();
    const p = DS.entities.player;
    const patch = {
      gold: (profile.gold || 0) + p.goldEarned,
      bestTimeSec: Math.max(profile.bestTimeSec || 0, Math.floor(runTime)),
      bestKills: Math.max(profile.bestKills || 0, p.kills)
    };
    profile = await DS.api.saveProfile(patch);
    DS.ui.showGameOver(win, runTime);
  }

  function openDraftModal() {
    state = 'draft';
    DS.audio.playLevelUp();
    DS.ui.renderDraft(
      DS.entities.skills,
      DS.entities.evolvedSkills,
      DS.entities.passives,
      (card) => {
        if (card.kind === 'evo') {
          DS.entities.evolvedSkills[card.key] = true;
        } else if (card.kind === 'skill') {
          DS.entities.skills[card.key] = (DS.entities.skills[card.key] || 0) + 1;
        } else {
          DS.entities.passives[card.key] = (DS.entities.passives[card.key] || 0) + 1;
          if (card.key === 'p_hp') {
            DS.entities.player.maxHp += 35;
            DS.entities.player.hp = Math.min(DS.entities.player.maxHp, DS.entities.player.hp + 35);
          }
        }
        $('draftScr').classList.add('hidden');
        state = 'playing';
      }
    );
  }

  DS.game = {
    async onScrollCollected(scrollDef) {
      collectedScrollsRun.add(scrollDef.id);
      if (collectedScrollsRun.size >= DS.SCROLL_DEFS.length) {
        DS.entities.player.scrollBonusMight = 0.15;
      }
      DS.ui.showLoreToast(scrollDef);
      const saved = new Set((profile && profile.discoveredScrolls) || []);
      if (!saved.has(scrollDef.id)) {
        saved.add(scrollDef.id);
        profile = await DS.api.saveProfile({ discoveredScrolls: Array.from(saved) });
      }
    },
    onBossDragonSlain() {
      finishRun(true);
    },
    onPlayerDead() {
      finishRun(false);
    }
  };

  function getMoveVector() {
    let mx = joyX;
    let mz = joyZ;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    return [mx, mz];
  }

  function waveStep(dt) {
    spawnAcc += dt;
    const interval = Math.max(1.15, 2.7 - runTime * 0.005);
    if (spawnAcc >= interval) {
      spawnAcc = 0;
      let pool = ['slime', 'goblin'];
      if (runTime >= 35) pool = ['goblin', 'mushroom', 'skeleton'];
      if (runTime >= 75) pool = ['skeleton', 'ghost', 'zombie'];
      if (runTime >= 150) pool = ['zombie', 'troll', 'golem'];
      if (runTime >= 240) pool = ['troll', 'golem', 'souleater'];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      DS.entities.spawnPack(pick, 3 + Math.min(4, Math.floor(runTime / 70)), 17);
    }

    if (runTime >= 45 && !triggeredChapters.has(1)) {
      triggeredChapters.add(1);
      DS.ui.showStoryBanner(DS.STORY.chapters[1]);
    }

    for (const sch of DS.BOSS_SCHEDULE) {
      if (runTime >= sch.time && !triggeredBosses.has(sch.time)) {
        triggeredBosses.add(sch.time);
        const angle = Math.random() * Math.PI * 2;
        const blim = DS.world.ARENA_LIMIT - 4;
        const bx = Math.max(-blim, Math.min(blim, DS.entities.player.x + Math.cos(angle) * 18));
        const bz = Math.max(-blim, Math.min(blim, DS.entities.player.z + Math.sin(angle) * 18));
        activeBoss = DS.entities.spawnMonster(sch.type, bx, bz, 1);
        DS.ui.showStoryBanner(DS.STORY.chapters[sch.chapterIdx]);
      }
    }
  }

  let lastFrameMs = performance.now();
  let minimapTick = 0;
  function animate(nowMs) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;

    if (state === 'playing') {
      runTime += dt;
      const [mx, mz] = getMoveVector();
      DS.entities.update(dt, mx, mz);
      waveStep(dt);

      const p = DS.entities.player;
      if (p.xp >= p.nextXp) {
        p.xp -= p.nextXp;
        p.level++;
        p.nextXp = Math.round(p.nextXp * 1.28 + 15);
        openDraftModal();
      }
      DS.vfx.update(dt, nowMs * 0.001, p.x, p.z);
      DS.ui.updateHud(runTime, activeBoss, collectedScrollsRun.size, profile ? profile.quality : 'balanced');
      if (minimapTick++ % 4 === 0) DS.ui.drawMinimap(activeBoss);
    } else {
      DS.vfx.update(0, nowMs * 0.001, DS.entities.player.x, DS.entities.player.z);
    }
    DS.vfx.renderFrame();
  }

  function bindInputs() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (state === 'story' && (e.code === 'Enter' || e.code === 'Space')) {
        $('btnStoryContinue').click();
        return;
      }
      if (state !== 'playing') {
        if (e.code === 'Escape' && state === 'pause') {
          $('pauseScr').classList.add('hidden');
          state = 'playing';
        }
        return;
      }
      if (e.code === 'KeyJ') DS.entities.triggerPlayerCombo();
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        const [mx, mz] = getMoveVector();
        DS.entities.triggerDash(mx, mz);
      }
      if (e.code === 'KeyE' || e.code === 'KeyQ') DS.entities.triggerUltimate(false);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        state = 'pause';
        $('pauseScr').classList.remove('hidden');
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    const cvs = DS.vfx.renderer.domElement;
    cvs.addEventListener('pointermove', (e) => {
      if (state !== 'playing') return;
      mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, DS.vfx.camera);
      if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) {
        const p = DS.entities.player;
        p.aimYaw = Math.atan2(aimPoint.x - p.x, aimPoint.z - p.z);
        p.hasMouseAim = true;
      }
    });

    cvs.addEventListener('pointerdown', (e) => {
      if (state !== 'playing') return;
      if (e.button === 0) DS.entities.triggerPlayerCombo();
      else if (e.button === 2) DS.entities.triggerUltimate(false);
    });
    cvs.addEventListener('contextmenu', (e) => e.preventDefault());

    $('btnAtk').onclick = () => state === 'playing' && DS.entities.triggerPlayerCombo();
    $('btnDash').onclick = () => {
      if (state !== 'playing') return;
      const [mx, mz] = getMoveVector();
      DS.entities.triggerDash(mx, mz);
    };
    $('btnUlt').onclick = () => state === 'playing' && DS.entities.triggerUltimate(false);

    // Virtual Joystick
    const joyZone = $('joyZone');
    const joyKnob = $('joyKnob');
    let joyPtr = null;
    joyZone.addEventListener('pointerdown', (e) => {
      joyPtr = e.pointerId;
      joyZone.setPointerCapture(e.pointerId);
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (joyPtr !== e.pointerId) return;
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const maxR = rect.width * 0.36;
      const d = Math.hypot(dx, dy);
      const cl = Math.min(maxR, d);
      const a = Math.atan2(dy, dx);
      const kx = Math.cos(a) * cl;
      const ky = Math.sin(a) * cl;
      joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      joyX = cl > 6 ? kx / maxR : 0;
      joyZ = cl > 6 ? ky / maxR : 0;
    });
    const endJoy = (e) => {
      if (joyPtr !== e.pointerId) return;
      joyPtr = null;
      joyX = 0;
      joyZ = 0;
      joyKnob.style.transform = 'translate(-50%, -50%)';
    };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    // UI Buttons
    $('btnStart').onclick = startRequested;
    $('btnStoryMenu').onclick = () => {
      hideAllOverlays();
      DS.ui.showStoryModal(profile, false, () => $('menuScr').classList.remove('hidden'));
    };
    $('btnShop').onclick = () => {
      hideAllOverlays();
      const buyFn = async (key, cost) => {
        if ((profile.gold || 0) < cost) return;
        const ml = Object.assign({}, profile.metaLevels);
        ml[key] = (ml[key] || 0) + 1;
        profile = await DS.api.saveProfile({ gold: profile.gold - cost, metaLevels: ml });
        DS.ui.renderShop(profile, buyFn);
        refreshMenu();
      };
      DS.ui.renderShop(profile, buyFn);
      $('shopScr').classList.remove('hidden');
    };
    $('btnCloseShop').onclick = () => {
      $('shopScr').classList.add('hidden');
      $('menuScr').classList.remove('hidden');
    };
    $('btnCodexMenu').onclick = () => {
      hideAllOverlays();
      DS.ui.renderCodex('skills');
      $('codexScr').classList.remove('hidden');
    };
    $('btnCodexHud').onclick = () => {
      if (state === 'playing') state = 'pause';
      DS.ui.renderCodex('skills');
      $('codexScr').classList.remove('hidden');
    };
    $('btnCloseCodex').onclick = () => {
      $('codexScr').classList.add('hidden');
      if (state === 'pause') {
        $('pauseScr').classList.remove('hidden');
      } else if (state === 'menu') {
        $('menuScr').classList.remove('hidden');
      }
    };
    document.querySelectorAll('#codexTabs .btn').forEach((b) => {
      b.onclick = () => DS.ui.renderCodex(b.dataset.tab);
    });

    $('btnLang').onclick = async () => {
      const next = (profile.lang || 'vi') === 'vi' ? 'en' : 'vi';
      profile = await DS.api.saveProfile({ lang: next });
      refreshMenu();
    };
    $('btnSoundMenu').onclick = () => {
      DS.audio.toggleMute();
      refreshMenu();
    };
    $('qualitySel').onchange = async (e) => {
      const q = e.target.value;
      DS.vfx.applyQuality(q);
      profile = await DS.api.saveProfile({ quality: q });
      refreshMenu();
    };
    $('qBadge').onclick = async () => {
      const order = ['fast', 'balanced', 'high'];
      const cur = (profile && profile.quality) || 'balanced';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      DS.vfx.applyQuality(next);
      profile = await DS.api.saveProfile({ quality: next });
    };

    $('btnPause').onclick = () => {
      if (state !== 'playing') return;
      state = 'pause';
      $('pauseScr').classList.remove('hidden');
    };
    $('btnResume').onclick = () => {
      $('pauseScr').classList.add('hidden');
      state = 'playing';
    };
    $('btnRestartPause').onclick = () => beginPlay();
    $('btnMenuPause').onclick = () => {
      hideAllOverlays();
      $('hud').classList.add('hidden');
      state = 'menu';
      refreshMenu();
      $('menuScr').classList.remove('hidden');
    };
    $('btnRetry').onclick = () => beginPlay();
    $('btnBackMenu').onclick = () => {
      hideAllOverlays();
      $('hud').classList.add('hidden');
      state = 'menu';
      refreshMenu();
      $('menuScr').classList.remove('hidden');
    };
    $('btnSaveScore').onclick = async () => {
      const nm = ($('overNameInput').value || 'Hero').trim();
      const p = DS.entities.player;
      leaderboard = await DS.api.submitScore({
        name: nm,
        hero: p.heroId,
        timeSec: Math.floor(runTime),
        kills: p.kills,
        level: p.level,
        win: p.hp > 0
      });
      $('btnSaveScore').textContent = '✔ Saved!';
      $('btnSaveScore').disabled = true;
    };
  }

  // Automation Verification Hook
  window.__dsTest = {
    start(opts) {
      beginPlay(opts && opts.hero);
      return true;
    },
    selectHero(id) {
      selectedHeroId = id;
      refreshMenu();
      return selectedHeroId;
    },
    spawnPack(type, n) {
      DS.entities.spawnPack(type, n || 5, 11);
      return true;
    },
    triggerVFX(mode) {
      const p = DS.entities.player;
      p.xp = 0;
      p.nextXp = 99999; // Keep draft modal from blocking VFX inspection
      if (mode === 'lightning') {
        ['C', 'J', 'L', 'U'].forEach((k) => {
          DS.entities.skills[k] = 5;
          DS.entities.fireSkill(k);
        });
      } else if (mode === 'frost') {
        ['E', 'O', 'V'].forEach((k) => {
          DS.entities.skills[k] = 5;
          DS.entities.fireSkill(k);
        });
      } else if (mode === 'divine' || mode === 'ult') {
        DS.entities.triggerUltimate(true);
      } else {
        ['B', 'H', 'P'].forEach((k) => {
          DS.entities.skills[k] = 5;
          DS.entities.fireSkill(k);
        });
      }
      DS.vfx.renderFrame();
      return true;
    },
    spawnBoss(type) {
      activeBoss = DS.entities.spawnMonster(
        type || 'dragon',
        DS.entities.player.x + 8,
        DS.entities.player.z - 6,
        1
      );
      DS.ui.updateHud(runTime, activeBoss, collectedScrollsRun.size, profile ? profile.quality : 'balanced');
      return true;
    },
    openDraft() {
      openDraftModal();
      return true;
    },
    triggerUlt() {
      return DS.entities.triggerUltimate(true);
    },
    triggerCombo() {
      return DS.entities.triggerPlayerCombo();
    },
    setTime(sec) {
      runTime = sec;
      return runTime;
    },
    getState() {
      return {
        state,
        runTime: Number(runTime.toFixed(2)),
        monsters: DS.entities.monsters.length,
        kills: DS.entities.player.kills,
        hp: DS.entities.player.hp,
        fury: DS.entities.player.fury,
        scrolls: collectedScrollsRun.size,
        quality: profile ? profile.quality : 'balanced',
        arenaLimit: DS.world.ARENA_LIMIT,
        zone: DS.world.getZoneFor(DS.entities.player.x, DS.entities.player.z).id
      };
    }
  };

  async function boot() {
    bindInputs();
    const [loadedProfile, loadedLb] = await Promise.all([
      DS.api.loadProfile(),
      DS.api.getLeaderboard(),
      DS.world.loadAllAssets((cur, tot) => {
        if ($('loadTxt')) $('loadTxt').textContent = `Đang nạp tài nguyên 3D... ${cur}/${tot}`;
      })
    ]);
    profile = loadedProfile;
    leaderboard = loadedLb;
    DS.vfx.applyQuality(profile.quality || 'balanced');
    DS.world.buildArena();
    if ($('loadScr')) $('loadScr').classList.add('hidden');
    state = 'menu';
    refreshMenu();
    $('menuScr').classList.remove('hidden');
    requestAnimationFrame(animate);
  }

  boot();
})();
