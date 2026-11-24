(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  const $ = (id) => document.getElementById(id);
  let lang = 'vi';
  let lastSkillSig = '';
  let bannerTimer = null;
  let loreTimer = null;
  let storyFromStart = false;
  let codexTab = 'skills';

  function txt(vi, en) {
    return lang === 'en' ? en : vi;
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function applyStaticI18n() {
    const t = DS.I18N[lang] || DS.I18N.vi;
    if ($('brandTitle')) $('brandTitle').textContent = t.title;
    if ($('brandSub')) $('brandSub').textContent = t.sub;
    if ($('btnStart')) $('btnStart').textContent = t.start;
    if ($('btnShop')) $('btnShop').textContent = t.shop;
    if ($('btnCodexMenu')) $('btnCodexMenu').textContent = t.codex;
    if ($('btnStoryMenu')) $('btnStoryMenu').textContent = t.storyBtn;
    if ($('lblGoldMeta')) $('lblGoldMeta').textContent = t.gold;
    if ($('lblBestMeta')) $('lblBestMeta').textContent = t.best;
    if ($('lblScrollMeta')) $('lblScrollMeta').textContent = t.scrolls;
    if ($('lblLbMeta')) $('lblLbMeta').textContent = t.lbTop;
    if ($('ctrlHintTxt')) $('ctrlHintTxt').innerHTML = t.ctrl;
    if ($('pauseTitle')) $('pauseTitle').textContent = t.pause;
    if ($('btnResume')) $('btnResume').textContent = t.resume;
    if ($('btnRestartPause')) $('btnRestartPause').textContent = t.restart;
    if ($('btnMenuPause')) $('btnMenuPause').textContent = t.menu;
    if ($('draftTitle')) $('draftTitle').textContent = t.draftTitle;
    if ($('btnSaveScore')) $('btnSaveScore').textContent = t.saveScore;
    if ($('btnRetry')) $('btnRetry').textContent = t.restart;
    if ($('btnBackMenu')) $('btnBackMenu').textContent = t.menu;
    if ($('btnLang')) $('btnLang').textContent = lang === 'vi' ? '🌐 VI' : '🌐 EN';
  }

  function renderMenu(profile, selectedHeroId, leaderboard, onSelectHero) {
    lang = (profile && profile.lang) || 'vi';
    applyStaticI18n();

    const p = profile || {};
    $('menuGold').textContent = String(p.gold || 0) + ' 🪙';
    $('menuBest').textContent = fmtTime(p.bestTimeSec || 0) + ' • ' + (p.bestKills || 0) + ' 💀';
    $('menuScrolls').textContent = (p.discoveredScrolls ? p.discoveredScrolls.length : 0) + ' / ' + DS.SCROLL_DEFS.length;

    if (leaderboard && leaderboard.length) {
      const top = leaderboard[0];
      $('lbBox').textContent = '#1 ' + top.name + ' (' + fmtTime(top.timeSec) + ' / ' + top.kills + '💀)';
    } else {
      $('lbBox').textContent = txt('Chưa có kỷ lục', 'No records yet');
    }

    if ($('qualitySel')) $('qualitySel').value = p.quality || 'balanced';
    if ($('btnSoundMenu')) $('btnSoundMenu').textContent = DS.audio.isMuted() ? '🔇 Sound' : '🔊 Sound';

    const unlocked = new Set(p.unlockedHeroes || ['knight', 'wizard', 'archer']);
    const grid = $('heroGrid');
    grid.innerHTML = '';

    for (const key of Object.keys(DS.HEROES)) {
      const h = DS.HEROES[key];
      const isOwned = unlocked.has(h.id);
      const card = document.createElement('div');
      card.className = 'heroCard' + (selectedHeroId === h.id ? ' selected' : '');
      const statusBadge = isOwned
        ? '<span style="color:#45e594;font-size:11px;font-weight:700">' + (selectedHeroId === h.id ? '✔ READY' : 'UNLOCKED') + '</span>'
        : '<span style="color:#ffd464;font-size:11px;font-weight:700">🔒 ' + h.cost + ' 🪙</span>';
      card.innerHTML = `
        <div class="heroTop">
          <div>
            <div class="heroName">${txt(h.nameVi, h.nameEn)}</div>
            <div class="heroRole">${txt(h.roleVi, h.roleEn)}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="heroStats">
          <span>❤️ ${h.hp}</span>
          <span>⚡ ${h.speed}</span>
          <span>⚔️ ${Math.round(h.might * 100)}%</span>
          <span>🎯 ${DS.SKILL_DEFS[h.skill].ico} ${h.skill}</span>
        </div>
        <div class="heroBio">${txt(h.bioVi, h.bioEn)}</div>
      `;
      card.onclick = () => onSelectHero(h.id);
      grid.appendChild(card);
    }
  }

  function showStoryModal(profile, fromStart, onContinue) {
    storyFromStart = !!fromStart;
    const chBox = $('storyChapters');
    chBox.innerHTML = DS.STORY.prologue
      .map(
        (c) => `
      <div class="storyAct">
        <h4>${txt(c.titleVi, c.titleEn)}</h4>
        <p>${txt(c.bodyVi, c.bodyEn)}</p>
      </div>`
      )
      .join('');

    const found = new Set((profile && profile.discoveredScrolls) || []);
    const sBox = $('storyScrollList');
    sBox.innerHTML = DS.SCROLL_DEFS.map((s) => {
      const ok = found.has(s.id);
      return `<div class="scrollItem${ok ? '' : ' locked'}">
        <div style="font-weight:700;color:${ok ? '#b88cff' : '#98a8c7'}">${ok ? '📜 ' + txt(s.titleVi, s.titleEn) : '🔒 ' + txt('Cổ Thư Bị Phong Ấn', 'Sealed Scroll')}</div>
        <div style="margin-top:4px;color:#cddbff;line-height:1.4">${ok ? txt(s.bodyVi, s.bodyEn) : txt('Khám phá 4 góc & trung tâm Cổ Thành để giải mã.', 'Explore the arena corners & north gate in-game to unlock.')}</div>
      </div>`;
    }).join('');

    $('btnStoryContinue').textContent = fromStart
      ? txt('⚔ BƯỚC VÀO CỔ THÀNH', '⚔ ENTER CITADEL')
      : txt('Đóng', 'Close');
    $('btnStoryContinue').onclick = () => {
      $('storyScr').classList.add('hidden');
      try {
        localStorage.setItem('ds3d_story_seen', '1');
      } catch {}
      if (onContinue) onContinue();
    };
    $('storyScr').classList.remove('hidden');
  }

  function renderShop(profile, onBuy) {
    $('shopGold').textContent = (profile.gold || 0) + ' 🪙';
    const grid = $('shopGrid');
    grid.innerHTML = '';
    for (const k of Object.keys(DS.META_UPGRADES)) {
      const u = DS.META_UPGRADES[k];
      const lv = (profile.metaLevels && profile.metaLevels[k]) || 0;
      const maxed = lv >= u.max;
      const cost = Math.round(u.cost * Math.pow(u.mult, lv));
      const div = document.createElement('div');
      div.className = 'shopCard';
      div.innerHTML = `
        <div style="font-weight:700;font-size:14px">${u.ico} ${txt(u.vi, u.en)} <span style="color:#5ce1ff">[${lv}/${u.max}]</span></div>
        <div style="color:#98a8c7;margin:5px 0 8px">${txt(u.descVi, u.descEn)}</div>
        <button class="btn ${maxed ? '' : 'gold'}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' 🪙'}</button>
      `;
      if (!maxed) {
        div.querySelector('button').onclick = () => onBuy(k, cost);
      }
      grid.appendChild(div);
    }
  }

  function renderCodex(tab) {
    codexTab = tab || codexTab;
    document.querySelectorAll('#codexTabs .btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === codexTab);
    });
    const grid = $('codexGrid');
    grid.innerHTML = '';

    if (codexTab === 'skills') {
      for (const k of Object.keys(DS.SKILL_DEFS)) {
        const s = DS.SKILL_DEFS[k];
        const card = document.createElement('div');
        card.className = 'codexCard';
        card.innerHTML = `
          <div style="font-weight:700;color:#ffd464">${s.ico} [${k}] ${txt(s.nameVi, s.nameEn)}</div>
          <div style="color:#98a8c7;margin-top:4px">${txt(s.descVi, s.descEn)}</div>
          ${s.evo ? `<div style="margin-top:5px;color:#5ce1ff;font-size:11px">★ Evo: ${txt(s.evo.nameVi, s.evo.nameEn)}</div>` : ''}
        `;
        grid.appendChild(card);
      }
    } else if (codexTab === 'passives') {
      for (const k of Object.keys(DS.PASSIVES)) {
        const p = DS.PASSIVES[k];
        const card = document.createElement('div');
        card.className = 'codexCard';
        card.innerHTML = `
          <div style="font-weight:700;color:#45e594">${p.ico} ${txt(p.nameVi, p.nameEn)}</div>
          <div style="color:#98a8c7;margin-top:4px">${txt(p.descVi, p.descEn)}</div>
        `;
        grid.appendChild(card);
      }
    } else if (codexTab === 'monsters') {
      for (const k of Object.keys(DS.MONSTER_STATS)) {
        const m = DS.MONSTER_STATS[k];
        const card = document.createElement('div');
        card.className = 'codexCard';
        card.innerHTML = `
          <div style="font-weight:700;color:${m.boss ? '#ff5666' : '#fff'}">${m.boss ? '👑 ' : ''}${m.boss ? txt(m.nameVi, m.nameEn) : k.toUpperCase()}</div>
          <div style="color:#98a8c7;margin-top:4px">HP ${m.hp} • SPD ${m.spd} • DMG ${m.dmg}</div>
        `;
        grid.appendChild(card);
      }
    }
  }

  function renderDraft(skills, evolvedSkills, passives, onPick) {
    const candidates = [];
    for (const k of Object.keys(DS.SKILL_DEFS)) {
      const def = DS.SKILL_DEFS[k];
      const lv = skills[k] || 0;
      if (lv >= 5 && def.evo && !evolvedSkills[k] && passives[def.evo.pass]) {
        candidates.push({ kind: 'evo', key: k, def, w: 40 });
      } else if (lv < 7) {
        candidates.push({ kind: 'skill', key: k, def, lv, w: def.w + (lv > 0 ? 5 : 0) });
      }
    }
    for (const pk of Object.keys(DS.PASSIVES)) {
      const lv = passives[pk] || 0;
      if (lv < 5) candidates.push({ kind: 'passive', key: pk, def: DS.PASSIVES[pk], lv, w: 9 });
    }

    const picked = [];
    const pool = candidates.slice();
    while (picked.length < 3 && pool.length) {
      const totalW = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * totalW;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].w;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      picked.push(pool.splice(idx, 1)[0]);
    }

    const box = $('draftCards');
    box.innerHTML = '';
    for (const c of picked) {
      const card = document.createElement('div');
      card.className = 'draftCard' + (c.kind === 'evo' ? ' evo' : '');
      if (c.kind === 'evo') {
        card.innerHTML = `
          <div class="draftTag">★ TIẾN HÓA THẦN KỸ</div>
          <div class="draftTitle">${c.def.ico} ${txt(c.def.evo.nameVi, c.def.evo.nameEn)}</div>
          <div class="draftDesc">${txt('Nâng cấp tối thượng cho chiêu', 'Ultimate evolution for')} ${c.key} (+65% DMG & +35% Area)</div>
        `;
      } else if (c.kind === 'skill') {
        card.innerHTML = `
          <div class="draftTag">${c.lv ? 'LV ' + (c.lv + 1) : txt('KỸ NĂNG MỚI', 'NEW SKILL')} [${c.key}]</div>
          <div class="draftTitle">${c.def.ico} ${txt(c.def.nameVi, c.def.nameEn)}</div>
          <div class="draftDesc">${txt(c.def.descVi, c.def.descEn)}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="draftTag" style="color:#45e594">${txt('BỊ ĐỘNG', 'PASSIVE')} LV ${c.lv + 1}</div>
          <div class="draftTitle">${c.def.ico} ${txt(c.def.nameVi, c.def.nameEn)}</div>
          <div class="draftDesc">${txt(c.def.descVi, c.def.descEn)}</div>
        `;
      }
      card.onclick = () => onPick(c);
      box.appendChild(card);
    }
    $('draftScr').classList.remove('hidden');
  }

  function updateHud(runTime, activeBoss, foundScrollCount, qualityId) {
    const p = DS.entities.player;
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    $('hpBar').style.width = hpPct.toFixed(1) + '%';
    $('hpVal').textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;

    const dashReadyPct = p.dashCd <= 0 ? 100 : Math.max(0, ((3.0 - p.dashCd) / 3.0) * 100);
    $('dashBar').style.width = dashReadyPct.toFixed(0) + '%';
    $('dashVal').textContent = p.dashCd <= 0 ? 'DASH READY' : p.dashCd.toFixed(1) + 's';
    $('btnDash').classList.toggle('onCd', p.dashCd > 0);

    const furyPct = Math.max(0, Math.min(100, p.fury));
    $('furyBar').style.width = furyPct.toFixed(0) + '%';
    $('furyVal').textContent = p.berserkT > 0 ? '🔥 BERSERK!' : 'NỘ ' + Math.floor(furyPct) + '%';
    $('btnUlt').classList.toggle('ready', furyPct >= 100);

    const xpPct = Math.max(0, Math.min(100, (p.xp / p.nextXp) * 100));
    $('xpBar').style.width = xpPct.toFixed(1) + '%';
    $('lvBadge').textContent = 'LV ' + p.level;

    $('timer').textContent = fmtTime(runTime);
    const hDef = DS.HEROES[p.heroId] || DS.HEROES.knight;
    $('heroTag').innerHTML = `<span>${txt(hDef.nameVi, hDef.nameEn)}</span><span>Combo ${p.comboStep}/3</span>`;
    $('waveInfo').textContent = txt('Đợt ', 'Wave ') + (1 + Math.floor(runTime / 45));
    $('scrollHud').textContent = '📄 ' + foundScrollCount + '/' + DS.SCROLL_DEFS.length;
    $('killCount').textContent = '💀 ' + p.kills;
    $('goldCount').textContent = '🪙 ' + p.goldEarned;

    const qDef = DS.QUALITY_PRESETS[qualityId] || DS.QUALITY_PRESETS.balanced;
    $('qBadge').textContent = txt(qDef.vi, qDef.en);

    if (activeBoss && activeBoss.alive) {
      $('bossBarWrap').classList.remove('hidden');
      const mDef = DS.MONSTER_STATS[activeBoss.type];
      $('bossName').textContent = txt(mDef.nameVi, mDef.nameEn);
      $('bossHpFill').style.width = Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100).toFixed(1) + '%';
      $('bossHpTxt').textContent = Math.max(0, Math.ceil(activeBoss.hp)) + ' / ' + activeBoss.maxHp;
    } else {
      $('bossBarWrap').classList.add('hidden');
    }

    const sig = Object.keys(DS.entities.skills)
      .sort()
      .map((k) => k + DS.entities.skills[k] + (DS.entities.evolvedSkills[k] ? 'E' : ''))
      .join('|');
    if (sig !== lastSkillSig) {
      lastSkillSig = sig;
      const box = $('skillHud');
      box.innerHTML = '';
      for (const k of Object.keys(DS.entities.skills)) {
        const s = DS.SKILL_DEFS[k];
        if (!s) continue;
        const slot = document.createElement('div');
        slot.className = 'skSlot' + (DS.entities.evolvedSkills[k] ? ' evolved' : '');
        slot.innerHTML = `<span>${s.ico}</span><span class="skLv">${DS.entities.skills[k]}</span>`;
        box.appendChild(slot);
      }
    }
  }

  function showStoryBanner(ch) {
    if (!ch) return;
    $('storyChTag').textContent = txt(ch.tagVi, ch.tagEn);
    $('storyChTitle').textContent = txt(ch.titleVi, ch.titleEn);
    $('storyChSub').textContent = txt(ch.subVi, ch.subEn);
    $('storyBanner').classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => $('storyBanner').classList.add('hidden'), 5200);
  }

  function showLoreToast(scrollDef) {
    $('loreTitle').textContent = '📜 ' + txt(scrollDef.titleVi, scrollDef.titleEn);
    $('loreBody').textContent = txt(scrollDef.bodyVi, scrollDef.bodyEn);
    $('loreToast').classList.remove('hidden');
    clearTimeout(loreTimer);
    loreTimer = setTimeout(() => $('loreToast').classList.add('hidden'), 6500);
  }

  function showGameOver(win, runTime) {
    const t = DS.I18N[lang] || DS.I18N.vi;
    const p = DS.entities.player;
    $('overTitle').textContent = win ? t.victory : t.defeat;
    $('overTitle').style.color = win ? '#ffd464' : '#ff5666';
    $('overStatsGrid').innerHTML = `
      <div class="metaBox"><div class="k">${txt('Thời Gian', 'Time')}</div><div class="v">${fmtTime(runTime)}</div></div>
      <div class="metaBox"><div class="k">${txt('Quái Đã Diệt', 'Kills')}</div><div class="v">${p.kills}</div></div>
      <div class="metaBox"><div class="k">${txt('Cấp Độ', 'Level')}</div><div class="v">LV ${p.level}</div></div>
      <div class="metaBox"><div class="k">${txt('Vàng Thu Được', 'Gold Earned')}</div><div class="v">+${p.goldEarned} 🪙</div></div>
    `;
    $('overScr').classList.remove('hidden');
  }

  function drawMinimap(activeBoss) {
    const cvs = $('minimap');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;
    const lim = DS.world.ARENA_LIMIT || 98;
    const toX = (wx) => ((wx + lim) / (lim * 2)) * (w - 10) + 5;
    const toY = (wz) => ((wz + lim) / (lim * 2)) * (h - 10) + 5;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8, 12, 24, 0.86)';
    ctx.fillRect(0, 0, w, h);

    // District sector crosshairs & boundary
    ctx.strokeStyle = 'rgba(118, 175, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.beginPath();
    ctx.moveTo(w / 2, 4);
    ctx.lineTo(w / 2, h - 4);
    ctx.moveTo(4, h / 2);
    ctx.lineTo(w - 4, h / 2);
    ctx.stroke();

    // Uncollected Lore Scrolls (Violet)
    for (const ln of DS.world.loreNodes) {
      if (ln.collected) continue;
      ctx.fillStyle = '#d088ff';
      ctx.beginPath();
      ctx.arc(toX(ln.x), toY(ln.z), 3.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Alive Treasure Chests (Gold)
    ctx.fillStyle = '#ffd464';
    for (const b of DS.world.breakables) {
      if (b.alive && b.isChest) ctx.fillRect(toX(b.x) - 2, toY(b.z) - 2, 4, 4);
    }

    // Monsters & Boss
    for (const m of DS.entities.monsters) {
      if (!m.alive) continue;
      const mx = toX(m.x);
      const my = toY(m.z);
      if (m.boss) {
        ctx.fillStyle = '#ff3850';
        ctx.beginPath();
        ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 110, 120, 0.85)';
        ctx.fillRect(mx - 1.2, my - 1.2, 2.4, 2.4);
      }
    }

    // Player Marker
    const p = DS.entities.player;
    const px = toX(p.x);
    const py = toY(p.z);
    ctx.fillStyle = '#5ce1ff';
    ctx.beginPath();
    ctx.arc(px, py, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(p.aimYaw) * 6.5, py + Math.cos(p.aimYaw) * 6.5);
    ctx.stroke();

    // District badge sync
    const zb = $('zoneBadge');
    if (zb && DS.world.getZoneFor) {
      const z = DS.world.getZoneFor(p.x, p.z);
      zb.textContent = txt(z.vi, z.en);
    }
  }

  DS.ui = {
    $,
    getLang: () => lang,
    txt,
    fmtTime,
    renderMenu,
    showStoryModal,
    renderShop,
    renderCodex,
    renderDraft,
    updateHud,
    drawMinimap,
    showStoryBanner,
    showLoreToast,
    showGameOver
  };
})();
