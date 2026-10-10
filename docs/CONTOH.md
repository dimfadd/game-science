# SOP contoh main ("Contoh")

Tujuan: sebelum anak mencoba jenis level yang baru, Si Cil **mencontohkan satu kali** dengan tangan bayangan, lalu anak mencoba sendiri. Contoh bisa dilewati. SOP ini wajib untuk setiap game baru, jenis level baru, atau perubahan mekanik, dan diperiksa dengan `node tests/demos.js <game>`.

## 1. Aturan pedagogi

1. **Angka atau soal contoh berbeda dari soal anak.** Contoh mengajarkan *cara* main, bukan jawaban. Soal anak dibuat ulang setelah contoh, dan harus berbeda dari soal contoh (periksa dengan tanda pengenal soal, ulangi acak kalau sama).
2. **Contoh memakai mekanik asli.** Tangan bayangan menekan, menyeret, dan menggesek lewat penangan input game yang sama dengan jari anak (`GS.demo` mengirim event pointer sintetis). Jangan memindahkan benda lewat kode langsung, dan jangan membuat versi tiruan.
3. **Berpikir keras.** Si Cil menjelaskan alasannya dengan kalimat pendek sambil bekerja: "Dari 3, lompat 2 sebanyak 4 kali." Untuk TK tanpa teks wajib dibaca: semua penting diucapkan, kalimat ≤ 10 kata.
4. **Contoh berhasil.** Contoh selalu berakhir dengan dunia game merespons benar (timbangan seimbang, angkot berangkat), lalu "Sekarang giliranmu!". Contoh tidak menunjukkan kesalahan, kecuali jenis level itu memang tentang memperbaiki (misalnya prediksi lalu amati); kalau begitu tetap akhiri dengan hasil benar.
5. **Singkat.** Satu ronde saja, 10–25 detik. Level dengan banyak ronde dicontohkan satu ronde.
6. **Tidak memengaruhi bintang.** Selama contoh, `run.win()` tidak menyimpan bintang dan tidak merayakan; soal anak dibangun ulang dari awal.

## 2. Kapan contoh diputar

| Situasi | Perilaku |
|---|---|
| Pertama kali anak bertemu `key` jenis level ini di kelas yang aktif | Diputar otomatis (setelah layar "Main!" bila ada) |
| Sudah pernah dilihat atau dilewati | Tidak otomatis; tombol tangan "Lihat contoh" di HUD selalu tersedia |
| Level tantangan atau campuran tanpa mekanik baru | `auto: false`, hanya lewat tombol; contohnya memakai jenis level terdekat |
| Anak meleset 2 kali | Game memanggil `run.offerDemo()`: tombol contoh berdenyut, tidak dipaksa |
| `?autotest` / pengujian otomatis | Tidak otomatis (kecuali `?demotest`); `?nodemo` mematikan contoh otomatis |

Status "sudah dilihat" disimpan per game, per kelas, per `key` (`demo.<game>@<tier>.<key>`).

## 3. Cara membuat (untuk coder)

```js
const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i), demo: demoSpec });

function demoSpec(i) {
  return {
    key: 'pasangan10',                 // jenis level; level dengan mekanik sama boleh berbagi key
    auto: true,                        // false untuk tantangan/campuran
    build: () => buildLevel(i, true),  // mode contoh: angka lain, tanpa GS.say pembuka
    script: async d => {
      await d.say('Angkot berangkat kalau isinya sepuluh.');
      await d.drag(() => personEl(0), () => seatPoint(3));  // target: titik SVG {x,y}, Element, selector, atau fungsi
      await d.tap('#dock .gs-action');
      await d.success();                // menunggu game memanggil run.win() di mode contoh
    }
  };
}
```

Alat di `d`: `say(teks, ms?)`, `wait(ms)`, `point(target)`, `tap(target)`, `drag(dari, ke, ms?)`, `path([titik...], ms?)` untuk gesekan dan putaran, `success(timeout?)`. Titik `{x, y}` memakai koordinat kanvas 1280 × 800.

Di `buildLevel(i, demo)`:
- buat soal dengan angka berbeda dari soal anak terakhir dan simpan tanda pengenalnya;
- jangan panggil `GS.say` pembuka saat `demo` (skrip yang bicara);
- pemanggilan `run.win(...)` biarkan seperti biasa: runner tahu sedang contoh.
- Kalau game punya pointer capture sendiri, tidak perlu diubah: core menelan `setPointerCapture` untuk pointer contoh.

## 4. Pemeriksaan wajib

1. `node tests/demos.js <game>`: setiap level di setiap kelas harus `ok` (contoh ada, berhasil lewat mekanik asli, contoh otomatis muncul sekali, "Lewati" berfungsi).
2. `node tests/levels.js <game>` tetap lolos.
3. Lihat screenshot contoh di HP 844 × 390 untuk setiap jenis level: tangan terlihat, tidak menutupi yang sedang dicontohkan, kalimat Si Cil sesuai gerakan, dan bingkai "Contoh" tidak menutupi angka penting.
4. Catat di `docs/LOG.md`.
