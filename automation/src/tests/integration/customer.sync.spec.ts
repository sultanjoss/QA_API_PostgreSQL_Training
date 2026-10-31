
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
// TEST SUITE - API + POSTGRESQL INTEGRATION
// ======================================================

describe('API + PostgreSQL Integration Testing', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-001 - CREATE CUSTOMER
    // ==================================================

    it('TC-API-DB-001 - Create Customer dan validasi PostgreSQL', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE TEST DATA
        // ==============================================

        const uniqueId = randomUUID().slice(0, 8);

        const payload = {
            name: 'QA Automation Testing',
            email: `qa-${uniqueId}@example.test`
        };

        let customerId: number | undefined;

        try {

            // ==========================================
            // STEP 2 - SEND API REQUEST
            // ==========================================

            const startTime = performance.now();

            const response = await apiClient.post(
                '/api/customers',
                payload
            );

            const responseTime = performance.now() - startTime;

            console.log(
                `[API] Response Time: ${responseTime.toFixed(2)} ms`
            );

            // ==========================================
            // STEP 3 - SAVE CUSTOMER ID
            // ==========================================

            if (
                Number.isSafeInteger(response.data?.id) &&
                response.data.id > 0
            ) {
                customerId = response.data.id;
            }

            // ==========================================
            // STEP 4 - STATUS CODE ASSERTION
            // ==========================================

            expect(response.status).to.equal(201);

            // ==========================================
            // STEP 5 - RESPONSE BODY ASSERTIONS
            // ==========================================

            expect(response.data.id)
                .to.be.a('number');

            expect(response.data.name)
                .to.equal(payload.name);

            expect(response.data.email)
                .to.equal(payload.email);

            expect(response.data.status)
                .to.equal('ACTIVE');

            // ==========================================
            // STEP 6 - RESPONSE HEADER ASSERTIONS
            // ==========================================

            expect(
                response.headers['content-type']
            ).to.include('application/json');

            expect(
                response.headers['x-request-id']
            ).to.be.a('string').and.not.empty;

            // ==========================================
            // STEP 7 - RESPONSE TIME ASSERTION
            // ==========================================

            expect(responseTime)
                .to.be.lessThan(responseSlaMs);

            // ==========================================
            // STEP 8 - DIRECT POSTGRESQL VALIDATION
            // ==========================================

            const result = await db.query(
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

            expect(result.rowCount).to.equal(1);

            const customer = result.rows[0];

            expect(customer.id)
                .to.equal(response.data.id);

            expect(customer.name)
                .to.equal(response.data.name);

            expect(customer.email)
                .to.equal(response.data.email);

            expect(customer.status)
                .to.equal(response.data.status);

            console.log('[TEST] API Validation: PASS');
            console.log('[TEST] Database Validation: PASS');
            console.log('[TEST] Data Synchronization: PASS');

            // ==========================================
            // STEP 9 - MOCHAWESOME TEST EVIDENCE
            // ==========================================

            addQaEvidence(this, [
                {
                    title: 'API Request Information',
                    value: {
                        testCaseId: 'TC-API-DB-001',
                        method: 'POST',
                        endpoint: '/api/customers',
                        expectedHttpStatus: 201,
                        actualHttpStatus: response.status,
                        responseTimeMs: Number(
                            responseTime.toFixed(2)
                        ),
                        responseSlaMs
                    }
                },
                {
                    title: 'Customer Test Data',
                    value: {
                        customerId,
                        name: payload.name,
                        email: payload.email,
                        expectedStatus: 'ACTIVE',
                        actualStatus: response.data.status
                    }
                },
                {
                    title: 'PostgreSQL Validation',
                    value: {
                        database: 'qa_training_db',
                        table: 'public.customers',
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
                        dataSynchronization: 'PASS'
                    }
                },
                {
                    title: 'Test Execution Summary',
                    value: {
                        testType: 'POSITIVE',
                        apiValidation: 'PASS',
                        databaseValidation: 'PASS',
                        dataSynchronization: 'PASS',
                        cleanupPolicy: 'ENABLED',
                        cleanupAction: 'DELETE /api/customers/:id'
                    }
                }
            ]);

        } finally {

            // ==========================================
            // STEP 10 - CLEANUP TEST DATA
            // ==========================================

            if (customerId !== undefined) {

                const cleanup = await apiClient.delete(
                    `/api/customers/${customerId}`
                );

                console.log(
                    `[CLEANUP] HTTP ${cleanup.status}`
                );

                expect(cleanup.status).to.equal(204);
            }
        }
    });
});
