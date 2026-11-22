(function () {
  'use strict';
  const DS = (window.DS = window.DS || {});

  DS.QUALITY_PRESETS = {
    fast: { id: 'fast', vi: '⚡ Siêu Mượt', en: '⚡ Ultra Fast', dpr: 1.0, bloom: false, maxMonsters: 60 },
    balanced: { id: 'balanced', vi: '⚖ Cân Bằng', en: '⚖ Balanced', dpr: 1.0, bloom: true, maxMonsters: 75 },
    high: { id: 'high', vi: '💎 Sắc Nét', en: '💎 Crisp', dpr: 1.35, bloom: true, maxMonsters: 85 }
  };

  DS.ASSETS = {
    dungeon: [
      ['wallDoor', 'assets/dungeon/dungeon-wall-with-door.glb'],
      ['wall', 'assets/dungeon/stepped-stone-wall.glb'],
      ['pillar', 'assets/dungeon/ancient-stone-pillar.glb'],
      ['torch', 'assets/dungeon/hell-torch.glb'],
      ['path', 'assets/dungeon/cobblestone-pathway.glb'],
      ['stairs', 'assets/dungeon/old-stone-stairs.glb'],
      ['rock', 'assets/dungeon/rusty-rock-pile.glb'],
      ['chest', 'assets/dungeon/treasure-chest.glb'],
      ['barrel', 'assets/dungeon/wooden-barrel.glb'],
      ['crate', 'assets/dungeon/sturdy-wooden-crate.glb']
    ],
    characters: [
      ['knight', 'assets/characters/tiny-knight.glb'],
      ['wizard', 'assets/characters/azure-wizard.glb'],
      ['archer', 'assets/characters/archer.glb'],
      ['samurai', 'assets/characters/samurai.glb'],
      ['viking', 'assets/characters/viking-warrior.glb'],
      ['pirate', 'assets/characters/pirate-captain.glb']
    ],
    monsters: [
      ['slime', 'assets/monsters/slime-glow.glb'],
      ['goblin', 'assets/monsters/goblin-grin.glb'],
      ['mushroom', 'assets/monsters/mushroom-buddy.glb'],
      ['skeleton', 'assets/monsters/skeleton-warrior.glb'],
      ['ghost', 'assets/monsters/ghost.glb'],
      ['zombie', 'assets/monsters/zombie.glb'],
      ['troll', 'assets/monsters/warrior-troll.glb'],
      ['golem', 'assets/monsters/flame-golem.glb'],
      ['souleater', 'assets/monsters/soul-eating-monster.glb'],
      ['orcking', 'assets/monsters/orc-king.glb'],
      ['minotaur', 'assets/monsters/minotaur-warrior.glb'],
      ['titan', 'assets/monsters/demonic-titan.glb'],
      ['dragon', 'assets/monsters/azure-dragon.glb']
    ],
    weapons: [
      ['sword', 'assets/weapons/fantasy-sword.glb'],
      ['staff', 'assets/weapons/azure-crystal-staff.glb'],
      ['bow', 'assets/weapons/rangers-bow.glb'],
      ['scythe', 'assets/weapons/frost-scythe-sword.glb'],
      ['axe', 'assets/weapons/runic-battle-axe.glb'],
      ['hammer', 'assets/weapons/cosmic-hammer.glb'],
      ['excalibur', 'assets/weapons/excalibur.glb'],
      ['kusanagi', 'assets/weapons/kusanagi.glb'],
      ['thuan-thien', 'assets/weapons/thuan-thien.glb'],
      ['masamune', 'assets/weapons/masamune.glb'],
      ['zulfiqar', 'assets/weapons/zulfiqar.glb'],
      ['muramasa', 'assets/weapons/muramasa.glb']
    ]
  };

  DS.HEROES = {
    knight: {
      id: 'knight', model: 'knight', weapon: 'sword', skill: 'A', cost: 0,
      nameVi: 'Hiệp Sĩ Nhỏ', nameEn: 'Tiny Knight',
      roleVi: 'Kiếm Sĩ Thánh Điện', roleEn: 'Paladin Vanguard',
      bioVi: 'Hậu duệ cuối cùng giữ chìa khóa Ấn Kiếm Địa Ngục.',
      bioEn: 'Last sworn keeper of the Hellblade Seal.',
      hp: 130, speed: 7.5, might: 1.05, area: 1.05, cd: 1.0, armor: 2, pickup: 4.0
    },
    wizard: {
      id: 'wizard', model: 'wizard', weapon: 'staff', skill: 'C', cost: 0,
      nameVi: 'Pháp Sư Thanh Lam', nameEn: 'Azure Wizard',
      roleVi: 'Triệu Hồi Thiên Lôi', roleEn: 'Tempest Mage',
      bioVi: 'Kẻ giải mã cổ thư Sấm Sét trên đỉnh Cổ Thành Lạc Long.',
      bioEn: 'Scholar who unlocked the Storm Scrolls of Lac Long.',
      hp: 100, speed: 7.3, might: 1.18, area: 1.14, cd: 0.88, armor: 0, pickup: 4.4
    },
    archer: {
      id: 'archer', model: 'archer', weapon: 'bow', skill: 'G', cost: 0,
      nameVi: 'Cung Thủ Rừng Sâu', nameEn: 'Deepwood Archer',
      roleVi: 'Thợ Săn Bóng Đêm', roleEn: 'Shadow Ranger',
      bioVi: 'Từng mũi tên xuyên thẳng qua linh hồn sa đọa.',
      bioEn: 'Every arrow pierces corrupt souls in darkness.',
      hp: 108, speed: 8.2, might: 1.08, area: 1.0, cd: 0.9, armor: 1, pickup: 4.6
    },
    samurai: {
      id: 'samurai', model: 'samurai', weapon: 'kusanagi', skill: 'D', cost: 400,
      nameVi: 'Lãng Khách Samurai', nameEn: 'Ronin Samurai',
      roleVi: 'Bậc Thầy Cư Hợp Trảm', roleEn: 'Iaido Blademaster',
      bioVi: 'Kiếm ảnh xoay quanh thân cắt nát mọi vòng vây.',
      bioEn: 'Spinning spirit blades shred every encirclement.',
      hp: 120, speed: 8.0, might: 1.2, area: 1.1, cd: 0.9, armor: 1, pickup: 4.0
    },
    viking: {
      id: 'viking', model: 'viking', weapon: 'axe', skill: 'F', cost: 750,
      nameVi: 'Chiến Binh Viking', nameEn: 'Viking Berserker',
      roleVi: 'Cuồng Chiến Cổ Ngữ', roleEn: 'Rune Juggernaut',
      bioVi: 'Càng bị vây hãm, rìu cổ ngữ càng gầm vang dữ dội.',
      bioEn: 'The thicker the horde, the harder the runic axe cleaves.',
      hp: 155, speed: 7.2, might: 1.28, area: 1.16, cd: 1.0, armor: 3, pickup: 3.9
    },
    pirate: {
      id: 'pirate', model: 'pirate', weapon: 'thuan-thien', skill: 'B', cost: 1200,
      nameVi: 'Thuyền Trưởng Hải Tặc', nameEn: 'Dread Captain',
      roleVi: 'Hỏa Pháo Thần Kiếm', roleEn: 'Hellfire Buccaneer',
      bioVi: 'Chiếm được Thuận Thiên Kiếm từ đáy vực Cổ Thành.',
      bioEn: 'Claimed Thuan Thien Blade from the abyssal vault.',
      hp: 138, speed: 7.8, might: 1.24, area: 1.14, cd: 0.93, armor: 2, pickup: 4.7
    }
  };

  DS.META_UPGRADES = {
    might:  { ico: '⚔️', vi: 'Sức Mạnh Cơ Bản', en: 'Base Might', max: 5, cost: 120, mult: 1.7, descVi: '+10% sát thương mỗi cấp', descEn: '+10% damage per rank' },
    hp:     { ico: '❤️', vi: 'Sinh Lực Tối Đa', en: 'Max Health', max: 5, cost: 100, mult: 1.65, descVi: '+25 HP mỗi cấp', descEn: '+25 HP per rank' },
    speed:  { ico: '💨', vi: 'Thân Pháp Nhanh', en: 'Swiftness', max: 5, cost: 110, mult: 1.65, descVi: '+6% tốc chạy mỗi cấp', descEn: '+6% move speed per rank' },
    armor:  { ico: '🛡️', vi: 'Thiết Giáp Thánh', en: 'Iron Ward', max: 4, cost: 140, mult: 1.8, descVi: '+1 Giáp giảm sát thương', descEn: '+1 Armor per rank' },
    magnet: { ico: '🧲', vi: 'Từ Trường Hút Ngọc', en: 'Soul Magnet', max: 4, cost: 90, mult: 1.6, descVi: '+1.0m tầm nhặt ngọc & rương', descEn: '+1.0m pickup radius' },
    greed:  { ico: '🪙', vi: 'Kho Báu Cổ Thành', en: 'Ancient Greed', max: 4, cost: 130, mult: 1.7, descVi: '+20% vàng nhận được', descEn: '+20% gold earned' }
  };

  DS.SKILL_DEFS = {
    A: { k: 'A', ico: '⚔️', fam: 'sword', w: 12, cd: 1.1, wp: 'sword', evo: { pass: 'p_cd', nameVi: 'Huyễn Kiếm Càn Khôn', nameEn: 'Celestial Omnislash' }, nameVi: 'Thánh Kiếm Quét Ngang', nameEn: 'Holy Cleave', descVi: 'Chém vòng cung 3D cực rộng phía trước', descEn: 'Wide 3D sacred sword arc slash' },
    B: { k: 'B', ico: '🔥', fam: 'fire', w: 12, cd: 1.55, evo: { pass: 'p_area', nameVi: 'Thiên Hỏa Vẫn Thạch', nameEn: 'Infernal Supernova' }, nameVi: 'Hỏa Cầu Địa Ngục', nameEn: 'Hellfire Orb', descVi: 'Phóng cầu lửa phát nổ rực cháy', descEn: 'Launches explosive hellfire orbs' },
    C: { k: 'C', ico: '⚡', fam: 'lightning', w: 12, cd: 1.45, evo: { pass: 'p_cd', nameVi: 'Cửu Tiêu Thần Lôi', nameEn: 'Empyrean Thunder' }, nameVi: 'Thiên Lôi Giáng Thế', nameEn: 'Skyfall Lightning', descVi: 'Sét xanh lam giáng xuống quái gần nhất', descEn: 'Cool-blue lightning strikes nearby foes' },
    D: { k: 'D', ico: '🌀', fam: 'sword', w: 10, cd: 0.55, wp: 'kusanagi', nameVi: 'Kiếm Khí Hộ Thân', nameEn: 'Orbiting Blades', descVi: 'Phi kiếm xoay quanh xé nát quái áp sát', descEn: 'Spinning blades carve nearby monsters' },
    E: { k: 'E', ico: '❄️', fam: 'frost', w: 11, cd: 1.35, wp: 'scythe', evo: { pass: 'p_area', nameVi: 'Vĩnh Hằng Băng Ngục', nameEn: 'Eternal Permafrost' }, nameVi: 'Thương Băng Xuyên Thấu', nameEn: 'Frost Lance', descVi: 'Phóng thương băng làm chậm & đóng băng', descEn: 'Piercing ice spears chill & slow enemies' },
    F: { k: 'F', ico: '🪓', fam: 'axe', w: 10, cd: 1.65, wp: 'axe', nameVi: 'Phi Rìu Bão Tố', nameEn: 'Storm Tomahawk', descVi: 'Ném rìu cổ ngữ quay tròn xuyên nhiều mục tiêu', descEn: 'Spinning runic axes cleave crowds' },
    G: { k: 'G', ico: '🏹', fam: 'arrow', w: 11, cd: 1.05, wp: 'bow', nameVi: 'Mưa Tên Xuyên Giáp', nameEn: 'Piercing Volley', descVi: 'Bắn chùm tên tốc độ cao về phía mục tiêu', descEn: 'Rapid volley of piercing arrows' },
    H: { k: 'H', ico: '☄️', fam: 'fire', w: 8, cd: 3.1, nameVi: 'Thiên Thạch Hỏa Long', nameEn: 'Meteor Impact', descVi: 'Triệu hồi thiên thạch nổ tung diện rộng', descEn: 'Calls down devastating fire meteors' },
    I: { k: 'I', ico: '🌑', fam: 'void', w: 8, cd: 3.3, nameVi: 'Nhật Thực Thần Phạt', nameEn: 'Eclipse Nova', descVi: 'Vòng xoáy hư vô rút sinh lực quái', descEn: 'Void nova crushes surrounding foes' },
    J: { k: 'J', ico: '🔗', fam: 'lightning', w: 10, cd: 1.85, evo: { pass: 'p_might', nameVi: 'Lôi Đình Vĩnh Cửu', nameEn: 'Eternal Arc' }, nameVi: 'Lôi Xích Liên Hoàn', nameEn: 'Chain Lightning', descVi: 'Tia sét xanh truyền qua nhiều mục tiêu', descEn: 'Cool-blue lightning arcs across targets' },
    K: { k: 'K', ico: '☠️', fam: 'poison', w: 9, cd: 2.0, nameVi: 'Độc Vụ Ám Khí', nameEn: 'Plague Mist', descVi: 'Rải sương độc bào mòn quái vật theo giây', descEn: 'Toxic cloud melts foes over time' },
    L: { k: 'L', ico: '🔷', fam: 'lightning', w: 9, cd: 2.6, nameVi: 'Lôi Trận Bát Quái', nameEn: 'TempestSigil', descVi: 'Khai mở trận đồ sét xanh giật quanh khu vực', descEn: 'Electrifies ground zone with cyan bolts' },
    M: { k: 'M', ico: '🔨', fam: 'hammer', w: 9, cd: 2.35, wp: 'hammer', nameVi: 'Búa Chấn Địa', nameEn: 'Cosmic Smash', descVi: 'Búa thần giáng xuống đẩy lùi mọi quái vật', descEn: 'Slams ground and knocks back swarms' },
    N: { k: 'N', ico: '🗡️', fam: 'sword', w: 9, cd: 1.7, wp: 'masamune', nameVi: 'Kiếm Ảnh Phân Thân', nameEn: 'Phantom Slash', descVi: 'Phóng kiếm ảnh Masamune chém xuyên hàng', descEn: 'Phantom Masamune slashes pierce lines' },
    O: { k: 'O', ico: '🌨️', fam: 'frost', w: 8, cd: 2.95, nameVi: 'Bão Tuyết Cực Hàn', nameEn: 'Blizzard Ring', descVi: 'Vùng hàn khí liên tục làm chậm quái xung quanh', descEn: 'Freezing ring chills enemies in radius' },
    P: { k: 'P', ico: '🦅', fam: 'fire', w: 7, cd: 3.5, nameVi: 'Phượng Hoàng Lửa', nameEn: 'Phoenix Sweep', descVi: 'Sóng lửa hình nón quét sạch tiền tuyến', descEn: 'Sweeping fire wave torches frontline' },
    Q: { k: 'Q', ico: '🩸', fam: 'void', w: 9, cd: 1.95, wp: 'zulfiqar', nameVi: 'Huyết Trảm Hồi Sinh', nameEn: 'Crimson Leech', descVi: 'Zulfiqar hút 1 HP khi kết liễu quái', descEn: 'Zulfiqar steals HP on lethal strikes' },
    R: { k: 'R', ico: '🪨', fam: 'earth', w: 8, cd: 2.75, nameVi: 'Trụ Đá Địa Chấn', nameEn: 'Earthquake Pillars', descVi: 'Rung chuyển mặt đất hất tung kẻ thù', descEn: 'Seismic shockwaves erupt below monsters' },
    S: { k: 'S', ico: '✨', fam: 'holy', w: 9, cd: 2.15, nameVi: 'Thập Tự Thánh Quang', nameEn: 'Radiant Cross', descVi: 'Tia thánh quang chéo chữ thập xuyên thấu', descEn: 'Cruciform holy beams sear evil' },
    T: { k: 'T', ico: '🌪️', fam: 'wind', w: 8, cd: 2.55, nameVi: 'Pháo Đài Gió Xoáy', nameEn: 'Gale Cyclone', descVi: 'Cơn lốc cuốn & chém loạn quái vật', descEn: 'Spinning cyclone shreds nearby hordes' },
    U: { k: 'U', ico: '🐉', fam: 'lightning', w: 7, cd: 3.4, nameVi: 'Lôi Long Bạch Kim', nameEn: 'Azure Storm Dragon', descVi: 'Triệu hồi Lôi Long xanh trắng quét ngang đấu trường', descEn: 'Calls white-cyan storm lightning barrages' },
    V: { k: 'V', ico: '🌙', fam: 'void', w: 9, cd: 1.85, wp: 'scythe', nameVi: 'Lưỡi Hái Tử Thần', nameEn: 'Reaper Scythe', descVi: 'Xoay lưỡi hái băng tử thần tầm trung', descEn: 'Whirling reaper frost scythe strikes' },
    W: { k: 'W', ico: '👑', fam: 'divine', w: 7, cd: 3.0, wp: 'excalibur', nameVi: 'Thần Kiếm Excalibur', nameEn: 'Excalibur Descent', descVi: 'Kiếm thánh từ trời cắm xuống bùng nổ quang trảm', descEn: 'Excalibur drops from above in radiant blast' },
    X: { k: 'X', ico: '⛩️', fam: 'divine', w: 6, cd: 3.1, wp: 'kusanagi', nameVi: 'Kiếm Trận Kusanagi', nameEn: 'Kusanagi Sanctuary', descVi: 'Kusanagi xoay vần tạo kết giới kiếm khí', descEn: 'Kusanagi spawns spinning sword sanctuary' },
    Y: { k: 'Y', ico: '🐲', fam: 'divine', w: 6, cd: 3.2, wp: 'thuan-thien', nameVi: 'Thiên Mệnh Thuận Thiên', nameEn: 'Thuan Thien Decree', descVi: 'Thuận Thiên Kiếm giáng thiên uy trấn áp Boss', descEn: 'Royal blade strikes crushing boss armor' },
    Z: { k: 'Z', ico: '🌕', fam: 'divine', w: 6, cd: 3.3, wp: 'muramasa', nameVi: 'Ánh Trăng Muramasa', nameEn: 'Muramasa Eclipse', descVi: 'Yêu đao Muramasa bùng nổ sát thương chí mạng', descEn: 'Cursed Muramasa unleashes fatal crimson arcs' }
  };

  DS.PASSIVES = {
    p_might:  { ico: '💪', nameVi: 'Chiến Thần Cuồng Nộ', nameEn: 'Warrior Fury', descVi: '+18% toàn bộ sát thương', descEn: '+18% all damage' },
    p_area:   { ico: '💠', nameVi: 'Khế Ước Mở Rộng', nameEn: 'Arcane Reach', descVi: '+18% phạm vi chiêu thức', descEn: '+18% skill area' },
    p_cd:     { ico: '⏳', nameVi: 'Đồng Hồ Thời Không', nameEn: 'Chrono Relic', descVi: '-12% thời gian hồi chiêu', descEn: '-12% skill cooldown' },
    p_spd:    { ico: '🥾', nameVi: 'Giày Gió Thần', nameEn: 'Wind Stride', descVi: '+12% tốc độ di chuyển', descEn: '+12% move speed' },
    p_hp:     { ico: '💖', nameVi: 'Trái Tim Rồng Xanh', nameEn: 'Dragon Heart', descVi: '+35 Máu tối đa & hồi 2 HP/s', descEn: '+35 Max HP & +2 HP/s regen' },
    p_armor:  { ico: '🔰', nameVi: 'Khiên Cổ Thành', nameEn: 'Bastion Shield', descVi: '+2 Giáp giảm sát thương nhận', descEn: '+2 Armor damage reduction' },
    p_magnet: { ico: '🧲', nameVi: 'Nhẫn Thu Hồn', nameEn: 'Soul Magnet', descVi: '+30% bán kính hút ngọc XP', descEn: '+30% XP magnet radius' },
    p_greed:  { ico: '👑', nameVi: 'Vương Miện Tham Lam', nameEn: 'Crown of Greed', descVi: '+25% EXP & Vàng nhận được', descEn: '+25% EXP & Gold gained' }
  };

  DS.MONSTER_STATS = {
    slime:     { hp: 28,  spd: 2.35, dmg: 6,  xp: 5,  gold: 2,  scale: 1.15, boss: false },
    goblin:    { hp: 42,  spd: 3.15, dmg: 8,  xp: 7,  gold: 3,  scale: 1.35, boss: false },
    mushroom:  { hp: 58,  spd: 2.45, dmg: 10, xp: 9,  gold: 4,  scale: 1.35, boss: false },
    skeleton:  { hp: 72,  spd: 3.25, dmg: 11, xp: 11, gold: 5,  scale: 1.7,  boss: false },
    ghost:     { hp: 85,  spd: 3.65, dmg: 13, xp: 14, gold: 6,  scale: 1.7,  boss: false },
    zombie:    { hp: 115, spd: 2.3,  dmg: 15, xp: 15, gold: 6,  scale: 1.75, boss: false },
    troll:     { hp: 210, spd: 2.45, dmg: 20, xp: 24, gold: 10, scale: 2.35, boss: false },
    golem:     { hp: 280, spd: 2.15, dmg: 24, xp: 30, gold: 14, scale: 2.55, boss: false },
    souleater: { hp: 330, spd: 3.1,  dmg: 26, xp: 36, gold: 16, scale: 2.5,  boss: false },
    orcking:   { hp: 2200, spd: 2.8, dmg: 26, xp: 180, gold: 120, scale: 3.5, boss: true, nameVi: 'ĐẠI CHÚA TỂ ORC', nameEn: 'ORC WARLORD KING' },
    minotaur:  { hp: 4200, spd: 3.1, dmg: 34, xp: 260, gold: 180, scale: 3.9, boss: true, nameVi: 'NGƯU MA VƯƠNG CỔ THÀNH', nameEn: 'ANCIENT MINOTAUR' },
    titan:     { hp: 7600, spd: 2.95, dmg: 42, xp: 360, gold: 260, scale: 4.5, boss: true, nameVi: 'TITAN ĐỊA NGỤC', nameEn: 'DEMONIC TITAN' },
    dragon:    { hp: 14500, spd: 3.35, dmg: 52, xp: 800, gold: 600, scale: 5.4, boss: true, nameVi: 'THANH LONG HỦY DIỆT (BOSS CUỐI)', nameEn: 'AZURE DRAGON (FINAL BOSS)' }
  };

  DS.BOSS_SCHEDULE = [
    { time: 90,  type: 'orcking',  chapterIdx: 2 },
    { time: 180, type: 'minotaur', chapterIdx: 3 },
    { time: 270, type: 'titan',    chapterIdx: 4 },
    { time: 360, type: 'dragon',   chapterIdx: 5 }
  ];

  // Rich Dark-Fantasy Storyline: "Ấn Kiếm Địa Ngục — Bí Mật Cổ Thành Lạc Long"
  DS.STORY = {
    prologue: [
      {
        titleVi: 'I. Lời Nguyền Cổ Thành Lạc Long',
        titleEn: 'I. Curse of Lac Long Citadel',
        bodyVi: 'Ba trăm năm trước, sáu thanh Thần Kiếm bị phong ấn dưới lòng Cổ Thành Lạc Long để giam giữ Thanh Long Hắc Ám. Đêm nay, ấn chú nứt vỡ — sương mù địa ngục tràn ngập sân đá cổ.',
        bodyEn: 'Three centuries ago, six Divine Blades sealed the Dark Azure Dragon beneath Lac Long Citadel. Tonight, the seal fractured — hellfog pours over the ancient courtyard.'
      },
      {
        titleVi: 'II. Sức Mạnh Chủ Động Trong Tay Bạn',
        titleEn: 'II. Master Active Combat',
        bodyVi: 'Đừng chỉ chạy trốn! Vung combo 3 đòn (Chuột trái / J) để tích Nộ, lướt qua vòng vây với Bất Tử (Space / Shift), phá thùng tìm Cổ Thư, và kích hoạt Nộ 6 Thần Kiếm (E / Q) khi thanh Nộ đầy 100%!',
        bodyEn: 'Never just run! Chain 3-hit combos (Click / J) to build Fury, Dash with i-frames (Space / Shift), smash crates for Lore Scrolls, and unleash the 6-Blade Fury Ultimate (E / Q) at 100% Fury!'
      },
      {
        titleVi: 'III. Giải Mã 5 Cổ Thư Thất Truyền',
        titleEn: 'III. Uncover 5 Ancient Scrolls',
        bodyVi: 'Rải rác quanh 4 góc sân đá và trung tâm Cổ Thành là 5 cuộn Cổ Thư phát sáng tím. Thu thập chúng để hé lộ sự thật về Đại Chúa Tể Orc, Ngưu Ma Vương, Titan và Thanh Long.',
        bodyEn: 'Five glowing violet Lore Scrolls rest around the arena corners and altar. Collect them to reveal the truth behind the four Guardians and save the realm.'
      }
    ],
    chapters: [
      { time: 0, tagVi: 'CHƯƠNG I', tagEn: 'CHAPTER I', titleVi: 'CỔNG ĐỊA NGỤC MỞ RA', titleEn: 'HELLGATE UNSEALED', subVi: 'Bầy Slime & Goblin ngửi thấy mùi Ấn Kiếm đang ùa vào từ bốn bức tường thành!', subEn: 'Slimes & Goblins swarm the courtyard drawn by the fractured seal!' },
      { time: 45, tagVi: 'CHƯƠNG II', tagEn: 'CHAPTER II', titleVi: 'ĐỘI QUÂN XƯƠNG TRỖI DẬY', titleEn: 'RISEN LEGION', subVi: 'Hồn ma và Chiến binh Xương cổ đại đánh thức nghĩa địa Cổ Thành.', subEn: 'Restless Skeletons and Ghosts rise from the sunken tombs.' },
      { time: 90, tagVi: 'CHƯƠNG III — BOSS', tagEn: 'CHAPTER III — BOSS', titleVi: 'ĐẠI CHÚA TỂ ORC GIÁNG LÂM', titleEn: 'THE ORC WARLORD APPEARS', subVi: 'Kẻ gác cổng đầu tiên của Ấn Kiếm đã xuất hiện! Hãy giữ cự ly và tung Nộ!', subEn: 'The First Seal Warden enters the arena! Dash and unleash Fury!' },
      { time: 180, tagVi: 'CHƯƠNG IV — BOSS', tagEn: 'CHAPTER IV — BOSS', titleVi: 'CƠN THỊNH NỘ CỦA NGƯU MA VƯƠNG', titleEn: 'WRATH OF THE MINOTAUR', subVi: 'Mặt đất rung chuyển — Ngưu Ma Vương xé tan màn đêm bằng rìu chiến khổng lồ.', subEn: 'The Minotaur charges forth, shaking the ancient cobblestones.' },
      { time: 270, tagVi: 'CHƯƠNG V — BOSS', tagEn: 'CHAPTER V — BOSS', titleVi: 'TITAN ĐỊA NGỤC PHÁ XIỀNG', titleEn: 'DEMONIC TITAN UNCHAINED', subVi: 'Tên khổng lồ rực lửa hộ mệnh trước ngai vàng Thanh Long đã thức tỉnh!', subEn: 'The molten Titan guarding the Dragon Sanctum awakens!' },
      { time: 360, tagVi: 'CHƯƠNG VI — HỒI KẾT', tagEn: 'CHAPTER VI — FINALE', titleVi: 'THANH LONG HỦY DIỆT', titleEn: 'THE AZURE DRAGON DESCENDS', subVi: 'Chủ nhân thực sự của Cổ Thành Lạc Long! Hạ gục Thanh Long để tái phong ấn Ấn Kiếm!', subEn: 'Master of the Abyss descends! Slay the Azure Dragon to reforge the seal!' }
    ]
  };

  DS.SCROLL_DEFS = [
    {
      id: 'scroll_1', x: -24, z: -24,
      titleVi: 'Cổ Thư I: Thệ Ước Lục Kiếm',
      titleEn: 'Scroll I: Pact of Six Blades',
      bodyVi: 'Excalibur, Kusanagi, Thuận Thiên, Masamune, Zulfiqar và Muramasa từng được 6 đại cao thủ cắm xuống đây để khóa chặt Long Mạch.',
      bodyEn: 'Six legendary masters forged a sealing array using Excalibur, Kusanagi, Thuan Thien, Masamune, Zulfiqar, and Muramasa.'
    },
    {
      id: 'scroll_2', x: 24, z: -24,
      titleVi: 'Cổ Thư II: Phản Bội Của Orc Vương',
      titleEn: 'Scroll II: Betrayal of the Orc King',
      bodyVi: 'Vua Orc từng là kẻ bảo vệ cổng Bắc, nhưng bị hơi thở Hư Không tha hóa khi tìm kiếm bí thuật bất tử.',
      bodyEn: 'Once warden of the North Gate, the Orc King fell to void corruption seeking eternal dominion.'
    },
    {
      id: 'scroll_3', x: -24, z: 24,
      titleVi: 'Cổ Thư III: Bí Ẩn Ngọn Đuốc Xanh',
      titleEn: 'Scroll III: Flame of the Cold Torches',
      bodyVi: 'Ánh lửa xanh trên các cột đá Cổ Thành không đốt cháy sinh linh — nó hút Nộ Khí từ mỗi nhát chém để nuôi Thần Kiếm.',
      bodyEn: 'The citadel torches feed upon your Fury strikes, empowering the dormant Six Blades.'
    },
    {
      id: 'scroll_4', x: 24, z: 24,
      titleVi: 'Cổ Thư IV: Lời Sấm Thanh Long',
      titleEn: 'Scroll IV: Prophecy of Azure Lightning',
      bodyVi: 'Chỉ có tia sét xanh thuần khiết mới có thể xuyên thủng vảy Thanh Long — ngọn lửa trần tục sẽ bị nó nuốt chửng.',
      bodyEn: 'Only pure cool-blue lightning pierces the Azure Dragon’s scales cleanly.'
    },
    {
      id: 'scroll_5', x: 0, z: -30,
      titleVi: 'Cổ Thư V: Chìa Khóa Thuận Thiên',
      titleEn: 'Scroll V: Key of Thuan Thien',
      bodyVi: 'Khi 5 Cổ Thư hợp nhất, người gác ấn nhận +15% Sát Thương vĩnh viễn cho lần chiến đấu này. Phong ấn tối hậu đã sẵn sàng!',
      bodyEn: 'Uniting all 5 scrolls grants +15% Might for this run. Reforge the final seal!'
    }
  ];

  DS.I18N = {
    vi: {
      title: 'ẤN KIẾM ĐỊA NGỤC',
      sub: 'Dungeon Survivor 3D • Bí Mật Cổ Thành Lạc Long',
      start: '⚔ BẮT ĐẦU CHIẾN ĐẤU',
      shop: '🛒 Cường Hóa',
      codex: '📖 Đồ Giám (26 Chiêu)',
      storyBtn: '📜 Cốt Truyện',
      gold: 'Vàng Tích Lũy',
      best: 'Kỷ Lục Cao Nhất',
      scrolls: 'Cổ Thư Đã Giải',
      lbTop: 'Bảng Vàng',
      ctrl: '<b>WASD/Mũi tên</b> Di chuyển • <b>Chuột trái / J</b> Combo 3 đòn • <b>Space / Shift</b> Lướt né (Bất tử) • <b>E / Q / Chuột phải</b> Tuyệt Kỹ Nộ',
      pause: 'TẠM DỪNG',
      resume: 'Tiếp Tục',
      restart: 'Chơi Lại',
      menu: 'Về Sảnh',
      draftTitle: 'THĂNG CẤP — CHỌN SỨC MẠNH',
      victory: 'CHIẾN THẮNG! ẤN KIẾM ĐƯỢC TÁI LẬP',
      defeat: 'GỤC NGÃ TRONG CỔ THÀNH',
      saveScore: 'Lưu Điểm'
    },
    en: {
      title: 'HELLBLADE SEAL',
      sub: 'Dungeon Survivor 3D • Secret of Lac Long Citadel',
      start: '⚔ ENTER THE CITADEL',
      shop: '🛒 Upgrades',
      codex: '📖 Codex (26 Skills)',
      storyBtn: '📜 Story & Lore',
      gold: 'Vault Gold',
      best: 'Best Survival',
      scrolls: 'Ancient Scrolls',
      lbTop: 'Top Record',
      ctrl: '<b>WASD/Arrows</b> Move • <b>Click / J</b> 3-Hit Combo • <b>Space / Shift</b> Invuln Dash • <b>E / Q / Right-Click</b> 6-Blade Fury Ult',
      pause: 'PAUSED',
      resume: 'Resume',
      restart: 'Restart',
      menu: 'Main Menu',
      draftTitle: 'LEVEL UP — CHOOSE BLESSING',
      victory: 'VICTORY! THE SEAL IS RESTORED',
      defeat: 'FALLEN IN THE CITADEL',
      saveScore: 'Save Score'
    }
  };
})();
