
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
// TEST SUITE - CUSTOMER PERSISTENCE
// ======================================================

describe('API + PostgreSQL - Customer Persistence', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-002 - CUSTOMER PERSISTENCE
    // ==================================================

    it('TC-API-DB-002 - Customer tetap tersimpan di PostgreSQL', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE TEST DATA
        // ==============================================

        const uniqueId = randomUUID().slice(0, 8);

        const payload = {
            name: 'QA Customer Persistence',
            email: `qa-persist-${uniqueId}@example.test`
        };

        // ==============================================
        // STEP 2 - SEND POST REQUEST
        // ==============================================

        const startTime = performance.now();

        const response = await apiClient.post(
            '/api/customers',
            payload
        );

        const responseTime = performance.now() - startTime;

        // ==============================================
        // STEP 3 - API ASSERTIONS
        // ==============================================

        expect(
            response.status,
            'Create Customer HTTP Status'
        ).to.equal(201);

        expect(response.data.id)
            .to.be.a('number');

        expect(response.data.name)
            .to.equal(payload.name);

        expect(response.data.email)
            .to.equal(payload.email);

        expect(response.data.status)
            .to.equal('ACTIVE');

        // ==============================================
        // STEP 4 - RESPONSE HEADER ASSERTIONS
        // ==============================================

        expect(
            response.headers['content-type']
        ).to.include('application/json');

        expect(
            response.headers['x-request-id']
        ).to.be.a('string').and.not.empty;

        // ==============================================
        // STEP 5 - RESPONSE TIME ASSERTION
        // ==============================================

        expect(
            responseTime,
            'Create Customer API Response Time'
        ).to.be.lessThan(responseSlaMs);

        // ==============================================
        // STEP 6 - DIRECT POSTGRESQL VALIDATION
        // ==============================================

        const result = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status,
                created_at
            FROM public.customers
            WHERE email = $1
            `,
            [payload.email]
        );

        expect(
            result.rowCount,
            'Customer Record Count'
        ).to.equal(1);

        const customer = result.rows[0];

        // ==============================================
        // STEP 7 - DATA SYNCHRONIZATION
        // ==============================================

        expect(customer.id)
            .to.equal(response.data.id);

        expect(customer.name)
            .to.equal(response.data.name);

        expect(customer.email)
            .to.equal(response.data.email);

        expect(customer.status)
            .to.equal(response.data.status);

        expect(customer.created_at)
            .to.exist;

        // ==============================================
        // STEP 8 - TEST RESULT
        // ==============================================

        console.log('\n========== CUSTOMER PERSISTENCE ==========');
        console.log('[TEST CASE] TC-API-DB-002');
        console.log('[STATUS] PASSED');
        console.log(`[RESPONSE TIME] ${responseTime.toFixed(2)} ms`);
        console.log(`[CUSTOMER ID] ${customer.id}`);
        console.log(`[CUSTOMER NAME] ${customer.name}`);
        console.log(`[CUSTOMER EMAIL] ${customer.email}`);
        console.log('[DATABASE] qa_training_db');
        console.log('[CLEANUP] DISABLED');
        console.log('==========================================');

        // ==============================================
        // STEP 9 - MOCHAWESOME TEST EVIDENCE
        // ==============================================

        addQaEvidence(this, [
            {
                title: 'API Request Information',
                value: {
                    testCaseId: 'TC-API-DB-002',
                    testType: 'POSITIVE',
                    method: 'POST',
                    endpoint: '/api/customers',
                    expectedHttpStatus: 201,
                    actualHttpStatus: response.status,
                    responseTimeMs: Number(
                        responseTime.toFixed(2)
                    ),
                    responseSlaMs,
                    requestId: response.headers['x-request-id']
                }
            },
            {
                title: 'Customer Test Data',
                value: {
                    customerId: customer.id,
                    name: customer.name,
                    email: customer.email,
                    expectedStatus: 'ACTIVE',
                    actualStatus: customer.status,
                    createdAt: customer.created_at
                }
            },
            {
                title: 'PostgreSQL Validation',
                value: {
                    database: 'qa_training_db',
                    table: 'public.customers',
                    queryFilter: 'WHERE email = $1',
                    recordCount: result.rowCount,
                    expectedRecordCount: 1,
                    customerIdMatched:
                        customer.id === response.data.id,
                    nameMatched:
                        customer.name === response.data.name,
                    emailMatched:
                        customer.email === response.data.email,
                    statusMatched:
                        customer.status === response.data.status,
                    createdAtExists:
                        customer.created_at !== null &&
                        customer.created_at !== undefined,
                    dataSynchronization: 'PASS',
                    persistenceValidation: 'PASS'
                }
            },
            {
                title: 'Test Execution Summary',
                value: {
                    testCaseId: 'TC-API-DB-002',
                    apiValidation: 'PASS',
                    databaseValidation: 'PASS',
                    dataSynchronization: 'PASS',
                    cleanupPolicy: 'DISABLED',
                    customerRemainsStored: true
                }
            }
        ]);

    });
});
