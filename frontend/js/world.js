(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  const templates = { dungeon: {}, characters: {}, monsters: {}, weapons: {} };
  const texStatus = { dungeon: {}, characters: {}, monsters: {}, weapons: {} };
  const expectedTotal =
    DS.ASSETS.dungeon.length +
    DS.ASSETS.characters.length +
    DS.ASSETS.monsters.length +
    DS.ASSETS.weapons.length;

  const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const LoaderCtor = window.GLTFLoader || THREE.GLTFLoader;
  const loader = new LoaderCtor();
  if (window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);

  function toFastLambert(root) {
    let meshes = 0;
    let texOk = true;
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const out = src.map((m) => {
        if (!m) return new THREE.MeshLambertMaterial({ color: 0x8899aa });
        if (m.map && m.map.image && m.map.image.width === 0) texOk = false;
        if (m.isMeshLambertMaterial) return m;
        const lm = new THREE.MeshLambertMaterial({
          color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
          map: m.map || null,
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
          emissiveMap: m.emissiveMap || null,
          emissiveIntensity: m.emissiveIntensity !== undefined ? m.emissiveIntensity : 0.35,
          transparent: !!m.transparent,
          opacity: m.opacity !== undefined ? m.opacity : 1,
          alphaTest: m.alphaTest || 0,
          side: m.side !== undefined ? m.side : THREE.FrontSide
        });
        if (m.dispose && m !== lm) m.dispose();
        return lm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o._origMat = o.material;
      o.castShadow = false;
      o.receiveShadow = false;
    });
    return meshes > 0 && texOk;
  }

  function prepTemplate(cat, key, gltf) {
    const root = gltf.scene;
    const ok = toFastLambert(root);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const h = size.y || maxDim;

    templates[cat][key] = {
      root,
      clips: gltf.animations || [],
      dim: size,
      center,
      minY: box.min.y,
      unitScale: 1 / maxDim,
      heightScale: 1 / h,
      ok
    };
    texStatus[cat][key] = ok;
  }

  async function loadAllAssets(onProgress) {
    let loadedCount = 0;
    const tasks = [];
    for (const cat of Object.keys(DS.ASSETS)) {
      for (const [key, url] of DS.ASSETS[cat]) {
        tasks.push(
          new Promise((resolve) => {
            loader.load(
              url,
              (gltf) => {
                prepTemplate(cat, key, gltf);
                loadedCount++;
                if (onProgress) onProgress(loadedCount, expectedTotal);
                resolve();
              },
              undefined,
              () => {
                texStatus[cat][key] = false;
                loadedCount++;
                if (onProgress) onProgress(loadedCount, expectedTotal);
                resolve();
              }
            );
          })
        );
      }
    }
    await Promise.all(tasks);
  }

  window.__dsTexOk = function () {
    let loaded = 0;
    let allOk = true;
    for (const cat of Object.keys(texStatus)) {
      for (const k of Object.keys(texStatus[cat])) {
        loaded++;
        if (!texStatus[cat][k]) allOk = false;
      }
    }
    if (loaded < expectedTotal) allOk = false;
    return {
      allOk,
      loaded,
      expected: expectedTotal,
      dungeon: Object.assign({}, texStatus.dungeon),
      characters: Object.assign({}, texStatus.characters),
      monsters: Object.assign({}, texStatus.monsters),
      weapons: Object.assign({}, texStatus.weapons)
    };
  };

  function spawnModel(cat, key, desiredHeight, fitByMaxDim) {
    const t = templates[cat] && templates[cat][key];
    if (!t) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, desiredHeight || 1.4, 0.8),
        new THREE.MeshLambertMaterial({ color: cat === 'monsters' ? 0xcc3344 : 0x55aaff })
      );
      m.position.y = (desiredHeight || 1.4) * 0.5;
      const g = new THREE.Group();
      g.add(m);
      return { group: g, inner: m, clips: [] };
    }

    const clone = window.SkeletonUtils && window.SkeletonUtils.clone
      ? window.SkeletonUtils.clone(t.root)
      : t.root.clone(true);

    // Ensure _origMat is mapped cleanly on clone meshes for zero-alloc hit-flash restore
    clone.traverse((o) => {
      if (o.isMesh) o._origMat = o.material;
    });

    const s = (desiredHeight || 1.8) * (fitByMaxDim ? t.unitScale : t.heightScale);
    clone.scale.setScalar(s);
    clone.position.set(-t.center.x * s, -t.minY * s, -t.center.z * s);

    const wrap = new THREE.Group();
    wrap.add(clone);
    return { group: wrap, inner: clone, clips: t.clips };
  }

  const arenaGroup = new THREE.Group();
  const breakables = [];
  const loreNodes = [];
  const shrines = [];
  const ARENA_LIMIT = 98;

  // Shared Shrine Geometries & Materials (zero per-instance cloning, zero PointLights)
  const SHRINE_STONE_MAT = new THREE.MeshLambertMaterial({ color: 0x3b445e });
  const SHRINE_CAP_MAT = new THREE.MeshLambertMaterial({ color: 0x556488 });
  const SHRINE_ORB_MATS = {
    gold: new THREE.MeshBasicMaterial({ color: 0xffd464 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x5ce1ff })
  };
  const SHRINE_RING_MATS = {
    gold: new THREE.MeshBasicMaterial({ color: 0xffd464, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide })
  };
  const SHRINE_CHARGE_MATS = {
    gold: new THREE.MeshBasicMaterial({ color: 0xffd464, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  };
  const SHRINE_GLOW_MATS = {
    gold: new THREE.MeshBasicMaterial({ map: DS.vfx.TEX.glow, color: 0xffd464, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }),
    cyan: new THREE.MeshBasicMaterial({ map: DS.vfx.TEX.glow, color: 0x5ce1ff, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending })
  };
  const shrinePedGeo = new THREE.CylinderGeometry(0.95, 1.25, 0.72, 8);
  const shrineCapGeo = new THREE.CylinderGeometry(0.75, 0.92, 0.24, 8);
  const shrineOrbGeo = new THREE.OctahedronGeometry(0.6, 0);
  const shrineRingGeo = new THREE.RingGeometry(3.65, 3.85, 48);
  shrineRingGeo.rotateX(-Math.PI / 2);
  const shrineChargeGeo = new THREE.CircleGeometry(3.68, 40);
  shrineChargeGeo.rotateX(-Math.PI / 2);
  const shrineGlowGeo = new THREE.PlaneGeometry(8.2, 8.2);
  shrineGlowGeo.rotateX(-Math.PI / 2);

  function getZoneFor(x, z) {
    if (Math.abs(x) <= 36 && Math.abs(z) <= 36) return DS.ZONES.sanctum;
    if (Math.abs(z) >= Math.abs(x)) return z < 0 ? DS.ZONES.north : DS.ZONES.south;
    return x > 0 ? DS.ZONES.east : DS.ZONES.west;
  }

  function buildArena() {
    const scene = DS.vfx.scene;
    while (arenaGroup.children.length) arenaGroup.remove(arenaGroup.children[0]);
    breakables.length = 0;
    loreNodes.length = 0;
    shrines.length = 0;

    const staticGroup = new THREE.Group();

    // Expanded 224x224 Citadel Cobblestone Floor
    const texLoader = new THREE.TextureLoader();
    const floorTex = texLoader.load('assets/textures/cobblestone_floor_03_diff_1k.jpg');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(42, 42);
    floorTex.colorSpace = THREE.SRGBColorSpace;

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(224, 224),
      new THREE.MeshLambertMaterial({ map: floorTex, color: 0xb8c0d4 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    staticGroup.add(floorMesh);

    // Center Sanctum Seal Ring & Outer District Rings
    const sealDisc = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.6, 36),
      new THREE.MeshBasicMaterial({ color: 0x3f88ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    sealDisc.rotation.x = -Math.PI / 2;
    sealDisc.position.y = 0.025;
    staticGroup.add(sealDisc);

    // North Dragon Altar Seal Ring
    const dragonAltarRing = new THREE.Mesh(
      new THREE.RingGeometry(5.5, 6.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    );
    dragonAltarRing.rotation.x = -Math.PI / 2;
    dragonAltarRing.position.set(0, 0.03, -76);
    staticGroup.add(dragonAltarRing);

    // Perimeter Fortress Walls around +/-102 (4 Monumental Gates + Wall Segments)
    const wallPositions = [];
    for (let i = -96; i <= 96; i += 16) {
      wallPositions.push({ x: i, z: -102, ry: 0, door: i === 0 });
      wallPositions.push({ x: i, z: 102, ry: Math.PI, door: i === 0 });
      wallPositions.push({ x: -102, z: i, ry: Math.PI / 2, door: i === 0 });
      wallPositions.push({ x: 102, z: i, ry: -Math.PI / 2, door: i === 0 });
    }
    for (const w of wallPositions) {
      const m = spawnModel('dungeon', w.door ? 'wallDoor' : 'wall', w.door ? 7.2 : 5.6, true);
      m.group.position.set(w.x, 0, w.z);
      m.group.rotation.y = w.ry;
      m.group.scale.set(2.6, 1.55, 1.5);
      staticGroup.add(m.group);
    }

    // 20 Pillars + Torches spanning Center Sanctum & All 4 Outer Districts (ZERO PointLights)
    const pillarCoords = [
      [15, 15], [-15, 15], [15, -15], [-15, -15],
      [0, 28], [0, -28], [28, 0], [-28, 0],
      // North Dragon Altar
      [-14, -68], [14, -68], [-14, -84], [14, -84],
      // South Sunken Crypt
      [-24, 58], [24, 58], [-48, 76], [48, 76],
      // East Relic Vault
      [58, -24], [58, 24],
      // West Fog Cloister
      [-64, -14], [-64, 14]
    ];
    for (const [px, pz] of pillarCoords) {
      const p = spawnModel('dungeon', 'pillar', 4.8, false);
      p.group.position.set(px, 0, pz);
      staticGroup.add(p.group);

      const t = spawnModel('dungeon', 'torch', 1.6, false);
      t.group.position.set(px, 2.4, pz + 0.72);
      staticGroup.add(t.group);
      DS.vfx.addTorchEffect(px, 3.85, pz + 0.72);
    }

    // Cardinal Cobblestone Causeways stretching across N/S/E/W wings
    for (const dist of [14, 32, 50, 68, 84]) {
      for (const [sx, sz, ry] of [
        [0, -dist, 0],
        [0, dist, Math.PI],
        [-dist, 0, Math.PI / 2],
        [dist, 0, -Math.PI / 2]
      ]) {
        const p = spawnModel('dungeon', 'path', 0.45, true);
        p.group.position.set(sx, 0.02, sz);
        p.group.rotation.y = ry;
        p.group.scale.set(3.4, 0.5, 3.4);
        staticGroup.add(p.group);
      }
    }

    // North Altar Grand Stairs + Ruin Walls in South Crypt / East Vault / West Cloister
    const stairsObj = spawnModel('dungeon', 'stairs', 2.8, true);
    stairsObj.group.position.set(0, 0, -95);
    stairsObj.group.scale.set(2.8, 2.2, 2.2);
    staticGroup.add(stairsObj.group);

    const interiorRuins = [
      // South Sunken Crypt barricades
      [-18, 62, 0.25], [18, 62, -0.25], [0, 82, 0],
      // East Relic Vault courtyard dividers
      [68, -22, Math.PI / 2], [68, 22, Math.PI / 2],
      // West Fog Cloister wings
      [-78, 0, Math.PI / 2]
    ];
    for (const [rx, rz, rry] of interiorRuins) {
      const rw = spawnModel('dungeon', 'wall', 3.4, true);
      rw.group.position.set(rx, 0, rz);
      rw.group.rotation.y = rry;
      rw.group.scale.set(1.4, 1.0, 1.1);
      staticGroup.add(rw.group);
    }

    // Rock clusters across all 5 districts
    for (const [rx, rz] of [
      [-34, -34], [34, -34], [-34, 34], [34, 34],
      [-76, -72], [76, -72], [-76, 72], [76, 72],
      [-52, 66], [52, 66], [-82, -28], [84, 34]
    ]) {
      const rk = spawnModel('dungeon', 'rock', 2.6, true);
      rk.group.position.set(rx, 0, rz);
      staticGroup.add(rk.group);
    }

    // Freeze static world matrices once for 60-FPS CPU efficiency
    staticGroup.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    arenaGroup.add(staticGroup);

    // Expanded Breakable Barrels, Crates & 10 Treasure Chests
    const propCoords = [
      // Center Sanctum
      [-9, -9, 'barrel'], [9, -9, 'crate'], [-9, 9, 'crate'], [9, 9, 'barrel'],
      [-20, 6, 'barrel'], [20, 6, 'crate'], [-20, -6, 'crate'], [20, -6, 'barrel'],
      [34, 0, 'chest'], [-34, 0, 'barrel'],
      // North Dragon Altar
      [-10, -78, 'chest'], [10, -78, 'chest'], [-8, -64, 'barrel'], [8, -64, 'crate'],
      [-26, -74, 'barrel'], [26, -74, 'crate'], [0, -86, 'barrel'],
      // East Relic Vault
      [72, 0, 'chest'], [66, 14, 'chest'], [74, -16, 'chest'],
      [54, -8, 'barrel'], [54, 8, 'crate'], [82, -10, 'barrel'], [82, 10, 'crate'], [72, 32, 'barrel'],
      // South Sunken Crypt
      [0, 74, 'chest'], [-32, 72, 'chest'], [32, 72, 'chest'],
      [-12, 54, 'barrel'], [12, 54, 'crate'], [-28, 84, 'crate'], [28, 84, 'barrel'],
      // West Fog Cloister
      [-74, 0, 'chest'], [-78, 18, 'chest'],
      [-54, -12, 'barrel'], [-54, 12, 'crate'], [-72, -18, 'barrel'], [-72, 18, 'crate'], [-86, 12, 'barrel']
    ];
    for (const [bx, bz, kind] of propCoords) {
      const obj = spawnModel('dungeon', kind, kind === 'chest' ? 1.55 : 1.35, true);
      obj.group.position.set(bx, 0, bz);
      arenaGroup.add(obj.group);
      breakables.push({
        kind,
        x: bx,
        z: bz,
        radius: 1.15,
        hp: kind === 'chest' ? 40 : 20,
        maxHp: kind === 'chest' ? 40 : 20,
        isChest: kind === 'chest',
        group: obj.group,
        alive: true,
        respawnT: 0
      });
    }

    buildLoreScrolls();
    buildShrines();
    scene.add(arenaGroup);
  }

  function buildShrines() {
    for (const sDef of DS.SHRINE_DEFS) {
      const tone = sDef.color === 0xffd464 ? 'gold' : 'cyan';
      const wrap = new THREE.Group();
      wrap.position.set(sDef.x, 0, sDef.z);

      const ped = new THREE.Mesh(shrinePedGeo, SHRINE_STONE_MAT);
      ped.position.y = 0.36;
      wrap.add(ped);

      const cap = new THREE.Mesh(shrineCapGeo, SHRINE_CAP_MAT);
      cap.position.y = 0.84;
      wrap.add(cap);

      const orb = new THREE.Mesh(shrineOrbGeo, SHRINE_ORB_MATS[tone]);
      orb.position.y = 1.72;
      wrap.add(orb);

      const glowDisc = new THREE.Mesh(shrineGlowGeo, SHRINE_GLOW_MATS[tone]);
      glowDisc.position.y = 0.032;
      wrap.add(glowDisc);

      const outerRing = new THREE.Mesh(shrineRingGeo, SHRINE_RING_MATS[tone]);
      outerRing.position.y = 0.04;
      wrap.add(outerRing);

      const chargeDisc = new THREE.Mesh(shrineChargeGeo, SHRINE_CHARGE_MATS[tone]);
      chargeDisc.position.y = 0.046;
      chargeDisc.scale.set(0.05, 1, 0.05);
      chargeDisc.visible = false;
      wrap.add(chargeDisc);

      arenaGroup.add(wrap);
      shrines.push({
        def: sDef,
        x: sDef.x,
        z: sDef.z,
        radius: 3.8,
        chargeDur: 2.2,
        charge: 0,
        ready: true,
        respawnT: 0,
        group: wrap,
        orb,
        outerRing,
        chargeDisc,
        glowDisc
      });
    }
  }

  function buildLoreScrolls() {
    for (const sDef of DS.SCROLL_DEFS) {
      const wrap = new THREE.Group();
      wrap.position.set(sDef.x, 0, sDef.z);

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.72, 0.5, 8),
        new THREE.MeshLambertMaterial({ color: 0x2c324a })
      );
      pedestal.position.y = 0.25;
      wrap.add(pedestal);

      const scrollOrb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshBasicMaterial({ color: 0xd088ff })
      );
      scrollOrb.position.y = 1.25;
      wrap.add(scrollOrb);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: 0xb866ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      wrap.add(ring);

      arenaGroup.add(wrap);
      loreNodes.push({
        def: sDef,
        x: sDef.x,
        z: sDef.z,
        group: wrap,
        orb: scrollOrb,
        ring,
        collected: false
      });
    }
  }

  function resetArenaObjects(discoveredIds) {
    for (const b of breakables) {
      b.alive = true;
      b.hp = b.maxHp;
      b.respawnT = 0;
      b.group.visible = true;
    }
    const known = new Set(discoveredIds || []);
    for (const ln of loreNodes) {
      ln.collected = false;
      ln.group.visible = true;
      ln.orb.material.color.set(known.has(ln.def.id) ? 0x5ce1ff : 0xd088ff);
    }
    for (const sh of shrines) {
      sh.ready = true;
      sh.charge = 0;
      sh.respawnT = 0;
      sh.orb.visible = true;
      sh.outerRing.visible = true;
      sh.glowDisc.visible = true;
      sh.chargeDisc.visible = false;
      sh.chargeDisc.scale.set(0.05, 1, 0.05);
    }
  }

  DS.world = {
    ARENA_LIMIT,
    FLASH_MAT,
    templates,
    breakables,
    loreNodes,
    shrines,
    getZoneFor,
    loadAllAssets,
    spawnModel,
    buildArena,
    resetArenaObjects
  };
})();
