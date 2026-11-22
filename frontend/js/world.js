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
  const ARENA_LIMIT = 40;

  function buildArena() {
    const scene = DS.vfx.scene;
    while (arenaGroup.children.length) arenaGroup.remove(arenaGroup.children[0]);
    breakables.length = 0;
    loreNodes.length = 0;

    // Cobblestone Floor
    const texLoader = new THREE.TextureLoader();
    const floorTex = texLoader.load('assets/textures/cobblestone_floor_03_diff_1k.jpg');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(18, 18);
    floorTex.colorSpace = THREE.SRGBColorSpace;

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(96, 96),
      new THREE.MeshLambertMaterial({ map: floorTex, color: 0xb8c0d4 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    arenaGroup.add(floorMesh);

    // Subtle Center Seal Circle on Ground
    const sealDisc = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.6, 36),
      new THREE.MeshBasicMaterial({ color: 0x3f88ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    sealDisc.rotation.x = -Math.PI / 2;
    sealDisc.position.y = 0.025;
    arenaGroup.add(sealDisc);

    // Perimeter Walls around +/-43
    const wallPositions = [];
    for (let i = -36; i <= 36; i += 12) {
      wallPositions.push({ x: i, z: -43, ry: 0, door: i === 0 });
      wallPositions.push({ x: i, z: 43, ry: Math.PI, door: i === 0 });
      wallPositions.push({ x: -43, z: i, ry: Math.PI / 2, door: false });
      wallPositions.push({ x: 43, z: i, ry: -Math.PI / 2, door: false });
    }
    for (const w of wallPositions) {
      const m = spawnModel('dungeon', w.door ? 'wallDoor' : 'wall', w.door ? 6.5 : 5.2, true);
      m.group.position.set(w.x, 0, w.z);
      m.group.rotation.y = w.ry;
      m.group.scale.set(2.1, 1.4, 1.4);
      arenaGroup.add(m.group);
    }

    // 8 Pillars + Torches (additive flame sprites & floor glow discs — ZERO PointLights)
    const pillarRing = [
      [15, 15], [-15, 15], [15, -15], [-15, -15],
      [0, 26], [0, -26], [26, 0], [-26, 0]
    ];
    for (const [px, pz] of pillarRing) {
      const p = spawnModel('dungeon', 'pillar', 4.6, false);
      p.group.position.set(px, 0, pz);
      arenaGroup.add(p.group);

      const t = spawnModel('dungeon', 'torch', 1.6, false);
      t.group.position.set(px, 2.35, pz + 0.72);
      arenaGroup.add(t.group);
      DS.vfx.addTorchEffect(px, 3.8, pz + 0.72);
    }

    // Decorative stairs & pathways near center cardinal axes
    for (const [sx, sz, ry] of [[0, -10, 0], [0, 10, Math.PI], [-10, 0, Math.PI / 2], [10, 0, -Math.PI / 2]]) {
      const p = spawnModel('dungeon', 'path', 0.45, true);
      p.group.position.set(sx, 0.02, sz);
      p.group.rotation.y = ry;
      p.group.scale.set(3.2, 0.5, 3.2);
      arenaGroup.add(p.group);
    }
    const stairsObj = spawnModel('dungeon', 'stairs', 2.4, true);
    stairsObj.group.position.set(0, 0, -39.5);
    stairsObj.group.scale.set(2.4, 2.0, 2.0);
    arenaGroup.add(stairsObj.group);

    // Rock clusters on outer rim
    for (const [rx, rz] of [[-33, -33], [33, -33], [-33, 33], [33, 33]]) {
      const rk = spawnModel('dungeon', 'rock', 2.5, true);
      rk.group.position.set(rx, 0, rz);
      arenaGroup.add(rk.group);
    }

    // Breakable Barrels, Crates & Treasure Chests
    const propCoords = [
      [-9, -9, 'barrel'], [9, -9, 'crate'], [-9, 9, 'crate'], [9, 9, 'barrel'],
      [-20, 6, 'barrel'], [20, 6, 'crate'], [-20, -6, 'crate'], [20, -6, 'barrel'],
      [7, -21, 'barrel'], [-7, 21, 'crate'], [-31, 0, 'chest'], [31, 0, 'chest'],
      [0, 31, 'chest'], [-18, -30, 'barrel'], [18, 30, 'crate'], [29, -15, 'barrel']
    ];
    for (const [bx, bz, kind] of propCoords) {
      const obj = spawnModel('dungeon', kind, kind === 'chest' ? 1.5 : 1.35, true);
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
    scene.add(arenaGroup);
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
  }

  DS.world = {
    ARENA_LIMIT,
    FLASH_MAT,
    templates,
    breakables,
    loreNodes,
    loadAllAssets,
    spawnModel,
    buildArena,
    resetArenaObjects
  };
})();
