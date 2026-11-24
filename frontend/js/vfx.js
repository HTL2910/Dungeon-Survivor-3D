(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    precision: 'mediump',
    stencil: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.88));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b14);
  scene.fog = new THREE.FogExp2(0x090b14, 0.0105);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 115);
  camera.position.set(0, 21, 18);
  camera.updateProjectionMatrix();

  // Strictly 3 scene lights total (zero shadow maps, zero PointLights, zero scene.environment)
  const ambLight = new THREE.AmbientLight(0x8a9ed0, 1.18);
  const hemiLight = new THREE.HemisphereLight(0xaad0ff, 0x2f2318, 0.96);
  const dirLight = new THREE.DirectionalLight(0xfff1d6, 1.48);
  dirLight.position.set(24, 42, 18);
  scene.add(ambLight, hemiLight, dirLight);

  // Quarter-res Single-Pass Bloom
  window.__bloomPass = { enabled: true, strength: 0.85, threshold: 0.78 };
  let rtScene = null;
  let rtBloomA = null;
  let rtBloomB = null;
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const postScene = new THREE.Scene();

  const extractMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.78 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uThresh;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        float f = smoothstep(uThresh, uThresh + 0.35, luma);
        gl_FragColor = vec4(c.rgb * f, 1.0);
      }`
  });

  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1 / 320, 0) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uDir;
      varying vec2 vUv;
      void main(){
        vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
        sum += texture2D(tDiffuse, vUv + uDir * 1.384615) * 0.316216;
        sum += texture2D(tDiffuse, vUv - uDir * 1.384615) * 0.316216;
        sum += texture2D(tDiffuse, vUv + uDir * 3.230769) * 0.070270;
        sum += texture2D(tDiffuse, vUv - uDir * 3.230769) * 0.070270;
        gl_FragColor = sum;
      }`
  });

  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tBase: { value: null },
      tBloom: { value: null },
      uStrength: { value: 0.85 }
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
    fragmentShader: `
      uniform sampler2D tBase;
      uniform sampler2D tBloom;
      uniform float uStrength;
      varying vec2 vUv;
      void main(){
        vec4 base = texture2D(tBase, vUv);
        vec4 bloom = texture2D(tBloom, vUv);
        gl_FragColor = vec4(base.rgb + bloom.rgb * uStrength, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });

  const quadMesh = new THREE.Mesh(quadGeo, extractMat);
  postScene.add(quadMesh);

  function rebuildTargets() {
    const dpr = renderer.getPixelRatio();
    const w = Math.max(64, Math.floor(window.innerWidth * dpr));
    const h = Math.max(64, Math.floor(window.innerHeight * dpr));
    const bw = Math.max(32, Math.floor(w / 4));
    const bh = Math.max(32, Math.floor(h / 4));
    if (rtScene) rtScene.dispose();
    if (rtBloomA) rtBloomA.dispose();
    if (rtBloomB) rtBloomB.dispose();
    rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    rtBloomA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
    rtBloomB = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
  }
  rebuildTargets();

  const DPR_CAPS = { fast: 0.75, balanced: 0.88, high: 1.0 };
  function applyQuality(presetId) {
    const key = DS.QUALITY_PRESETS[presetId] ? presetId : 'balanced';
    const q = DS.QUALITY_PRESETS[key];
    const cap = DPR_CAPS[key] !== undefined ? DPR_CAPS[key] : 0.88;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    window.__bloomPass.enabled = q.bloom;
    rebuildTargets();
    return q;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    rebuildTargets();
  });

  // Procedural Canvas Textures
  function mkCanvasTex(sz, drawFn) {
    const c = document.createElement('canvas');
    c.width = c.height = sz;
    drawFn(c.getContext('2d'), sz);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  const TEX = {
    glow: mkCanvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.28, 'rgba(255,255,255,0.65)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
    smoke: mkCanvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(220,230,245,0.55)');
      gr.addColorStop(0.55, 'rgba(160,175,200,0.22)');
      gr.addColorStop(1, 'rgba(100,115,140,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
    ring: mkCanvasTex(128, (g, s) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.41, 0, Math.PI * 2);
      g.stroke();
    }),
    rune: mkCanvasTex(128, (g, s) => {
      g.strokeStyle = 'rgba(255,255,255,0.92)';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = s / 2 + Math.cos(a) * s * 0.4;
        const y = s / 2 + Math.sin(a) * s * 0.4;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
    }),
    scorch: mkCanvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(20,10,6,0.92)');
      gr.addColorStop(0.6, 'rgba(55,22,8,0.45)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
    iceDecal: mkCanvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(170,240,255,0.85)');
      gr.addColorStop(0.55, 'rgba(70,185,255,0.35)');
      gr.addColorStop(1, 'rgba(0,120,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
    elecDecal: mkCanvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(215,248,255,0.95)');
      gr.addColorStop(0.45, 'rgba(65,175,255,0.42)');
      gr.addColorStop(1, 'rgba(20,90,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
    slash: mkCanvasTex(128, (g, s) => {
      g.save();
      g.translate(s / 2, s / 2);
      const gr = g.createLinearGradient(-s / 2, 0, s / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.7, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr;
      g.lineWidth = 20;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, 8, s * 0.36, -Math.PI * 0.88, -Math.PI * 0.12);
      g.stroke();
      g.restore();
    })
  };

  // GPU Particle Batch
  class ParticleBatch {
    constructor(maxCount, tex, additive) {
      this.max = maxCount;
      this.pos = new Float32Array(maxCount * 3);
      this.vel = new Float32Array(maxCount * 3);
      this.col = new Float32Array(maxCount * 3);
      this.life = new Float32Array(maxCount);
      this.maxLife = new Float32Array(maxCount);
      this.sizes = new Float32Array(maxCount);
      this.gravity = 0;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: tex } },
        vertexShader: `
          attribute vec3 color;
          attribute float aSize;
          varying vec3 vColor;
          void main(){
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = max(0.0, aSize * (280.0 / max(1.0, -mv.z)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex;
          varying vec3 vColor;
          void main(){
            vec4 t = texture2D(uTex, gl_PointCoord);
            if(t.a < 0.04) discard;
            gl_FragColor = vec4(vColor * t.rgb, t.a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });

      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      this.cursor = 0;
      for (let i = 0; i < maxCount; i++) this.pos[i * 3 + 1] = -999;
    }

    spawn(x, y, z, vx, vy, vz, hex, size, life) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      const c = new THREE.Color(hex);
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      this.sizes[i] = size;
      this.life[i] = life;
      this.maxLife[i] = life;
    }

    update(dt) {
      let dirty = false;
      for (let i = 0; i < this.max; i++) {
        if (this.life[i] <= 0) continue;
        dirty = true;
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          this.pos[i * 3 + 1] = -999;
          this.sizes[i] = 0;
          continue;
        }
        this.vel[i * 3 + 1] += this.gravity * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        const ratio = this.life[i] / this.maxLife[i];
        if (ratio < 0.35) this.sizes[i] *= 0.94;
      }
      if (dirty) {
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.attributes.aSize.needsUpdate = true;
      }
    }

    clear() {
      for (let i = 0; i < this.max; i++) {
        this.life[i] = 0;
        this.sizes[i] = 0;
        this.pos[i * 3 + 1] = -999;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.aSize.needsUpdate = true;
    }
  }

  const fireBatch = new ParticleBatch(160, TEX.glow, true);
  const iceBatch = new ParticleBatch(140, TEX.glow, true);
  const elecBatch = new ParticleBatch(160, TEX.glow, true);
  const bloodBatch = new ParticleBatch(130, TEX.glow, true);
  bloodBatch.gravity = -14;
  const smokeBatch = new ParticleBatch(100, TEX.smoke, false);

  // Additive Floor Glow Discs (replaces all PointLights)
  const floorDiscGeo = new THREE.PlaneGeometry(1, 1);
  floorDiscGeo.rotateX(-Math.PI / 2);
  const floorGlowPool = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(
      floorDiscGeo,
      new THREE.MeshBasicMaterial({
        map: TEX.glow,
        color: 0x66ccff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    m.visible = false;
    m.position.y = 0.04;
    scene.add(m);
    floorGlowPool.push({ mesh: m, life: 0, max: 0.4, baseOp: 0.65 });
  }
  let fgCur = 0;

  function spawnFloorGlow(x, z, color, radius, life, opacity) {
    const g = floorGlowPool[fgCur];
    fgCur = (fgCur + 1) % floorGlowPool.length;
    g.mesh.position.set(x, 0.04, z);
    g.mesh.scale.set(radius * 2, 1, radius * 2);
    g.mesh.material.color.set(color);
    g.baseOp = opacity || 0.7;
    g.mesh.material.opacity = g.baseOp;
    g.life = life || 0.35;
    g.max = g.life;
    g.mesh.visible = true;
  }

  // Decals (48)
  const decalPool = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(
      floorDiscGeo,
      new THREE.MeshBasicMaterial({
        map: TEX.scorch,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    m.visible = false;
    scene.add(m);
    decalPool.push({ mesh: m, life: 0, max: 1 });
  }
  let decCur = 0;

  function spawnDecal(x, z, type, radius, life) {
    const d = decalPool[decCur];
    decCur = (decCur + 1) % decalPool.length;
    d.mesh.position.set(x, 0.03, z);
    d.mesh.scale.set(radius * 2, 1, radius * 2);
    d.mesh.material.map = type === 'ice' ? TEX.iceDecal : type === 'elec' ? TEX.elecDecal : TEX.scorch;
    d.mesh.material.opacity = 0.85;
    d.life = life || 3.2;
    d.max = d.life;
    d.mesh.visible = true;
  }

  // Ground Rings (24)
  const ringPool = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(
      floorDiscGeo,
      new THREE.MeshBasicMaterial({
        map: TEX.ring,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    m.visible = false;
    scene.add(m);
    ringPool.push({ mesh: m, life: 0, max: 0.4, maxS: 4 });
  }
  let ringCur = 0;

  function spawnRing(x, z, color, maxRadius, life, isRune) {
    const r = ringPool[ringCur];
    ringCur = (ringCur + 1) % ringPool.length;
    r.mesh.position.set(x, 0.06, z);
    r.mesh.material.map = isRune ? TEX.rune : TEX.ring;
    r.mesh.material.color.set(color);
    r.maxS = maxRadius * 2;
    r.life = life || 0.35;
    r.max = r.life;
    r.mesh.scale.set(0.2, 1, 0.2);
    r.mesh.visible = true;
  }

  // Slash Arcs (16) for Player 3-Hit Combo & Sword Skills
  const slashGeo = new THREE.PlaneGeometry(1, 1);
  slashGeo.rotateX(-Math.PI / 2);
  const slashPool = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(
      slashGeo,
      new THREE.MeshBasicMaterial({
        map: TEX.slash,
        color: 0xffe484,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    m.visible = false;
    scene.add(m);
    slashPool.push({ mesh: m, life: 0, max: 0.22, spin: 0 });
  }
  let slCur = 0;

  function spawnSlashArc(x, z, angle, color, radius, life, spinDir) {
    const s = slashPool[slCur];
    slCur = (slCur + 1) % slashPool.length;
    s.mesh.position.set(x, 0.95, z);
    s.mesh.rotation.set(0, angle, 0);
    s.mesh.scale.set(radius * 2, 1, radius * 2);
    s.mesh.material.color.set(color);
    s.mesh.material.opacity = 0.95;
    s.life = life || 0.22;
    s.max = s.life;
    s.spin = spinDir || 2.8;
    s.mesh.visible = true;
  }

  // Pooled Crimson Boss Warning Telegraph Rings (16)
  const telOuterGeo = new THREE.RingGeometry(0.92, 1.0, 40);
  telOuterGeo.rotateX(-Math.PI / 2);
  const telEdgeGeo = new THREE.RingGeometry(0.88, 1.0, 40);
  telEdgeGeo.rotateX(-Math.PI / 2);
  const telFillGeo = new THREE.CircleGeometry(1.0, 40);
  telFillGeo.rotateX(-Math.PI / 2);
  const telegraphPool = [];
  for (let i = 0; i < 16; i++) {
    const grp = new THREE.Group();
    grp.visible = false;
    const outer = new THREE.Mesh(
      telOuterGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    outer.position.y = 0.06;
    const fill = new THREE.Mesh(
      telFillGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff1e3c,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    fill.position.y = 0.052;
    const edge = new THREE.Mesh(
      telEdgeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff6677,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    edge.position.y = 0.056;
    grp.add(outer, fill, edge);
    scene.add(grp);
    telegraphPool.push({
      grp,
      outer,
      fill,
      edge,
      active: false,
      x: 0,
      z: 0,
      radius: 4,
      dur: 1.0,
      elapsed: 0,
      onDetonate: null
    });
  }
  let telCur = 0;

  function spawnTelegraph(x, z, radius, dur, onDetonate) {
    let slot = null;
    for (let i = 0; i < telegraphPool.length; i++) {
      const cand = telegraphPool[(telCur + i) % telegraphPool.length];
      if (!cand.active) {
        slot = cand;
        telCur = (telCur + i + 1) % telegraphPool.length;
        break;
      }
    }
    if (!slot) {
      slot = telegraphPool[telCur];
      telCur = (telCur + 1) % telegraphPool.length;
    }
    const r = radius || 4;
    slot.active = true;
    slot.x = x;
    slot.z = z;
    slot.radius = r;
    slot.dur = Math.max(0.15, dur || 1.0);
    slot.elapsed = 0;
    slot.onDetonate = onDetonate || null;
    slot.grp.position.set(x, 0, z);
    slot.outer.scale.set(r, 1, r);
    slot.fill.scale.set(r * 0.05, 1, r * 0.05);
    slot.edge.scale.set(r * 0.05, 1, r * 0.05);
    slot.fill.material.opacity = 0.16;
    slot.outer.material.opacity = 0.9;
    slot.grp.visible = true;
    return slot;
  }

  // Cool-Blue Fractal 3-Layer Lightning Bolts (24 instanced slots — STRICTLY #ffffff / #7ce0ff / #2b88ff)
  const MAX_BOLTS = 24;
  const BOLT_SEGS = 5;
  const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  const boltWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false });
  const boltCyanMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
  const boltBlueMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const _zeroBoltMat = new THREE.Matrix4().makeScale(0, 0, 0);
  const boltWhiteInst = new THREE.InstancedMesh(boltGeo, boltWhiteMat, MAX_BOLTS * BOLT_SEGS);
  const boltCyanInst = new THREE.InstancedMesh(boltGeo, boltCyanMat, MAX_BOLTS * BOLT_SEGS);
  const boltBlueInst = new THREE.InstancedMesh(boltGeo, boltBlueMat, MAX_BOLTS * BOLT_SEGS);
  for (const inst of [boltWhiteInst, boltCyanInst, boltBlueInst]) {
    inst.frustumCulled = false;
    inst.visible = false;
    inst.matrixAutoUpdate = false;
    inst.updateMatrix();
    for (let k = 0; k < MAX_BOLTS * BOLT_SEGS; k++) inst.setMatrixAt(k, _zeroBoltMat);
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }
  const BOLT_POOL = [];
  for (let i = 0; i < MAX_BOLTS; i++) {
    BOLT_POOL.push({ idx: i, active: false, life: 0, max: 0.2 });
  }
  let boltCur = 0;

  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vMid = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vUp = new THREE.Vector3(0, 1, 0);
  const _boltQuat = new THREE.Quaternion();
  const _boltScale = new THREE.Vector3();
  const _boltMat = new THREE.Matrix4();
  const _boltPts = Array.from({ length: BOLT_SEGS + 1 }, () => new THREE.Vector3());

  function spawnLightning(ax, ay, az, bx, by, bz) {
    const b = BOLT_POOL[boltCur];
    boltCur = (boltCur + 1) % BOLT_POOL.length;
    for (let i = 0; i <= BOLT_SEGS; i++) {
      const t = i / BOLT_SEGS;
      const jit = i === 0 || i === BOLT_SEGS ? 0 : 0.65;
      _boltPts[i].set(
        ax + (bx - ax) * t + (Math.random() - 0.5) * jit,
        ay + (by - ay) * t + (Math.random() - 0.5) * jit * 0.4,
        az + (bz - az) * t + (Math.random() - 0.5) * jit
      );
    }
    const base = b.idx * BOLT_SEGS;
    for (let i = 0; i < BOLT_SEGS; i++) {
      _vA.copy(_boltPts[i]);
      _vB.copy(_boltPts[i + 1]);
      _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
      _vDir.subVectors(_vB, _vA);
      const len = Math.max(0.05, _vDir.length());
      _vDir.normalize();
      _boltQuat.setFromUnitVectors(_vUp, _vDir);
      const h = len * 1.05;
      const slot = base + i;
      boltWhiteInst.setMatrixAt(slot, _boltMat.compose(_vMid, _boltQuat, _boltScale.set(0.05, h, 0.05)));
      boltCyanInst.setMatrixAt(slot, _boltMat.compose(_vMid, _boltQuat, _boltScale.set(0.14, h, 0.14)));
      boltBlueInst.setMatrixAt(slot, _boltMat.compose(_vMid, _boltQuat, _boltScale.set(0.28, h, 0.28)));
    }
    b.active = true;
    b.life = 0.2;
    b.max = 0.2;
    for (const inst of [boltWhiteInst, boltCyanInst, boltBlueInst]) {
      inst.visible = true;
      inst.instanceMatrix.needsUpdate = true;
    }
    spawnFloorGlow(bx, bz, 0x3399ff, 3.0, 0.28, 0.78);
    spawnRing(bx, bz, 0x66ccff, 2.4, 0.24, false);
    for (let k = 0; k < 6; k++) {
      elecBatch.spawn(
        bx, 0.5 + Math.random() * 0.6, bz,
        (Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8,
        k % 2 === 0 ? 0xffffff : 0x66ccff, 0.55, 0.28
      );
    }
  }

  // Persistent Dungeon Torch Flame Sprites + Glow Discs (instanced, zero PointLights)
  const MAX_TORCH_VFX = 32;
  const torchFlames = [];
  const torchFlameGeo = new THREE.PlaneGeometry(1.1, 1.3);
  const torchFlameMat = new THREE.MeshBasicMaterial({
    map: TEX.glow,
    color: 0xffaa44,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const torchFlameInst = new THREE.InstancedMesh(torchFlameGeo, torchFlameMat, MAX_TORCH_VFX);
  torchFlameInst.count = 0;
  torchFlameInst.visible = false;
  torchFlameInst.frustumCulled = false;
  torchFlameInst.matrixAutoUpdate = false;
  torchFlameInst.updateMatrix();
  scene.add(torchFlameInst);

  const torchDiscMat = new THREE.MeshBasicMaterial({
    map: TEX.glow,
    color: 0xff8a30,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const torchDiscInst = new THREE.InstancedMesh(floorDiscGeo, torchDiscMat, MAX_TORCH_VFX);
  torchDiscInst.count = 0;
  torchDiscInst.visible = false;
  torchDiscInst.frustumCulled = false;
  torchDiscInst.matrixAutoUpdate = false;
  torchDiscInst.updateMatrix();
  scene.add(torchDiscInst);

  const _torchPos = new THREE.Vector3();
  const _torchScale = new THREE.Vector3();
  const _torchIdentQuat = new THREE.Quaternion();
  const _torchMat = new THREE.Matrix4();

  function clearTorchEffects() {
    torchFlames.length = 0;
    torchFlameInst.count = 0;
    torchFlameInst.visible = false;
    torchDiscInst.count = 0;
    torchDiscInst.visible = false;
  }

  function addTorchEffect(x, y, z) {
    const idx = torchFlames.length;
    if (idx >= MAX_TORCH_VFX) return;
    torchFlames.push({ x, y: y + 0.35, z });

    _torchPos.set(x, y + 0.35, z);
    _torchScale.set(1, 1.15, 1);
    _torchMat.compose(_torchPos, camera.quaternion, _torchScale);
    torchFlameInst.setMatrixAt(idx, _torchMat);
    torchFlameInst.count = torchFlames.length;
    torchFlameInst.visible = true;
    torchFlameInst.instanceMatrix.needsUpdate = true;

    _torchPos.set(x, 0.035, z);
    _torchScale.set(10, 1, 10);
    _torchMat.compose(_torchPos, _torchIdentQuat, _torchScale);
    torchDiscInst.setMatrixAt(idx, _torchMat);
    torchDiscInst.count = torchFlames.length;
    torchDiscInst.visible = true;
    torchDiscInst.instanceMatrix.needsUpdate = true;
  }

  let shakeAmt = 0;
  function addShake(v) {
    shakeAmt = Math.min(1.4, Math.max(shakeAmt, v));
  }

  function updateVfx(dt, now, playerX, playerZ) {
    fireBatch.update(dt);
    iceBatch.update(dt);
    elecBatch.update(dt);
    bloodBatch.update(dt);
    smokeBatch.update(dt);

    for (const g of floorGlowPool) {
      if (!g.mesh.visible) continue;
      g.life -= dt;
      if (g.life <= 0) g.mesh.visible = false;
      else g.mesh.material.opacity = (g.life / g.max) * g.baseOp;
    }
    for (const d of decalPool) {
      if (!d.mesh.visible) continue;
      d.life -= dt;
      if (d.life <= 0) d.mesh.visible = false;
      else if (d.life < 0.8) d.mesh.material.opacity = (d.life / 0.8) * 0.85;
    }
    for (const r of ringPool) {
      if (!r.mesh.visible) continue;
      r.life -= dt;
      if (r.life <= 0) r.mesh.visible = false;
      else {
        const p = 1 - r.life / r.max;
        const sc = 0.25 + r.maxS * p;
        r.mesh.scale.set(sc, 1, sc);
        r.mesh.material.opacity = (1 - p) * 0.88;
      }
    }
    for (const s of slashPool) {
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) s.mesh.visible = false;
      else {
        s.mesh.rotation.y += s.spin * dt;
        s.mesh.material.opacity = (s.life / s.max) * 0.95;
      }
    }
    let anyBoltActive = false;
    let boltExpired = false;
    for (let bi = 0; bi < BOLT_POOL.length; bi++) {
      const b = BOLT_POOL[bi];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        boltExpired = true;
        const base = b.idx * BOLT_SEGS;
        for (let s = 0; s < BOLT_SEGS; s++) {
          boltWhiteInst.setMatrixAt(base + s, _zeroBoltMat);
          boltCyanInst.setMatrixAt(base + s, _zeroBoltMat);
          boltBlueInst.setMatrixAt(base + s, _zeroBoltMat);
        }
      } else {
        anyBoltActive = true;
      }
    }
    if (boltExpired) {
      for (const inst of [boltWhiteInst, boltCyanInst, boltBlueInst]) {
        inst.visible = anyBoltActive;
        inst.instanceMatrix.needsUpdate = true;
      }
    }
    for (const t of telegraphPool) {
      if (!t.active) continue;
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.dur);
      const sc = Math.max(0.05, p) * t.radius;
      t.fill.scale.set(sc, 1, sc);
      t.edge.scale.set(sc, 1, sc);
      t.fill.material.opacity = 0.16 + p * 0.34;
      t.outer.material.opacity = 0.72 + Math.sin(now * 18) * 0.2;
      if (t.elapsed >= t.dur) {
        t.active = false;
        t.grp.visible = false;
        const cb = t.onDetonate;
        t.onDetonate = null;
        if (cb) cb(t.x, t.z, t.radius);
      }
    }

    // Smooth Isometric Camera + Shake
    const tx = playerX;
    const tz = playerZ + 17.5;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 8);
    camera.position.y += (21 - camera.position.y) * Math.min(1, dt * 8);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 8);
    if (shakeAmt > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
      shakeAmt *= Math.pow(0.05, dt);
    }
    camera.lookAt(playerX, 0.8, playerZ);

    if (torchFlames.length > 0) {
      for (let i = 0; i < torchFlames.length; i++) {
        const f = torchFlames[i];
        const s = 0.88 + Math.sin(now * 9 + i) * 0.16;
        _torchPos.set(f.x, f.y, f.z);
        _torchScale.set(s, s * 1.15, 1);
        _torchMat.compose(_torchPos, camera.quaternion, _torchScale);
        torchFlameInst.setMatrixAt(i, _torchMat);
      }
      torchFlameInst.instanceMatrix.needsUpdate = true;
    }
  }

  let lastSceneCalls = 0;
  let lastSceneTris = 0;

  function renderFrame() {
    const bp = window.__bloomPass;
    if (!bp.enabled) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      lastSceneCalls = renderer.info.render.calls;
      lastSceneTris = renderer.info.render.triangles;
      return;
    }
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);
    lastSceneCalls = renderer.info.render.calls;
    lastSceneTris = renderer.info.render.triangles;

    extractMat.uniforms.tDiffuse.value = rtScene.texture;
    extractMat.uniforms.uThresh.value = bp.threshold;
    quadMesh.material = extractMat;
    renderer.setRenderTarget(rtBloomA);
    renderer.render(postScene, orthoCam);

    blurMat.uniforms.tDiffuse.value = rtBloomA.texture;
    blurMat.uniforms.uDir.value.set(1 / rtBloomA.width, 0);
    quadMesh.material = blurMat;
    renderer.setRenderTarget(rtBloomB);
    renderer.render(postScene, orthoCam);

    blurMat.uniforms.tDiffuse.value = rtBloomB.texture;
    blurMat.uniforms.uDir.value.set(0, 1 / rtBloomB.height);
    quadMesh.material = blurMat;
    renderer.setRenderTarget(rtBloomA);
    renderer.render(postScene, orthoCam);

    compMat.uniforms.tBase.value = rtScene.texture;
    compMat.uniforms.tBloom.value = rtBloomA.texture;
    compMat.uniforms.uStrength.value = bp.strength;
    quadMesh.material = compMat;
    renderer.setRenderTarget(null);
    renderer.render(postScene, orthoCam);
  }

  DS.vfx = {
    renderer,
    scene,
    camera,
    TEX,
    fireBatch,
    iceBatch,
    elecBatch,
    bloodBatch,
    smokeBatch,
    applyQuality,
    spawnFloorGlow,
    spawnDecal,
    spawnRing,
    spawnSlashArc,
    spawnLightning,
    spawnTelegraph,
    telegraphs: telegraphPool,
    addTorchEffect,
    clearTorchEffects,
    addShake,
    update: updateVfx,
    renderFrame,
    getDrawStats: () => ({
      drawCalls: lastSceneCalls,
      triangles: lastSceneTris,
      textures: renderer.info.memory.textures
    }),
    clearAll() {
      fireBatch.clear();
      iceBatch.clear();
      elecBatch.clear();
      bloodBatch.clear();
      smokeBatch.clear();
      for (const g of floorGlowPool) g.mesh.visible = false;
      for (const d of decalPool) d.mesh.visible = false;
      for (const r of ringPool) r.mesh.visible = false;
      for (const s of slashPool) s.mesh.visible = false;
      for (let bi = 0; bi < BOLT_POOL.length; bi++) {
        BOLT_POOL[bi].active = false;
        BOLT_POOL[bi].life = 0;
      }
      for (const inst of [boltWhiteInst, boltCyanInst, boltBlueInst]) {
        for (let k = 0; k < MAX_BOLTS * BOLT_SEGS; k++) inst.setMatrixAt(k, _zeroBoltMat);
        inst.instanceMatrix.needsUpdate = true;
        inst.visible = false;
      }
      for (const t of telegraphPool) {
        t.active = false;
        t.grp.visible = false;
        t.onDetonate = null;
      }
    }
  };
})();
