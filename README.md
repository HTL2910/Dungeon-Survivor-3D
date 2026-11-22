# Dungeon Survivor 3D

WebGL / Three.js 3D action survivor (top-down ~55°) đóng gói trong một file `index.html` duy nhất kèm thư mục `assets/`.

## Tính năng chính

- **6 Hero có thể chơi & mở khóa bằng vàng:** `tiny-knight`, `azure-wizard`, `archer`, `samurai`, `viking-warrior`, `pirate-captain`.
- **26 Kỹ năng A–Z (Cấp 1–5) & Bộ Kiếm Thần Khí 3D:** Bao gồm các họ Lửa, Băng, Sét (fractal 3 lớp thuần `#ffffff` / `#66ccff` / `#3399ff`), Bí Thuật, Vật Lý và Thần Khí (`Excalibur`, `Kusanagi`, `Thuận Thiên`, `Masamune`, `Zulfiqar`, `Muramasa`).
- **Hệ thống VFX & Rendering:** Multi-pass post-processing Bloom (`UnrealBloomPass`-equivalent), GPU particle pools (`THREE.Points` custom shader), 10 `PointLight` động, 48 ground decals (cháy sém/dung nham, băng giá, vết nứt điện).
- **13 Quái vật & 5 Trùm Hầm Ngục (10:00 survival):** `orc-king` (2:00) → `minotaur-warrior` (4:00) → `flame-golem` lớn (6:00) → `demonic-titan` (8:00) → `azure-dragon` (9:30), kèm quái Elite (từ 6:00) và rương báu (`treasure-chest.glb`).
- **Song ngữ VI | EN, Shop Meta-Upgrade lưu `localStorage`, Joystick cảm ứng mobile (responsive 390px) & Adaptive Quality.**

## Cách chạy

Vì trình duyệt chặn `fetch()` tải các file `.glb` qua giao thức `file://`, hãy phục vụ thư mục qua HTTP server bất kỳ:

```bash
python3 -m http.server 8000
```

Sau đó mở trình duyệt truy cập `http://localhost:8000`.

## Cấu trúc thư mục

- `index.html` — Toàn bộ engine Three.js r160, `MeshoptDecoder 0.22`, `GLTFLoader`, post-processing Bloom, VFX, âm thanh WebAudio & UI.
- `PROMPT-Dungeon-Survivor-3D.md` — Đặc tả gốc của dự án.
- `assets/dungeon/` — 10 model môi trường đấu trường hầm ngục.
- `assets/characters/` — 6 model anh hùng.
- `assets/monsters/` — 13 model quái vật & boss.
- `assets/weapons/` — 12 model vũ khí & kiếm thần khí 3D.
- `assets/fonts/`, `assets/audio/`, `assets/textures/` — Font tiếng Việt (`BeVietnamPro`, `Oswald`), nhạc nền hầm ngục và texture PBR/hạt.
