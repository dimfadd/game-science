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

---

# Gelombang 2 (2026-10-10): empat game baru

Dipilih untuk menutup elemen Kurikulum Merdeka yang belum tersentuh: **Pengukuran** (uang, waktu), **Geometri/aljabar** (perkalian sebagai larik, luas, keliling) dan **IPAS cahaya**. Aturan umum tetap berlaku (5 jenjang, tk = 6 level, lainnya 8; mekanik adalah pelajarannya; tanpa "Salah!").

## Kebun Bibit (`bibit`)

**Mekanik inti.** Lahan sawah/kebun berpetak (grid). Anak menanam bibit dalam **larik baris × kolom**: menyeret pojok lahan (pegangan besar) untuk memperbesar/memperkecil petak yang dicangkul, atau menyeret bibit dari keranjang ke lubang. Bibit di keranjang **harus habis tepat**: kalau lahan kebesaran, ada lubang kosong yang dimakan burung/ditumbuhi rumput; kalau kekecilan, bibit sisa layu di keranjang. Yang menilai adalah dunia (bibit tumbuh, panen), bukan tanda salah. Setelah ditanam, tanaman tumbuh dan dipanen baris demi baris sambil dihitung ("4, 8, 12"), sehingga penjumlahan berulang terlihat. Pagar bambu (keliling) dan petak (luas) memakai satuan petak yang sama.

| Jenjang | Level |
|---|---|
| tk | Tanpa wajib baca; bibit bertitik. 1–2 satu bibit untuk setiap lubang (korespondensi satu-satu, 3–5 lubang). 3 dua barisan sama panjang (tambah bibit sampai sama). 4 barisan mana yang lebih banyak, lalu tanam untuk membuktikan. 5 lahan 2 × 2 dan 2 × 3: isi semua lubang lalu hitung panen. 6 tantangan: isi lahan ≤ 10 lubang dengan bibit pas. |
| k1 | 1 isi satu baris 5 (five-frame). 2 dua baris isi 5 = 10. 3 dobel: 4 + 4, 6 + 6 (dua baris sama). 4 dobel tambah satu (7 = 3 + 3 + 1 lubang di pinggir). 5 pengurangan: ada 12 bibit, lahan 10 lubang, sisa berapa (tebak dulu). 6 genap atau ganjil: bisa ditanam berpasangan tanpa sisa? 7 lengkapi lahan isi 10/20 yang sudah tertanam sebagian. 8 tantangan. |
| k2 | 1 penjumlahan berulang: 3 baris isi 4, panen dihitung 4, 8, 12. 2 tarik pojok untuk lahan a × b (×2, ×5, ×10). 3 tukar baris dan kolom: 2 × 5 dan 5 × 2 panennya sama (putar lahan). 4 berapa bibit untuk lahan 4 baris isi 5 (tebak, lalu tanam). 5 pembagian sebagai pengurangan berulang: 15 bibit, baris isi 5, berapa baris? 6 dua susunan berbeda untuk 12 bibit. 7 dua lahan digabung (3 × 4 + 2 × 4). 8 tantangan. |
| k3 | 1 perkalian sampai 10 × 10 dengan tarik pojok (6 × 7). 2 pembagian: 24 bibit ke 4 baris sama. 3 semua susunan untuk 24 (faktor), tiap susunan yang ditemukan dicatat di papan. 4 distributif: lahan 7 × 6 dibelah tali jadi 5 × 6 + 2 × 6. 5 pembagian bersisa: 26 bibit, baris isi 4, sisa masuk polybag. 6 luas persegi panjang dalam petak. 7 keliling: pasang pagar bambu mengelilingi lahan (hitung batang pagar). 8 tantangan. |
| k4 | 1 perkalian dua angka dengan model luas: 12 × 13 = (10 + 2) × (10 + 3), lahan dibelah empat bagian. 2 keliling sama, luas berbeda: 20 batang pagar, lahan mana yang paling luas. 3 bilangan prima: 7 atau 13 bibit hanya bisa satu baris; temukan bilangan yang bisa dibuat persegi panjang. 4 kelipatan persekutuan: dua jenis bibit, baris isi 4 dan isi 6, berapa bibit paling sedikit supaya keduanya pas (12). 5 pembagian bersisa dan pembulatan ke atas (butuh berapa baris untuk 30 bibit isi 8). 6 luas bangun L (gabungan dua persegi panjang). 7 campuran. 8 tantangan. |

## Warung Kembalian (`kembalian`)

**Mekanik inti.** Anak menjaga warung kelontong. Pembeli datang membawa barang dan uang. Anak **menyeret uang rupiah sungguhan** (gambar koin dan uang kertas dengan nilai jelas, bukan foto uang asli) dari laci kas ke nampan: untuk membayar harga tepat, atau untuk memberi kembalian. Pembeli menghitung uang di nampan secara terlihat (uang ditumpuk dan dijumlah satu per satu dengan suara koin); kalau kurang, pembeli menunggu sambil menatap nampan; kalau lebih, pembeli mengembalikan kelebihannya dengan senyum ("Kebanyakan, Nak"). Barang hanya pindah tangan kalau pas. Bintang dari ketepatan pada percobaan pertama, ditambah bintang bonus "lembar paling sedikit" di level yang menyebutkannya. Pecahan yang dipakai: koin Rp100, Rp200, Rp500, Rp1.000; uang kertas Rp1.000, Rp2.000, Rp5.000, Rp10.000, Rp20.000, Rp50.000, Rp100.000. Harga ditulis gaya Indonesia (Rp3.500, titik ribuan).

| Jenjang | Level |
|---|---|
| tk | Hanya koin Rp1.000 bergambar titik; harga ditunjukkan dengan titik koin di label (tanpa wajib baca). 1–2 bayar permen dengan 1–3 koin (letakkan koin di setiap titik). 3 bayar sampai 5 koin. 4 mana yang lebih mahal: dua barang, bayar yang koinnya lebih banyak. 5 beli dua barang (2 + 1 koin). 6 tantangan ≤ 5. |
| k1 | Ribuan saja (Rp1.000, Rp2.000, Rp5.000, Rp10.000), harga Rp1.000–Rp20.000. 1 bayar tepat dengan lembar seribu. 2 bayar dengan dua ribuan dan seribuan. 3 bayar dengan lima ribuan. 4 kembalian dari Rp10.000 (pasangan 10: harga 7 ribu, kembali 3 ribu). 5 dua barang dijumlah. 6 kembalian dari Rp20.000. 7 lembar paling sedikit (Rp8.000 = 5 + 2 + 1). 8 tantangan. |
| k2 | Sampai Rp100.000. 1 bayar dengan puluhan ribu dan ribuan (Rp47.000). 2 kembalian dari Rp50.000 (menghitung lanjut). 3 kembalian dari Rp100.000. 4 lembar paling sedikit. 5 belanja tiga barang. 6 cukup atau tidak: pembeli punya Rp20.000, barang apa saja yang bisa dibeli (pilih barang lalu bayar). 7 membandingkan dua belanjaan (mana yang lebih mahal, selisihnya). 8 tantangan. |
| k3 | Ratusan dan ribuan (koin Rp100, Rp200, Rp500). 1 bayar Rp3.500 dengan koin dan lembar. 2 kembalian dari Rp5.000 (Rp2.300 → Rp2.700). 3 perkalian: 4 bungkus kerupuk @Rp1.500. 4 pembagian: patungan Rp12.000 untuk 3 anak. 5 belanja beberapa barang dengan kembalian dari Rp50.000. 6 lembar dan koin paling sedikit. 7 tukar uang: Rp10.000 jadi koin Rp500 (berapa keping). 8 tantangan. |
| k4 | Sampai Rp1.000.000. 1 bayar dan kembalian ratusan ribu. 2 pembulatan dan perkiraan: cukupkah Rp50.000 untuk 3 barang (perkirakan dulu, lalu hitung). 3 harga satuan: beli 3 lebih hemat atau beli satuan (perkalian dan perbandingan). 4 perkalian dua angka: 12 botol @Rp4.500. 5 anggaran: belanja sebanyak mungkin dengan Rp100.000 tanpa kurang. 6 pembagian bersisa: Rp25.000 untuk beli pensil @Rp3.000, berapa batang dan sisa berapa. 7 campuran. 8 tantangan. |

## Jam Kampung (`jam`)

**Mekanik inti.** Jam dinding besar di pos ronda. Anak **memutar jarum panjang** (seret di sekeliling jam). Jarum pendek ikut bergerak seperti roda gigi sungguhan (jam + menit/60), jadi tidak bisa diatur sendiri-sendiri. Saat jam diputar, **dunia ikut berjalan**: matahari terbit dari timur jam 6, tertinggi jam 12, terbenam jam 18 (Indonesia dekat khatulistiwa), langit berganti warna, bayangan tiang memendek dan memanjang mengikuti sudut matahari (panjang bayangan = tinggi tiang / tan(sudut matahari)), lampu rumah menyala di malam hari. Kegiatan kampung terjadi tepat pada waktunya (ayam berkokok, bus sekolah datang, warung buka, azan magrib, anak tidur). Tugas: atur jam supaya sesuatu terjadi tepat waktu, atau cocokkan jam dengan kejadian. Untuk durasi, busur berwarna menyapu jam selama jarum berputar. Jarum tidak dibulatkan sendiri ke jawaban: di jenjang rendah jarum menempel ke menit kelipatan 30/15/5 sesuai jenjang (dinyatakan), bukan ke jawaban yang benar.

| Jenjang | Level |
|---|---|
| tk | Tanpa wajib baca; memakai matahari dan kegiatan. 1 pagi atau malam: geser matahari/putar jam sampai ayam berkokok (pagi). 2 siang: matahari paling tinggi, bayangan paling pendek. 3 urutkan tiga kegiatan sehari (bangun, sekolah, tidur) di jalur matahari. 4 jam tepat besar dengan jarum pendek saja (angka bertitik, jam 1–6). 5 bayangan: kapan bayangan paling panjang (pagi/sore). 6 tantangan. |
| k1 | Menempel tiap 30 menit. 1 atur jam tepat (jam 7: bus sekolah). 2 jam berapa sekarang: putar jam kosong sampai sama dengan jam di menara. 3 setengah jam (jam setengah 8). 4 satu jam kemudian. 5 urutkan kegiatan dengan jamnya. 6 bayangan dan jam (jam 9 vs jam 12). 7 campuran jam tepat dan setengah. 8 tantangan. |
| k2 | Menempel tiap 5 menit. 1 seperempat jam (lewat seperempat, kurang seperempat). 2 menit kelipatan 5. 3 jam digital ↔ jam analog (07.25). 4 lama waktu dalam jam (berangkat 7, pulang 12, berapa jam). 5 lama waktu dalam menit (20 menit kemudian). 6 pagi atau malam: jam 7 pagi vs jam 7 malam (dunia membedakannya). 7 campuran. 8 tantangan. |
| k3 | Menempel tiap 1 menit. 1 menit tepat (08.47). 2 format 24 jam (19.30 = jam setengah 8 malam). 3 lama waktu menit melewati jam (08.40 → 09.15). 4 jadwal: angkot datang tiap 15 menit, kapan angkot berikutnya. 5 mundur waktu: film selesai 11.20, lamanya 45 menit, mulai jam berapa. 6 jam, menit, detik (1 menit = 60 detik dengan jarum detik). 7 campuran. 8 tantangan. |
| k4 | 1 lama waktu jam dan menit (06.45 → 10.10). 2 konversi: 2 jam 15 menit = 135 menit. 3 jadwal kereta: tiba, berangkat, lama perjalanan. 4 zona waktu Indonesia: WIB, WITA, WIT (jam di Jakarta, Makassar, Jayapura berputar bersama, selisih 1 jam). 5 kecepatan: angkot 1 km tiap 3 menit, berapa lama ke pasar 6 km. 6 bayangan sebagai jam matahari: baca jam dari panjang dan arah bayangan. 7 campuran. 8 tantangan. |

## Wayang Bayangan (`wayang`)

**Mekanik inti.** Panggung wayang: lampu blencong di kiri, kelir (layar putih) di kanan, penonton menonton bayangannya. Anak **menyeret wayang** di antara lampu dan kelir (maju-mundur dan naik-turun), memutarnya, atau memindahkan lampu. Bayangan dihitung jujur dengan **sinar lurus dari sumber titik**: tinggi bayangan = tinggi wayang × (jarak lampu ke kelir ÷ jarak lampu ke wayang); posisinya mengikuti garis lurus dari lampu melalui tepi wayang (sinar tipis boleh ditampilkan sebagai pemandu di jenjang rendah). Tugas: buat bayangan **pas dengan garis bentuk pesanan** di kelir (ukuran dan posisi, dengan toleransi sesuai jenjang). Bahan berbeda memberi bayangan berbeda: kulit/karton gelap pekat, kain tipis/kertas minyak samar, plastik bening hampir tidak berbayang. Lampu lebih besar memberi tepi bayangan kabur (penumbra) secara jujur.

| Jenjang | Level |
|---|---|
| tk | 1 bayangan muncul: taruh wayang di depan lampu (di antara lampu dan kelir). 2 dekatkan ke lampu: bayangan jadi besar (buat raksasa yang besar). 3 jauhkan dari lampu: bayangan kecil. 4 bentuk apa ini: pilih wayang yang bayangannya cocok (kucing, burung, pohon). 5 lampu pindah, bayangan pindah. 6 tantangan. |
| k1 | 1 pas tinggi: buat bayangan setinggi garis. 2 pas posisi (naik-turun). 3 ukuran dan posisi sekaligus. 4 tembus cahaya atau tidak: pilih bahan supaya bayangan pekat. 5 dua wayang, dua bayangan pas sekaligus. 6 putar wayang: bayangan miring. 7 campuran. 8 tantangan. |
| k2 | 1 bayangan dua kali tinggi wayang (tebak posisinya dulu, lalu lihat). 2 bayangan tiga kali. 3 tinggi lampu memindahkan bayangan (lampu tinggi, bayangan turun). 4 urutkan bahan: bening, tembus cahaya (samar), tidak tembus (pekat). 5 prediksi arah: wayang diangkat, bayangan naik atau turun? (cahaya lurus, bayangan tegak dan ikut naik). 6 dua lampu, dua bayangan. 7 campuran. 8 tantangan. |
| k3 | 1 cahaya merambat lurus: sinar lewat lubang di tiga karton berderet hanya kalau lubangnya segaris. 2 ukuran bayangan dengan angka: wayang 20 cm, jarak 1 m dari lampu, kelir 3 m, bayangan berapa. 3 tepi kabur: lampu besar vs lampu kecil (penumbra). 4 sortir bahan sungguhan (kaca, kertas minyak, kain tipis, kayu, daun) ke bening, tembus cahaya, tidak tembus, lalu buktikan di depan lampu. 5 bayangan dari dua lampu berwarna (wayang menutupi satu lampu). 6 jarak: di mana wayang supaya bayangan 50 cm. 7 campuran. 8 tantangan. |
| k4 | 1 perbandingan: tinggi bayangan ÷ tinggi wayang = jarak kelir ÷ jarak wayang (isi tabel dari percobaan). 2 pakai perbandingan untuk sasaran baru tanpa sinar pemandu. 3 pantulan cermin: putar cermin supaya cahaya mengenai wayang di balik tirai (sudut datang = sudut pantul). 4 dua cermin. 5 bayangan dua wayang bertumpuk (mana yang lebih dekat lampu). 6 mengukur tinggi pohon dengan bayangan (perbandingan bayangan tongkat). 7 campuran. 8 tantangan. |
