
const path = require('node:path');

// ======================================================
// REPORTPORTAL - REQUIRED ENVIRONMENT VARIABLES
// ======================================================

const requiredVariables = [
    'RP_ENDPOINT',
    'RP_PROJECT',
    'RP_LAUNCH',
    'RP_API_KEY'
];

// ======================================================
// STEP 1 - VALIDATE ENVIRONMENT CONFIGURATION
// ======================================================

for (const variable of requiredVariables) {
    const value = process.env[variable];

    if (!value || !value.trim()) {
        throw new Error(
            `[REPORTPORTAL CONFIG ERROR] ${variable} belum dikonfigurasi.`
        );
    }
}

// ======================================================
// STEP 2 - REPORTPORTAL LAUNCH METADATA
// ======================================================

const launchDescription =
    'Automated REST API and PostgreSQL Integration Regression Testing';

const launchAttributes = [
    'framework:Mocha',
    'language:TypeScript',
    'testing:API_Database',
    'database:PostgreSQL',
    'reporter:ReportPortal',
    'execution:Local'
].join(';');

// ======================================================
// STEP 3 - MOCHA + REPORTPORTAL CONFIGURATION
// ======================================================

module.exports = {

    // ==============================================
    // TEST FILE EXTENSION
    // ==============================================

    extension: ['ts'],

    // ==============================================
    // GLOBAL DATABASE HOOKS
    // ==============================================

    file: [
        path.resolve(
            __dirname,
            'src/setup/database.hooks.ts'
        )
    ],

    // ==============================================
    // INTEGRATION TEST SPECIFICATIONS
    // ==============================================

    spec: [
        path.resolve(
            __dirname,
            'src/tests/integration/**/*.spec.ts'
        )
    ],

    // ==============================================
    // TEST EXECUTION TIMEOUT
    // ==============================================

    timeout: 30000,

    // ==============================================
    // REPORTPORTAL MOCHA REPORTER
    // ==============================================

    reporter: '@reportportal/agent-js-mocha',

    // ==============================================
    // REPORTPORTAL CONNECTION & METADATA
    // ==============================================

    'reporter-option': [
        `endpoint=${process.env.RP_ENDPOINT}`,
        `apiKey=${process.env.RP_API_KEY}`,
        `project=${process.env.RP_PROJECT}`,
        `launch=${process.env.RP_LAUNCH}`,

        // Launch description
        `description=${launchDescription}`,

        // Launch attributes
        `attributes=${launchAttributes}`,

        // Reporter settings
        'mode=DEFAULT',
        'debug=false'
    ]
};
