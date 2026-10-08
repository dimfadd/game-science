# Narasi Mat Sains: daftar kalimat dan panduan rekaman

Suara bawaan perangkat (text-to-speech) tidak punya suara anak, dan selalu terdengar seperti mesin. Untuk suara anak yang natural, kalimat-kalimat di bawah perlu **direkam oleh anak sungguhan**. Setiap kalimat yang sudah direkam otomatis dipakai, dan yang belum tetap memakai suara perangkat.

## Siapa dan izin

- Pengisi suara anak usia 7–10 tahun yang lancar membaca dan berbicara Bahasa Indonesia dengan jelas.
- **Wajib ada izin tertulis orang tua/wali**, termasuk izin memakai suara di aplikasi yang nanti dikomersialkan.

## Cara merekam

1. Ruangan sepi dan tidak bergema (kamar dengan kasur dan gorden lebih baik daripada kamar mandi atau ruang kosong).
2. HP biasa sudah cukup. Jarak mulut ke mikrofon sekitar 20–30 cm, posisi sama sepanjang rekaman.
3. Nada ceria, tidak terburu-buru, seperti berbicara ke adik.
4. Satu kalimat per file. Beri jeda setengah detik di awal dan akhir, lalu potong hening yang berlebih.
5. Format: **.m4a (AAC) atau .mp3**, mono, 44,1 kHz. Hindari .ogg karena tidak diputar di iPhone.
6. Samakan volume semua file (normalisasi sekitar −16 LUFS, misalnya dengan Audacity: Efek → Normalisasi Kenyaringan).

## Cara memasang rekaman

1. Simpan file di `audio/voice/` dengan nama sesuai kolom **File** di bawah.
2. Tambahkan baris ke `audio/voice/manifest.json` di bagian `lines`. Kuncinya adalah kalimat dalam huruf kecil tanpa tanda baca, dengan simbol matematika ditulis sebagai kata:

```json
{ "lines": { "seret rambutan ke piring": "timbangan-001.m4a" } }
```

Di browser, `MS.voice.keyOf("Seret rambutan ke piring.")` menghasilkan kunci yang tepat, dan `MS.voice.missing()` menampilkan kalimat yang sudah terdengar di perangkat itu tetapi belum ada rekamannya.

## Memperbarui daftar ini

Jalankan `node tests/collect-lines.js`. Skrip memainkan semua level dan menulis ulang daftar di antara penanda di bawah.

## Daftar kalimat

<!-- LINES:START -->

### timbangan

| No | File | Kalimat |
|---|---|---|
| 1 | `timbangan-001.m4a` | Mana yang lebih berat? Tebak dulu! |
| 2 | `timbangan-002.m4a` | Sekarang tekan Lepas! |
| 3 | `timbangan-003.m4a` | Tebakanmu benar! Batu lebih berat, padahal kecil. |
| 4 | `timbangan-004.m4a` | Sekarang balon dan gembok. Tebak dulu! |
| 5 | `timbangan-005.m4a` | Tebakanmu benar! Gembok lebih berat, padahal kecil. |
| 6 | `timbangan-006.m4a` | Sekarang bantal dan baut. Tebak dulu! |
| 7 | `timbangan-007.m4a` | Tebakanmu benar! Bantal lebih berat. |
| 8 | `timbangan-008.m4a` | Kecil belum tentu ringan! |
| 9 | `timbangan-009.m4a` | Buat timbangan seimbang, ya! |
| 10 | `timbangan-010.m4a` | Seimbang! Sama banyak. |
| 11 | `timbangan-011.m4a` | Taruh tanda yang cocok, lalu Lepas! |
| 12 | `timbangan-012.m4a` | Tanda mana yang cocok? |
| 13 | `timbangan-013.m4a` | Hebat! Kamu paham tanda < = > |
| 14 | `timbangan-014.m4a` | Isi dua keranjang sampai seimbang. |
| 15 | `timbangan-015.m4a` | Cari pasangan lain! |
| 16 | `timbangan-016.m4a` | Pilih satu anak timbangan yang pas. |
| 17 | `timbangan-017.m4a` | Hebat! Kamu bisa menjumlah. |
| 18 | `timbangan-018.m4a` | Karung tidak bisa dibuka. Tambah anak timbangan sampai seimbang. |
| 19 | `timbangan-019.m4a` | Hebat! Kamu menemukan bilangan hilang. |
| 20 | `timbangan-020.m4a` | Sama dengan artinya sama berat. Isi yang kosong! |
| 21 | `timbangan-021.m4a` | Seimbang atau tidak? Tebak dulu! |
| 22 | `timbangan-022.m4a` | Sama dengan artinya sama berat! |
| 23 | `timbangan-023.m4a` | Ambil rambutan dari kiri sampai seimbang. |
| 24 | `timbangan-024.m4a` | Hebat! Kamu bisa mengurangi. |
| 25 | `timbangan-025.m4a` | Sama berat. Sisi mana yang turun? |
| 26 | `timbangan-026.m4a` | Benar! Kiri turun. Jaraknya lebih jauh. |
| 27 | `timbangan-027.m4a` | Pindahkan anak supaya seimbang. |
| 28 | `timbangan-028.m4a` | Seimbang! Jaraknya sama. |
| 29 | `timbangan-029.m4a` | Jarak juga penting! |
| 30 | `timbangan-030.m4a` | Kakak lebih berat. Di mana adik duduk? |
| 31 | `timbangan-031.m4a` | Sekarang adik di sini. Di mana kakak duduk? |
| 32 | `timbangan-032.m4a` | Seimbang! Kakak dekat, adik jauh. |
| 33 | `timbangan-033.m4a` | Berat kali jarak sama, jadi seimbang! |
| 34 | `timbangan-034.m4a` | Taruh beban di pasak yang pas. |
| 35 | `timbangan-035.m4a` | Seimbang! Tenaga putarnya sama. |

### angkot

| No | File | Kalimat |
|---|---|---|
| 36 | `angkot-036.m4a` | Angkot belum penuh. Pilih rombongan yang pas! |
| 37 | `angkot-037.m4a` | Penuh! Berangkat! |
| 38 | `angkot-038.m4a` | Hebat! Semua angkot penuh. |
| 39 | `angkot-039.m4a` | Dua angkot menunggu. Isi sampai tepat sepuluh! |
| 40 | `angkot-040.m4a` | Rombongan baru datang! |
| 41 | `angkot-041.m4a` | Angkot kosong. Gabungkan dua rombongan jadi sepuluh! |
| 42 | `angkot-042.m4a` | Masih ada kursi kosong. Tambah lagi! |
| 43 | `angkot-043.m4a` | Angkot berikutnya datang! |
| 44 | `angkot-044.m4a` | Ayo, angkot baru! |
| 45 | `angkot-045.m4a` | Belum penuh. Siapa lagi yang naik? |
| 46 | `angkot-046.m4a` | Lihat angkanya. Pasangkan jadi sepuluh! |
| 47 | `angkot-047.m4a` | Tiga rombongan untuk satu angkot. Ayo isi! |
| 48 | `angkot-048.m4a` | Isi tepat sepuluh. Ada rombongan yang tidak cocok, lho! |
| 49 | `angkot-049.m4a` | Rombongan ini pulang naik becak saja. |
| 50 | `angkot-050.m4a` | Sekarang hanya angka. Isi tepat sepuluh! |
| 51 | `angkot-051.m4a` | Ketuk Isi angkot! Sisanya naik becak. |
| 52 | `angkot-052.m4a` | Ayo, angkot berikutnya! |
| 53 | `angkot-053.m4a` | Sisanya sedikit. Angkot atau becak? |
| 54 | `angkot-054.m4a` | Satu becak, satu penumpang. |
| 55 | `angkot-055.m4a` | Berapa penumpang semuanya? Susun angkanya di papan. |
| 56 | `angkot-056.m4a` | Kerumunan baru datang! Ketuk Isi angkot! |
| 57 | `angkot-057.m4a` | Masih banyak. Isi angkot lagi! |
| 58 | `angkot-058.m4a` | Hebat! Kamu paham puluhan dan satuan. |
| 59 | `angkot-059.m4a` | Sepuluh! |
| 60 | `angkot-060.m4a` | Dua puluh! |
| 61 | `angkot-061.m4a` | Tiga puluh! |
| 62 | `angkot-062.m4a` | Empat puluh! |
| 63 | `angkot-063.m4a` | Pas! Empat puluh delapan penumpang sampai di pasar. |
| 64 | `angkot-064.m4a` | Pas! Tiga puluh dua penumpang sampai di pasar. |
| 65 | `angkot-065.m4a` | Hebat! Pesanan sampai dengan pas. |
| 66 | `angkot-066.m4a` | Tantangan! Lima angkot, tanpa angka. |
| 67 | `angkot-067.m4a` | Lima angkot penuh. Lima puluh penumpang! |
| 68 | `angkot-068.m4a` | Luar biasa! Lima angkot penuh. |

### katak

| No | File | Kalimat |
|---|---|---|
| 69 | `katak-069.m4a` | Bantu Kodi lompat ke temannya. Berapa lompatan? |
| 70 | `katak-070.m4a` | Tepat! nol tambah empat sama dengan empat. |
| 71 | `katak-071.m4a` | Tepat! Kodi bertemu temannya. |
| 72 | `katak-072.m4a` | Temannya ada di belakang. Lompat mundur, ya! |
| 73 | `katak-073.m4a` | Tepat! dua belas kurang lima sama dengan tujuh. |
| 74 | `katak-074.m4a` | Hore, Kodi sampai! |
| 75 | `katak-075.m4a` | Sekali lompat, dua batu. Berapa kali lompat? |
| 76 | `katak-076.m4a` | Tepat! tujuh kali dua sama dengan empat belas. |
| 77 | `katak-077.m4a` | Lompatanmu pas sekali! |
| 78 | `katak-078.m4a` | Awas buaya! Pilih lompatan yang aman. |
| 79 | `katak-079.m4a` | Tepat! lima kali lima sama dengan dua puluh lima. |
| 80 | `katak-080.m4a` | Jauh sekali! Coba lompatan sepuluh. |
| 81 | `katak-081.m4a` | Tepat! enam kali sepuluh sama dengan enam puluh. |
| 82 | `katak-082.m4a` | Lompat sepuluh dulu, lalu lompat satu. |
| 83 | `katak-083.m4a` | Tepat! tiga kali sepuluh sama dengan tiga puluh. |
| 84 | `katak-084.m4a` | Kodi mulai dari tengah. Berapa lompatan lagi? |
| 85 | `katak-085.m4a` | Tepat! tujuh tambah empat sama dengan sebelas. |
| 86 | `katak-086.m4a` | Kodi mau pulang. Lompat mundur ke temannya. |
| 87 | `katak-087.m4a` | Tepat! empat belas kurang tujuh sama dengan tujuh. |
| 88 | `katak-088.m4a` | Batunya tanpa angka. Rencanakan lompatanmu! |
| 89 | `katak-089.m4a` | Tepat! tiga puluh delapan tambah sepuluh tambah sepuluh tambah tujuh sama dengan enam puluh lima. |
| 90 | `katak-090.m4a` | Banyak buaya! Pilih lompatan yang aman. |
| 91 | `katak-091.m4a` | Tepat! enam kali lima sama dengan tiga puluh. |

### ketapel

| No | File | Kalimat |
|---|---|---|
| 92 | `ketapel-092.m4a` | Robohkan kalengnya! Ketuk dulu patok tebakanmu. |
| 93 | `ketapel-093.m4a` | Kalengnya roboh semua! Hebat! |
| 94 | `ketapel-094.m4a` | Kalengnya lebih jauh. Ketuk patok tebakanmu dulu. |
| 95 | `ketapel-095.m4a` | Dua kaleng! Tarik pendek untuk dekat, panjang untuk jauh. |
| 96 | `ketapel-096.m4a` | Kena! Hebat! |
| 97 | `ketapel-097.m4a` | Sekarang tanpa titik pemandu. Kamu pasti bisa! |
| 98 | `ketapel-098.m4a` | Arah tarikan bisa diubah. Lewati pohon kecil itu! |
| 99 | `ketapel-099.m4a` | Jatuhkan mangga ke keranjang! Ketuk patok tebakanmu dulu. |
| 100 | `ketapel-100.m4a` | Mangganya masuk keranjang! |
| 101 | `ketapel-101.m4a` | Kelereng dulu, lalu batu. Kalengnya sama. |
| 102 | `ketapel-102.m4a` | Pak Tani menyusun kalengnya lagi. |
| 103 | `ketapel-103.m4a` | Sekarang batu. Tebak dulu, jatuh di patok mana? |
| 104 | `ketapel-104.m4a` | Semua sasaran kena! Hebat! |
| 105 | `ketapel-105.m4a` | Ini bola kertas. Ringan, tapi ditahan udara. |
| 106 | `ketapel-106.m4a` | Tiga kaleng berjajar. Robohkan satu per satu! |
| 107 | `ketapel-107.m4a` | Kena! Masih ada sasaran lagi. |
| 108 | `ketapel-108.m4a` | Tantangan! Batu, lalu bola kertas, lalu kelereng. |
| 109 | `ketapel-109.m4a` | Sekarang pakai kelereng. Ringan sekali! |

### perahu

| No | File | Kalimat |
|---|---|---|
| 110 | `perahu-110.m4a` | Terapung atau tenggelam? Seret ke keranjang tebakan. |
| 111 | `perahu-111.m4a` | Pas! Gabus sangat ringan untuk ukurannya. Terapung tinggi! |
| 112 | `perahu-112.m4a` | Pas! Paku kecil, tapi padat. Tenggelam! |
| 113 | `perahu-113.m4a` | Pas! Kayu ringan untuk ukurannya, jadi terapung. |
| 114 | `perahu-114.m4a` | Pas! Batu padat untuk ukurannya. Tenggelam. |
| 115 | `perahu-115.m4a` | Semua tebakan pas! |
| 116 | `perahu-116.m4a` | Tebak lagi. Terapung atau tenggelam? |
| 117 | `perahu-117.m4a` | Pas! Kelapa besar, tapi berserat dan berongga. Terapung! |
| 118 | `perahu-118.m4a` | Pas! Kelereng kecil dari kaca padat. Tenggelam! |
| 119 | `perahu-119.m4a` | Pas! Apel menyimpan udara di dalamnya. Terapung! |
| 120 | `perahu-120.m4a` | Pas! Koin kecil, tapi logamnya padat. Tenggelam! |
| 121 | `perahu-121.m4a` | Besar belum tentu tenggelam. Ayo tebak! |
| 122 | `perahu-122.m4a` | Pas! Es terapung, tapi hampir seluruhnya terendam. |
| 123 | `perahu-123.m4a` | Pas! Baut kecil, tapi logamnya padat. Tenggelam! |
| 124 | `perahu-124.m4a` | Pas! Sendok dari logam padat. Tenggelam! |
| 125 | `perahu-125.m4a` | Enam benda. Seret semua ke keranjang tebakan. |
| 126 | `perahu-126.m4a` | Pas! Plastisin sedikit lebih padat dari air. Tenggelam pelan. |
| 127 | `perahu-127.m4a` | Sampai di seberang! |
| 128 | `perahu-128.m4a` | Mana yang membawa kelereng paling banyak? Ketuk satu. |
| 129 | `perahu-129.m4a` | Tebakanmu: mangkuk lebar. Tekan Coba! |
| 130 | `perahu-130.m4a` | Bola langsung tenggelam. Nol kelereng! |
| 131 | `perahu-131.m4a` | Seret kelereng ke perahu kecil. Hitung, ya! |
| 132 | `perahu-132.m4a` | Seret kelereng ke mangkuk lebar. Hitung, ya! |
| 133 | `perahu-133.m4a` | Tebakanmu pas! Ruang di dalam mangkuk paling besar. |
| 134 | `perahu-134.m4a` | Bentuk lebar dan berongga, muatannya banyak! |
| 135 | `perahu-135.m4a` | Pakai mangkuk lebar? Tekan Coba! |
| 136 | `perahu-136.m4a` | Mangkuk lebar kuat membawa muatan! |

### martabak

| No | File | Kalimat |
|---|---|---|
| 137 | `martabak-137.m4a` | Potong martabak jadi dua. Sama besar ya! |
| 138 | `martabak-138.m4a` | Seret potongan ke piring teman. |
| 139 | `martabak-139.m4a` | Dua bagian sama besar. Setengah! |
| 140 | `martabak-140.m4a` | Potong kue lapis untuk dua teman. |
| 141 | `martabak-141.m4a` | Setengah dan setengah. Adil! |
| 142 | `martabak-142.m4a` | Martabak untuk empat teman. Potong sama besar! |
| 143 | `martabak-143.m4a` | Empat bagian sama. Seperempat! |
| 144 | `martabak-144.m4a` | Kue lapis untuk empat teman. Bentuknya boleh beda! |
| 145 | `martabak-145.m4a` | Seperempat semua. Adil! |
| 146 | `martabak-146.m4a` | Kue lapis untuk tiga teman. Potong dua kali. |
| 147 | `martabak-147.m4a` | Tiga bagian sama. Sepertiga! |
| 148 | `martabak-148.m4a` | Dodi dan Rina minta seperempat. Pilih yang pas! |
| 149 | `martabak-149.m4a` | Bentuknya beda, sama-sama seperempat! |
| 150 | `martabak-150.m4a` | Lihat! Potongan panjang dibelah dua. |
| 151 | `martabak-151.m4a` | Raka lapar sekali. Setengah atau seperempat? Beri yang lebih besar! |
| 152 | `martabak-152.m4a` | Setengah lebih besar dari seperempat! |
| 153 | `martabak-153.m4a` | Lihat pesanan di kartu. Potong, lalu bagikan! |
| 154 | `martabak-154.m4a` | Pesanan pas semua. Hebat! |
| 155 | `martabak-155.m4a` | Urutkan teman dari potongan terbesar. |
| 156 | `martabak-156.m4a` | Setengah, sepertiga, seperempat. Pas! |
| 157 | `martabak-157.m4a` | Tantangan! Baca kartu pesanan, lalu potong. |

### Kalimat dengan angka (berubah tiap main, sementara memakai suara perangkat)

- timbangan: 8 sama dengan 8. Tandanya cocok!
- timbangan: 5 kurang dari 8. Tandanya cocok!
- timbangan: 8 lebih dari 6. Tandanya cocok!
- timbangan: Pasangan baru: 1 dan 5!
- timbangan: Pasangan baru: 2 dan 4!
- timbangan: Pasangan baru: 3 dan 3!
- timbangan: Tiga pasangan! Sekarang karungnya 10.
- timbangan: Karungnya sekarang 10. Cari 3 pasangan!
- timbangan: Pasangan baru: 1 dan 9!
- timbangan: Pasangan baru: 2 dan 8!
- timbangan: Pasangan baru: 3 dan 7!
- timbangan: Hebat! Banyak cara membuat 6 dan 10.
- timbangan: 4 tambah 6 sama dengan 10. Pas!
- timbangan: 3 tambah 3 sama dengan 6. Pas!
- timbangan: 11 sama dengan 5 tambah 6!
- timbangan: 14 sama dengan 6 tambah 8!
- timbangan: 6 + 2 sama dengan 7 + 1!
- timbangan: Benar! 5 + 3 sama dengan 6 + 2.
- timbangan: Benar! 4 + 5 kurang dari 8 + 2.
- timbangan: 12 kurang 4 sama dengan 8!
- timbangan: 12 kurang 3 sama dengan 9!
- timbangan: Bagi 12 kelereng ke dua kantong, sama banyak.
- timbangan: Setengah dari 12 adalah 6!
- timbangan: 2 kali 1 sama dengan 1 kali 2. Seimbang!
- timbangan: Dua beban di kiri. Di mana beban 3?
- timbangan: 2 + 2 + 2 = 3 + 3. Seimbang!
- angkot: Tiga puluh satu penumpang! 3 puluhan, 1 satuan.
- angkot: Empat puluh lima penumpang! 4 puluhan, 5 satuan.
- angkot: Kirim 48 penumpang ke pasar. Atur angkot dan becak!
- angkot: Kirim 32 penumpang ke pasar. Atur angkot dan becak!
- ketapel: Tebakanmu patok 2. Sekarang tarik karetnya!
- ketapel: Tebakanmu tepat! Kelerengnya jatuh di patok 2. Kena!
- ketapel: Tebakanmu patok 5. Sekarang tarik karetnya!
- ketapel: Tebakanmu tepat! Kelerengnya jatuh di patok 5. Kena!
- ketapel: Tebakanmu patok 3. Sekarang tarik karetnya!
- ketapel: Tebakanmu tepat! Kelerengnya jatuh di patok 3. Kena!
- ketapel: Tebakanmu patok 9. Sekarang tarik karetnya!
- ketapel: Tebakanmu tepat! Kelerengnya jatuh di patok 9. Kena!
- ketapel: Tebakanmu tepat! Batunya jatuh di patok 3. Kena!
- ketapel: Tebakanmu tepat! Bola kertasnya jatuh di patok 5. Kena!
- perahu: Muat rakit tepat 8 kilo, lalu Dayung!
- perahu: Tepat 8 kilo! Ayo menyeberang!
- perahu: Rakit kuat 12 kilo. Muat tepat segitu!
- perahu: Muat sebanyak mungkin, asal tidak lewat 12 kilo.
- perahu: 11 kilo, paling banyak tanpa lewat 12!
- perahu: Muat paling banyak, jangan lewat 14 kilo. Hitung sendiri, ya!
- perahu: Perahu kecil kuat membawa 5 kelereng.
- perahu: Mangkuk lebar kuat membawa 10 kelereng.
- perahu: Bawa 7 kelereng tanpa tenggelam. Pilih bentuknya!
- perahu: 7 kelereng terbawa! Hebat!

<!-- LINES:END -->
