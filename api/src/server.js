import express from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const app = express();
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'qa_training_db',
  user: process.env.PGUSER || 'qa_training',
  password: process.env.PGPASSWORD,
  max: 10,
  connectionTimeoutMillis: 5000
});
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  const proposed = req.get('x-request-id');
  res.set('x-request-id', proposed && proposed.length <= 80 ? proposed : randomUUID());
  res.on('finish', () => {
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsed.toFixed(1)}ms`);
  });
  next();
});
app.use(express.json({ limit: '100kb' }));

const sendError = (res, status, code, message) => res.status(status).json({ code, message });
const positiveId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const validName = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100;
const validEmail = (v) => typeof v === 'string' && v.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const customerFields = 'id, name, email, status, created_at, updated_at';

app.get('/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'UP', database: 'CONNECTED' }); }
  catch (e) { next(e); }
});

app.get('/api/customers', async (req, res, next) => {
  try {
    const page = positiveId(req.query.page ?? 1);
    const limit = positiveId(req.query.limit ?? 10);
    if (!page || !limit || limit > 100 || (page - 1) * limit > 1000000) return sendError(res, 400, 'INVALID_PAGINATION', 'page/limit tidak valid');
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    if (status && !['ACTIVE','INACTIVE','SUSPENDED'].includes(status)) return sendError(res, 422, 'INVALID_STATUS', 'status tidak valid');
    const params = [search, status];
    const where = "WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%') AND ($2 = '' OR status = $2)";
    const count = await pool.query(`SELECT count(*)::int AS total FROM customers ${where}`, params);
    const rows = await pool.query(`SELECT ${customerFields} FROM customers ${where} ORDER BY id LIMIT $3 OFFSET $4`, [...params, limit, (page-1)*limit]);
    res.json({ data: rows.rows, pagination: { page, limit, total: count.rows[0].total } });
  } catch (e) { next(e); }
});

app.post('/api/customers', async (req, res, next) => {
  const { name, email } = req.body || {};
  if (name == null || email == null || name === '' || email === '') return sendError(res, 400, 'REQUIRED_FIELDS', 'name dan email wajib diisi');
  if (!validName(name) || !validEmail(email)) return sendError(res, 422, 'INVALID_CUSTOMER', 'name atau email tidak valid');
  const cleanEmail = email.trim().toLowerCase();
  const client = await pool.connect().catch(next);
  if (!client) return;
  try {
    await client.query('BEGIN');
    const result = await client.query(`INSERT INTO customers (name,email) VALUES ($1,$2) RETURNING ${customerFields}`, [name.trim(), cleanEmail]);
    await client.query('INSERT INTO audit_logs (entity_type,entity_id,action,detail) VALUES ($1,$2,$3,$4)', ['customer', result.rows[0].id, 'CREATE', JSON.stringify({ email: cleanEmail })]);
    await client.query('COMMIT');
    res.status(201).location(`/api/customers/${result.rows[0].id}`).json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return sendError(res, 409, 'DUPLICATE_EMAIL', 'Email sudah terdaftar');
    next(e);
  } finally { client.release(); }
});

app.get('/api/customers/:id', async (req, res, next) => {
  const id = positiveId(req.params.id);
  if (!id) return sendError(res, 400, 'INVALID_ID', 'ID tidak valid');
  try {
    const r = await pool.query(`SELECT ${customerFields} FROM customers WHERE id=$1`, [id]);
    if (!r.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Customer tidak ditemukan');
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

app.put('/api/customers/:id', async (req, res, next) => {
  const id = positiveId(req.params.id);
  if (!id) return sendError(res, 400, 'INVALID_ID', 'ID tidak valid');
  const { name, email } = req.body || {};
  if (name == null || email == null || name === '' || email === '') return sendError(res, 400, 'REQUIRED_FIELDS', 'name dan email wajib diisi');
  if (!validName(name) || !validEmail(email)) return sendError(res, 422, 'INVALID_CUSTOMER', 'name atau email tidak valid');
  try {
    const r = await pool.query(`UPDATE customers SET name=$1,email=$2,updated_at=now() WHERE id=$3 RETURNING ${customerFields}`, [name.trim(),email.trim().toLowerCase(),id]);
    if (!r.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Customer tidak ditemukan');
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return sendError(res, 409, 'DUPLICATE_EMAIL', 'Email sudah terdaftar');
    next(e);
  }
});

app.patch('/api/customers/:id/status', async (req, res, next) => {
  const id = positiveId(req.params.id);
  if (!id) return sendError(res, 400, 'INVALID_ID', 'ID tidak valid');
  const status = req.body?.status;
  if (!['ACTIVE','INACTIVE','SUSPENDED'].includes(status)) return sendError(res, 422, 'INVALID_STATUS', 'status tidak valid');
  try {
    const r = await pool.query(`UPDATE customers SET status=$1,updated_at=now() WHERE id=$2 RETURNING ${customerFields}`, [status,id]);
    if (!r.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Customer tidak ditemukan');
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/customers/:id', async (req, res, next) => {
  const id = positiveId(req.params.id);
  if (!id) return sendError(res, 400, 'INVALID_ID', 'ID tidak valid');
  try {
    const r = await pool.query('DELETE FROM customers WHERE id=$1 RETURNING id', [id]);
    if (!r.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Customer tidak ditemukan');
    res.status(204).end();
  } catch (e) {
    if (e.code === '23503') return sendError(res, 409, 'CUSTOMER_HAS_ACCOUNTS', 'Customer masih mempunyai rekening');
    next(e);
  }
});

app.post('/api/accounts', async (req, res, next) => {
  const customerId = positiveId(req.body?.customer_id);
  const balance = req.body?.initial_balance ?? 0;
  if (!customerId || !Number.isSafeInteger(balance) || balance < 0) return sendError(res, 422, 'INVALID_ACCOUNT', 'customer_id/initial_balance tidak valid');
  try {
    const c = await pool.query('SELECT id,status FROM customers WHERE id=$1', [customerId]);
    if (!c.rowCount) return sendError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer tidak ditemukan');
    if (c.rows[0].status !== 'ACTIVE') return sendError(res, 422, 'CUSTOMER_NOT_ACTIVE', 'Customer harus ACTIVE');
    const accountNumber = `QA-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
    const r = await pool.query('INSERT INTO accounts (customer_id,account_number,balance) VALUES ($1,$2,$3) RETURNING id,customer_id,account_number,balance,status,created_at', [customerId,accountNumber,balance]);
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

app.get('/api/accounts/:id', async (req,res,next) => {
  const id=positiveId(req.params.id);
  if(!id) return sendError(res,400,'INVALID_ID','ID tidak valid');
  try {
    const r=await pool.query('SELECT id,customer_id,account_number,balance,status,created_at FROM accounts WHERE id=$1',[id]);
    if(!r.rowCount) return sendError(res,404,'NOT_FOUND','Account tidak ditemukan');
    res.json(r.rows[0]);
  } catch(e){next(e);}
});

app.get('/api/customers/:id/accounts', async (req,res,next) => {
  const id=positiveId(req.params.id);
  if(!id) return sendError(res,400,'INVALID_ID','ID tidak valid');
  try {
    const c=await pool.query('SELECT id FROM customers WHERE id=$1',[id]);
    if(!c.rowCount) return sendError(res,404,'NOT_FOUND','Customer tidak ditemukan');
    const r=await pool.query('SELECT id,customer_id,account_number,balance,status FROM accounts WHERE customer_id=$1 ORDER BY id',[id]);
    res.json({data:r.rows});
  } catch(e){next(e);}
});

app.post('/api/transfers', async (req,res,next) => {
  const source=positiveId(req.body?.source_account_id);
  const target=positiveId(req.body?.target_account_id);
  const amount=req.body?.amount;
  const key=req.get('Idempotency-Key');
  if(!key || key.length>100) return sendError(res,400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key wajib diisi (maksimal 100 karakter)');
  if(!source || !target || source===target || !Number.isSafeInteger(amount) || amount<=0) return sendError(res,422,'INVALID_TRANSFER','Rekening/amount tidak valid');
  const client=await pool.connect().catch(next);
  if(!client) return;
  try {
    await client.query('BEGIN');
    // Lock kedua rekening dalam urutan ID untuk menghindari deadlock saat transfer silang.
    const locked=await client.query('SELECT id,balance,status FROM accounts WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',[[source,target]]);
    if(locked.rowCount!==2) { await client.query('ROLLBACK'); return sendError(res,404,'ACCOUNT_NOT_FOUND','Rekening tidak ditemukan'); }
    const prior=await client.query('SELECT id,source_account_id,target_account_id,amount,created_at FROM transfers WHERE idempotency_key=$1',[key]);
    if(prior.rowCount){
      const t=prior.rows[0];
      await client.query('COMMIT');
      if(t.source_account_id!==source || t.target_account_id!==target || Number(t.amount)!==amount) return sendError(res,409,'IDEMPOTENCY_CONFLICT','Key sudah dipakai untuk request berbeda');
      return res.status(200).json({...t,replayed:true});
    }
    const sourceRow=locked.rows.find(r=>r.id===source);
    const targetRow=locked.rows.find(r=>r.id===target);
    if(sourceRow.status!=='ACTIVE' || targetRow.status!=='ACTIVE'){await client.query('ROLLBACK');return sendError(res,422,'ACCOUNT_NOT_ACTIVE','Rekening tidak aktif');}
    if(Number(sourceRow.balance)<amount){await client.query('ROLLBACK');return sendError(res,422,'INSUFFICIENT_FUNDS','Saldo tidak cukup');}
    await client.query('UPDATE accounts SET balance=balance-$1 WHERE id=$2',[amount,source]);
    await client.query('UPDATE accounts SET balance=balance+$1 WHERE id=$2',[amount,target]);
    const t=await client.query('INSERT INTO transfers (source_account_id,target_account_id,amount,idempotency_key) VALUES ($1,$2,$3,$4) RETURNING id,source_account_id,target_account_id,amount,created_at',[source,target,amount,key]);
    await client.query('INSERT INTO audit_logs(entity_type,entity_id,action,detail) VALUES ($1,$2,$3,$4)',['transfer',t.rows[0].id,'TRANSFER',JSON.stringify({source,target,amount})]);
    await client.query('COMMIT');
    res.status(201).json({...t.rows[0],replayed:false});
  } catch(e){
    await client.query('ROLLBACK').catch(()=>{});
    if(e.code==='23505') return sendError(res,409,'IDEMPOTENCY_CONFLICT','Idempotency key sudah digunakan');
    next(e);
  } finally {client.release();}
});

app.get('/api/transfers/:id', async(req,res,next) => {
  const id=positiveId(req.params.id);
  if(!id) return sendError(res,400,'INVALID_ID','ID tidak valid');
  try {
    const r=await pool.query('SELECT id,source_account_id,target_account_id,amount,created_at FROM transfers WHERE id=$1',[id]);
    if(!r.rowCount) return sendError(res,404,'NOT_FOUND','Transfer tidak ditemukan');
    res.json(r.rows[0]);
  } catch(e){next(e);}
});

app.use((req,res)=>sendError(res,404,'ROUTE_NOT_FOUND','Endpoint tidak ditemukan'));
app.use((error,req,res,next)=>{
  if(error instanceof SyntaxError && 'body' in error) return sendError(res,400,'INVALID_JSON','JSON body tidak valid');
  console.error('Unhandled API error:',error.message);
  if(res.headersSent) return next(error);
  return sendError(res,500,'INTERNAL_ERROR','Internal server error');
});
const server=app.listen(port,'0.0.0.0',()=>console.log(`Training API listening on ${port}`));
async function stop(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGINT',stop); process.on('SIGTERM',stop);
