(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const LS_KEY = 'ds3d_profile_v2';
  const LS_LB_KEY = 'ds3d_leaderboard_v2';
  const IS_STATIC = !!window.__ITCH_STATIC__;

  const DEFAULT_PROFILE = {
    gold: 150,
    unlockedHeroes: ['knight', 'wizard', 'archer'],
    metaLevels: { might: 0, hp: 0, speed: 0, magnet: 0, greed: 0, armor: 0 },
    discoveredScrolls: [],
    bestTimeSec: 0,
    bestKills: 0,
    lang: 'vi',
    quality: 'balanced'
  };

  async function reqJson(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_PROFILE);
      return Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw));
    } catch {
      return Object.assign({}, DEFAULT_PROFILE);
    }
  }

  function saveLocal(p) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {}
  }

  function mergeProfile(cur, patch) {
    const p = patch || {};
    return {
      gold: typeof p.gold === 'number' ? Math.max(0, Math.round(p.gold)) : cur.gold,
      unlockedHeroes: Array.isArray(p.unlockedHeroes) && p.unlockedHeroes.length ? p.unlockedHeroes : cur.unlockedHeroes,
      metaLevels: p.metaLevels && typeof p.metaLevels === 'object' ? p.metaLevels : cur.metaLevels,
      discoveredScrolls: Array.from(new Set([...(cur.discoveredScrolls || []), ...(Array.isArray(p.discoveredScrolls) ? p.discoveredScrolls : [])])),
      bestTimeSec: Math.max(cur.bestTimeSec || 0, Number(p.bestTimeSec) || 0),
      bestKills: Math.max(cur.bestKills || 0, Number(p.bestKills) || 0),
      lang: p.lang || cur.lang || 'vi',
      quality: p.quality || cur.quality || 'balanced'
    };
  }

  function loadLocalLb() {
    try {
      const raw = localStorage.getItem(LS_LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalLb(list) {
    try {
      localStorage.setItem(LS_LB_KEY, JSON.stringify(list));
    } catch {}
  }

  DS.api = {
    async loadProfile() {
      if (IS_STATIC) return loadLocal();
      try {
        const data = await reqJson('api/profile');
        const merged = Object.assign({}, DEFAULT_PROFILE, data);
        saveLocal(merged);
        return merged;
      } catch {
        return loadLocal();
      }
    },

    async saveProfile(patch) {
      const merged = mergeProfile(loadLocal(), patch);
      saveLocal(merged);
      if (IS_STATIC) return merged;
      try {
        const remote = await reqJson('api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        saveLocal(remote);
        return remote;
      } catch {
        return merged;
      }
    },

    async getLeaderboard() {
      if (IS_STATIC) return loadLocalLb();
      try {
        return await reqJson('api/leaderboard');
      } catch {
        return loadLocalLb();
      }
    },

    async submitScore(entry) {
      const list = loadLocalLb();
      list.push({
        name: String((entry && entry.name) || 'Warrior').slice(0, 24),
        hero: String((entry && entry.hero) || 'knight'),
        timeSec: Math.round(Number(entry && entry.timeSec) || 0),
        kills: Number(entry && entry.kills) || 0,
        level: Number(entry && entry.level) || 1,
        win: !!(entry && entry.win),
        date: new Date().toISOString().slice(0, 10)
      });
      list.sort((a, b) => (b.win - a.win) || (b.timeSec - a.timeSec) || (b.kills - a.kills));
      const top = list.slice(0, 10);
      saveLocalLb(top);
      if (IS_STATIC) return top;
      try {
        const remote = await reqJson('api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        saveLocalLb(remote);
        return remote;
      } catch {
        return top;
      }
    }
  };
})();
