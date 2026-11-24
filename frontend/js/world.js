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

  function _disposeUnusedPbrMaps(m, keepMap, keepEmissive) {
    for (const t of [m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap]) {
      if (t && t !== keepMap && t !== keepEmissive && typeof t.dispose === 'function') {
        try { t.dispose(); } catch {}
      }
    }
  }

  function toFastLambert(root) {
    let meshes = 0;
    let texOk = true;
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
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
        _disposeUnusedPbrMaps(m, m.map || null, m.emissiveMap || null);
        if (m.dispose && m !== lm) m.dispose();
        return lm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o._origMat = o.material;
      o.frustumCulled = !o.isSkinnedMesh;
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
    const jobs = [];
    for (const cat of Object.keys(DS.ASSETS)) {
      for (const [key, url] of DS.ASSETS[cat]) {
        jobs.push({ cat, key, url });
      }
    }
    let nextIdx = 0;
    const MAX_CONCURRENT = 6;
    async function worker() {
      while (nextIdx < jobs.length) {
        const job = jobs[nextIdx++];
        await new Promise((resolve) => {
          loader.load(
            job.url,
            (gltf) => {
              prepTemplate(job.cat, job.key, gltf);
              loadedCount++;
              if (onProgress) onProgress(loadedCount, expectedTotal);
              resolve();
            },
            undefined,
            () => {
              texStatus[job.cat][job.key] = false;
              loadedCount++;
              if (onProgress) onProgress(loadedCount, expectedTotal);
              resolve();
            }
          );
        });
      }
    }
    const pool = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT, jobs.length); i++) pool.push(worker());
    await Promise.all(pool);
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

  const _instPos = new THREE.Vector3();
  const _instQuat = new THREE.Quaternion();
  const _instEuler = new THREE.Euler();
  const _instScale = new THREE.Vector3();
  const _instFinalMat = new THREE.Matrix4();
  const _identQuat = new THREE.Quaternion();
  const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);
  const FALLBACK_BOX_GEO = new THREE.BoxGeometry(0.8, 1.0, 0.8);
  const FALLBACK_BOX_MAT = new THREE.MeshLambertMaterial({ color: 0x55aaff });

  function _composePlacementWrap(p, outMat) {
    _instPos.set(p.x || 0, p.y || 0, p.z || 0);
    _instEuler.set(p.rx || 0, p.ry || 0, p.rz || 0);
    _instQuat.setFromEuler(_instEuler);
    _instScale.set(
      p.sx !== undefined ? p.sx : 1,
      p.sy !== undefined ? p.sy : 1,
      p.sz !== undefined ? p.sz : 1
    );
    return outMat.compose(_instPos, _instQuat, _instScale);
  }

  function _buildInstancedModels(cat, key, placements) {
    if (!placements || !placements.length) {
      return { meshes: [], wrapMatrices: [], setInstanceMatrix() {} };
    }
    const t = templates[cat] && templates[cat][key];
    const subMeshes = [];
    if (t && t.root) {
      t.root.updateMatrixWorld(true);
      const invRoot = new THREE.Matrix4().copy(t.root.matrixWorld).invert();
      t.root.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const localMat = new THREE.Matrix4().multiplyMatrices(invRoot, o.matrixWorld);
        subMeshes.push({
          geometry: o.geometry,
          material: o.material,
          localMat
        });
      });
    }

    const isFallback = subMeshes.length === 0;
    if (isFallback) {
      subMeshes.push({
        geometry: FALLBACK_BOX_GEO,
        material: FALLBACK_BOX_MAT,
        localMat: new THREE.Matrix4()
      });
    }

    const count = placements.length;
    const wrapMatrices = new Array(count);
    const baseMatrices = new Array(count);
    for (let i = 0; i < count; i++) {
      const p = placements[i];
      wrapMatrices[i] = _composePlacementWrap(p, new THREE.Matrix4());
      const baseMat = new THREE.Matrix4();
      if (isFallback) {
        const dh = p.desiredHeight || 1.4;
        _instPos.set(0, dh * 0.5, 0);
        _instScale.set(1, dh, 1);
        baseMat.compose(_instPos, _identQuat, _instScale);
      } else {
        const s = (p.desiredHeight || 1.8) * (p.fitByMaxDim ? t.unitScale : t.heightScale);
        _instPos.set(-t.center.x * s, -t.minY * s, -t.center.z * s);
        _instScale.set(s, s, s);
        baseMat.compose(_instPos, _identQuat, _instScale);
      }
      baseMatrices[i] = baseMat;
    }

    const meshes = [];
    for (let sIdx = 0; sIdx < subMeshes.length; sIdx++) {
      const sub = subMeshes[sIdx];
      const inst = new THREE.InstancedMesh(sub.geometry, sub.material, count);
      for (let i = 0; i < count; i++) {
        _instFinalMat.multiplyMatrices(wrapMatrices[i], baseMatrices[i]);
        if (!isFallback) _instFinalMat.multiply(sub.localMat);
        inst.setMatrixAt(i, _instFinalMat);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.matrixAutoUpdate = false;
      inst.updateMatrix();
      if (typeof inst.computeBoundingSphere === 'function') inst.computeBoundingSphere();
      // Keep full-arena static instanced layers from disappearing on bounds/frustum edge cases
      inst.frustumCulled = false;
      meshes.push(inst);
    }

    function setInstanceMatrix(i, mat4) {
      if (i < 0 || i >= count) return;
      for (let sIdx = 0; sIdx < meshes.length; sIdx++) {
        const inst = meshes[sIdx];
        const sub = subMeshes[sIdx];
        _instFinalMat.multiplyMatrices(mat4, baseMatrices[i]);
        if (!isFallback) _instFinalMat.multiply(sub.localMat);
        inst.setMatrixAt(i, _instFinalMat);
        inst.instanceMatrix.needsUpdate = true;
      }
    }

    return { meshes, wrapMatrices, setInstanceMatrix };
  }

  const arenaGroup = new THREE.Group();
  const breakables = [];
  const loreNodes = [];
  const shrines = [];
  const ARENA_LIMIT = 98;

  // Shared Lore Scroll Geometries & Static Materials (per-orb material stays unique for discovered color)
  const lorePedGeo = new THREE.CylinderGeometry(0.55, 0.72, 0.5, 8);
  const loreOrbGeo = new THREE.OctahedronGeometry(0.45, 0);
  const loreRingGeo = new THREE.RingGeometry(0.9, 1.15, 24);
  loreRingGeo.rotateX(-Math.PI / 2);
  const LORE_PED_MAT = new THREE.MeshLambertMaterial({ color: 0x2c324a });
  const LORE_RING_MAT = new THREE.MeshBasicMaterial({ color: 0xb866ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });

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
    if (DS.vfx.clearTorchEffects) DS.vfx.clearTorchEffects();
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

    // Perimeter Fortress Walls around +/-102 (4 Monumental Gates + 48 Wall Segments) + 6 Interior Ruins
    const wallPlacements = [];
    const doorPlacements = [];
    for (let i = -96; i <= 96; i += 16) {
      for (const w of [
        { x: i, z: -102, ry: 0, door: i === 0 },
        { x: i, z: 102, ry: Math.PI, door: i === 0 },
        { x: -102, z: i, ry: Math.PI / 2, door: i === 0 },
        { x: 102, z: i, ry: -Math.PI / 2, door: i === 0 }
      ]) {
        if (w.door) {
          doorPlacements.push({
            x: w.x, y: 0, z: w.z, ry: w.ry,
            sx: 2.6, sy: 1.55, sz: 1.5,
            desiredHeight: 7.2, fitByMaxDim: true
          });
        } else {
          wallPlacements.push({
            x: w.x, y: 0, z: w.z, ry: w.ry,
            sx: 2.6, sy: 1.55, sz: 1.5,
            desiredHeight: 5.6, fitByMaxDim: true
          });
        }
      }
    }

    const interiorRuins = [
      // South Sunken Crypt barricades
      [-18, 62, 0.25], [18, 62, -0.25], [0, 82, 0],
      // East Relic Vault courtyard dividers
      [68, -22, Math.PI / 2], [68, 22, Math.PI / 2],
      // West Fog Cloister wings
      [-78, 0, Math.PI / 2]
    ];
    for (const [rx, rz, rry] of interiorRuins) {
      wallPlacements.push({
        x: rx, y: 0, z: rz, ry: rry,
        sx: 1.4, sy: 1.0, sz: 1.1,
        desiredHeight: 3.4, fitByMaxDim: true
      });
    }

    for (const m of _buildInstancedModels('dungeon', 'wall', wallPlacements).meshes) staticGroup.add(m);
    for (const m of _buildInstancedModels('dungeon', 'wallDoor', doorPlacements).meshes) staticGroup.add(m);

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
    const pillarPlacements = [];
    const torchPlacements = [];
    for (const [px, pz] of pillarCoords) {
      pillarPlacements.push({ x: px, y: 0, z: pz, desiredHeight: 4.8, fitByMaxDim: false });
      torchPlacements.push({ x: px, y: 2.4, z: pz + 0.72, desiredHeight: 1.6, fitByMaxDim: false });
      DS.vfx.addTorchEffect(px, 3.85, pz + 0.72);
    }
    for (const m of _buildInstancedModels('dungeon', 'pillar', pillarPlacements).meshes) staticGroup.add(m);
    for (const m of _buildInstancedModels('dungeon', 'torch', torchPlacements).meshes) staticGroup.add(m);

    // Cardinal Cobblestone Causeways stretching across N/S/E/W wings
    const pathPlacements = [];
    for (const dist of [14, 32, 50, 68, 84]) {
      for (const [sx, sz, ry] of [
        [0, -dist, 0],
        [0, dist, Math.PI],
        [-dist, 0, Math.PI / 2],
        [dist, 0, -Math.PI / 2]
      ]) {
        pathPlacements.push({
          x: sx, y: 0.02, z: sz, ry,
          sx: 3.4, sy: 0.5, sz: 3.4,
          desiredHeight: 0.45, fitByMaxDim: true
        });
      }
    }
    for (const m of _buildInstancedModels('dungeon', 'path', pathPlacements).meshes) staticGroup.add(m);

    // North Altar Grand Stairs (single mesh)
    const stairsObj = spawnModel('dungeon', 'stairs', 2.8, true);
    stairsObj.group.position.set(0, 0, -95);
    stairsObj.group.scale.set(2.8, 2.2, 2.2);
    staticGroup.add(stairsObj.group);

    // Rock clusters across all 5 districts
    const rockPlacements = [
      [-34, -34], [34, -34], [-34, 34], [34, 34],
      [-76, -72], [76, -72], [-76, 72], [76, 72],
      [-52, 66], [52, 66], [-82, -28], [84, 34]
    ].map(([rx, rz]) => ({ x: rx, y: 0, z: rz, desiredHeight: 2.6, fitByMaxDim: true }));
    for (const m of _buildInstancedModels('dungeon', 'rock', rockPlacements).meshes) staticGroup.add(m);

    // Freeze static world matrices once for 60-FPS CPU efficiency
    staticGroup.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    arenaGroup.add(staticGroup);

    // Expanded Breakable Barrels, Crates & 10 Treasure Chests (instanced per kind with visible proxy)
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
    const breakablesByKind = { barrel: [], crate: [], chest: [] };
    for (const [bx, bz, kind] of propCoords) {
      breakablesByKind[kind].push({ bx, bz, kind });
    }
    for (const kind of ['barrel', 'crate', 'chest']) {
      const items = breakablesByKind[kind];
      if (!items.length) continue;
      const dh = kind === 'chest' ? 1.55 : 1.35;
      const placements = items.map((it) => ({
        x: it.bx, y: 0, z: it.bz, desiredHeight: dh, fitByMaxDim: true
      }));
      const batch = _buildInstancedModels('dungeon', kind, placements);
      for (const m of batch.meshes) arenaGroup.add(m);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const origMat4 = batch.wrapMatrices[i];
        let _vis = true;
        const groupProxy = {
          get visible() {
            return _vis;
          },
          set visible(v) {
            const next = !!v;
            if (_vis === next) return;
            _vis = next;
            batch.setInstanceMatrix(i, next ? origMat4 : _zeroMat4);
          }
        };
        breakables.push({
          kind,
          x: it.bx,
          z: it.bz,
          radius: 1.15,
          hp: kind === 'chest' ? 40 : 20,
          maxHp: kind === 'chest' ? 40 : 20,
          isChest: kind === 'chest',
          group: groupProxy,
          alive: true,
          respawnT: 0
        });
      }
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

      const pedestal = new THREE.Mesh(lorePedGeo, LORE_PED_MAT);
      pedestal.position.y = 0.25;
      wrap.add(pedestal);

      const scrollOrb = new THREE.Mesh(
        loreOrbGeo,
        new THREE.MeshBasicMaterial({ color: 0xd088ff })
      );
      scrollOrb.position.y = 1.25;
      wrap.add(scrollOrb);

      const ring = new THREE.Mesh(loreRingGeo, LORE_RING_MAT);
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
