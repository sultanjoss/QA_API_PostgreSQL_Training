
import { createRequire } from 'node:module';
import type { Context } from 'mocha';

// ======================================================
// QA EVIDENCE - DUAL REPORTING
// ======================================================

const require = createRequire(import.meta.url);

const addContext = require('mochawesome/addContext');

const PublicReportingAPI = require(
    '@reportportal/agent-js-mocha/lib/publicReportingAPI'
);

// ======================================================
// EVIDENCE TYPES
// ======================================================

type EvidenceSection = {
    title: string;
    value: Record<string, unknown>;
};

// ======================================================
// REPORTING MODE
// ======================================================

const isReportPortal = process.env.RP_TESTING === 'true';

// ======================================================
// REUSABLE QA EVIDENCE HELPER
// ======================================================

export function addQaEvidence(
    context: Context,
    sections: EvidenceSection[]
): void {

    for (const section of sections) {

        // ==========================================
        // 1. MOCHAWESOME EVIDENCE
        // ==========================================

        addContext(context, {
            title: section.title,
            value: section.value
        });

        // ==========================================
        // 2. REPORTPORTAL EVIDENCE
        // ==========================================

        if (isReportPortal) {

            const formattedEvidence = JSON.stringify(
                section.value,
                null,
                2
            );

            PublicReportingAPI.info(
                `${section.title}\n${formattedEvidence}`
            );
        }
    }
}
