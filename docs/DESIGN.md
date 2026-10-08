# Mat Sains: Design Bible

Koleksi game HTML5 untuk anak kelas 1–3 SD (6–9 tahun). Matematika dan fisika intuitif diajarkan **lewat mekanik game itu sendiri**.
Dokumen ini adalah sintesis dari empat brainstorming spesialis (didaktik matematika, pendidikan IPAS/fisika, game design, art direction) dan menjadi acuan wajib untuk semua builder.

## 1. Prinsip pedagogi (tidak bisa ditawar)

1. **Tanpa chocolate-covered broccoli.** Tidak pernah "jawab soal dulu, baru main". Aksi bermainnya sendiri yang menuntut penalaran. Feedback datang dari dunia game (timbangan miring, jembatan ambruk, perahu tenggelam), bukan dari tulisan "Salah!".
2. **Concreteness fading.** Level awal: objek konkret saja. Lalu gambar/titik dan angka muncul di samping objek. Lalu kalimat matematika (strip angka). Terakhir angka/simbol saja. Kalau anak gagal 2 kali di satu soal, objek konkret muncul lagi untuk soal itu saja.
3. **Prediksi → coba → amati.** Sebelum hasil terlihat, anak membuat prediksi dengan satu ketuk atau seret (misalnya "sisi mana yang turun?"). Prediksi benar memberi kilau bonus, prediksi salah tidak dihukum.
4. **Anti-tebak tanpa hukuman.** Ruang jawaban besar (anak membangun jumlah dengan menyeret, tidak memilih dari 3 opsi). Ada jeda pendek antara rencana dan hasil (animasi dunia). Kegagalan bersifat informatif (tunjukkan arah dan besar selisihnya). Tidak ada nyawa, tidak ada timer, tidak ada buzzer merah. Angka diacak setiap sesi.
5. **Bintang untuk efisiensi, bukan kecepatan.** 3 bintang = berhasil pada percobaan pertama, 2 = dengan 1–2 percobaan ulang, 1 = berhasil.
6. **Kebenaran fisika.** Lihat bagian 6. Simulasi tidak boleh "membantu" jawaban salah supaya berhasil.

## 2. Gaya visual: "Kampung Chunky"

- **Bentuk**: tebal, membulat, sedikit tidak simetris (elips di-squash 5–8%). Karakter chibi.
- **Outline**: satu warna `#3B2A20` (tidak pernah hitam murni). Tebal stroke ≈ 3% ukuran objek (2–6px), detail dalam 60% dari outline. Join dan cap selalu round. Latar jauh **tanpa outline**: hanya objek interaktif dan karakter yang punya outline.
- **Cahaya**: dari kiri atas. Setiap isian punya 3 tone: base, highlight (+15% terang, blob di kiri atas), shade (−15% dan sedikit lebih hangat, bulan sabit di kanan bawah). Titik spekular putih hanya untuk benda mengilap (logam, kulit buah, mata).
- **Kedalaman murah**: bayangan kontak elips `#3B2A20` opasitas 18% di bawah setiap benda yang menapak. Parallax 3 lapis; lapis jauh dicampur 40% ke warna langit.
- **Tekstur**: titik kawung atau garis diagonal opasitas 5–8%, hanya di latar, kain, dan anyaman. Tidak pernah di benda interaktif.
- **Gradient**: hanya satu, yaitu langit (2 stop). Tidak ada glassmorphism, tidak ada glow, tidak ada gradient ungu.

### Palet

| Peran | Hex |
|---|---|
| Langit atas / horizon | `#9ED8EC` / `#E6F5F0` |
| Bukit jauh | `#A9D3A0` |
| Sawah/rumput | `#7CC26B` |
| Tanah / jalan | `#E5BE86` / `#D4A062` |
| Pasir / laut | `#F3DDA6` / `#3FA7C4` |
| Merah cabai | `#E2453C` (shade `#B5322B`, hl `#F27A6E`) |
| Jingga | `#F28C28` (shade `#C76A12`, hl `#F8B26A`) |
| Kuning kunyit | `#FFC83D` (shade `#E09A00`, hl `#FFE08A`) |
| Hijau pandan | `#4DAA57` (shade `#357F40`, hl `#86CC8C`) |
| Biru laut | `#2F80C9` (shade `#215F98`, hl `#6FAEE3`) |
| Kayu | `#A8673A` (shade `#7E4A27`) |
| Jambu pink | `#F59AB0` |
| Batu | `#8C8F94` (shade `#63666B`) |
| Kuningan (timbangan) | `#D9A441` |
| UI primer | `#1F6FD1` (teks putih) |
| UI sekunder | `#F28C28` (teks `#2B1D14`) |
| Berhasil | `#0F8C7A` teal + ikon centang + bunyi |
| Coba lagi | `#F2A900` amber + goyang + ikon panah melengkung. **Tidak ada merah untuk "salah".** |
| Teks / panel | `#2B1D14` di atas `#FFF8EC` |
| Outline | `#3B2A20` |

**Aturan buta warna**: pasangan kunci adalah **biru vs jingga**, bukan merah vs hijau. Setiap perbedaan biner diberi isyarat kedua (pola titik vs garis, bentuk ikon, bunyi). Sisi kiri timbangan biru dengan titik, sisi kanan jingga dengan garis.

### Tipografi (Google Fonts)

- **Baloo 2** 800: judul dan label tombol.
- **Andika** 400/700: instruksi dan label (dibuat SIL untuk pembaca awal: a dan g satu tingkat, I/l/1 jelas berbeda).
- **Fredoka** 600: angka (digit lebar dan terbuka). Selalu `font-variant-numeric: tabular-nums`.
- Instruksi maksimal ±30 karakter per baris, kalimat biasa (bukan huruf kapital semua). **Setiap instruksi juga diucapkan** (`GS.say`).
- **Tidak boleh ada em dash (—) di teks yang tampil di layar.**

### Maskot: Si Cil, si kancil

Kancil dari dongeng Si Kancil yang cerdik. Kepala bentuk telur (lebih lebar di pipi), moncong krem `#F6E3C4` dengan hidung segitiga membulat, mata oval tinggi dengan 2 titik cahaya, telinga daun (luar cokelat, dalam `#F59AB0`). Badan bentuk pir `#C98B4E` (shade `#A06A36`, hl `#E0A86E`), perut krem, kaki ramping dengan kuku gelap seperti sarung tangan. Tanda khas: tiga chevron krem di leher. Aksesori: ikat kepala jingga dengan titik kawung dan dua ujung simpul yang berkibar.
Ekspresi: idle, happy, cheer, think, surprise, oops, point.

## 3. Gerak (motion)

- Easing masuk `cubic-bezier(0.33,1,0.68,1)`, pop/overshoot `cubic-bezier(0.34,1.56,0.64,1)`, loop idle `cubic-bezier(0.37,0,0.63,1)`.
- Tekan tombol: skala 0.92 dalam 80ms, kembali dengan overshoot 160ms. Feedback maksimal 600ms.
- **Ambil benda**: skala 1.15 dalam 120ms (outBack), bayangan membesar, benda digambar ±40px di atas jari supaya tidak tertutup jari.
- **Lepas benda**: snap 150ms, squash 1.2×0.85 lalu 0.92×1.08 lalu diam (±300ms). Benda berat squash sedikit (0.95) + guncangan layar 4px/150ms + debu. Benda ringan squash 0.9, memantul 2 kali, melayang turun pelan.
- Idle: kedip setiap 2.5–5 detik, napas naik-turun 3px/2.4 detik, benda ringan melayang ±4px/3 detik, benda berat diam.
- Salah: goyang ±6° tiga kali dalam 400ms, bunyi lembut (`GS.sfx.oops`), tanpa kilatan merah.
- Menang: hening 300ms (momen tegang), lalu akor naik, konfeti, Si Cil bersorak (`GS.celebrate`).
- `prefers-reduced-motion`: hilangkan guncangan dan parallax, pertahankan fade (`GS.reducedMotion`, `GS.tween` sudah memperpendek durasi).

## 4. Tata letak dan sentuhan

- Kanvas game: satu `<svg>` dengan `viewBox` tetap (disarankan `0 0 1280 800`, landscape) dan `preserveAspectRatio="xMidYMid meet"`, memenuhi area di bawah HUD. Jadi skalanya otomatis ikut tablet maupun HP.
- Target sentuh minimal 64 CSS px (tombol utama 88px), jarak antar-target 16px. Benda yang bisa diseret minimal 72px dengan area sentuh +16px.
- Tidak ada hover, ketuk dua kali, tekan lama, atau multi-touch yang wajib. Hanya satu sentuhan aktif sekaligus (`GS.drag` sudah menangani ini).
- HUD (dari `GS.hud`): rumah di kiri atas, judul + level di tengah, pilih level / ulangi suara / suara di kanan atas. Teks Si Cil (caption) di kiri bawah. Tombol aksi utama ("Cek!", "Lepas!", "Gas!") di kanan bawah, area jempol.
- Semua bisa dimainkan dengan keyboard minimal: tombol HTML asli, focus ring terlihat (`:focus-visible`).

## 5. Daftar game

| Id | Nama | Kata kerja | Konsep inti | Area peta |
|---|---|---|---|---|
| `timbangan` | **Timbangan Pasar** | seret, timbang | Kesamaan (=, <, >), number bond, penjumlahan/pengurangan sebagai keseimbangan, bilangan hilang, perkalian sebagai beban berulang; fisika: berat ≠ ukuran, pengungkit (berat × jarak) | Pasar |
| `angkot` | **Angkot Penuh!** | kelompokkan | Pasangan 10, number bond, puluhan & satuan | Terminal |
| `katak` | **Lompat Katak** | rencanakan, lompat | Garis bilangan, maju/mundur, lompat 2/5/10, perkalian sebagai lompatan berulang | Sawah |
| `ketapel` | **Ketapel Mangga** | bidik, luncurkan | Gaya tarik → kecepatan → jarak, gravitasi membuat lintasan melengkung, benda berat lebih lambat dari tarikan yang sama; garis bilangan patok | Kebun |
| `perahu` | **Rakit Terapung** | prediksi, muat | Terapung/tenggelam bergantung bahan (massa jenis), bukan berat; kapasitas rakit (menghitung, menjumlah) | Sungai |
| `martabak` | **Bagi Martabak** | potong, bagi | Bagian sama besar, setengah, seperempat, sepertiga; membandingkan pecahan satuan | Warung |

## 6. Aturan kebenaran fisika (untuk coder)

1. **Deterministik**: timestep tetap (1/120 detik, Euler semi-implisit), hasil tidak acak. Input sama = hasil sama. Efek visual saja yang boleh acak.
2. **Satu skala dunia**: g = 9.8 m/s², 1 m = 100 unit viewBox kecuali game menyatakan skala sendiri secara konsisten.
3. Tanpa hambatan udara, benda berat dan ringan jatuh sama cepat. Hambatan udara hanya untuk benda ringan dan lebar (bulu, kertas).
4. Benda bergerak berhenti hanya karena gesekan/tabrakan, tidak pernah karena timer.
5. Proyektil melengkung sejak awal (tidak lurus lalu jatuh). Dari tarikan yang sama, benda lebih berat meluncur lebih lambat (v0 = tarikan × √(k/m)).
6. Pantulan tidak pernah lebih tinggi dari ketinggian jatuh (restitusi < 1).
7. **Ukuran gambar tidak pernah menyandikan berat.** Setiap set benda menyertakan benda kecil-berat dan besar-ringan.
8. Pengungkit: seimbang tepat ketika Σ(berat × jarak) kiri = kanan. Timbangan dacing miring sebanding dengan selisih (maksimal ±18°). Jungkat-jungkit langsung miring penuh pada selisih sekecil apa pun.
9. Terapung jika massa jenis < 1.0 (air); bagian yang tenggelam = ρ/ρair. Rakit tenggelam jika total massa > kapasitas.
10. Jangan pernah menjentikkan balok yang hampir seimbang menjadi seimbang, atau membelokkan tembakan agar kena. Zona sasaran yang murah hati boleh, tetapi fisika yang diubah tidak boleh.

## 7. Arsitektur teknis

```
index.html              hub: Peta Kampung
assets.html             galeri aset visual
shared/core.css         token desain, HUD, tombol, overlay
shared/core.js          window.GS: store, sfx, say, tween, el, drag, confetti, hud, celebrate, levelPicker, runner
shared/art.js           window.GS.art: maskot, benda, makhluk, latar, landmark (SVG string)
games/<id>/index.html   halaman game
games/<id>/game.js      logika game
```

- Tanpa build step, tanpa library eksternal, tanpa jaringan (kecuali Google Fonts dengan fallback). Bisa dibuka dari `file://`.
- Template halaman game: lihat `games/_template/index.html`.
- Progres disimpan lewat `GS.store` (localStorage dengan fallback memori).
- Semua teks layar dan suara dalam Bahasa Indonesia yang sederhana dan hangat. Contoh: "Seret rambutan ke piring.", "Hmm, masih miring. Coba lagi ya!", "Seimbang! Hebat!".
