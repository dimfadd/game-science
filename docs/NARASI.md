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
(belum dikumpulkan)
<!-- LINES:END -->
