
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
// TEST SUITE - PATCH CUSTOMER STATUS + POSTGRESQL
// ======================================================

describe('API + PostgreSQL - Customer Status Update', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-006 - PATCH CUSTOMER STATUS
    // ==================================================

    it('TC-API-DB-006 - PATCH Customer Status dan validasi PostgreSQL', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE CUSTOMER
        // ==============================================

        const uniqueId = randomUUID().slice(0, 12);

        const payload = {
            name: 'QA Customer Status Testing',
            email: `qa-status-${uniqueId}@example.test`
        };

        const patchPayload = {
            status: 'SUSPENDED'
        };

        // ==============================================
        // STEP 2 - CREATE CUSTOMER
        // ==============================================

        const createResponse = await apiClient.post(
            '/api/customers',
            payload
        );

        expect(
            createResponse.status,
            'Create Customer HTTP Status'
        ).to.equal(201);

        const customerId = createResponse.data.id;

        expect(customerId)
            .to.be.a('number');

        expect(createResponse.data.status)
            .to.equal('ACTIVE');

        // ==============================================
        // STEP 3 - DATABASE BEFORE PATCH
        // ==============================================

        const beforeResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status,
                created_at,
                updated_at
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        expect(
            beforeResult.rowCount,
            'Customer Record Before PATCH'
        ).to.equal(1);

        const beforeCustomer = beforeResult.rows[0];

        expect(beforeCustomer.status)
            .to.equal('ACTIVE');

        expect(beforeCustomer.name)
            .to.equal(payload.name);

        expect(beforeCustomer.email)
            .to.equal(payload.email);

        // ==============================================
        // STEP 4 - SEND PATCH REQUEST
        // ==============================================

        const startTime = performance.now();

        const patchResponse = await apiClient.patch(
            `/api/customers/${customerId}/status`,
            patchPayload
        );

        const responseTime = performance.now() - startTime;

        // ==============================================
        // STEP 5 - STATUS CODE ASSERTION
        // ==============================================

        expect(
            patchResponse.status,
            'PATCH Customer HTTP Status'
        ).to.equal(200);

        // ==============================================
        // STEP 6 - RESPONSE BODY ASSERTIONS
        // ==============================================

        expect(patchResponse.data.id)
            .to.equal(customerId);

        expect(patchResponse.data.status)
            .to.equal('SUSPENDED');

        expect(patchResponse.data.name)
            .to.equal(payload.name);

        expect(patchResponse.data.email)
            .to.equal(payload.email);

        // ==============================================
        // STEP 7 - RESPONSE HEADER ASSERTIONS
        // ==============================================

        expect(
            patchResponse.headers['content-type']
        ).to.include('application/json');

        expect(
            patchResponse.headers['x-request-id']
        ).to.be.a('string').and.not.empty;

        // ==============================================
        // STEP 8 - RESPONSE TIME ASSERTION
        // ==============================================

        expect(
            responseTime,
            'PATCH API Response Time'
        ).to.be.lessThan(responseSlaMs);

        // ==============================================
        // STEP 9 - DATABASE AFTER PATCH
        // ==============================================

        const afterResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status,
                created_at,
                updated_at
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        expect(
            afterResult.rowCount,
            'Customer Record After PATCH'
        ).to.equal(1);

        const afterCustomer = afterResult.rows[0];

        // ==============================================
        // STEP 10 - STATUS SYNCHRONIZATION
        // ==============================================

        expect(afterCustomer.status)
            .to.equal('SUSPENDED');

        expect(afterCustomer.status)
            .to.equal(patchResponse.data.status);

        // ==============================================
        // STEP 11 - DATA INTEGRITY
        // ==============================================

        expect(afterCustomer.id)
            .to.equal(beforeCustomer.id);

        expect(afterCustomer.name)
            .to.equal(beforeCustomer.name);

        expect(afterCustomer.email)
            .to.equal(beforeCustomer.email);

        // created_at tidak boleh berubah
        expect(
            new Date(afterCustomer.created_at).getTime()
        ).to.equal(
            new Date(beforeCustomer.created_at).getTime()
        );

        // updated_at tidak boleh lebih lama
        expect(
            new Date(afterCustomer.updated_at).getTime()
        ).to.be.at.least(
            new Date(beforeCustomer.updated_at).getTime()
        );

        // ==============================================
        // STEP 12 - VERIFY GET API AFTER PATCH
        // ==============================================

        const getResponse = await apiClient.get(
            `/api/customers/${customerId}`
        );

        expect(
            getResponse.status,
            'GET Customer After PATCH'
        ).to.equal(200);

        expect(getResponse.data.status)
            .to.equal('SUSPENDED');

        // ==============================================
        // STEP 13 - TEST SUMMARY
        // ==============================================

        console.log('\n========== PATCH CUSTOMER STATUS ==========');
        console.log('[TEST CASE] TC-API-DB-006');
        console.log(`[CUSTOMER ID] ${customerId}`);
        console.log(`[CUSTOMER EMAIL] ${payload.email}`);
        console.log(`[STATUS BEFORE] ${beforeCustomer.status}`);
        console.log(`[STATUS AFTER] ${afterCustomer.status}`);
        console.log(`[PATCH HTTP STATUS] ${patchResponse.status}`);
        console.log(`[RESPONSE TIME] ${responseTime.toFixed(2)} ms`);
        console.log('[DATABASE VALIDATION] PASS');
        console.log('[DATA INTEGRITY] PASS');
        console.log('[GET AFTER PATCH] HTTP 200');
        console.log('[CLEANUP] DISABLED');
        console.log('==========================================');

        // ==============================================
        // STEP 14 - MOCHAWESOME TEST EVIDENCE
        // ==============================================

        addQaEvidence(this, [
            {
                title: 'API Request Information',
                value: {
                    testCaseId: 'TC-API-DB-006',
                    testType: 'POSITIVE',
                    method: 'PATCH',
                    endpoint: `/api/customers/${customerId}/status`,
                    expectedHttpStatus: 200,
                    actualHttpStatus: patchResponse.status,
                    responseTimeMs: Number(
                        responseTime.toFixed(2)
                    ),
                    responseSlaMs,
                    requestId: patchResponse.headers['x-request-id']
                }
            },
            {
                title: 'Customer Status Before and After',
                value: {
                    customerId,
                    name: beforeCustomer.name,
                    email: beforeCustomer.email,
                    statusBefore: beforeCustomer.status,
                    statusAfter: afterCustomer.status,
                    expectedStatusAfter: 'SUSPENDED',
                    createdAtBefore: beforeCustomer.created_at,
                    createdAtAfter: afterCustomer.created_at,
                    updatedAtBefore: beforeCustomer.updated_at,
                    updatedAtAfter: afterCustomer.updated_at
                }
            },
            {
                title: 'PostgreSQL Validation',
                value: {
                    database: 'qa_training_db',
                    table: 'public.customers',
                    queryFilter: 'WHERE id = $1',
                    recordsBefore: beforeResult.rowCount,
                    recordsAfter: afterResult.rowCount,
                    expectedRecordsAfter: 1,
                    statusMatched:
                        afterCustomer.status === patchResponse.data.status,
                    customerIdUnchanged:
                        afterCustomer.id === beforeCustomer.id,
                    nameUnchanged:
                        afterCustomer.name === beforeCustomer.name,
                    emailUnchanged:
                        afterCustomer.email === beforeCustomer.email,
                    createdAtUnchanged:
                        new Date(afterCustomer.created_at).getTime() ===
                        new Date(beforeCustomer.created_at).getTime(),
                    updatedAtValid:
                        new Date(afterCustomer.updated_at).getTime() >=
                        new Date(beforeCustomer.updated_at).getTime(),
                    dataSynchronization: 'PASS',
                    dataIntegrity: 'PASS'
                }
            },
            {
                title: 'Test Execution Summary',
                value: {
                    testCaseId: 'TC-API-DB-006',
                    testType: 'POSITIVE',
                    createHttpStatus: createResponse.status,
                    patchHttpStatus: patchResponse.status,
                    expectedPatchStatus: 200,
                    getAfterPatchStatus: getResponse.status,
                    expectedGetAfterPatchStatus: 200,
                    statusBefore: beforeCustomer.status,
                    statusAfter: afterCustomer.status,
                    apiValidation: 'PASS',
                    databaseValidation: 'PASS',
                    dataSynchronization: 'PASS',
                    dataIntegrity: 'PASS',
                    cleanupPolicy: 'DISABLED',
                    customerRemainsStored: true
                }
            }
        ]);

    });
});
