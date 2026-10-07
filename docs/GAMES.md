# Spesifikasi Game

Setiap game mengikuti `docs/DESIGN.md`. Angka dalam soal **diacak per sesi** dalam rentang yang disebutkan, kecuali level yang sengaja dibuat tetap untuk mengenalkan konsep.
Bintang: 3 = berhasil pada uji pertama, 2 = 1–2 uji ulang, 1 = lebih dari itu. "Uji" adalah aksi komit (Lepas!, Lompat!, Tembak, Dayung!, Bagikan!), bukan setiap seretan.

---

## 1. Timbangan Pasar (`timbangan`), latar `pasar`

**Fantasi**: membantu Bu Ani menimbang dagangan dengan adil di pasar, lalu bermain jungkat-jungkit di lapangan.
**Loop inti**: balok timbangan **dikunci pasak**. Anak menyeret benda dari nampan ke piring kiri/kanan, lalu menekan **"Lepas!"** (atau mengetuk pasak). Pasak tercabut, balok miring sebanding selisih (pegas teredam, maksimal ±18°, 2–3 ayunan, diam dalam ±1.2 detik). Saat anak mengubah isi piring, pasak otomatis terpasang lagi (balok kembali datar perlahan). Jadi setiap pengujian adalah komitmen.
**Prediksi**: di level tertentu, sebelum Lepas! muncul 3 tombol besar (piring kiri turun / seimbang / piring kanan turun). Prediksi benar memberi kilau bonus. Prediksi salah tidak dihukum.
**Seimbang**: balok datar, hening 300ms, akor, waterpass muncul, konfeti kecil, lalu payoff.
**Concreteness fading**: L1–2 benda saja; L3–5 angka dan titik muncul di samping benda; L6–9 strip kalimat matematika di bawah timbangan (kiri | tanda | kanan, mencerminkan piring); L10–12 jungkat-jungkit dengan grid "tenaga putar" (baris berat × kolom jarak).

| Lv | Judul | Isi |
|---|---|---|
| 1 | Mana lebih berat? | 3 ronde: benda besar-ringan vs kecil-berat sudah di piring (kapas vs batu, balon vs gembok, bantal vs baut). Anak memprediksi, lalu Lepas!. Fisika: ukuran ≠ berat. |
| 2 | Sama banyak | Rambutan (unit berat sama) 4–6 di kiri, 1–3 di kanan. Tambah/kurangi sampai seimbang. Maksimal 10. |
| 3 | Tanda < = > | 3 ronde, kiri a, kanan b (5–10). Anak menyeret kartu tanda ke slot di tiang tengah lalu Lepas!. Sisi lebar tanda selalu menghadap piring yang lebih berat. Tanda yang tidak cocok dengan kemiringan "terguncang lepas". |
| 4 | Pasangan bilangan | Kiri karung tertutup bertanda n (6, lalu 10). Kanan 2 keranjang. Isi keranjang dengan rambutan agar seimbang. Cari 3 pasangan berbeda (rak koleksi terisi: 1+5, 2+4, 3+3 ...). |
| 5 | Penjumlahan | Kiri a + b rambutan (a,b 2–6). Pilih SATU anak timbangan dari 4 pilihan (jumlah, jumlah±1, jumlah+2). Strip: `a + b = ?`. |
| 6 | Bilangan hilang | Kiri anak timbangan n (10–15). Kanan karung tertutup m (5–8) + slot kosong. Isi slot dengan anak timbangan 1/2/5 (stok terbatas). Strip `n = m + ?`. Karung tidak bisa dibuka, memaksa menghitung lanjut. |
| 7 | Sama dengan itu hubungan | Kiri a + b, kanan c + slot. Contoh 3 + 5 = ? + 2. Ronde ke-2: kalimat tersaji (4 + 4 = 6 + 2), anak memprediksi seimbang atau tidak, lalu Lepas!. |
| 8 | Pengurangan | Kiri n rambutan (11–15), kanan anak timbangan m (6–9). Ambil rambutan dari kiri sampai seimbang. Strip `n − ? = m`. |
| 9 | Setengah | 2n kelereng (10–16) di nampan, 2 kantong kosong di kiri dan kanan. Bagi agar seimbang. Strip `2n = ? + ?`, lalu "setengah dari 2n adalah n". |
| 10 | Jungkat-jungkit: posisi | Jungkat-jungkit dengan pasak jarak 1, 2, 3 di setiap sisi. Dua anak yang sama berat. Ronde: anak kiri di jarak 3, kanan di jarak 1. Prediksi lalu Lepas!. Jungkat-jungkit langsung miring penuh pada selisih apa pun. Lalu anak memindahkan agar seimbang. |
| 11 | Kakak dan adik | Kakak (berat 2) di kanan jarak 1 (atau 2). Adik (berat 1) harus ditempatkan di jarak berapa? Grid tenaga putar menunjukkan 2×1 = 1×2. |
| 12 | Tenaga putar | Beban 2 dan 3, pasak 1–3. Seimbangkan 2 di jarak 3 dengan 3 di jarak 2. Ronde 2: dua beban di satu sisi. Strip `2 + 2 + 2 = 3 + 3`. |

**Fisika**: dacing: sudut = 18° × clamp((kanan − kiri) / max(kiri, kanan, 1) × 1.6, −1, 1), lalu pegas teredam (kekakuan ±120, redaman ±14). Jungkat-jungkit: Σ(berat×jarak); selisih ≠ 0 berarti miring penuh ±14° sampai menyentuh tanah. Selisih 0 berarti datar dengan goyang kecil. Massa level 1 diambil dari tabel nyata (kapas 0.05, batu 1.2, balon 0.01, gembok 0.4, bantal 0.3, baut 0.15 kg); ukuran gambar sengaja tidak sebanding.

---

## 2. Angkot Penuh! (`angkot`), latar `terminal`

**Fantasi**: kamu kenek di terminal. Angkot hanya berangkat kalau **tepat 10 penumpang**.
**Loop**: tempat duduk angkot tersusun **2 baris × 5** (ten-frame). Rombongan penumpang menunggu di halte sebagai kelompok (GS.art.person). Seret satu rombongan ke angkot, penumpang naik satu per satu (bunyi hitung naik). Tepat 10: kenek berteriak "Penuh! Berangkat!", klakson, asap knalpot, angkot melaju keluar layar, dan angkot baru datang. Lebih dari 10: penumpang kelebihan berdiri di atap dengan wajah cemberut, angkot menolak berangkat. Ketuk atap untuk menurunkan mereka kembali ke halte (dihitung sebagai uji ulang).
**Fading**: L1–3 orang saja (anak menghitung), L4–6 orang + label angka, L7 label angka saja (rombongan duduk di bangku halte dengan papan angka, orang tidak dihitung satu per satu).

| Lv | Isi |
|---|---|
| 1 | 1 angkot sudah berisi a (3–7). 3 rombongan pilihan. Tepat 1 yang melengkapi 10. |
| 2 | Sama, 2 angkot berturut-turut. |
| 3 | Angkot kosong. Rombongan 2–8. Isi 3 angkot (setiap angkot dari 2 rombongan). |
| 4 | Dengan label angka. 4 angkot. Pasangan 10 (1+9, 2+8, ...). |
| 5 | Tiga rombongan per angkot (2+3+5). |
| 6 | Campuran: pasangan 10 dan tiga rombongan. Rombongan pengganggu yang tidak cocok dengan apa pun pulang naik becak di akhir level. |
| 7 | Label angka saja. 4 angkot. |
| 8 | Puluhan & satuan: kerumunan besar n (21–49). Setiap ketuk "Isi angkot!" mengisi 1 angkot dengan 10 dari kerumunan. Papan terminal mencatat PULUHAN \| SATUAN. Sisa < 10 naik becak (satuan). Anak menyusun angka di papan dari kolom yang terisi. |
| 9 | Kebalikannya: pesanan "Kirim 37 penumpang ke pasar". Anak memilih jumlah angkot penuh dan becak berisi satuan. Penghitung di tujuan menghitung keras. |
| 10 | Tantangan: 5 angkot, rombongan bervariasi, tanpa label sampai akhir. |

---

## 3. Lompat Katak (`katak`), latar `sawah`

**Fantasi**: Katak Kodi ingin menemui temannya di pematang sawah. Garis bilangan = batu pijakan.
**Loop**: atur **ukuran lompatan** (daun teratai 1, 2, 5, 10) dan **jumlah lompatan** (tombol + / − besar, angka besar di tengah), arah maju/mundur. Lalu **"Lompat!"**. Katak melompat dalam busur parabola, satu lompatan per ketuk irama (bunyi hitung naik). Rencana dikunci sebelum lompat. Hasil: mendarat tepat (teman melompat gembira, keduanya pulang) atau meleset (katak tercebur kecil, kembali ke awal; selisih terlihat sebagai jejak busur dan label "kurang 2" / "lebih 3").
**Fading**: L1–4 semua batu bernomor; L5–8 hanya kelipatan 5 dan 10 yang bernomor; L9–10 garis bilangan kosong, hanya awal dan tujuan yang diberi angka. Setelah setiap lompatan, strip kalimat: `3 × 4 = 12` atau `8 + 5 = 13`.
**Hitung lompatan, bukan batu**: batu awal tidak dihitung.

| Lv | Isi |
|---|---|
| 1 | 0 → t (4–9), lompatan 1 saja. |
| 2 | Mundur: dari s (8–12) ke s − (3–6). |
| 3 | Lompatan 2: 0 → genap 8–16. |
| 4 | Lompatan 5: 0 → 15–30. Batu bukan kelipatan 5 berisi buaya kecil (harus dilompati). |
| 5 | Lompatan 10: 0 → 30–60 (garis bilangan bergulir/zoom). |
| 6 | Dua tahap: lompatan 10 lalu lompatan 1, 0 → 23–48. |
| 7 | Mulai dari tengah (menghitung lanjut): 8 → 13 dengan lompatan 1 (rencana +5). |
| 8 | Pengurangan: 15 → 6. |
| 9 | Garis bilangan kosong 38 → 63 (+10 +10 +5). |
| 10 | Tantangan: buaya di beberapa batu, pilih ukuran lompatan yang aman. |

---

## 4. Ketapel Mangga (`ketapel`), latar `kebun`

**Fantasi**: menjatuhkan mangga matang dan merobohkan kaleng di kebun Pak Tani.
**Loop**: tarik kantong ketapel ke belakang (seret dari mana saja di zona kiri). Panjang tarikan = kecepatan awal `v0 = tarikan × √(k/m)`. Sudut mengikuti arah tarikan (level awal sudut dikunci 45°). Lepas → proyektil terbang dengan fisika nyata (timestep tetap 1/120 detik, g = 9.8, 1 m = 100 unit). Tanah memiliki **patok bernomor 1–10 meter** (garis bilangan).
**Prediksi**: tembakan pertama setiap level: ketuk patok tempat batu akan jatuh. Hasil dibandingkan.
**Jejak**: 3 lintasan terakhir tetap terlihat samar untuk dibandingkan. Label "jatuh di patok 6".
**Proyektil**: kelereng (m kecil, cepat), batu (m 2× lebih besar → lebih lambat dari tarikan yang sama), bola kertas (hambatan udara `F = −c·v`, jatuh lebih pendek).

| Lv | Isi |
|---|---|
| 1 | Sudut 45° dikunci. Kaleng di patok 3. Titik pemandu lintasan ditampilkan. |
| 2 | Kaleng di patok 6. Pemandu ditampilkan. |
| 3 | Dua kaleng (patok 4 dan 8). Tarikan lebih jauh = lebih jauh. |
| 4 | Tanpa pemandu. Kaleng di patok acak 3–9. |
| 5 | Sudut dibuka (arah tarikan). Pohon penghalang rendah di depan. |
| 6 | Mangga di dahan pohon (sasaran di udara). |
| 7 | Batu vs kelereng: sasaran sama, proyektil diganti batu. |
| 8 | Bola kertas (hambatan udara). |
| 9 | Tiga sasaran berurutan. |
| 10 | Tantangan campuran. |

Bintang: jumlah tembakan (≤ jumlah sasaran = 3, +2 = 2, lebih = 1).

---

## 5. Rakit Terapung (`perahu`), latar `sungai`

**Fantasi**: menyeberangkan barang ke kampung seberang sungai.
**Bagian A (L1–4) Terapung atau tenggelam**: 4–6 benda di dermaga. Anak menyeret setiap benda ke keranjang prediksi **Terapung** (biru, ikon gelombang dengan benda di atas) atau **Tenggelam** (jingga, ikon panah ke bawah, pola garis). Lalu "Cemplung!": benda dijatuhkan ke akuarium bening satu per satu dan berperilaku jujur (mengapung dengan bagian terendam = ρ/1.0, atau tenggelam perlahan dan diam di dasar; pegas teredam). Benda wajib berpasangan menantang miskonsepsi: kayu besar (terapung) vs paku kecil (tenggelam), kelapa vs koin, apel vs kelereng, es (hampir seluruhnya terendam) vs sendok, gabus vs batu.
**Bagian B (L5–8) Muatan rakit**: rakit bambu berkapasitas K kg (8–15). Barang bertanda kg (2–7). Isi rakit sehingga totalnya tepat K (L5–6) atau sebanyak mungkin tanpa melebihi K (L7–8). Rakit turun makin dalam sesuai muatan (garis air). Lebih dari K: rakit tenggelam perlahan dan barang mengapung/tenggelam sesuai bahannya. Lalu "Dayung!" menyeberang.
**Bagian C (L9–10) Bentuk plastisin**: plastisin yang sama dibentuk bola / perahu kecil / mangkuk lebar. Prediksi mana yang membawa kelereng paling banyak. Muat kelereng satu per satu sampai tenggelam (bola langsung tenggelam). Hitung kapasitas.

---

## 6. Bagi Martabak (`martabak`), latar `warung`

**Fantasi**: kamu penjual martabak. Teman-teman ingin bagian yang adil.
**Loop**: seret garis lurus melintasi makanan untuk memotong (pisau). Potongan dihitung dengan memotong poligon cembung (lingkaran = poligon 64 sisi). Potongan memisah sedikit. Seret potongan ke piring setiap teman. "Bagikan!": luas dibandingkan (toleransi 6%). Adil: semua teman tersenyum dan makan. Tidak adil: teman dengan potongan lebih kecil cemberut, lalu potongan ditumpuk untuk membandingkan selisihnya secara visual. Tombol ulang mengembalikan makanan utuh.
**Fading**: label ½ ¼ ⅓ muncul di potongan mulai L5; L8–10 pesanan ditulis dalam simbol.

| Lv | Isi |
|---|---|
| 1 | Martabak bundar untuk 2 teman (setengah). |
| 2 | Kue lapis persegi panjang untuk 2. Potongan diagonal juga sah (penemuan). |
| 3 | Martabak bundar untuk 4 (seperempat). |
| 4 | Kue lapis untuk 4. Bentuk berbeda tetap seperempat. |
| 5 | Kue lapis untuk 3 (dua potongan sejajar, sepertiga). |
| 6 | "Ibu minta ¼": pilih potongan yang tepat seperempat dari potongan berbentuk berbeda. |
| 7 | "Aku lapar sekali. ½ atau ¼?" Beri potongan yang lebih besar (miskonsepsi ¼ > ½ karena 4 > 2). |
| 8 | Pesanan simbol: ½ untuk Siti, ¼ untuk Budi dan ¼ untuk Ani dari satu martabak. |
| 9 | Bandingkan ½, ⅓, ¼ dari kue yang sama besar: urutkan teman dari potongan terbesar. |
| 10 | Tantangan campuran. |
