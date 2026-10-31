
const path = require('node:path');
const fs = require('node:fs');

const mochaModule = require('mocha');
const Mocha = mochaModule.Mocha ?? mochaModule.default ?? mochaModule;

// ======================================================
// STEP 1 - PROJECT CONFIGURATION
// ======================================================

const projectRoot = path.resolve(__dirname, '..');

const testDirectory = path.join(
    projectRoot,
    'automation/src/tests/integration'
);

const reportDirectory = path.join(
    projectRoot,
    'reports/mochawesome'
);

// ======================================================
// STEP 2 - VALIDATE REPORTPORTAL ENVIRONMENT
// ======================================================

const requiredVariables = [
    'RP_ENDPOINT',
    'RP_PROJECT',
    'RP_LAUNCH',
    'RP_API_KEY'
];

for (const variable of requiredVariables) {
    const value = process.env[variable];

    if (!value || !value.trim()) {
        throw new Error(
            `[CONFIG ERROR] ${variable} belum dikonfigurasi.`
        );
    }
}

// ======================================================
// STEP 3 - ENABLE DUAL EVIDENCE
// ======================================================

process.env.RP_TESTING = 'true';

// ======================================================
// STEP 4 - DISCOVER INTEGRATION TESTS
// ======================================================

const testFiles = fs
    .readdirSync(testDirectory)
    .filter(file => file.endsWith('.spec.ts'))
    .sort();

if (testFiles.length === 0) {
    throw new Error(
        '[TEST ERROR] Tidak ada file integration test.'
    );
}

// ======================================================
// STEP 5 - CREATE MOCHA RUNNER
// ======================================================

const mocha = new Mocha({
    timeout: 30000,

    reporter: 'mocha-multi-reporters',

    reporterOptions: {
        // ==========================================
        // ENABLE TWO REPORTERS
        // ==========================================

        reporterEnabled:
            'mochawesome, @reportportal/agent-js-mocha',

        // ==========================================
        // MOCHAWESOME CONFIGURATION
        // ==========================================

        mochawesomeReporterOptions: {
            reportDir: reportDirectory,
            reportFilename: 'regression-report',
            html: true,
            json: true,
            overwrite: true,
            quiet: false
        },

        // ==========================================
        // REPORTPORTAL CONFIGURATION
        // ==========================================

        reportportalAgentJsMochaReporterOptions: {
            endpoint: process.env.RP_ENDPOINT,
            apiKey: process.env.RP_API_KEY,
            project: process.env.RP_PROJECT,
            launch: process.env.RP_LAUNCH,

            description:
                'Automated REST API and PostgreSQL Integration Regression Testing',

            attributes: [
                { key: 'framework', value: 'Mocha' },
                { key: 'language', value: 'TypeScript' },
                { key: 'testing', value: 'API_Database' },
                { key: 'database', value: 'PostgreSQL' },
                { key: 'reporter', value: 'Dual_Reporter' },
                { key: 'execution', value: 'Local' }
            ],

            mode: 'DEFAULT',
            debug: false
        }
    }
});

// ======================================================
// STEP 6 - REGISTER GLOBAL DATABASE HOOKS
// ======================================================

mocha.addFile(
    path.join(
        projectRoot,
        'automation/src/setup/database.hooks.ts'
    )
);

// ======================================================
// STEP 7 - REGISTER ALL INTEGRATION TESTS
// ======================================================

for (const file of testFiles) {
    mocha.addFile(
        path.join(testDirectory, file)
    );
}

// ======================================================
// STEP 8 - EXECUTE REGRESSION
// ======================================================

async function main() {
    console.log('\n========== DUAL REPORTING ==========');
    console.log('[FRAMEWORK] Mocha + TypeScript');
    console.log('[TEST TYPE] API + PostgreSQL');
    console.log(`[TEST FILES] ${testFiles.length}`);
    console.log('[REPORTERS] Mochawesome + ReportPortal');
    console.log('====================================\n');

    await mocha.loadFilesAsync();

    mocha.run(failures => {
        process.exitCode = failures > 0 ? 1 : 0;
    });
}

main().catch(error => {
    console.error('[DUAL REPORT ERROR]', error.message);
    process.exitCode = 1;
});
