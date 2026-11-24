(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  const scene = DS.vfx.scene;
  const camera = DS.vfx.camera;

  const monsters = [];
  const projectiles = [];
  const weaponVfx = [];
  const pickups = [];
  let uidCounter = 1;
  let frameTick = 0;

  // Player State
  const player = {
    x: 0,
    z: 0,
    yaw: 0,
    aimYaw: 0,
    aimX: 0,
    aimZ: 7,
    hasMouseAim: false,
    heroId: 'knight',
    hp: 130,
    maxHp: 130,
    speed: 7.5,
    might: 1.0,
    area: 1.0,
    cdMult: 1.0,
    armor: 2,
    pickupR: 4.0,
    greed: 1.0,
    regen: 0.4,
    level: 1,
    xp: 0,
    nextXp: 30,
    kills: 0,
    goldEarned: 0,
    scrollBonusMight: 0,
    streak: 0,
    streakT: 0,
    shrineBuff: null,
    shrineCharging: null,
    // Active Combat
    comboStep: 0,
    comboResetT: 0,
    atkCd: 0,
    swingAnimT: 0,
    dashCd: 0,
    dashTimer: 0,
    dashDirX: 0,
    dashDirZ: 1,
    invulnT: 0,
    fury: 0,
    berserkT: 0,
    // Visual Refs
    group: null,
    mixer: null,
    weaponPivot: null,
    aimRing: null,
    berserkHalo: null
  };

  const skills = {}; // { A: 1, ... }
  const skillCds = {};
  const evolvedSkills = {};
  const passives = {};

  function buildPlayerVisual(heroId) {
    if (player.group) scene.remove(player.group);
    const hDef = DS.HEROES[heroId] || DS.HEROES.knight;
    const root = new THREE.Group();

    // Heroic 2.55m scale (~18% larger & sharper visibility)
    const m = DS.world.spawnModel('characters', hDef.model, 2.55, false);
    root.add(m.group);

    let mixer = null;
    if (m.clips && m.clips.length) {
      mixer = new THREE.AnimationMixer(m.inner);
      const walkClip =
        m.clips.find((c) => /run|walk|move/i.test(c.name)) || m.clips[0];
      if (walkClip) mixer.clipAction(walkClip).play();
    }

    // Wielded 3D Weapon Pivot on right side
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.68, 1.15, 0.22);
    const wp = DS.world.spawnModel('weapons', hDef.weapon, 1.55, true);
    wp.group.rotation.set(Math.PI * 0.18, 0, -Math.PI * 0.25);
    weaponPivot.add(wp.group);
    root.add(weaponPivot);

    // Directional Ground Aim Ring + Chevron Arrow
    const aimRing = new THREE.Group();
    aimRing.position.y = 0.05;
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.12, 28),
      new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    aimRing.add(ringMesh);

    const arrowGeo = new THREE.ConeGeometry(0.28, 0.55, 4);
    arrowGeo.rotateX(Math.PI / 2);
    const arrow = new THREE.Mesh(
      arrowGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd464 })
    );
    arrow.position.set(0, 0.06, 1.38);
    aimRing.add(arrow);
    root.add(aimRing);

    const berserkHalo = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.65, 28),
      new THREE.MeshBasicMaterial({ color: 0xff9b33, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    berserkHalo.rotation.x = -Math.PI / 2;
    berserkHalo.position.y = 0.06;
    berserkHalo.visible = false;
    root.add(berserkHalo);

    scene.add(root);
    player.group = root;
    player.mixer = mixer;
    player.weaponPivot = weaponPivot;
    player.aimRing = aimRing;
    player.berserkHalo = berserkHalo;
  }

  function resetEntities(heroId, profile) {
    for (const m of monsters) scene.remove(m.group);
    monsters.length = 0;
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0;
    for (const w of weaponVfx) scene.remove(w.group);
    weaponVfx.length = 0;
    for (const pk of pickups) scene.remove(pk.mesh);
    pickups.length = 0;

    for (const k of Object.keys(skills)) delete skills[k];
    for (const k of Object.keys(skillCds)) delete skillCds[k];
    for (const k of Object.keys(evolvedSkills)) delete evolvedSkills[k];
    for (const k of Object.keys(passives)) delete passives[k];

    const h = DS.HEROES[heroId] || DS.HEROES.knight;
    const ml = (profile && profile.metaLevels) || {};
    player.heroId = h.id;
    player.x = 0;
    player.z = 0;
    player.yaw = 0;
    player.aimYaw = 0;
    player.aimX = 0;
    player.aimZ = 7;
    player.hasMouseAim = false;
    player.maxHp = Math.round(h.hp + (ml.hp || 0) * 25);
    player.hp = player.maxHp;
    player.speed = h.speed * (1 + (ml.speed || 0) * 0.06);
    player.might = h.might * (1 + (ml.might || 0) * 0.1);
    player.area = h.area;
    player.cdMult = h.cd;
    player.armor = h.armor + (ml.armor || 0);
    player.pickupR = h.pickup + (ml.magnet || 0) * 1.0;
    player.greed = 1 + (ml.greed || 0) * 0.2;
    player.regen = 0.5;
    player.level = 1;
    player.xp = 0;
    player.nextXp = 28;
    player.kills = 0;
    player.goldEarned = 0;
    player.scrollBonusMight = 0;
    player.streak = 0;
    player.streakT = 0;
    player.shrineBuff = null;
    player.shrineCharging = null;

    player.comboStep = 0;
    player.comboResetT = 0;
    player.atkCd = 0;
    player.swingAnimT = 0;
    player.dashCd = 0;
    player.dashTimer = 0;
    player.invulnT = 0;
    player.fury = 35; // Start with some Fury so players see it charge fast
    player.berserkT = 0;

    skills[h.skill] = 1;
    skillCds[h.skill] = 0.2;

    buildPlayerVisual(h.id);
    DS.vfx.clearAll();
  }

  // Pooled Floating Damage DOM Numbers (28 elements, zero DOM churn)
  const dmgLayer = document.getElementById('dmgLayer');
  const dmgPool = [];
  const _projV = new THREE.Vector3();
  if (dmgLayer) {
    dmgLayer.innerHTML = '';
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'dmgNum hidden';
      dmgLayer.appendChild(el);
      dmgPool.push({ el, active: false, x: 0, y: 0, z: 0, life: 0, vy: 1.9 });
    }
  }
  let dmgCur = 0;

  function showDmg(x, y, z, txt, cls) {
    if (!dmgPool.length) return;
    const d = dmgPool[dmgCur];
    dmgCur = (dmgCur + 1) % dmgPool.length;
    d.active = true;
    d.x = x + (Math.random() - 0.5) * 0.5;
    d.y = y;
    d.z = z;
    d.life = 0.65;
    d.el.textContent = String(txt);
    d.el.className = 'dmgNum ' + (cls || '');
  }

  function updateDmgPool(dt) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const d of dmgPool) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        d.el.classList.add('hidden');
        continue;
      }
      d.y += d.vy * dt;
      _projV.set(d.x, d.y, d.z).project(camera);
      if (_projV.z > 1) {
        d.el.classList.add('hidden');
        continue;
      }
      const sx = (_projV.x * 0.5 + 0.5) * w;
      const sy = (-_projV.y * 0.5 + 0.5) * h;
      d.el.classList.remove('hidden');
      d.el.style.left = sx.toFixed(0) + 'px';
      d.el.style.top = sy.toFixed(0) + 'px';
      d.el.style.opacity = Math.min(1, d.life * 2.4).toFixed(2);
    }
  }

  function addFury(amount) {
    const mult = player.streak >= 10 ? 1.2 : 1.0;
    player.fury = Math.min(100, player.fury + amount * mult);
  }

  function effectiveStats() {
    const berserk = player.berserkT > 0 ? 1 : 0;
    const sb = player.shrineBuff && player.shrineBuff.timer > 0 ? player.shrineBuff.type : null;
    const might =
      player.might *
      (1 + (passives.p_might || 0) * 0.18 + player.scrollBonusMight + berserk * 0.5 + (sb === 'might' ? 0.3 : 0));
    const area = player.area * (1 + (passives.p_area || 0) * 0.18 + berserk * 0.25 + (sb === 'area' ? 0.35 : 0));
    const cd = Math.max(0.35, player.cdMult * (1 - (passives.p_cd || 0) * 0.12) * (berserk ? 0.65 : 1));
    const speed = player.speed * (1 + (passives.p_spd || 0) * 0.12 + berserk * 0.4 + (sb === 'speed' ? 0.25 : 0));
    const pickup = player.pickupR * (1 + (passives.p_magnet || 0) * 0.3 + (sb === 'magnet' ? 1.0 : 0));
    const armor = player.armor + (passives.p_armor || 0) * 2;
    const greed = player.greed * (1 + (passives.p_greed || 0) * 0.25);
    return { might, area, cd, speed, pickup, armor, greed };
  }

  function setFlash(m, on) {
    m.group.traverse((o) => {
      if (o.isMesh && o._origMat) {
        o.material = on ? DS.world.FLASH_MAT : o._origMat;
      }
    });
  }

  function damageMonster(m, rawDmg, crit, knockX, knockZ) {
    if (!m.alive) return;
    const val = Math.max(1, Math.round(rawDmg));
    m.hp -= val;
    if (!m.boss) {
      if (!m.flashT || m.flashT <= 0) setFlash(m, true);
      m.flashT = 0.075;
    }
    if (knockX || knockZ) {
      const kb = m.boss ? 0.2 : 1.0;
      m.x += (knockX || 0) * kb;
      m.z += (knockZ || 0) * kb;
    }
    showDmg(m.x, m.height + 0.5, m.z, val + (crit ? '!' : ''), crit ? 'crit' : '');
    DS.vfx.bloodBatch.spawn(m.x, 1.0, m.z, (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4, 0xff3b58, 0.45, 0.3);

    if (m.hp <= 0) {
      m.alive = false;
      player.kills++;
      player.streak++;
      player.streakT = 3.5;
      addFury(m.boss ? 45 : 3.5);
      spawnPickup(m.x, m.z, m.boss ? 'chest' : 'xp', m.xp);
      if (Math.random() < 0.22 || m.boss) spawnPickup(m.x + 0.5, m.z - 0.4, 'gold', m.gold);
      if (Math.random() < 0.015) spawnPickup(m.x - 0.4, m.z + 0.4, 'heal', 25);
      DS.vfx.smokeBatch.spawn(m.x, 0.8, m.z, 0, 1.4, 0, 0x8899aa, 1.2, 0.45);
      scene.remove(m.group);
      const idx = monsters.indexOf(m);
      if (idx >= 0) monsters.splice(idx, 1);

      if (m.type === 'dragon' && DS.game && DS.game.onBossDragonSlain) {
        DS.game.onBossDragonSlain();
      }
    }
  }

  function smashBreakable(b) {
    if (!b.alive) return;
    b.alive = false;
    b.group.visible = false;
    b.respawnT = 28;
    DS.vfx.spawnRing(b.x, b.z, b.isChest ? 0xffd464 : 0xffaa55, 2.2, 0.28, false);
    DS.vfx.smokeBatch.spawn(b.x, 0.8, b.z, 0, 2, 0, 0xddbb88, 1.1, 0.4);
    if (b.isChest) {
      spawnPickup(b.x, b.z, 'gold', 35);
      spawnPickup(b.x + 0.6, b.z, 'heal', 30);
    } else {
      spawnPickup(b.x, b.z, Math.random() < 0.45 ? 'gold' : 'xp', 15);
    }
  }

  function spawnMonster(type, x, z, multHp) {
    const preset = DS.QUALITY_PRESETS[DS.profile ? DS.profile.quality : 'balanced'] || DS.QUALITY_PRESETS.balanced;
    const st = DS.MONSTER_STATS[type] || DS.MONSTER_STATS.slime;
    if (!st.boss && monsters.length >= preset.maxMonsters) return null;

    const mObj = DS.world.spawnModel('monsters', type, st.scale, false);
    mObj.group.position.set(x, 0, z);
    scene.add(mObj.group);

    let mixer = null;
    if (mObj.clips && mObj.clips.length) {
      mixer = new THREE.AnimationMixer(mObj.inner);
      const clip = mObj.clips.find((c) => /walk|run|fly|idle/i.test(c.name)) || mObj.clips[0];
      if (clip) mixer.clipAction(clip).play();
    }

    const hpScale = multHp || 1;
    const ent = {
      uid: uidCounter++,
      type,
      boss: !!st.boss,
      x,
      z,
      hp: Math.round(st.hp * hpScale),
      maxHp: Math.round(st.hp * hpScale),
      spd: st.spd,
      dmg: st.dmg,
      xp: st.xp,
      gold: st.gold,
      height: st.scale,
      radius: st.boss ? 1.55 : st.scale * 0.42,
      slowT: 0,
      flashT: 0,
      animAcc: 0,
      skillCd: st.boss ? 4.6 : 0,
      bossCastT: 0,
      chargeWindupT: 0,
      chargeMoveT: 0,
      chargeDirX: 0,
      chargeDirZ: 0,
      chargeSpeed: 0,
      alive: true,
      group: mObj.group,
      mixer
    };
    monsters.push(ent);
    return ent;
  }

  function spawnPack(type, count, ringRadius) {
    const r = ringRadius || 16;
    const lim = DS.world.ARENA_LIMIT - 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sx = Math.max(-lim, Math.min(lim, player.x + Math.cos(a) * r));
      const sz = Math.max(-lim, Math.min(lim, player.z + Math.sin(a) * r));
      spawnMonster(type, sx, sz, 1);
    }
  }

  // Pickups
  const xpGeo = new THREE.OctahedronGeometry(0.32, 0);
  const goldGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10);
  const healGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  const gemMat = new THREE.MeshBasicMaterial({ color: 0x4de8ff });
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd452 });
  const healMat = new THREE.MeshBasicMaterial({ color: 0x4dff88 });
  const chestGemMat = new THREE.MeshBasicMaterial({ color: 0xd088ff });

  function spawnPickup(x, z, kind, val) {
    if (pickups.length > 140) return;
    const geo = kind === 'gold' ? goldGeo : kind === 'heal' ? healGeo : xpGeo;
    const mat = kind === 'gold' ? goldMat : kind === 'heal' ? healMat : kind === 'chest' ? chestGemMat : gemMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.48, z);
    if (kind === 'gold') mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    pickups.push({ kind, val, x, z, mesh, mag: false });
  }

  // ==================== ACTIVE PLAYER COMBAT ====================
  function meleeSweep(reach, dmg, isFinisher, dotMin, knockForce, fx, fz) {
    const hitList = monsters.slice();
    let hits = 0;
    for (const m of hitList) {
      const dx = m.x - player.x;
      const dz = m.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach + m.radius) continue;
      if (dotMin > -1 && dist > 1.3) {
        const dot = (dx * fx + dz * fz) / dist;
        if (dot < dotMin) continue;
      }
      hits++;
      const d = Math.max(0.1, dist);
      damageMonster(m, dmg, isFinisher, (dx / d) * knockForce, (dz / d) * knockForce);
    }
    for (const b of DS.world.breakables) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - player.x, b.z - player.z) <= reach + 0.8) {
        b.hp -= dmg;
        if (b.hp <= 0) smashBreakable(b);
      }
    }
    return hits;
  }

  function clampArena(v, pad) {
    const lim = (DS.world.ARENA_LIMIT || 98) - (pad || 1.5);
    return Math.max(-lim, Math.min(lim, v));
  }

  function triggerPlayerCombo() {
    if (player.atkCd > 0) return false;
    const st = effectiveStats();
    const hId = player.heroId;
    player.comboStep = player.comboResetT > 0 ? (player.comboStep % 3) + 1 : 1;
    player.comboResetT = 0.95;
    player.swingAnimT = 0.24;

    const step = player.comboStep;
    const isFinisher = step === 3;
    const dirYaw = player.aimYaw;
    const fx = Math.sin(dirYaw);
    const fz = Math.cos(dirYaw);
    const stepScale = isFinisher ? 2.0 : step === 2 ? 1.25 : 1.0;
    const baseDmg = 34 * st.might * stepScale;

    if (hId === 'wizard') {
      player.atkCd = 0.24 * Math.min(1, st.cd);
      DS.audio.playSkillSfx('lightning');
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.1,
        player.z + fz * 1.1,
        dirYaw + (step === 2 ? 0.35 : -0.35),
        isFinisher ? 0xffffff : 0x66ccff,
        2.3 * st.area,
        0.19,
        step === 2 ? -5.0 : 5.0
      );
      DS.vfx.spawnFloorGlow(player.x + fx * 1.5, player.z + fz * 1.5, 0x3399ff, 2.6 * st.area, 0.22, 0.68);

      const offsets = step === 2 ? [-0.11, 0.11] : [0];
      const boltDmg = baseDmg * (step === 2 ? 0.82 : isFinisher ? 1.05 : 1.0);
      for (const off of offsets) {
        const a = dirYaw + off;
        spawnProjectile(
          player.x + Math.sin(a) * 0.9,
          player.z + Math.cos(a) * 0.9,
          Math.sin(a) * (isFinisher ? 26 : 23),
          Math.cos(a) * (isFinisher ? 26 : 23),
          isFinisher ? 0xffffff : 0x66ccff,
          boltDmg,
          isFinisher ? 1.4 : 1.15,
          'arcane',
          { pierce: isFinisher ? 6 : 4, life: 1.1, crit: isFinisher, fromCombo: true, shape: 'arcane' }
        );
      }

      if (isFinisher) {
        let aimDist = 6.8 * st.area;
        if (player.hasMouseAim) {
          const md = Math.hypot(player.aimX - player.x, player.aimZ - player.z);
          aimDist = Math.max(3.0, Math.min(11.5 * st.area, md));
        }
        const tx = clampArena(player.x + fx * aimDist, 1.0);
        const tz = clampArena(player.z + fz * aimDist, 1.0);
        const strikeRad = 3.2 * st.area;
        DS.vfx.spawnLightning(tx, 14, tz, tx, 0.35, tz);
        DS.vfx.spawnDecal(tx, tz, 'elec', 2.7 * st.area, 2.3);
        DS.vfx.spawnRing(tx, tz, 0x66ccff, strikeRad, 0.28, false);
        DS.vfx.addShake(0.24);
        let strikeHits = 0;
        for (const m of monsters.slice()) {
          if (Math.hypot(m.x - tx, m.z - tz) <= strikeRad + m.radius) {
            strikeHits++;
            damageMonster(m, baseDmg * 1.15, true, 0, 0);
          }
        }
        for (const b of DS.world.breakables) {
          if (b.alive && Math.hypot(b.x - tx, b.z - tz) <= strikeRad + 0.8) {
            b.hp -= baseDmg;
            if (b.hp <= 0) smashBreakable(b);
          }
        }
        addFury(strikeHits > 0 ? 12 : 5);
      } else {
        addFury(4);
      }
      return true;
    }

    if (hId === 'archer') {
      player.atkCd = 0.21 * Math.min(1, st.cd);
      DS.audio.playSkillSfx('arrow');
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.0,
        player.z + fz * 1.0,
        dirYaw + (step === 2 ? 0.3 : -0.3),
        isFinisher ? 0x5ce1ff : 0x99ff88,
        2.1 * st.area,
        0.16,
        step === 2 ? -4.5 : 4.5
      );
      DS.vfx.spawnFloorGlow(player.x + fx * 1.3, player.z + fz * 1.3, isFinisher ? 0x5ce1ff : 0x88ee66, 2.2 * st.area, 0.18, 0.55);

      const fan = isFinisher ? [-0.36, -0.18, 0, 0.18, 0.36] : step === 2 ? [-0.2, 0, 0.2] : [-0.14, 0, 0.14];
      const arrowSpd = isFinisher ? 28 : step === 2 ? 25 : 23;
      const arrowDmg = baseDmg * (isFinisher ? 0.82 : 0.62);
      for (const off of fan) {
        const a = dirYaw + off;
        spawnProjectile(
          player.x + Math.sin(a) * 0.8,
          player.z + Math.cos(a) * 0.8,
          Math.sin(a) * arrowSpd,
          Math.cos(a) * arrowSpd,
          isFinisher ? 0x5ce1ff : step === 2 ? 0x66ffaa : 0xaaff77,
          arrowDmg,
          isFinisher ? 1.15 : 0.95,
          'arrow',
          { pierce: isFinisher ? 6 : 2, life: 1.05, crit: isFinisher, fromCombo: true, shape: 'arrow' }
        );
      }
      if (isFinisher) {
        DS.vfx.spawnRing(player.x + fx * 1.3, player.z + fz * 1.3, 0x5ce1ff, 2.8 * st.area, 0.24, false);
        DS.vfx.addShake(0.2);
      }
      addFury(isFinisher ? 7 : 4);
      return true;
    }

    if (hId === 'pirate') {
      player.atkCd = 0.23 * Math.min(1, st.cd);
      const reach = (isFinisher ? 5.2 : step === 2 ? 4.4 : 4.0) * st.area;
      DS.audio.playSwordSlash(step);
      if (isFinisher) DS.audio.playSkillSfx('fire');
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.1,
        player.z + fz * 1.1,
        dirYaw + (step === 2 ? Math.PI * 0.45 : -Math.PI * 0.35),
        isFinisher ? 0xff4411 : 0xffaa33,
        reach * 0.76,
        isFinisher ? 0.26 : 0.19,
        step === 2 ? -5.5 : 5.5
      );
      DS.vfx.spawnFloorGlow(player.x + fx * 2.0, player.z + fz * 2.0, 0xff5511, reach * 0.78, 0.26, 0.72);
      const coneCount = isFinisher ? 14 : 9;
      for (let k = 0; k < coneCount; k++) {
        const ca = dirYaw + (Math.random() - 0.5) * 0.85;
        const spd = 7 + Math.random() * 8;
        DS.vfx.fireBatch.spawn(
          player.x + fx * 1.2,
          0.95,
          player.z + fz * 1.2,
          Math.sin(ca) * spd,
          1.2 + Math.random() * 2.5,
          Math.cos(ca) * spd,
          k % 2 === 0 ? 0xffaa33 : 0xff4411,
          isFinisher ? 0.85 : 0.65,
          0.32
        );
      }

      let hits = meleeSweep(reach, baseDmg * 0.85, isFinisher, isFinisher ? -1 : 0.05, isFinisher ? 2.4 : 1.2, fx, fz);
      // Explosive hellfire cone bonus damage
      const coneReach = reach * 1.3;
      for (const m of monsters.slice()) {
        const dx = m.x - player.x;
        const dz = m.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist > coneReach + m.radius || dist < 0.1) continue;
        if ((dx * fx + dz * fz) / dist < 0.42) continue;
        hits++;
        damageMonster(m, baseDmg * 0.55, isFinisher, (dx / dist) * 1.6, (dz / dist) * 1.6);
      }

      if (isFinisher) {
        const bx = clampArena(player.x + fx * 2.1, 1.0);
        const bz = clampArena(player.z + fz * 2.1, 1.0);
        DS.vfx.spawnRing(bx, bz, 0xff5511, reach * 0.95, 0.34, true);
        DS.vfx.spawnFloorGlow(bx, bz, 0xff6622, reach * 1.05, 0.38, 0.9);
        DS.vfx.spawnDecal(bx, bz, 'scorch', 3.4 * st.area, 3.2);
        DS.vfx.addShake(0.32);
        for (const m of monsters.slice()) {
          const dx = m.x - bx;
          const dz = m.z - bz;
          const dist = Math.hypot(dx, dz);
          if (dist <= reach * 0.95 + m.radius) {
            const d = Math.max(0.1, dist);
            damageMonster(m, baseDmg * 0.85, true, (dx / d) * 2.8, (dz / d) * 2.8);
          }
        }
      }
      addFury(hits > 0 ? (isFinisher ? 14 : 7) : 3);
      return true;
    }

    if (hId === 'samurai') {
      player.atkCd = 0.175 * Math.min(1, st.cd);
      const reach = (isFinisher ? 5.8 : step === 2 ? 4.8 : 4.4) * st.area;
      DS.audio.playSwordSlash(step);
      // Swift cyan-crimson double arc
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.2,
        player.z + fz * 1.2,
        dirYaw - 0.38,
        0x5ce1ff,
        reach * 0.76,
        isFinisher ? 0.24 : 0.17,
        6.8
      );
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.2,
        player.z + fz * 1.2,
        dirYaw + 0.42,
        0xff3860,
        reach * 0.72,
        isFinisher ? 0.24 : 0.17,
        -6.8
      );
      DS.vfx.spawnFloorGlow(player.x + fx * 1.6, player.z + fz * 1.6, isFinisher ? 0xff3860 : 0x5ce1ff, reach * 0.65, 0.22, 0.68);
      if (isFinisher) {
        DS.vfx.spawnRing(player.x + fx * 1.5, player.z + fz * 1.5, 0x5ce1ff, reach * 0.85, 0.26, true);
        DS.vfx.addShake(0.24);
      }
      const hits = meleeSweep(reach, baseDmg * 1.05, isFinisher, isFinisher ? -1 : 0.0, isFinisher ? 2.1 : 0.9, fx, fz);
      addFury(hits > 0 ? (isFinisher ? 14 : 7) : 2);
      return true;
    }

    if (hId === 'viking') {
      player.atkCd = 0.27 * Math.min(1, st.cd);
      const reach = (isFinisher ? 6.1 : step === 2 ? 5.1 : 4.6) * st.area;
      const color = isFinisher ? 0xff4411 : step === 2 ? 0xff7722 : 0xffaa33;
      DS.audio.playSwordSlash(step);
      DS.vfx.spawnSlashArc(
        player.x + fx * 1.0,
        player.z + fz * 1.0,
        dirYaw + (step === 2 ? Math.PI * 0.55 : -Math.PI * 0.45),
        color,
        reach * 0.82,
        isFinisher ? 0.28 : 0.22,
        step === 2 ? -5.0 : 5.0
      );
      DS.vfx.spawnFloorGlow(player.x + fx * 1.5, player.z + fz * 1.5, color, reach * 0.75, 0.26, 0.7);
      if (isFinisher) {
        DS.vfx.spawnRing(player.x + fx * 1.4, player.z + fz * 1.4, 0xff6622, reach * 0.92, 0.34, true);
        DS.vfx.addShake(0.36);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          DS.vfx.smokeBatch.spawn(player.x + Math.cos(a) * 2, 0.4, player.z + Math.sin(a) * 2, Math.cos(a) * 5, 2, Math.sin(a) * 5, 0xccaa88, 1.0, 0.35);
        }
      }
      const hits = meleeSweep(reach, baseDmg * 1.2, isFinisher, isFinisher ? -1 : -0.25, isFinisher ? 5.2 : 3.2, fx, fz);
      addFury(hits > 0 ? (isFinisher ? 16 : 8) : 2);
      return true;
    }

    // Knight (default): Radiant Gold Arc
    player.atkCd = 0.22 * Math.min(1, st.cd);
    const reach = (isFinisher ? 5.6 : step === 2 ? 4.6 : 4.2) * st.area;
    const color = isFinisher ? 0xfff4a8 : step === 2 ? 0xffe066 : 0xffd464;
    DS.audio.playSwordSlash(step);
    DS.vfx.spawnSlashArc(
      player.x + fx * 1.1,
      player.z + fz * 1.1,
      dirYaw + (step === 2 ? Math.PI * 0.45 : -Math.PI * 0.35),
      color,
      reach * 0.74,
      isFinisher ? 0.26 : 0.19,
      step === 2 ? -5.5 : 5.5
    );
    DS.vfx.spawnFloorGlow(player.x + fx * 1.6, player.z + fz * 1.6, 0xffd464, reach * 0.68, 0.24, 0.68);
    if (isFinisher) {
      DS.vfx.spawnRing(player.x + fx * 1.5, player.z + fz * 1.5, 0xffd464, reach * 0.85, 0.3, true);
      DS.vfx.addShake(0.26);
    }
    const hits = meleeSweep(reach, baseDmg, isFinisher, isFinisher ? -1 : 0.05, isFinisher ? 2.6 : 1.2, fx, fz);
    addFury(hits > 0 ? (isFinisher ? 14 : 7) : 2);
    return true;
  }

  function triggerDash(moveX, moveZ) {
    if (player.dashCd > 0) return false;
    player.dashCd = 3.0;
    player.dashTimer = 0.22;
    player.invulnT = Math.max(player.invulnT, 0.3);
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.1) {
      player.dashDirX = moveX / len;
      player.dashDirZ = moveZ / len;
    } else {
      player.dashDirX = Math.sin(player.aimYaw);
      player.dashDirZ = Math.cos(player.aimYaw);
    }
    DS.audio.playDash();
    DS.vfx.spawnRing(player.x, player.z, 0x5ce1ff, 2.5, 0.3, false);
    DS.vfx.spawnFloorGlow(player.x, player.z, 0x5ce1ff, 3.2, 0.3, 0.8);
    DS.vfx.addShake(0.16);
    return true;
  }

  function spawnWeaponVfx(wpKey, tx, tz, dur, spin, dmg, radius) {
    const m = DS.world.spawnModel('weapons', wpKey, 2.1, true);
    m.group.position.set(tx, 6.5, tz);
    m.group.rotation.set(Math.PI, Math.random() * Math.PI, 0);
    scene.add(m.group);
    weaponVfx.push({
      group: m.group,
      tx,
      tz,
      life: dur || 0.75,
      max: dur || 0.75,
      spin: spin || 7,
      dmg: dmg || 70,
      radius: radius || 3.4,
      impacted: false
    });
  }

  function triggerUltimate(forceFree) {
    if (!forceFree && player.fury < 100) return false;
    player.fury = 0;
    player.berserkT = 2.8;
    player.invulnT = Math.max(player.invulnT, 0.8);
    DS.audio.playUlt();
    DS.vfx.addShake(0.65);
    DS.vfx.spawnRing(player.x, player.z, 0xffd464, 11, 0.65, true);
    DS.vfx.spawnFloorGlow(player.x, player.z, 0xffaa33, 9.5, 0.8, 0.9);

    const st = effectiveStats();
    const blades = ['excalibur', 'kusanagi', 'thuan-thien', 'masamune', 'zulfiqar', 'muramasa'];
    for (let i = 0; i < blades.length; i++) {
      const a = (i / blades.length) * Math.PI * 2 + player.aimYaw;
      const dist = 3.2 + (i % 2) * 2.4;
      const sx = player.x + Math.cos(a) * dist;
      const sz = player.z + Math.sin(a) * dist;
      spawnWeaponVfx(blades[i], sx, sz, 0.85, 9, 130 * st.might, 4.5 * st.area);
      if (i % 2 === 0) DS.vfx.spawnLightning(sx, 11, sz, sx, 0.3, sz);
    }
    return true;
  }

  // ==================== 26 A-Z SKILL EXECUTION ====================
  function fireSkill(key) {
    const def = DS.SKILL_DEFS[key];
    if (!def) return;
    const lv = skills[key] || 1;
    const isEvo = !!evolvedSkills[key];
    const st = effectiveStats();
    const mult = (1 + (lv - 1) * 0.26) * (isEvo ? 1.65 : 1) * st.might;
    const rad = 3.5 * st.area * (isEvo ? 1.35 : 1);

    // Find nearest monster
    let nearest = null;
    let bestD = 9999;
    for (const m of monsters) {
      const d = Math.hypot(m.x - player.x, m.z - player.z);
      if (d < bestD) {
        bestD = d;
        nearest = m;
      }
    }

    DS.audio.playSkillSfx(def.fam);

    if (def.fam === 'lightning') {
      // Strictly Cool-Blue/White Lightning (ZERO orange/red)
      const count = isEvo ? 4 : Math.min(3, 1 + Math.floor(lv / 2));
      const pool = monsters.filter((m) => Math.hypot(m.x - player.x, m.z - player.z) < 18 * st.area);
      for (let i = 0; i < count; i++) {
        const tgt = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        const bx = tgt ? tgt.x : player.x + (Math.random() - 0.5) * 10;
        const bz = tgt ? tgt.z : player.z + (Math.random() - 0.5) * 10;
        const ax = i > 0 && key === 'J' ? player.x : bx + (Math.random() - 0.5) * 2;
        const ay = i > 0 && key === 'J' ? 1.5 : 13;
        const az = i > 0 && key === 'J' ? player.z : bz + (Math.random() - 0.5) * 2;
        DS.vfx.spawnLightning(ax, ay, az, bx, 0.4, bz);
        DS.vfx.spawnDecal(bx, bz, 'elec', 2.4, 2.2);
        for (const m of monsters.slice()) {
          if (Math.hypot(m.x - bx, m.z - bz) < rad * 0.95) {
            damageMonster(m, 42 * mult, isEvo, 0, 0);
          }
        }
      }
      return;
    }

    if (def.fam === 'fire') {
      const tx = nearest ? nearest.x : player.x + Math.sin(player.aimYaw) * 7;
      const tz = nearest ? nearest.z : player.z + Math.cos(player.aimYaw) * 7;
      const angle = Math.atan2(tx - player.x, tz - player.z);
      if (key === 'H' || key === 'P') {
        DS.vfx.spawnDecal(tx, tz, 'scorch', rad, 3.0);
        DS.vfx.spawnRing(tx, tz, 0xff6622, rad, 0.38, true);
        DS.vfx.spawnFloorGlow(tx, tz, 0xff6622, rad * 1.1, 0.4, 0.85);
        for (let k = 0; k < 10; k++) {
          DS.vfx.fireBatch.spawn(tx, 0.5, tz, (Math.random() - 0.5) * 7, 3 + Math.random() * 6, (Math.random() - 0.5) * 7, k % 2 ? 0xffaa33 : 0xff4411, 0.85, 0.4);
        }
        for (const m of monsters.slice()) {
          if (Math.hypot(m.x - tx, m.z - tz) < rad) damageMonster(m, 55 * mult, isEvo, 0, 0);
        }
      } else {
        spawnProjectile(player.x, player.z, Math.sin(angle) * 14, Math.cos(angle) * 14, 0xff6622, 42 * mult, rad * 0.8, 'fire');
      }
      return;
    }

    if (def.fam === 'frost') {
      const tx = nearest ? nearest.x : player.x + Math.sin(player.aimYaw) * 8;
      const tz = nearest ? nearest.z : player.z + Math.cos(player.aimYaw) * 8;
      const angle = Math.atan2(tx - player.x, tz - player.z);
      if (key === 'O') {
        DS.vfx.spawnRing(player.x, player.z, 0x88eeff, rad * 1.5, 0.45, true);
        DS.vfx.spawnDecal(player.x, player.z, 'ice', rad * 1.4, 2.8);
        for (const m of monsters.slice()) {
          if (Math.hypot(m.x - player.x, m.z - player.z) < rad * 1.5) {
            m.slowT = 2.5;
            damageMonster(m, 34 * mult, false, 0, 0);
          }
        }
      } else {
        spawnProjectile(player.x, player.z, Math.sin(angle) * 16, Math.cos(angle) * 16, 0x7ce8ff, 36 * mult, 1.5, 'frost');
      }
      return;
    }

    if (def.fam === 'divine') {
      const tx = nearest ? nearest.x : player.x + Math.sin(player.aimYaw) * 6;
      const tz = nearest ? nearest.z : player.z + Math.cos(player.aimYaw) * 6;
      spawnWeaponVfx(def.wp || 'excalibur', tx, tz, 0.72, 10, 82 * mult, rad);
      return;
    }

    if (def.fam === 'arrow' || def.fam === 'axe') {
      const n = isEvo ? 4 : Math.min(3, 1 + Math.floor(lv / 2));
      const baseAngle = nearest ? Math.atan2(nearest.x - player.x, nearest.z - player.z) : player.aimYaw;
      for (let i = 0; i < n; i++) {
        const a = baseAngle + (i - (n - 1) / 2) * 0.24;
        spawnProjectile(
          player.x,
          player.z,
          Math.sin(a) * (def.fam === 'arrow' ? 20 : 12),
          Math.cos(a) * (def.fam === 'arrow' ? 20 : 12),
          def.fam === 'arrow' ? 0x99ff88 : 0xffbb55,
          30 * mult,
          def.fam === 'axe' ? 1.8 : 1.0,
          def.fam
        );
      }
      return;
    }

    // Sword / Hammer / Void / Poison / Earth / Holy / Wind
    const tx = nearest && bestD < 8 ? nearest.x : player.x + Math.sin(player.aimYaw) * 2.5;
    const tz = nearest && bestD < 8 ? nearest.z : player.z + Math.cos(player.aimYaw) * 2.5;
    const col = def.fam === 'poison' ? 0x66ff66 : def.fam === 'void' ? 0xc266ff : def.fam === 'holy' ? 0xfff088 : 0x66ddff;
    DS.vfx.spawnSlashArc(player.x, player.z, player.aimYaw, col, rad * 0.9, 0.24, 5);
    DS.vfx.spawnRing(tx, tz, col, rad, 0.35, def.fam === 'holy' || def.fam === 'void');
    DS.vfx.spawnFloorGlow(tx, tz, col, rad, 0.3, 0.65);
    for (const m of monsters.slice()) {
      if (Math.hypot(m.x - tx, m.z - tz) < rad + m.radius) {
        if (key === 'Q' && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 1);
        damageMonster(m, 44 * mult, isEvo, 0, 0);
      }
    }
  }

  const projGeo = new THREE.SphereGeometry(0.32, 8, 8);
  const arrowGeo = new THREE.ConeGeometry(0.15, 0.95, 4);
  arrowGeo.rotateX(Math.PI / 2);
  const boltGeo = new THREE.CylinderGeometry(0.11, 0.16, 1.1, 6);
  boltGeo.rotateX(Math.PI / 2);
  const projMats = {};
  function getProjMat(color) {
    if (!projMats[color]) projMats[color] = new THREE.MeshBasicMaterial({ color });
    return projMats[color];
  }

  function spawnProjectile(x, z, vx, vz, color, dmg, rad, kind, opts) {
    if (projectiles.length > 64) return;
    const o = opts || {};
    const shape = o.shape || kind;
    const geo = shape === 'arrow' ? arrowGeo : shape === 'arcane' ? boltGeo : projGeo;
    const mesh = new THREE.Mesh(geo, getProjMat(color));
    mesh.position.set(x, 1.0, z);
    mesh.rotation.y = Math.atan2(vx, vz);
    scene.add(mesh);
    projectiles.push({
      x,
      z,
      vx,
      vz,
      dmg,
      rad,
      kind,
      color,
      life: o.life || 1.6,
      pierce: o.pierce || 1,
      crit: !!o.crit,
      fromCombo: !!o.fromCombo,
      hitIds: new Set(),
      hitBreakIds: new Set(),
      mesh
    });
  }

  // ==================== BOSS TELEGRAPHED PATTERNS ====================
  function applyBossAreaDamage(hx, hz, rad, dmg, armor) {
    if (Math.hypot(player.x - hx, player.z - hz) > rad) return;
    if (player.invulnT <= 0) {
      const taken = Math.max(1, Math.round(dmg) - armor);
      player.hp -= taken;
      player.invulnT = 0.55;
      addFury(6);
      DS.audio.playHurt();
      DS.vfx.addShake(0.42);
      showDmg(player.x, 2.8, player.z, '-' + taken, 'playerHit');
      if (player.hp <= 0) {
        player.hp = 0;
        if (DS.game && DS.game.onPlayerDead) DS.game.onPlayerDead();
      }
    } else {
      // Tactical reward for dashing through boss telegraphs with i-frames
      showDmg(player.x, 3.0, player.z, 'DODGE!', 'heal');
      addFury(8);
    }
  }

  function executeBossSkill(b) {
    if (!b || !b.alive) return false;
    const dx = player.x - b.x;
    const dz = player.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d;
    const nz = dz / d;

    if (b.type === 'orcking') {
      // Warlord Slam 5m ring
      const step = Math.min(d, 8.5);
      const tx = clampArena(b.x + nx * step, 2.0);
      const tz = clampArena(b.z + nz * step, 2.0);
      b.bossCastT = 1.05;
      DS.vfx.spawnTelegraph(tx, tz, 5.0, 1.05, (ax, az, rad) => {
        if (!b.alive) return;
        b.x = ax;
        b.z = az;
        b.group.position.set(ax, 0, az);
        DS.vfx.spawnRing(ax, az, 0xff4422, 5.2, 0.44, true);
        DS.vfx.spawnFloorGlow(ax, az, 0xff5522, 5.6, 0.45, 0.9);
        DS.vfx.spawnDecal(ax, az, 'scorch', 4.2, 3.0);
        DS.vfx.addShake(0.65);
        DS.audio.playSkillSfx('fire');
        for (let k = 0; k < 12; k++) {
          DS.vfx.smokeBatch.spawn(ax, 0.5, az, (Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9, 0xcc8855, 1.2, 0.45);
        }
        applyBossAreaDamage(ax, az, rad, b.dmg * 1.45, effectiveStats().armor);
      });
      return true;
    }

    if (b.type === 'minotaur') {
      // Charge lunge + impact shockwave
      const chargeDist = Math.min(13.5, Math.max(6.5, d + 1.5));
      const endX = clampArena(b.x + nx * chargeDist, 2.0);
      const endZ = clampArena(b.z + nz * chargeDist, 2.0);
      const actualDist = Math.hypot(endX - b.x, endZ - b.z) || 1;
      const midX = b.x + (endX - b.x) * 0.5;
      const midZ = b.z + (endZ - b.z) * 0.5;
      b.bossCastT = 1.05;
      b.chargeWindupT = 0.65;
      b.chargeMoveT = 0.4;
      b.chargeDirX = (endX - b.x) / actualDist;
      b.chargeDirZ = (endZ - b.z) / actualDist;
      b.chargeSpeed = actualDist / 0.4;

      DS.vfx.spawnTelegraph(midX, midZ, 2.6, 0.78, (ax, az, rad) => {
        if (!b.alive) return;
        applyBossAreaDamage(ax, az, rad, b.dmg * 1.1, effectiveStats().armor);
      });
      DS.vfx.spawnTelegraph(endX, endZ, 4.5, 1.05, (ax, az, rad) => {
        if (!b.alive) return;
        DS.vfx.spawnRing(ax, az, 0xff4422, 4.8, 0.45, true);
        DS.vfx.spawnFloorGlow(ax, az, 0xff5522, 5.2, 0.45, 0.9);
        DS.vfx.spawnDecal(ax, az, 'scorch', 3.6, 3.0);
        DS.vfx.addShake(0.7);
        DS.audio.playSkillSfx('fire');
        applyBossAreaDamage(ax, az, rad, b.dmg * 1.5, effectiveStats().armor);
      });
      return true;
    }

    if (b.type === 'titan') {
      // 3x telegraphed Molten Pillars
      b.bossCastT = 0.9;
      const baseAng = Math.random() * Math.PI * 2;
      const spots = [
        [clampArena(player.x, 2.0), clampArena(player.z, 2.0)],
        [clampArena(player.x + Math.cos(baseAng) * 4.5, 2.0), clampArena(player.z + Math.sin(baseAng) * 4.5, 2.0)],
        [clampArena(player.x + Math.cos(baseAng + 2.2) * 4.5, 2.0), clampArena(player.z + Math.sin(baseAng + 2.2) * 4.5, 2.0)]
      ];
      spots.forEach(([px, pz], idx) => {
        DS.vfx.spawnTelegraph(px, pz, 3.4, 1.0 + idx * 0.15, (ax, az, rad) => {
          if (!b.alive) return;
          DS.vfx.spawnRing(ax, az, 0xff5511, 3.7, 0.42, true);
          DS.vfx.spawnFloorGlow(ax, az, 0xff6622, 4.2, 0.55, 0.92);
          DS.vfx.spawnDecal(ax, az, 'scorch', 3.0, 3.2);
          for (let k = 0; k < 14; k++) {
            DS.vfx.fireBatch.spawn(
              ax + (Math.random() - 0.5) * 1.2,
              0.3 + k * 0.35,
              az + (Math.random() - 0.5) * 1.2,
              (Math.random() - 0.5) * 3,
              6 + Math.random() * 7,
              (Math.random() - 0.5) * 3,
              k % 2 === 0 ? 0xffaa33 : 0xff4411,
              1.05,
              0.48
            );
          }
          DS.vfx.smokeBatch.spawn(ax, 1.2, az, 0, 3.5, 0, 0x775544, 1.3, 0.5);
          DS.vfx.addShake(0.45);
          DS.audio.playSkillSfx('fire');
          applyBossAreaDamage(ax, az, rad, b.dmg * 1.3, effectiveStats().armor);
        });
      });
      return true;
    }

    // dragon: 4x telegraphed cool-blue Sky Lightning & Frost shockwaves (STRICTLY #ffffff, #66ccff, #3399ff)
    b.bossCastT = 0.95;
    const baseAng = Math.random() * Math.PI * 2;
    const spots = [
      [clampArena(player.x, 2.0), clampArena(player.z, 2.0)],
      [clampArena(player.x + Math.cos(baseAng) * 4.6, 2.0), clampArena(player.z + Math.sin(baseAng) * 4.6, 2.0)],
      [clampArena(player.x + Math.cos(baseAng + (Math.PI * 2) / 3) * 4.6, 2.0), clampArena(player.z + Math.sin(baseAng + (Math.PI * 2) / 3) * 4.6, 2.0)],
      [clampArena(player.x + Math.cos(baseAng + (Math.PI * 4) / 3) * 4.6, 2.0), clampArena(player.z + Math.sin(baseAng + (Math.PI * 4) / 3) * 4.6, 2.0)]
    ];
    spots.forEach(([px, pz], idx) => {
      DS.vfx.spawnTelegraph(px, pz, 3.6, 0.98 + idx * 0.12, (ax, az, rad) => {
        if (!b.alive) return;
        DS.vfx.spawnLightning(ax, 15, az, ax, 0.35, az);
        DS.vfx.spawnRing(ax, az, 0x66ccff, 3.8, 0.42, true);
        DS.vfx.spawnFloorGlow(ax, az, 0x3399ff, 4.4, 0.45, 0.88);
        DS.vfx.spawnDecal(ax, az, 'ice', 3.2, 3.0);
        for (let k = 0; k < 10; k++) {
          DS.vfx.iceBatch.spawn(
            ax,
            0.5,
            az,
            (Math.random() - 0.5) * 9,
            2 + Math.random() * 5,
            (Math.random() - 0.5) * 9,
            k % 3 === 0 ? 0xffffff : k % 3 === 1 ? 0x66ccff : 0x3399ff,
            0.75,
            0.38
          );
        }
        DS.vfx.addShake(0.45);
        DS.audio.playSkillSfx('lightning');
        applyBossAreaDamage(ax, az, rad, b.dmg * 1.25, effectiveStats().armor);
      });
    });
    return true;
  }

  function triggerBossSkill(preferredBoss) {
    let target = preferredBoss && preferredBoss.alive && preferredBoss.boss ? preferredBoss : null;
    if (!target) {
      let bestD = Infinity;
      for (const m of monsters) {
        if (!m.alive || !m.boss) continue;
        const d = Math.hypot(m.x - player.x, m.z - player.z);
        if (d < bestD) {
          bestD = d;
          target = m;
        }
      }
    }
    if (!target) return false;
    target.skillCd = 4.6;
    return executeBossSkill(target);
  }

  // ==================== MAIN UPDATE ====================
  function updateEntities(dt, moveX, moveZ) {
    frameTick++;
    const st = effectiveStats();
    const limit = DS.world.ARENA_LIMIT;

    // Timers
    if (player.atkCd > 0) player.atkCd -= dt;
    if (player.comboResetT > 0) player.comboResetT -= dt;
    if (player.dashCd > 0) player.dashCd = Math.max(0, player.dashCd - dt);
    if (player.invulnT > 0) player.invulnT -= dt;
    if (player.streakT > 0) {
      player.streakT -= dt;
      if (player.streakT <= 0) {
        player.streakT = 0;
        player.streak = 0;
      }
    }
    if (player.shrineBuff) {
      player.shrineBuff.timer -= dt;
      if (player.shrineBuff.timer <= 0) player.shrineBuff = null;
    }
    if (player.berserkT > 0) {
      player.berserkT -= dt;
      player.berserkHalo.visible = true;
      player.berserkHalo.rotation.z += dt * 3;
    } else if (player.berserkHalo) {
      player.berserkHalo.visible = false;
    }

    // Regen
    const shrineRegen = player.shrineBuff && player.shrineBuff.type === 'magnet' ? 3.0 : 0;
    if ((player.regen > 0 || shrineRegen > 0) && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + (player.regen + (passives.p_hp || 0) * 2 + shrineRegen) * dt);
    }

    // Player Movement + Dash
    let vx = 0;
    let vz = 0;
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      vx = player.dashDirX * 20;
      vz = player.dashDirZ * 20;
      if (frameTick % 2 === 0) {
        DS.vfx.elecBatch.spawn(player.x, 0.9, player.z, 0, 1, 0, 0x5ce1ff, 0.7, 0.25);
      }
    } else if (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01) {
      const mlen = Math.hypot(moveX, moveZ) || 1;
      vx = (moveX / mlen) * st.speed;
      vz = (moveZ / mlen) * st.speed;
      player.yaw = Math.atan2(vx, vz);
      if (!player.hasMouseAim) player.aimYaw = player.yaw;
    }

    player.x = Math.max(-limit, Math.min(limit, player.x + vx * dt));
    player.z = Math.max(-limit, Math.min(limit, player.z + vz * dt));
    if (player.group) {
      player.group.position.set(player.x, 0, player.z);
      player.group.rotation.y = player.aimYaw;
      if (player.mixer && (Math.abs(vx) > 0.2 || Math.abs(vz) > 0.2)) {
        player.mixer.update(dt);
      }
      if (player.weaponPivot) {
        if (player.swingAnimT > 0) {
          player.swingAnimT -= dt;
          const p = 1 - player.swingAnimT / 0.24;
          player.weaponPivot.rotation.y = (player.comboStep === 2 ? -1 : 1) * (-1.4 + p * 2.9);
          player.weaponPivot.rotation.x = 0.7;
        } else {
          player.weaponPivot.rotation.y *= 0.82;
          player.weaponPivot.rotation.x *= 0.82;
        }
      }
    }

    // Dash Smash Breakables
    if (player.dashTimer > 0) {
      for (const b of DS.world.breakables) {
        if (b.alive && Math.hypot(b.x - player.x, b.z - player.z) < 2.2) smashBreakable(b);
      }
      for (const m of monsters.slice()) {
        if (Math.hypot(m.x - player.x, m.z - player.z) < 2.2 + m.radius) {
          damageMonster(m, 26 * st.might, false, player.dashDirX * 1.5, player.dashDirZ * 1.5);
        }
      }
    }

    // Auto-Skill Cooldowns
    for (const k of Object.keys(skills)) {
      skillCds[k] = (skillCds[k] || 0) - dt;
      if (skillCds[k] <= 0) {
        const def = DS.SKILL_DEFS[k];
        skillCds[k] = def ? def.cd * st.cd : 1.5;
        fireSkill(k);
      }
    }

    // Breakables Respawn & Lore Scroll Collection
    for (const b of DS.world.breakables) {
      if (!b.alive) {
        b.respawnT -= dt;
        if (b.respawnT <= 0) {
          b.alive = true;
          b.hp = b.maxHp;
          b.group.visible = true;
        }
      }
    }
    for (const ln of DS.world.loreNodes) {
      if (!ln.collected) {
        ln.orb.rotation.y += dt * 1.9;
        ln.orb.position.y = 1.25 + Math.sin(frameTick * 0.08) * 0.16;
        if (Math.hypot(ln.x - player.x, ln.z - player.z) < 2.7) {
          ln.collected = true;
          ln.group.visible = false;
          DS.audio.playLore();
          DS.vfx.spawnRing(ln.x, ln.z, 0xd088ff, 3.6, 0.45, true);
          if (DS.game && DS.game.onScrollCollected) DS.game.onScrollCollected(ln.def);
        }
      }
    }

    // 4 Interactive District Shrines (3.8m radius, 2.2s charge, 18s buff, 60s respawn)
    player.shrineCharging = null;
    if (DS.world.shrines) {
      for (const sh of DS.world.shrines) {
        if (!sh.ready) {
          sh.respawnT -= dt;
          if (sh.respawnT <= 0) {
            sh.ready = true;
            sh.charge = 0;
            sh.orb.visible = true;
            sh.outerRing.visible = true;
            sh.glowDisc.visible = true;
            sh.chargeDisc.visible = false;
            sh.chargeDisc.scale.set(0.05, 1, 0.05);
            DS.vfx.spawnRing(sh.x, sh.z, sh.def.color, 4.2, 0.45, false);
          }
          continue;
        }
        sh.orb.rotation.y += dt * (sh.charge > 0 ? 5.2 : 1.7);
        sh.orb.position.y = 1.72 + Math.sin(frameTick * 0.07) * 0.16;
        const sd = Math.hypot(player.x - sh.x, player.z - sh.z);
        if (sd <= sh.radius) {
          sh.charge += dt;
          const prog = Math.min(1, sh.charge / sh.chargeDur);
          player.shrineCharging = { id: sh.def.id, progress: prog, def: sh.def };
          sh.chargeDisc.visible = true;
          const sc = Math.max(0.06, prog);
          sh.chargeDisc.scale.set(sc, 1, sc);
          if (frameTick % 4 === 0) {
            DS.vfx.elecBatch.spawn(
              sh.x + (Math.random() - 0.5) * 2.2,
              0.4,
              sh.z + (Math.random() - 0.5) * 2.2,
              0,
              3.2,
              0,
              sh.def.color === 0xffd464 ? 0x66ccff : 0x5ce1ff,
              0.5,
              0.35
            );
          }
          if (sh.charge >= sh.chargeDur) {
            sh.ready = false;
            sh.respawnT = 60.0;
            sh.charge = 0;
            sh.orb.visible = false;
            sh.outerRing.visible = false;
            sh.glowDisc.visible = false;
            sh.chargeDisc.visible = false;
            player.shrineCharging = null;

            const healAmt = Math.round(player.maxHp * 0.35);
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            showDmg(player.x, 2.8, player.z, '+' + healAmt, 'heal');
            player.shrineBuff = { id: sh.def.id, type: sh.def.buffType, timer: 18.0, def: sh.def };

            for (const m of monsters.slice()) {
              const mdx = m.x - sh.x;
              const mdz = m.z - sh.z;
              const md = Math.hypot(mdx, mdz);
              if (md <= 9.5 + m.radius) {
                const n = Math.max(0.1, md);
                damageMonster(m, 100 * st.might, true, (mdx / n) * 4.8, (mdz / n) * 4.8);
              }
            }
            DS.vfx.spawnRing(sh.x, sh.z, sh.def.color, 9.5, 0.5, true);
            DS.vfx.spawnFloorGlow(sh.x, sh.z, sh.def.color, 9.0, 0.65, 0.92);
            DS.vfx.spawnLightning(sh.x, 12, sh.z, sh.x, 0.4, sh.z);
            DS.vfx.addShake(0.35);
            DS.audio.playLore();
            if (DS.ui && DS.ui.showShrineToast) DS.ui.showShrineToast(sh.def);
          }
        } else if (sh.charge > 0) {
          sh.charge = Math.max(0, sh.charge - dt * 1.4);
          if (sh.charge <= 0.01) {
            sh.charge = 0;
            sh.chargeDisc.visible = false;
          } else {
            const sc = Math.max(0.06, sh.charge / sh.chargeDur);
            sh.chargeDisc.scale.set(sc, 1, sc);
          }
        }
      }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, 1.0, p.z);
      if (p.kind === 'fire') {
        DS.vfx.fireBatch.spawn(p.x, 1.0, p.z, 0, 0.8, 0, 0xff7722, 0.55, 0.2);
      } else if (p.kind === 'arcane' && frameTick % 2 === 0) {
        DS.vfx.elecBatch.spawn(p.x, 1.0, p.z, 0, 0.5, 0, frameTick % 4 === 0 ? 0xffffff : 0x66ccff, 0.5, 0.18);
      }

      let exhausted = false;
      for (const m of monsters.slice()) {
        if (p.hitIds.has(m.uid)) continue;
        if (Math.hypot(m.x - p.x, m.z - p.z) < p.rad + m.radius) {
          p.hitIds.add(m.uid);
          if (p.kind === 'frost') m.slowT = 2.0;
          if (p.kind === 'fire') {
            DS.vfx.spawnFloorGlow(p.x, p.z, 0xff6622, 3.2, 0.3, 0.8);
            DS.vfx.spawnDecal(p.x, p.z, 'scorch', 2.2, 2.5);
          } else if (p.kind === 'arcane') {
            DS.vfx.elecBatch.spawn(m.x, 1.0, m.z, (Math.random() - 0.5) * 4, 2.5, (Math.random() - 0.5) * 4, 0x66ccff, 0.6, 0.22);
          }
          damageMonster(m, p.dmg, p.crit, p.vx * 0.03, p.vz * 0.03);
          if (p.fromCombo) addFury(2.5);
          p.pierce--;
          if (p.pierce <= 0) {
            exhausted = true;
            break;
          }
        }
      }
      if (!exhausted && (p.kind === 'arrow' || p.kind === 'arcane' || p.kind === 'fire')) {
        for (let bi = 0; bi < DS.world.breakables.length; bi++) {
          const b = DS.world.breakables[bi];
          if (!b.alive || p.hitBreakIds.has(bi)) continue;
          if (Math.hypot(b.x - p.x, b.z - p.z) < p.rad + b.radius) {
            p.hitBreakIds.add(bi);
            b.hp -= p.dmg;
            if (b.hp <= 0) smashBreakable(b);
            p.pierce--;
            if (p.pierce <= 0) {
              exhausted = true;
              break;
            }
          }
        }
      }
      if (exhausted || p.life <= 0) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }

    // 3D Dropping Divine Weapon VFX
    for (let i = weaponVfx.length - 1; i >= 0; i--) {
      const w = weaponVfx[i];
      w.life -= dt;
      const elapsed = w.max - w.life;
      if (elapsed < 0.22) {
        const drop = elapsed / 0.22;
        w.group.position.y = 6.5 * (1 - drop) + 0.45;
      } else {
        w.group.position.y = 0.45;
        w.group.rotation.y += w.spin * dt;
        if (!w.impacted) {
          w.impacted = true;
          DS.vfx.spawnRing(w.tx, w.tz, 0xffd464, w.radius, 0.4, true);
          DS.vfx.spawnFloorGlow(w.tx, w.tz, 0xffc144, w.radius, 0.45, 0.85);
          for (const m of monsters.slice()) {
            if (Math.hypot(m.x - w.tx, m.z - w.tz) < w.radius + m.radius) {
              damageMonster(m, w.dmg, true, 0, 0);
            }
          }
        }
      }
      if (w.life <= 0) {
        scene.remove(w.group);
        weaponVfx.splice(i, 1);
      }
    }

    // Monsters Update + Distance-Throttled Mixers + Player Contact
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (!m.alive) continue;
      if (m.flashT > 0) {
        m.flashT -= dt;
        if (m.flashT <= 0) setFlash(m, false);
      }
      if (m.slowT > 0) m.slowT -= dt;

      const dx = player.x - m.x;
      const dz = player.z - m.z;
      const d2 = dx * dx + dz * dz;
      const d = Math.sqrt(d2) || 0.01;

      if (m.boss) {
        m.skillCd -= dt;
        if (m.skillCd <= 0) {
          m.skillCd = 4.6;
          executeBossSkill(m);
        }
      }

      if (m.chargeWindupT > 0) {
        m.chargeWindupT -= dt;
        m.group.rotation.y = Math.atan2(m.chargeDirX, m.chargeDirZ);
      } else if (m.chargeMoveT > 0) {
        m.chargeMoveT -= dt;
        m.x = clampArena(m.x + m.chargeDirX * m.chargeSpeed * dt, 1.5);
        m.z = clampArena(m.z + m.chargeDirZ * m.chargeSpeed * dt, 1.5);
        m.group.position.set(m.x, 0, m.z);
        m.group.rotation.y = Math.atan2(m.chargeDirX, m.chargeDirZ);
        if (frameTick % 2 === 0) {
          DS.vfx.smokeBatch.spawn(m.x, 0.4, m.z, 0, 1.5, 0, 0xaa8866, 1.1, 0.3);
        }
      } else {
        let spd = m.spd * (m.slowT > 0 ? 0.55 : 1);
        if (m.bossCastT > 0) {
          m.bossCastT -= dt;
          spd *= 0.25;
        }
        m.x += (dx / d) * spd * dt;
        m.z += (dz / d) * spd * dt;
        m.group.position.set(m.x, 0, m.z);
        m.group.rotation.y = Math.atan2(dx, dz);
      }

      // Distance-throttled skeletal AnimationMixer
      if (m.mixer) {
        m.animAcc += dt;
        if (d2 < 196) {
          m.mixer.update(m.animAcc);
          m.animAcc = 0;
        } else if (d2 < 676 && (frameTick + m.uid) % 3 === 0) {
          m.mixer.update(m.animAcc);
          m.animAcc = 0;
        }
      }

      // Contact Damage
      if (d < 1.05 + m.radius && player.invulnT <= 0) {
        const taken = Math.max(1, m.dmg - st.armor);
        player.hp -= taken;
        player.invulnT = 0.55;
        addFury(6);
        DS.audio.playHurt();
        DS.vfx.addShake(0.32);
        showDmg(player.x, 2.8, player.z, '-' + taken, 'playerHit');
        if (player.hp <= 0) {
          player.hp = 0;
          if (DS.game && DS.game.onPlayerDead) DS.game.onPlayerDead();
          return;
        }
      }
    }

    // Pickups Magnetic Collection
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.mesh.rotation.y += dt * 3;
      const dx = player.x - pk.x;
      const dz = player.z - pk.z;
      const d = Math.hypot(dx, dz);
      if (d < st.pickup) pk.mag = true;
      if (pk.mag && d > 0.01) {
        pk.x += (dx / d) * 18 * dt;
        pk.z += (dz / d) * 18 * dt;
        pk.mesh.position.set(pk.x, 0.48, pk.z);
      }
      if (d < 1.25) {
        DS.audio.playPickup();
        if (pk.kind === 'gold') {
          player.goldEarned += Math.round(pk.val * st.greed);
        } else if (pk.kind === 'heal') {
          player.hp = Math.min(player.maxHp, player.hp + pk.val);
          showDmg(player.x, 2.7, player.z, '+' + pk.val, 'heal');
        } else {
          player.xp += Math.round(pk.val * st.greed);
        }
        scene.remove(pk.mesh);
        pickups.splice(i, 1);
      }
    }

    updateDmgPool(dt);
  }

  DS.entities = {
    player,
    monsters,
    skills,
    evolvedSkills,
    passives,
    resetEntities,
    spawnMonster,
    spawnPack,
    triggerPlayerCombo,
    triggerDash,
    triggerUltimate,
    triggerBossSkill,
    fireSkill,
    effectiveStats,
    update: updateEntities,
    clearDmgNumbers() {
      for (const d of dmgPool) {
        d.active = false;
        d.el.classList.add('hidden');
      }
    }
  };
})();
