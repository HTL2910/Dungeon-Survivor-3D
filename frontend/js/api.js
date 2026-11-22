(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});
  const LS_KEY = 'ds3d_profile_v2';

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

  DS.api = {
    async loadProfile() {
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
      const merged = Object.assign({}, loadLocal(), patch);
      saveLocal(merged);
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
      try {
        return await reqJson('api/leaderboard');
      } catch {
        return [];
      }
    },

    async submitScore(entry) {
      try {
        return await reqJson('api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch {
        return [];
      }
    }
  };
})();
