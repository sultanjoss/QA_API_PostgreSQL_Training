
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { expect } from 'chai';

import { apiClient } from '../../clients/apiClient.ts';
import { db } from '../../clients/postgresClient.ts';
import { addQaEvidence } from '../../utils/qaEvidence.ts';

// ======================================================
// TEST CONFIGURATION
// ======================================================

const responseSlaMs = Number(
    process.env.API_RESPONSE_SLA_MS || 3000
);

// ======================================================
// TEST SUITE - NEGATIVE API + DATABASE TESTING
// ======================================================

describe('API + PostgreSQL - Duplicate Email Validation', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-003 - DUPLICATE EMAIL
    // ==================================================

    it('TC-API-DB-003 - Menolak duplicate email dan menjaga integritas DB', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE TEST DATA
        // ==============================================

        const uniqueId = randomUUID().slice(0, 12);

        const payload = {
            name: 'QA Duplicate Email Testing',
            email: `qa-duplicate-${uniqueId}@example.test`
        };

        console.log('\n========== TEST DATA ==========');
        console.log(`[EMAIL] ${payload.email}`);

        // ==============================================
        // STEP 2 - CREATE FIRST CUSTOMER
        // ==============================================

        const firstResponse = await apiClient.post(
            '/api/customers',
            payload
        );

        expect(
            firstResponse.status,
            'Create First Customer HTTP Status'
        ).to.equal(201);

        expect(firstResponse.data.id)
            .to.be.a('number');

        const customerId = firstResponse.data.id;

        console.log(`[FIRST REQUEST] HTTP ${firstResponse.status}`);
        console.log(`[CUSTOMER ID] ${customerId}`);

        // ==============================================
        // STEP 3 - DATABASE BEFORE DUPLICATE REQUEST
        // ==============================================

        const beforeResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status
            FROM public.customers
            WHERE email = $1
            `,
            [payload.email]
        );

        expect(
            beforeResult.rowCount,
            'Customer Record Before Duplicate'
        ).to.equal(1);

        const originalCustomer = beforeResult.rows[0];

        expect(originalCustomer.id)
            .to.equal(customerId);

        expect(originalCustomer.email)
            .to.equal(payload.email);

        console.log(
            `[DATABASE BEFORE] ${beforeResult.rowCount} record`
        );

        // ==============================================
        // STEP 4 - SEND DUPLICATE EMAIL REQUEST
        // ==============================================

        const startTime = performance.now();

        const duplicateResponse = await apiClient.post(
            '/api/customers',
            payload
        );

        const responseTime = performance.now() - startTime;

        console.log(
            `[DUPLICATE REQUEST] HTTP ${duplicateResponse.status}`
        );

        console.log(
            `[RESPONSE TIME] ${responseTime.toFixed(2)} ms`
        );

        // ==============================================
        // STEP 5 - HTTP STATUS CODE ASSERTION
        // ==============================================

        expect(
            duplicateResponse.status,
            'Duplicate Email HTTP Status'
        ).to.equal(409);

        // ==============================================
        // STEP 6 - RESPONSE BODY ASSERTIONS
        // ==============================================

        expect(duplicateResponse.data.code)
            .to.equal('DUPLICATE_EMAIL');

        expect(duplicateResponse.data.message)
            .to.equal('Email sudah terdaftar');

        // ==============================================
        // STEP 7 - RESPONSE HEADER ASSERTIONS
        // ==============================================

        expect(
            duplicateResponse.headers['content-type']
        ).to.include('application/json');

        expect(
            duplicateResponse.headers['x-request-id']
        ).to.be.a('string').and.not.empty;

        // ==============================================
        // STEP 8 - RESPONSE TIME ASSERTION
        // ==============================================

        expect(
            responseTime,
            'Duplicate Email API Response Time'
        ).to.be.lessThan(responseSlaMs);

        // ==============================================
        // STEP 9 - DATABASE AFTER DUPLICATE REQUEST
        // ==============================================

        const afterResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status
            FROM public.customers
            WHERE email = $1
            `,
            [payload.email]
        );

        expect(
            afterResult.rowCount,
            'Customer Record After Duplicate'
        ).to.equal(1);

        const storedCustomer = afterResult.rows[0];

        // ==============================================
        // STEP 10 - VERIFY DATABASE INTEGRITY
        // ==============================================

        expect(storedCustomer.id)
            .to.equal(originalCustomer.id);

        expect(storedCustomer.name)
            .to.equal(originalCustomer.name);

        expect(storedCustomer.email)
            .to.equal(originalCustomer.email);

        expect(storedCustomer.status)
            .to.equal(originalCustomer.status);

        // ==============================================
        // STEP 11 - TEST RESULT
        // ==============================================

        console.log('\n========== DUPLICATE EMAIL TEST ==========');
        console.log('[TEST CASE] TC-API-DB-003');
        console.log('[TEST TYPE] NEGATIVE');
        console.log('[EXPECTED HTTP] 409 Conflict');
        console.log(`[ACTUAL HTTP] ${duplicateResponse.status}`);
        console.log(`[RESPONSE CODE] ${duplicateResponse.data.code}`);
        console.log(`[RESPONSE TIME] ${responseTime.toFixed(2)} ms`);
        console.log(`[DB BEFORE] ${beforeResult.rowCount} record`);
        console.log(`[DB AFTER] ${afterResult.rowCount} record`);
        console.log(`[CUSTOMER ID] ${customerId}`);
        console.log(`[CUSTOMER EMAIL] ${payload.email}`);
        console.log('[DATABASE INTEGRITY] PASS');
        console.log('[CLEANUP] DISABLED');
        console.log('==========================================');

        // ==============================================
        // STEP 12 - MOCHAWESOME TEST EVIDENCE
        // ==============================================

        addQaEvidence(this, [
            {
                title: 'API Request Information',
                value: {
                    testCaseId: 'TC-API-DB-003',
                    testType: 'NEGATIVE',
                    method: 'POST',
                    endpoint: '/api/customers',
                    firstRequestStatus: firstResponse.status,
                    expectedDuplicateStatus: 409,
                    actualDuplicateStatus: duplicateResponse.status,
                    responseTimeMs: Number(
                        responseTime.toFixed(2)
                    ),
                    responseSlaMs,
                    requestId:
                        duplicateResponse.headers['x-request-id']
                }
            },
            {
                title: 'Duplicate Email Test Data',
                value: {
                    customerId,
                    name: payload.name,
                    duplicateEmail: payload.email,
                    initialCustomerStatus: originalCustomer.status,
                    duplicateAttempt: true,
                    expectedErrorCode: 'DUPLICATE_EMAIL',
                    actualErrorCode: duplicateResponse.data.code,
                    actualErrorMessage: duplicateResponse.data.message
                }
            },
            {
                title: 'PostgreSQL Validation',
                value: {
                    database: 'qa_training_db',
                    table: 'public.customers',
                    queryFilter: 'WHERE email = $1',
                    recordsBefore: beforeResult.rowCount,
                    recordsAfter: afterResult.rowCount,
                    expectedRecordsAfter: 1,
                    customerIdUnchanged:
                        storedCustomer.id === originalCustomer.id,
                    nameUnchanged:
                        storedCustomer.name === originalCustomer.name,
                    emailUnchanged:
                        storedCustomer.email === originalCustomer.email,
                    statusUnchanged:
                        storedCustomer.status === originalCustomer.status,
                    duplicateRecordCreated: false,
                    databaseIntegrity: 'PASS'
                }
            },
            {
                title: 'Test Execution Summary',
                value: {
                    testCaseId: 'TC-API-DB-003',
                    testType: 'NEGATIVE',
                    expectedHttpStatus: 409,
                    actualHttpStatus: duplicateResponse.status,
                    expectedErrorCode: 'DUPLICATE_EMAIL',
                    actualErrorCode: duplicateResponse.data.code,
                    duplicateValidation: 'PASS',
                    databaseValidation: 'PASS',
                    dataIntegrity: 'PASS',
                    cleanupPolicy: 'DISABLED',
                    originalCustomerRemainsStored: true
                }
            }
        ]);

    });
});
