(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  let ctx = null;
  let muted = false;
  let bgm = null;
  let bgmReady = false;

  function ensureCtx() {
    if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
      const C = window.AudioContext || window.webkitAudioContext;
      ctx = new C();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'triangle';
      const now = c.currentTime;
      o.frequency.setValueAtTime(freq, now);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + dur);
      g.gain.setValueAtTime(vol || 0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(now);
      o.stop(now + dur + 0.01);
    } catch {}
  }

  DS.audio = {
    isMuted: () => muted,

    toggleMute() {
      muted = !muted;
      if (bgm) bgm.muted = muted;
      return muted;
    },

    unlock() {
      ensureCtx();
      if (!bgmReady) {
        bgmReady = true;
        try {
          bgm = new Audio('assets/audio/dungeon_bgm.ogg');
          bgm.loop = true;
          bgm.volume = 0.28;
          bgm.muted = muted;
        } catch {}
      }
      if (bgm && bgm.paused && !muted) {
        bgm.play().catch(() => {});
      }
    },

    playSwordSlash(step) {
      const f = step === 3 ? 520 : step === 2 ? 410 : 340;
      playTone(f, 0.11, 'sawtooth', 0.08, 120);
    },

    playDash() {
      playTone(260, 0.14, 'sine', 0.09, 640);
    },

    playUlt() {
      playTone(180, 0.45, 'sawtooth', 0.13, 680);
      setTimeout(() => playTone(880, 0.32, 'triangle', 0.1, 240), 70);
    },

    playLore() {
      playTone(523, 0.18, 'sine', 0.09, 659);
      setTimeout(() => playTone(784, 0.25, 'sine', 0.08, 1046), 110);
    },

    playPickup() {
      playTone(680, 0.06, 'sine', 0.04, 960);
    },

    playHurt() {
      playTone(150, 0.14, 'square', 0.08, 70);
    },

    playLevelUp() {
      playTone(440, 0.12, 'triangle', 0.09, 554);
      setTimeout(() => playTone(659, 0.18, 'triangle', 0.09, 880), 90);
    },

    playSkillSfx(fam) {
      if (fam === 'lightning') playTone(920, 0.09, 'sawtooth', 0.05, 320);
      else if (fam === 'fire') playTone(210, 0.12, 'sawtooth', 0.05, 85);
      else if (fam === 'frost') playTone(760, 0.1, 'sine', 0.045, 420);
      else playTone(380, 0.08, 'triangle', 0.045, 160);
    }
  };
})();
