
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
// TEST SUITE - DELETE CUSTOMER + POSTGRESQL
// ======================================================

describe('API + PostgreSQL - Delete Customer', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-005 - DELETE CUSTOMER
    // ======================================================

    it('TC-API-DB-005 - Delete Customer dan validasi PostgreSQL', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE TEST DATA
        // ==============================================

        const uniqueId = randomUUID();

        const payload = {
            name: 'QA Customer Delete Testing',
            email: `qa-delete-${uniqueId}@example.test`
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

        expect(customerId).to.be.a('number');

        expect(createResponse.data.email)
            .to.equal(payload.email);

        console.log('\n[CREATE] Customer berhasil dibuat');
        console.log(`[CUSTOMER ID] ${customerId}`);
        console.log(`[CUSTOMER EMAIL] ${payload.email}`);

        // ==============================================
        // STEP 3 - DATABASE BEFORE DELETE
        // ==============================================

        const beforeResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        expect(
            beforeResult.rowCount,
            'Customer sebelum DELETE'
        ).to.equal(1);

        const beforeCustomer = beforeResult.rows[0];

        expect(beforeCustomer.id)
            .to.equal(customerId);

        expect(beforeCustomer.name)
            .to.equal(payload.name);

        expect(beforeCustomer.email)
            .to.equal(payload.email);

        // ==============================================
        // STEP 4 - SEND DELETE REQUEST
        // ==============================================

        const startTime = performance.now();

        const deleteResponse = await apiClient.delete(
            `/api/customers/${customerId}`
        );

        const responseTime = performance.now() - startTime;

        // ==============================================
        // STEP 5 - STATUS CODE ASSERTION
        // ==============================================

        expect(
            deleteResponse.status,
            'Delete Customer HTTP Status'
        ).to.equal(204);

        // ==============================================
        // STEP 6 - RESPONSE BODY ASSERTION
        // ==============================================

        // HTTP 204 tidak boleh mengirim response body.
        const responseBody = deleteResponse.data;

        expect(
            responseBody === '' ||
            responseBody === null ||
            responseBody === undefined
        ).to.equal(true);

        // ==============================================
        // STEP 7 - RESPONSE HEADER ASSERTION
        // ==============================================

        expect(
            deleteResponse.headers['x-request-id']
        ).to.be.a('string').and.not.empty;

        // ==============================================
        // STEP 8 - RESPONSE TIME ASSERTION
        // ==============================================

        expect(
            responseTime,
            'Delete API Response Time'
        ).to.be.lessThan(responseSlaMs);

        // ==============================================
        // STEP 9 - DATABASE AFTER DELETE
        // ==============================================

        const afterResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        // ==============================================
        // STEP 10 - VERIFY DATABASE DELETE
        // ==============================================

        expect(
            afterResult.rowCount,
            'Customer seharusnya sudah terhapus'
        ).to.equal(0);

        // ==============================================
        // STEP 11 - VERIFY API GET AFTER DELETE
        // ==============================================

        const getResponse = await apiClient.get(
            `/api/customers/${customerId}`
        );

        expect(
            getResponse.status,
            'GET Customer setelah DELETE'
        ).to.equal(404);

        // ==============================================
        // STEP 12 - TEST SUMMARY
        // ==============================================

        console.log('\n========== DELETE CUSTOMER ==========');
        console.log('[TEST CASE] TC-API-DB-005');
        console.log(`[CUSTOMER ID] ${customerId}`);
        console.log(`[CUSTOMER EMAIL] ${payload.email}`);
        console.log(`[DATABASE BEFORE] ${beforeResult.rowCount} record`);
        console.log(`[DELETE HTTP STATUS] ${deleteResponse.status}`);
        console.log(`[RESPONSE TIME] ${responseTime.toFixed(2)} ms`);
        console.log(`[DATABASE AFTER] ${afterResult.rowCount} record`);
        console.log(`[GET AFTER DELETE] HTTP ${getResponse.status}`);
        console.log('[DATABASE VALIDATION] PASS');
        console.log('[DATA CONSISTENCY] PASS');
        console.log('=====================================');

        // ==============================================
        // STEP 13 - MOCHAWESOME TEST EVIDENCE
        // ==============================================

        addQaEvidence(this, [
            {
                title: 'API Request Information',
                value: {
                    testCaseId: 'TC-API-DB-005',
                    testType: 'POSITIVE',
                    method: 'DELETE',
                    endpoint: `/api/customers/${customerId}`,
                    expectedHttpStatus: 204,
                    actualHttpStatus: deleteResponse.status,
                    responseTimeMs: Number(
                        responseTime.toFixed(2)
                    ),
                    responseSlaMs,
                    requestId: deleteResponse.headers['x-request-id']
                }
            },
            {
                title: 'Customer Before Delete',
                value: {
                    customerId: beforeCustomer.id,
                    name: beforeCustomer.name,
                    email: beforeCustomer.email,
                    status: beforeCustomer.status,
                    initialCreateHttpStatus: createResponse.status
                }
            },
            {
                title: 'PostgreSQL Validation',
                value: {
                    database: 'qa_training_db',
                    table: 'public.customers',
                    queryFilter: 'WHERE id = $1',
                    customerId,
                    recordsBefore: beforeResult.rowCount,
                    recordsAfter: afterResult.rowCount,
                    expectedRecordsAfter: 0,
                    customerRemoved:
                        afterResult.rowCount === 0,
                    deleteValidation: 'PASS'
                }
            },
            {
                title: 'Test Execution Summary',
                value: {
                    testCaseId: 'TC-API-DB-005',
                    testType: 'POSITIVE',
                    createHttpStatus: createResponse.status,
                    deleteHttpStatus: deleteResponse.status,
                    expectedDeleteStatus: 204,
                    responseBodyEmpty:
                        responseBody === '' ||
                        responseBody === null ||
                        responseBody === undefined,
                    getAfterDeleteStatus: getResponse.status,
                    expectedGetAfterDeleteStatus: 404,
                    apiValidation: 'PASS',
                    databaseValidation: 'PASS',
                    dataConsistency: 'PASS',
                    cleanupPolicy: 'DELETE IS THE TEST ACTION'
                }
            }
        ]);

    });
});
