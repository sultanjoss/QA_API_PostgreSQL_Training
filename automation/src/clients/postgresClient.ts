
import { Pool } from 'pg';

// ======================================================
// DATABASE CONFIGURATION
// ======================================================

const password = process.env.DB_PASSWORD;

if (!password) {
    throw new Error(
        '[CONFIG ERROR] DB_PASSWORD belum dikonfigurasi.'
    );
}

// ======================================================
// REUSABLE POSTGRESQL CONNECTION POOL
// ======================================================

export const db = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || 'qa_training_db',
    user: process.env.PGUSER || 'qa_training',
    password,

    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
});

// ======================================================
// VERIFY DATABASE CONNECTION
// ======================================================

export async function checkDatabaseConnection(): Promise<void> {
    const result = await db.query(
        'SELECT current_database() AS database_name'
    );

    console.log(
        `[DATABASE] Connected: ${result.rows[0].database_name}`
    );
}

// ======================================================
// CLOSE DATABASE CONNECTION
// ======================================================

export async function closeDatabaseConnection(): Promise<void> {
    await db.end();
    console.log('[DATABASE] Connection pool closed');
}
