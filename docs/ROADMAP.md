# Kurikulum Basic → Intermediate

## Basic (latihan 1–15)
1. Hidupkan Docker dan validasi health endpoint.
2. GET customers dan cek header/body/pagination.
3. POST customer valid dan bandingkan ID/email dengan SELECT PostgreSQL.
4. Negative required/format/duplikat.
5. GET by ID 200 dan 404.
6. PUT update dan PATCH status dibandingkan ke DB.
7. DELETE dan validasi record tidak ada.
8. Ukur response time Axios/Mocha secara konsisten.

## Intermediate (latihan 16–30)
1. Validasi foreign key customer-account.
2. Uji status customer dan account.
3. Transfer saldo: sebelum/sesudah, dua record account, satu transfer dan audit.
4. Insufficient funds → tidak ada perubahan database (rollback).
5. Transfer dengan idempotency key yang sama → tidak debit dua kali.
6. Idempotency key yang sama dengan payload berbeda → 409.
7. Duplicate requests dan simple concurrent transfer, verifikasi saldo non-negatif.
8. Tambahkan test isolation: unique test data, per-test cleanup, jangan menghapus seed tanpa sengaja.

## Tahap berikutnya (bukan bagian paket v1)
- Buat repository automation **terpisah** `APIDatabaseAutomationTesting`.
- Axios + Mocha/Chai + node-postgres `pg`, test suite `api`, `db`, `integration`.
- ReportPortal API/DB Mocha agent terpisah dari WDIO mobile, tetapi project server yang sama.
- Konversi ReportPortal ke Cucumber-style HTML dengan validasi hierarki test item.
- Jenkins pipeline API/DB + Jenkins mobile pipeline + orchestrator.
