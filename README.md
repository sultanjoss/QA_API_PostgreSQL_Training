# QA API + PostgreSQL Training Lab (Basic → Intermediate)

**Sistem yang diuji (SUT)**: REST API Express + PostgreSQL. Ini **bukan framework automation**; nantinya dites dari repository `APIDatabaseAutomationTesting` menggunakan Axios + Mocha + `pg`. Tidak memodifikasi project `MobileAutomationTesting` atau container ReportPortal.

## Cakupan

- **Basic:** health check, customer CRUD, pagination, pencarian/filter, validasi 200/201/204/400/404/409/422, body/header/response-time.
- **Intermediate:** relasi customer→account, transfer antar rekening dengan database transaction, row locks, rollback, idempotency, audit log, pembandingan data API vs DB.
- Belum ada login/JWT, async queue, atau file upload; ketiganya bisa ditambahkan sebagai tahap berikutnya.
- Ini hanya lab localhost. **Jangan expose API/DB ke jaringan publik** atau memasukkan data pelanggan asli.

## Persyaratan

- MacBook, Docker Desktop + Docker Compose (`docker compose version`)
- Terminal dan opsional Postman / DBeaver
- Port host **3000** dan **5433** kosong (`lsof -nP -iTCP:3000 -sTCP:LISTEN`)
- Image PostgreSQL dan Node akan diunduh saat pertama menjalankan, sehingga perlu internet.

## Startup pertama

Buka terminal di **folder paket ini**, bukan di root repo mobile.

```bash
cp .env.example .env
```

Edit `.env` dan ganti `CHANGE_ME_LOCAL_ONLY` dengan password lab yang kuat. Jangan commit `.env`, jangan kirim password ke chat. Pilih password tanpa karakter `$` atau `#` untuk kemudahan interpolasi Compose.

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
docker compose ps
curl -i http://127.0.0.1:3000/health
```

Target: `db` dan `api` **healthy**, dan `/health` menghasilkan **200** dengan `{"status":"UP","database":"CONNECTED"}`. Saat startup pertama, tunggu proses pull image dan build sampai Docker siap. Jika belum sehat, lihat `docker compose logs --tail=100 db api`.

## Latihan pertama: POST customer → verifikasi PostgreSQL

```bash
curl -i -X POST http://127.0.0.1:3000/api/customers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Fahmi QA Training","email":"qa-lab-001@example.test"}'
```

Expected: **201**, `content-type: application/json`, `location: /api/customers/{id}`, `x-request-id`, dan body berisi `id,name,email,status,created_at,updated_at`.

Cek record via SQL menggunakan variabel environment container (tanpa menampilkan password):

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,name,email,status FROM customers ORDER BY id DESC LIMIT 10"'
```

Jalankan ulang POST dengan email **sama** untuk menguji **409 DUPLICATE_EMAIL**. Untuk request berikutnya gunakan email berbeda agar testing dapat diulang.

## Transfer sederhana → verifikasi atomicity

**Seed:** account 1 balance = 200000, account 2 balance = 50000 (satuan integer, bukan float).

```bash
curl -i -X POST http://127.0.0.1:3000/api/transfers \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: qa-training-transfer-001' \
  -d '{"source_account_id":1,"target_account_id":2,"amount":10000}'
```

Expected pertama: **201**, `replayed:false`. Kirim ulang key + payload **yang sama**: **200**, `replayed:true`, saldo **tidak boleh berkurang dua kali**.

Verifikasi DB:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,account_number,balance FROM accounts ORDER BY id"'
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,source_account_id,target_account_id,amount,idempotency_key FROM transfers ORDER BY id DESC LIMIT 5"'
```

Buat idempotency key **baru** untuk transaksi baru. Jangan mengasumsikan saldo seed masih sama setelah lab digunakan.

## Koneksi DBeaver

- Host: `127.0.0.1`
- Port: `5433`
- Database: `qa_training_db`
- User: `qa_training`
- Password: nilai `.env` milikmu

**Database ini berbeda dari PostgreSQL internal ReportPortal.** Container ini diberi namespace Compose `qa-api-postgresql-training` dan memakai Docker volume tersendiri.

## Import Postman

Import `postman/QA_API_PostgreSQL_Training.postman_collection.json`. Collection menggunakan variable `baseUrl=http://127.0.0.1:3000` dan menyimpan `customerId` serta `transferId` saat request berhasil. Request `Create Customer` menggunakan email unik dari timestamp.

Untuk melihat daftar endpoint dan query verifikasi DB, lihat `docs/API_CONTRACT.md`. Matriks latihan: `docs/TEST_CASE_MATRIX.csv`.

## Startup setelah Mac restart

1. Buka Docker Desktop.
2. Masuk ke folder paket.
3. `docker compose --env-file .env up -d`
4. `docker compose ps`
5. `curl -i http://127.0.0.1:3000/health`
6. Jalankan Postman / automation API/DB. **Appium/HP/simulator tidak dibutuhkan**.

## Stop, backup, reset

```bash
docker compose down             # Container berhenti; DATA volume tetap ada
docker compose up -d            # Jalankan ulang dengan data lama
docker compose logs -f api      # Log API
```

**Reset destruktif (menghapus seluruh data latihan, bukan ReportPortal):**

```bash
docker compose down -v
# Lalu: docker compose --env-file .env up -d --build
```

Perintah `down -v` **menghapus data di volume training** dan akan mengembalikan seed saat dibuat lagi. Hanya lakukan apabila memang sengaja ingin reset data lab.

## Troubleshooting singkat

| Kondisi | Diagnosis |
|---|---|
| `empty compose file` | Buka `compose.yaml` dari folder paket ini, pastikan isi tersimpan |
| `port is already allocated` | Cek port 3000 / 5433; hentikan service konflik atau atur mapping Compose |
| `db` unhealthy | `docker compose logs db`; cek `.env`, password, dan data volume |
| API 503 / gagal terhubung | `docker compose logs api db`; cek status koneksi PG |
| Email POST 409 | Email sudah ada; gunakan email unik atau reset hanya data lab |
| `relation customers does not exist` | Volume lama mungkin dibuat sebelum SQL init; periksa `\dt` atau reset volume lab dengan sengaja |
| Docker Compose URL dari repo mobile | Masuk ke folder paket training atau gunakan `-f <lokasi>/compose.yaml` |

## Batasan yang disengaja

- `balance` dan `amount` memakai integer (unit nominal lab), bukan floating point. PostgreSQL BIGINT dikirim sebagai **string** dalam JSON untuk menghindari kehilangan presisi di JavaScript.
- Tidak ada autentikasi: lab ini fokus API + DB, bukan keamanan production.
- Klaim kebenaran test baru valid setelah kamu menjalankannya di Docker milikmu. File paket divalidasi sintaksnya tetapi container belum dieksekusi dalam sesi ini.
