
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { expect } from 'chai';

import { apiClient } from '../../clients/apiClient.ts';
import { db } from '../../clients/postgresClient.ts';
import { addQaEvidence } from '../../utils/qaEvidence.ts';
// ======================================================
// TEST CONFIGURATION
// ======================================================

const addContext = (
    context: Parameters<typeof addQaEvidence>[0],
    section: Parameters<typeof addQaEvidence>[1][number]
): void => {
    addQaEvidence(context, [section]);
};

const responseSlaMs = Number(
    process.env.API_RESPONSE_SLA_MS || 3000
);

// ======================================================
// TEST SUITE - UPDATE CUSTOMER + POSTGRESQL
// ======================================================

describe('API + PostgreSQL - Update Customer', function () {
    this.timeout(30000);

    // ==================================================
    // TC-API-DB-004 - UPDATE CUSTOMER
    // ==================================================

    it('TC-API-DB-004 - Update Customer dan validasi PostgreSQL', async function () {

        // ==============================================
        // STEP 1 - GENERATE UNIQUE TEST DATA
        // ==============================================

        const uniqueId = randomUUID().slice(0, 12);

        const initialPayload = {
            name: 'QA Customer Before Update',
            email: `qa-before-${uniqueId}@example.test`
        };

        const updatePayload = {
            name: 'QA Customer After Update',
            email: `qa-after-${uniqueId}@example.test`
        };

        // ==============================================
        // STEP 2 - CREATE CUSTOMER
        // ==============================================

        const createResponse = await apiClient.post(
            '/api/customers',
            initialPayload
        );

        expect(createResponse.status).to.equal(201);

        const customerId = createResponse.data.id;

        expect(customerId).to.be.a('number');

        // ==============================================
        // STEP 3 - DATABASE BEFORE UPDATE
        // ==============================================

        const beforeResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status,
                updated_at
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        expect(beforeResult.rowCount).to.equal(1);

        const beforeCustomer = beforeResult.rows[0];

        expect(beforeCustomer.name)
            .to.equal(initialPayload.name);

        expect(beforeCustomer.email)
            .to.equal(initialPayload.email);

        // ==============================================
        // STEP 4 - SEND PUT UPDATE REQUEST
        // ==============================================

        const startTime = performance.now();

        const updateResponse = await apiClient.put(
            `/api/customers/${customerId}`,
            updatePayload
        );

        const responseTime = performance.now() - startTime;

        // ==============================================
        // STEP 5 - STATUS CODE ASSERTION
        // ==============================================

        expect(
            updateResponse.status,
            'Update Customer HTTP Status'
        ).to.equal(200);

        // ==============================================
        // STEP 6 - RESPONSE BODY ASSERTION
        // ==============================================

        expect(updateResponse.data.id)
            .to.equal(customerId);

        expect(updateResponse.data.name)
            .to.equal(updatePayload.name);

        expect(updateResponse.data.email)
            .to.equal(updatePayload.email);

        expect(updateResponse.data.status)
            .to.equal('ACTIVE');

        // ==============================================
        // STEP 7 - RESPONSE HEADER ASSERTION
        // ==============================================

        expect(
            updateResponse.headers['content-type']
        ).to.include('application/json');

        expect(
            updateResponse.headers['x-request-id']
        ).to.be.a('string').and.not.empty;

        // ==============================================
        // STEP 8 - RESPONSE TIME ASSERTION
        // ==============================================

        expect(
            responseTime,
            'Update API Response Time'
        ).to.be.lessThan(responseSlaMs);

        // ==============================================
        // STEP 9 - DATABASE AFTER UPDATE
        // ==============================================

        const afterResult = await db.query(
            `
            SELECT
                id,
                name,
                email,
                status,
                updated_at
            FROM public.customers
            WHERE id = $1
            `,
            [customerId]
        );

        expect(afterResult.rowCount).to.equal(1);

        const afterCustomer = afterResult.rows[0];

        // ==============================================
        // STEP 10 - DATA SYNCHRONIZATION
        // ==============================================

        expect(afterCustomer.id)
            .to.equal(updateResponse.data.id);

        expect(afterCustomer.name)
            .to.equal(updateResponse.data.name);

        expect(afterCustomer.email)
            .to.equal(updateResponse.data.email);

        expect(afterCustomer.status)
            .to.equal(updateResponse.data.status);

        // ==============================================
        // STEP 11 - VERIFY OLD DATA REPLACED
        // ==============================================

        expect(afterCustomer.name)
            .to.not.equal(beforeCustomer.name);

        expect(afterCustomer.email)
            .to.not.equal(beforeCustomer.email);

        const oldEmailResult = await db.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM public.customers
            WHERE email = $1
            `,
            [initialPayload.email]
        );

        expect(oldEmailResult.rows[0].total)
            .to.equal(0);

        // ==============================================
        // STEP 12 - VERIFY UPDATE TIMESTAMP
        // ==============================================

        expect(
            new Date(afterCustomer.updated_at).getTime()
        ).to.be.at.least(
            new Date(beforeCustomer.updated_at).getTime()
        );

        // ==============================================
        // STEP 13 - TEST RESULT
        // ==============================================

        console.log('\n========== UPDATE CUSTOMER ==========');
        console.log('[TEST CASE] TC-API-DB-004');
        console.log(`[CUSTOMER ID] ${customerId}`);
        console.log(`[BEFORE NAME] ${beforeCustomer.name}`);
        console.log(`[AFTER NAME] ${afterCustomer.name}`);
        console.log(`[BEFORE EMAIL] ${beforeCustomer.email}`);
        console.log(`[AFTER EMAIL] ${afterCustomer.email}`);
        console.log(`[RESPONSE TIME] ${responseTime.toFixed(2)} ms`);
        console.log('[HTTP STATUS] 200 OK');
        console.log('[DATABASE VALIDATION] PASS');
        console.log('[DATA SYNCHRONIZATION] PASS');
        console.log('[CLEANUP] DISABLED');
        console.log('=====================================');

        // ==============================================
        // STEP 14 - MOCHAWESOME TEST EVIDENCE
        // ==============================================

        addContext(this, {
            title: 'API Request Information',
            value: {
                testCaseId: 'TC-API-DB-004',
                method: 'PUT',
                endpoint: `/api/customers/${customerId}`,
                expectedHttpStatus: 200,
                actualHttpStatus: updateResponse.status,
                responseTimeMs: Number(responseTime.toFixed(2)),
                responseSlaMs
            }
        });

        addContext(this, {
            title: 'Customer Data Before Update',
            value: {
                id: beforeCustomer.id,
                name: beforeCustomer.name,
                email: beforeCustomer.email,
                status: beforeCustomer.status
            }
        });

        addContext(this, {
            title: 'Customer Data After Update',
            value: {
                id: afterCustomer.id,
                name: afterCustomer.name,
                email: afterCustomer.email,
                status: afterCustomer.status
            }
        });

        addContext(this, {
            title: 'Database Validation Result',
            value: {
                database: 'qa_training_db',
                table: 'public.customers',
                recordFound: afterResult.rowCount === 1,
                dataSynchronization: 'PASS',
                oldEmailReplaced: true,
                cleanup: 'DISABLED'
            }
        });

    });
});
