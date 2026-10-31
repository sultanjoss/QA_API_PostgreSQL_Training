
import { before, after } from 'mocha';

import {
    checkDatabaseConnection,
    closeDatabaseConnection
} from '../clients/postgresClient.ts';

// ======================================================
// GLOBAL DATABASE LIFECYCLE
// ======================================================

// Dijalankan satu kali sebelum seluruh regression suite.
before(async function () {
    this.timeout(10000);

    console.log('\n========== DATABASE SETUP ==========');

    await checkDatabaseConnection();

    console.log('[DATABASE] Ready for regression testing');
    console.log('====================================');
});

// Dijalankan satu kali setelah seluruh regression suite.
after(async function () {
    this.timeout(10000);

    console.log('\n========== DATABASE TEARDOWN ==========');

    await closeDatabaseConnection();

    console.log('[DATABASE] Regression cleanup completed');
    console.log('=======================================');
});
