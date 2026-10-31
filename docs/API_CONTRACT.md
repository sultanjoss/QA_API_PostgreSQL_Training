# API Contract — QA Training Lab v1

Base URL `http://127.0.0.1:3000`. Request/response JSON menggunakan `Content-Type: application/json`. Seluruh response API menambahkan header `x-request-id` (jika request mengirim `x-request-id` yang panjangnya ≤80 karakter, nilainya dipakai kembali).

| Method | Endpoint | Berhasil | Negatif yang disiapkan |
|---|---|---|---|
| GET | `/health` | 200 | Koneksi DB rusak → 500 (gangguan service) |
| GET | `/api/customers?page=1&limit=10&search=andi&status=ACTIVE` | 200 | 400 pagination, 422 status |
| POST | `/api/customers` | 201 + Location | 400 required, 422 invalid, 409 duplicate |
| GET | `/api/customers/:id` | 200 | 400 invalid ID, 404 missing |
| PUT | `/api/customers/:id` | 200 | 400 invalid, 404 missing, 409 duplicate |
| PATCH | `/api/customers/:id/status` | 200 | 422 invalid status, 404 missing |
| DELETE | `/api/customers/:id` | 204 | 404 missing, 409 has accounts |
| POST | `/api/accounts` | 201 | 422 invalid / inactive customer, 404 missing |
| GET | `/api/accounts/:id` | 200 | 400 invalid, 404 missing |
| GET | `/api/customers/:id/accounts` | 200 | 404 missing |
| POST | `/api/transfers` | 201; replay 200 | 400 missing key, 422 invalid/insufficient/frozen, 404 account missing, 409 key conflict |
| GET | `/api/transfers/:id` | 200 | 404 missing |

## Example payloads

**POST /api/customers**
```json
{"name":"QA Automation","email":"qa-unique-123@example.test"}
```
**PUT /api/customers/:id**
```json
{"name":"QA Update","email":"qa-updated-123@example.test"}
```
**PATCH /api/customers/:id/status**
```json
{"status":"SUSPENDED"}
```
**POST /api/accounts**
```json
{"customer_id":1,"initial_balance":10000}
```
**POST /api/transfers** (header `Idempotency-Key: <unik-per-operasi>`)
```json
{"source_account_id":1,"target_account_id":2,"amount":10000}
```

## Perbandingan API vs PostgreSQL

Jalankan queries dengan database `qa_training_db`, bukan ReportPortal:

```sql
SELECT id,name,email,status FROM customers WHERE id = :customer_id;
SELECT id,customer_id,account_number,balance,status FROM accounts WHERE id IN (1,2);
SELECT id,source_account_id,target_account_id,amount,idempotency_key FROM transfers ORDER BY id DESC;
SELECT entity_type,entity_id,action,detail FROM audit_logs ORDER BY id DESC LIMIT 20;
```

Parameter `:customer_id` di sini notasi dokumentasi/DBeaver. Di node-postgres gunakan `$1` dengan parameter array.

## Business rules penting

1. Customer email unik, name wajib, status `ACTIVE | INACTIVE | SUSPENDED`.
2. Rekening baru hanya bisa untuk customer `ACTIVE`.
3. Transfer hanya antar rekening yang berbeda dan keduanya `ACTIVE`.
4. Transfer ditolak bila saldo sumber kurang; perubahan saldo harus **nol** jika ditolak.
5. Transfer sukses mengubah **dua saldo + satu transfer + satu audit log** dalam satu transaksi PostgreSQL.
6. Header `Idempotency-Key` digunakan agar retry request sama tidak mendebit ulang; replay sukses menghasilkan **200**.
7. Penghapusan customer yang masih punya account ditolak **409** oleh foreign key.
8. `amount/balance` adalah unit integer lab; field BIGINT dibaca sebagai string pada JSON agar presisi tidak hilang.

## Response time

Gunakan `performance.now()` di Axios/Mocha untuk waktu request dari sisi client, bukan timestamp PostgreSQL. Contoh target **<3000ms** hanyalah SLA latihan; jangan samakan dengan standar aplikasi bisnis tanpa persetujuan.
