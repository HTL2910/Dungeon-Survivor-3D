# PROMPT — DUNGEON SURVIVOR 3D
### (dán nguyên khối dưới đây cho AI builder)

---

Xây một game web hoàn chỉnh tên **DUNGEON SURVIVOR 3D** bằng Three.js, đóng gói trong 1 file `index.html` duy nhất (kèm thư mục `assets/` chứa model GLB), chạy được trên trình duyệt desktop và điện thoại. Thể loại: **action survivor top-down kiểu Soulstone Survivors / Vampire Survivors** — người chơi chỉ di chuyển, vũ khí/kỹ năng tự đánh, nhặt XP lên cấp chọn 1-trong-3 nâng cấp, sống sót trong đấu trường hầm ngục tới phút 10:00 thì thắng.

## 1. NGUỒN MODEL — CHỈ DÙNG THƯ VIỆN CÓ SẴN, KHÔNG TÌM NGUỒN NGOÀI

Toàn bộ model lấy từ thư viện `meshy-library/` (Meshy, đã kiểm chứng từ bên trong file: có texture nhúng thật, đếm tam giác và đọc clip animation trực tiếp từ GLB — không tin tag mô tả bên ngoài):

**Đấu trường (thư mục `dungeon/`):**
- `dungeon-wall-with-door.glb` — tường + cửa làm vòng tường bao arena
- `stepped-stone-wall.glb`, `ancient-stone-pillar.glb` — tường bậc, cột đá trang trí/vật cản
- `hell-torch.glb` — đuốc địa ngục gắn tường (nguồn sáng ấm chính của map)
- `cobblestone-pathway.glb` — lát đường đá giữa arena
- `old-stone-stairs.glb`, `rusty-rock-pile.glb` — bậc đá, đống đá
- `treasure-chest.glb` — rương báu (mở khi hạ boss, rơi vật phẩm), `wooden-barrel.glb`, `sturdy-wooden-crate.glb` — vật phá được rơi vàng/HP

**Người chơi (thư mục `characters/`):** hiệp sĩ chính `tiny-knight.glb`; mở khóa dần các hero khác: `azure-wizard.glb` (pháp sư), `archer.glb` (cung thủ), `samurai.glb`, `viking-warrior.glb`, `pirate-captain.glb` — mỗi hero có chỉ số và vũ khí khởi đầu riêng.

**Quái (thư mục `monsters/`) theo độ khó tăng dần theo thời gian:**
- Đầu game: `slime-glow.glb`, `goblin-grin.glb`, `mushroom-buddy.glb`
- Giữa game: `skeleton-warrior.glb`, `ghost.glb` (bay, xuyên vật cản), `zombie.glb`
- Cuối game: `warrior-troll.glb`, `flame-golem.glb`, `soul-eating-monster.glb`
- **Boss (mỗi 2 phút, tổng 5 boss):** `orc-king.glb` (2:00) → `minotaur-warrior.glb` (4:00) → `flame-golem.glb` cỡ lớn (6:00) → `demonic-titan.glb` (8:00) → `azure-dragon.glb` (9:30, boss cuối)

**Vũ khí hiển thị trên tay nhân vật (thư mục `weapons/`):** `fantasy-sword.glb`, `azure-crystal-staff.glb`, `rangers-bow.glb`, `frost-scythe-sword.glb`, `runic-battle-axe.glb`, `cosmic-hammer.glb`… gắn theo kỹ năng đang sở hữu.

Hiệu ứng hạt dùng kho `vfx-library/` (texture hạt, sprite sheet), nhạc/nền dùng `audio-library/` (có sẵn loop nhạc hầm ngục), font/UI dùng `ui-font-library/` (font hỗ trợ tiếng Việt).

**Kỹ thuật load model (bắt buộc):** loader GLTF phải đăng ký **MeshoptDecoder** (model trong thư viện nén meshopt — thiếu decoder là model không load, lỗi đã từng gặp). Quái không có clip chết thì animation chết làm bằng code (ngã + chìm + mờ dần). Trước khi dùng bất kỳ model nào phải mở file kiểm: số tam giác, có texture nhúng không, có clip animation thật không.

## 2. GAMEPLAY

- Camera top-down nghiêng ~55°, bám theo nhân vật, không pointer lock; kéo chuột xoay nhẹ + lăn chuột zoom (desktop), điện thoại dùng joystick ảo.
- Điều khiển: WASD / phím mũi tên / joystick ảo. Vũ khí tự ngắm mục tiêu gần nhất.
- Quái spawn theo sóng tăng dần theo đồng hồ: 0:00 slime/goblin → 1:30 skeleton → 3:00 ghost → 5:00 troll → 7:00 golem/soul-eater → elite (viền vàng, máu ×5, rơi nhiều XP) từ 6:00.
- XP gem rơi từ quái, nam châm hút khi lại gần; lên cấp **dừng game, hiện draft chọn 1-trong-3** (vũ khí mới / nâng cấp vũ khí / chỉ số / nội tại).
- **Kho kỹ năng theo chuẩn 26 hiệu ứng A–Z đã test** (vòng lửa, sét chuỗi, nova băng, thiên thạch, lốc xoáy, nổ lớn, cổng hư không, tan biến…): mỗi kỹ năng có cấp 1–5, có thể cộng dồn build nhiều kỹ năng cùng lúc.
- Boss có thanh máu riêng + tên boss; hạ boss rơi rương báu (chọn 1 trong 3 phần thưởng mạnh). Thắng ở 10:00, thua khi HP = 0; có màn hình kết thúc + chơi lại ngay.
- Vàng nhặt trong trận dùng nâng cấp vĩnh viễn ở menu chính (meta progression nhẹ: +máu, +sát thương, +tốc độ, mở hero mới).

## 3. CHUẨN VFX — PHẦN QUAN TRỌNG NHẤT, KHÔNG ĐƯỢC LÀM YẾU

Game này thắng thua ở hiệu ứng. Chuẩn đã chốt qua bản test 26 hiệu ứng (bản đầu bị chấm 4/10 vì "nhìn chưa đủ mạnh, chưa thật" — không lặp lại lỗi đó):

1. **Có bloom thật** (UnrealBloomPass, strength ~0.8, threshold 0.8) — hiệu ứng phải phát sáng và loé sáng ra xung quanh, không phải hình nét cứng phẳng.
2. **Hạt mềm có texture** (vẽ bằng canvas: lõi lửa, tia lửa, mảnh băng, khói noise) — cấm hạt tròn/khối trơn. Mật độ hạt gấp 2–3 lần mức tối thiểu, quy mô hiệu ứng lớn, khói và tàn lửa lưu lại sau khi hiệu ứng tắt.
3. **Đèn động**: mỗi hiệu ứng lớn có PointLight chớp theo màu hiệu ứng, hắt sáng lên sàn và quái xung quanh.
4. **Tương tác mặt đất**: hiệu ứng lửa/nổ để lại decal cháy + vết nứt phát sáng nguội dần 3–5 giây; khói bốc lên sau nổ.
5. **Kỷ luật màu họ SÉT (bắt buộc)**: sét = tia fractal gãy khúc (midpoint displacement) 3 lớp — lõi trắng chói, quầng xanh #66ccff / #3399ff, có tia nhánh; vết nứt điện trên đất màu xanh-trắng nhấp nháy. **Họ sét TUYỆT ĐỐI không có màu ấm** (không cam/vàng/đỏ — lỗi "sét nhìn toàn lửa" đã bị chê). Sét phải sắc và nhanh, rung màn hình nhẹ.
6. **Cảm giác va chạm**: số sát thương nổi, hit-stop 60–90ms ở hiệu ứng lớn, rung camera theo độ mạnh, quái chớp trắng khi trúng đòn, tia lửa/máu hạt khi trúng.
7. Âm thanh tổng hợp WebAudio cho từng họ hiệu ứng (sét nổ điện, lửa, băng vỡ…), có nút tắt tiếng.

## 4. GIAO DIỆN & NGÔN NGỮ

- **Song ngữ Việt / Anh** có nút đổi VI|EN ngay ở menu và trong pause, lưu lựa chọn.
- HUD mỏng ở 4 góc, **không che khu vực chơi trên điện thoại**; thanh HP/XP gọn; thanh boss ở cạnh trên.
- Menu chính: chọn hero, nâng cấp vĩnh viễn bằng vàng, nút Chơi, chọn độ khó (Thường / Khó / Địa Ngục).
- Kiểm tra layout 390px: không tràn ngang, nút bấm đủ to cho cảm ứng.

## 5. HIỆU NĂNG

- Object pool cho hạt, đạn, số sát thương, quái — không cấp phát mới trong vòng lặp.
- DPR khóa ≤1.5 (điện thoại) / ≤2 (desktop); tự giảm chất lượng khi FPS < 45 kéo dài, tăng lại khi > 57; dừng render khi tab ẩn.
- Nén model bằng gltfpack trước khi đóng gói; tổng dung lượng tải lần đầu phải gọn.

## 6. QUY TRÌNH LÀM VIỆC (bắt buộc)

- Tự build → tự test bằng trình duyệt headless: tải trang **0 lỗi console**, chụp screenshot menu + combat + từng họ hiệu ứng chính (lửa, băng, sét) + boss, kiểm bằng mắt rồi mới báo xong.
- Thấy lỗi thì **tự sửa trong vòng lặp tới khi sạch mới báo một lần** — không báo cáo lỗi thay cho việc sửa.
- Báo cáo cuối phải nói rõ: cái gì đã kiểm chứng bằng screenshot thật, cái gì chưa kiểm được (ví dụ chưa chạy hết trận boss cuối, chưa đo FPS trên GPU thật — không được bịa số FPS).
- **Không dùng model ngoài thư viện ở mục 1. Không để model nào trắng/thiếu texture trong bản giao** — nếu material mất texture thì ép về màu vật liệu tối và ghi rõ trong báo cáo.

---
*Ghi chú nguồn: concept Dungeon Survivor 3D + chuẩn 26 hiệu ứng A–Z đã test ngày 20/11/2026; thư viện model Meshy thu thập 21/11/2026 (86 model dùng được: dungeon 10, monsters 13, characters 9, weapons 14…).*
