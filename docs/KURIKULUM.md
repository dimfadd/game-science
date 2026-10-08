# Kurikulum per kelas

Setiap game punya **5 jenjang**: `tk`, `k1`, `k2`, `k3`, `k4` (Kelas 4 ke atas). Isi, variasi mekanik, dan rentang angka berbeda per jenjang. Jenjang diambil dari kelas di profil anak dan bisa diganti kapan saja dari hub ("Ganti kelas"). Progres bintang disimpan **per game per jenjang** (`stars.<game>@<tier>`).

Acuan Kurikulum Merdeka: **Fase Fondasi** (TK), **Fase A** (kelas 1–2), **Fase B** (kelas 3–4).

| Jenjang | Bilangan | Operasi | Pecahan | Fisika intuitif |
|---|---|---|---|---|
| tk | 1–10 (banyak di 1–5), titik/benda, belum wajib angka | membandingkan banyak/sedikit, membilang | sama besar untuk 2 | berat/ringan, jauh/dekat, terapung/tenggelam |
| k1 | sampai 20 | + dan − sampai 20, pasangan 10 | ½, ¼ (bentuk) | berat ≠ ukuran, tarikan → jarak |
| k2 | sampai 100 | + − dua angka, lompat 2/5/10, × sebagai penjumlahan berulang | ½ ¼ ⅓, membandingkan | posisi pada jungkat-jungkit, sudut lempar, kapasitas |
| k3 | sampai 1.000 | × ÷ sampai 100, ratusan | pecahan biasa (2/4, 3/4), urutan pecahan satuan | berat × jarak, massa dan hambatan udara, bentuk lambung |
| k4 | sampai 10.000 | × ÷ bersisa, kelipatan, pembulatan | pecahan senilai, + − penyebut sama, pecahan dari kumpulan | pengungkit banyak beban, jangkauan ∝ kuadrat tarikan, massa jenis air asin |

Jumlah level: **tk = 6**, **k1 = k2 = k3 = k4 = 8**. Hub membaca jumlah ini dari `shared/curriculum.js`; game wajib membuat jumlah level yang sama persis.

Prinsip tetap berlaku di semua jenjang (lihat `DESIGN.md`): mekanik adalah pelajarannya, concreteness fading, prediksi sebelum hasil, tanpa nyawa dan timer. Jenjang TK: **tanpa teks wajib dibaca**, angka boleh muncul tapi selalu bersama titik/benda, sesi lebih pendek, target sentuh lebih besar, toleransi lebih longgar.

---

## Timbangan Pasar (`timbangan`)

| Jenjang | Level |
|---|---|
| tk | 1–2 berat/ringan: prediksi sisi yang turun (kapas vs batu, balon vs gembok). 3–4 sama banyak: buat seimbang dengan rambutan, total ≤ 5. 5 lebih banyak/lebih sedikit: pilih piring yang isinya lebih banyak (≤ 6), lalu Lepas! untuk cek. 6 jungkat-jungkit: kakak vs adik, prediksi sisi yang turun. |
| k1 | 1 berat ≠ ukuran (3 ronde). 2 sama banyak ≤ 10. 3 tanda < = > (≤ 20). 4 pasangan bilangan 10. 5 penjumlahan ≤ 20 (pilih satu anak timbangan). 6 bilangan hilang ≤ 20. 7 pengurangan ≤ 20. 8 kesamaan a + b = c + ?. |
| k2 | Anak timbangan 10 dan 1. 1 menyusun bilangan dua angka (puluhan + satuan) sampai 99. 2 bilangan hilang sampai 100 (47 + ? = 80). 3 pengurangan dua angka. 4 setengah (bilangan genap ≤ 40). 5 penjumlahan berulang: 3 kantong isi 5 = ? (×2, ×5, ×10). 6 kesamaan empat suku (20 + 15 = 30 + ?). 7 jungkat-jungkit: posisi menentukan (jarak 1–3). 8 campuran. |
| k3 | 1 perkalian kelompok sama (4 kantong isi 6). 2 pembagian: bagi n benda ke k kantong sama berat. 3 faktor hilang 4 × ? = 20. 4 pecahan berat: ½ dan ¼ dari 20 kg. 5 jungkat-jungkit kakak-adik (berat × jarak). 6 tenaga putar 2 × 3 = 3 × 2. 7 bilangan ratusan (anak timbangan 100, 10, 1). 8 campuran. |
| k4 | 1 dua kotak misteri sama: ? + ? + 3 = 11. 2 kg dan gram: 1 kg = 1.000 g (anak timbangan 500, 200, 100 g). 3 pertidaksamaan: pilih semua beban yang membuat kiri lebih berat. 4 jungkat-jungkit banyak beban (jarak 1–4). 5 pengungkit: geser satu beban agar seimbang. 6 perkalian dua angka (12 × 4) dengan anak timbangan. 7 ribuan. 8 tantangan. |

## Angkot Penuh! (`angkot`)

| Jenjang | Level |
|---|---|
| tk | Angkot kecil **5 kursi** (five-frame). 1–2 hitung penumpang naik satu per satu sampai penuh. 3–4 rombongan 1–4, lengkapi 5. 5 dua angkot berturut-turut. 6 rombongan tanpa angka, hanya orang. |
| k1 | Angkot 10 kursi (ten-frame). 1 lengkapi 10 (dari isi 3–7). 2 dua angkot. 3 angkot kosong, dua rombongan. 4 pasangan 10 dengan angka. 5 tiga rombongan (2 + 3 + 5). 6 campuran + rombongan pengganggu. 7 angka saja. 8 tantangan 5 angkot. |
| k2 | 1–2 puluhan & satuan: kerumunan 21–99, isi angkot (puluhan), sisa naik becak (satuan), susun angka di papan. 3–4 kirim n penumpang (angkot + becak). 5 penjumlahan dua angka: 23 + 15 penumpang digabung. 6 pengurangan: 47 penumpang, 20 turun di pasar. 7 bandingkan dua terminal (< = >). 8 tantangan. |
| k3 | **Bus besar 100 penumpang** (10 angkot). 1–2 ratusan, puluhan, satuan sampai 999. 3 kirim 345 penumpang (bus, angkot, becak). 4 perkalian: n angkot × 10, lalu angkot berkapasitas 6/7/8. 5 pembagian: bagi 24 penumpang sama rata ke 4 angkot. 6 pembagian bersisa sederhana (sisa naik becak). 7 penjumlahan tiga angka. 8 tantangan. |
| k4 | 1 kereta: gerbong isi 100, ribuan sampai 9.999. 2 pembulatan: 47 penumpang butuh berapa angkot isi 10? (pembulatan ke atas). 3 pembagian bersisa dengan kapasitas 6–9. 4 kelipatan: angkot isi 6 dan isi 8 sama-sama penuh di 24. 5 perkalian dua angka (12 angkot × 8). 6 estimasi. 7 campuran. 8 tantangan. |

## Lompat Katak (`katak`)

| Jenjang | Level |
|---|---|
| tk | Batu bertitik (1–10), angka kecil di bawah titik. 1–2 lompat 1 sampai 5. 3 lompat 1 sampai 10. 4 mundur ke rumah (dari 5 ke 0). 5 lompat 2 di batu bertitik. 6 tantangan sampai 10. |
| k1 | Garis 0–20. 1 maju 1. 2 mundur 1. 3 lompat 2. 4 mulai dari tengah (menghitung lanjut 8 → 13). 5 pengurangan 15 → 6. 6 lompat 5 dengan buaya. 7 dua tahap (5 lalu 1). 8 tantangan. |
| k2 | Garis 0–100. 1 lompat 10. 2 lompat 5. 3 dua tahap 10 lalu 1 (0 → 47). 4 menghitung lanjut dengan puluhan (38 → 63). 5 mundur dua angka (72 → 35). 6 garis bilangan kosong. 7 buaya di batu bukan kelipatan. 8 tantangan. |
| k3 | 1 perkalian sebagai lompatan berulang (×2 sampai ×10). 2 pembagian: berapa lompat isi 4 sampai 28. 3 lompat 100 di garis 0–1.000. 4 dua tahap ratusan + puluhan (0 → 340). 5 garis bilangan kosong ratusan. 6 faktor: lompatan berapa yang tepat sampai 24 (tanpa buaya). 7 campuran × dan ÷. 8 tantangan. |
| k4 | 1 kelipatan persekutuan: dua katak lompat 3 dan 4, kapan bertemu (12). 2 pecahan di garis bilangan: lompat ½ dari 0 ke 3. 3 lompat ¼. 4 garis 0–10.000, lompat 1.000. 5 pembagian bersisa (sisa jadi lompatan kecil). 6 pecahan campuran (2½). 7 campuran. 8 tantangan. |

## Ketapel Mangga (`ketapel`)

| Jenjang | Level |
|---|---|
| tk | Patok 1–5 bertitik, sudut dikunci 45°, pemandu lintasan. 1 tarik sedikit, kaleng dekat. 2 tarik jauh, kaleng jauh. 3 dekat atau jauh: dua kaleng. 4 tanpa pemandu. 5 mangga rendah di pohon. 6 tantangan. |
| k1 | Patok 1–10, sudut dikunci. 1 patok 3 + pemandu. 2 patok 6 + pemandu. 3 dua kaleng (4 dan 8). 4 tanpa pemandu. 5 bandingkan: tebakan vs hasil (selisih patok). 6 tiga kaleng berurutan. 7 sasaran acak. 8 tantangan. |
| k2 | Sudut dibuka. 1 semak penghalang (perlu sudut). 2 mangga di dahan. 3 dua mangga. 4 patok setengah meter (2,5 m). 5 sasaran di balik pohon (lintasan tinggi). 6 jarak 1–15 m. 7 campuran. 8 tantangan. |
| k3 | 1 batu vs kelereng (massa). 2 bola kertas (hambatan udara). 3 pilih proyektil yang tepat. 4 tiga sasaran berbeda proyektil. 5 prediksi patok untuk proyektil lebih berat. 6 jarak dalam meter dan setengah meter. 7 campuran. 8 tantangan. |
| k4 | 1 sudut terbaik: cari sudut yang paling jauh (45°). 2 tabel tembakan: tarikan 1, 2 → jarak; temukan pola (tarikan 2× → jarak ≈ 4×). 3 gunakan pola untuk sasaran baru. 4 sudut rendah vs tinggi ke sasaran yang sama. 5 sasaran tinggi dan jauh sekaligus: atur sudut dan tarikan bersamaan (tanpa angin, fisika tetap jujur). 6 hambatan udara + sudut. 7 campuran. 8 tantangan. |

## Rakit Terapung (`perahu`)

| Jenjang | Level |
|---|---|
| tk | 1–3 terapung/tenggelam, 3–4 benda per level, prediksi ke keranjang. 4 benda besar-ringan vs kecil-berat. 5 rakit: muat buah sampai penuh (hitung ≤ 5). 6 tantangan sortir. |
| k1 | 1–4 sortir dengan pasangan miskonsepsi (kayu vs paku, kelapa vs koin, apel vs kelereng, es vs sendok). 5–6 muatan rakit tepat K (≤ 10 kg). 7 muatan sebanyak mungkin ≤ K. 8 tantangan. |
| k2 | 1–2 sortir campuran 6 benda. 3–5 muatan rakit tepat K (≤ 30 kg, barang 2–12 kg). 6–7 sebanyak mungkin ≤ K (jumlah tersembunyi). 8 tantangan. |
| k3 | 1–2 muatan dengan perkalian (n peti × 4 kg ≤ K). 3 dua rakit, bagi muatan sama berat. 4–6 bentuk plastisin (bola, perahu, mangkuk), hitung kapasitas kelereng. 7 tebak bentuk yang membawa paling banyak. 8 tantangan. |
| k4 | 1 air tawar vs air asin: telur tenggelam di air tawar, terapung di air asin. 2 massa jenis: urutkan benda dari yang paling dalam tenggelamnya. 3 kapasitas dengan perkalian dua angka. 4–5 rancang lambung: pilih ukuran mangkuk untuk membawa T kelereng. 6 rakit bertingkat muatan. 7 campuran. 8 tantangan. |

## Bagi Martabak (`martabak`)

| Jenjang | Level |
|---|---|
| tk | 1–2 bagi untuk 2 teman sama besar (potong sekali, toleransi lebih longgar). 3 bagi kue lapis untuk 2. 4 pilih potongan yang sama besar dengan milik temannya. 5 bagi klepon: 4 klepon untuk 2 teman (satu-satu). 6 tantangan. |
| k1 | 1 setengah martabak. 2 setengah kue lapis (diagonal sah). 3 seperempat martabak. 4 seperempat kue lapis. 5 pilih ¼. 6 ½ atau ¼ untuk teman yang lapar. 7 pesanan simbol ½. 8 tantangan. |
| k2 | 1 sepertiga kue lapis. 2 bandingkan ½ ⅓ ¼. 3 pesanan ½ + ¼ + ¼. 4 seperenam. 5 urutkan potongan. 6 pecahan dari kumpulan: ½ dari 8 klepon. 7 campuran. 8 tantangan. |
| k3 | 1 pecahan bukan satuan: 3/4 untuk satu teman. 2 2/4 sama dengan ½? (tumpuk). 3 urutkan pecahan satuan. 4 bagi sama rata untuk 3 dan 6. 5 ¼ dari 12 klepon. 6 bandingkan 2/3 dan 3/4. 7 campuran. 8 tantangan. |
| k4 | 1 pecahan senilai ½ = 2/4 = 4/8. 2 penjumlahan penyebut sama: ¼ + ¼ = ½. 3 pengurangan: ¾ − ¼. 4 pecahan dari kumpulan (⅔ dari 12). 5 pecahan campuran: 1½ martabak untuk 3 teman? (½ masing-masing). 6 bandingkan pecahan berbeda penyebut. 7 campuran. 8 tantangan. |
