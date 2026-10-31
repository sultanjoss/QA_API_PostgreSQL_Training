
const path = require('node:path');
const fs = require('node:fs');

const mochaModule = require('mocha');
const Mocha = mochaModule.Mocha ?? mochaModule.default ?? mochaModule;

// ======================================================
// 1. PROJECT CONFIGURATION
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
// 2. VALIDATE REPORTPORTAL ENVIRONMENT
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
// 3. CONFIGURE EXECUTION ENVIRONMENT
// ======================================================

process.env.RP_TESTING = 'true';

const executionEnvironment = process.env.JENKINS_URL
    ? 'Jenkins'
    : 'Local';

const buildNumber = process.env.BUILD_NUMBER;

// ======================================================
// 4. DISCOVER INTEGRATION TEST FILES
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
// 5. CONFIGURE REPORTPORTAL ATTRIBUTES
// ======================================================

const reportPortalAttributes = [
    { key: 'framework', value: 'Mocha' },
    { key: 'language', value: 'TypeScript' },
    { key: 'testing', value: 'API_Database' },
    { key: 'database', value: 'PostgreSQL' },
    { key: 'reporter', value: 'Dual_Reporter' },
    { key: 'execution', value: executionEnvironment }
];

if (executionEnvironment === 'Jenkins' && buildNumber) {
    reportPortalAttributes.push({
        key: 'buildNumber',
        value: String(buildNumber)
    });
}

// ======================================================
// 6. CREATE MOCHA RUNNER
// ======================================================

const mocha = new Mocha({
    timeout: 30000,

    reporter: 'mocha-multi-reporters',

    reporterOptions: {

        // ==========================================
        // DUAL REPORTER CONFIGURATION
        // ==========================================

        reporterEnabled:
            'mochawesome, @reportportal/agent-js-mocha',

        // ==========================================
        // MOCHAWESOME
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
        // REPORTPORTAL
        // ==========================================

        reportportalAgentJsMochaReporterOptions: {
            endpoint: process.env.RP_ENDPOINT,
            apiKey: process.env.RP_API_KEY,
            project: process.env.RP_PROJECT,
            launch: process.env.RP_LAUNCH,

            description:
                'Automated REST API and PostgreSQL Integration Regression Testing',

            attributes: reportPortalAttributes,

            mode: 'DEFAULT',
            debug: false
        }
    }
});

// ======================================================
// 7. APPLY JENKINS TEST CASE FILTER
// ======================================================

const selectedTestCase = process.env.TEST_CASE_FILTER?.trim();

const allowedTestCases = [
    'TC-API-DB-001',
    'TC-API-DB-002',
    'TC-API-DB-003',
    'TC-API-DB-004',
    'TC-API-DB-005',
    'TC-API-DB-006'
];

if (selectedTestCase) {

    if (!allowedTestCases.includes(selectedTestCase)) {
        throw new Error(
            `[FILTER ERROR] Test Case tidak dikenal: ${selectedTestCase}`
        );
    }

    // Filter by exact test case ID in the test title.
    mocha.grep(new RegExp(
        `\\b${selectedTestCase}\\b`
    ));

    console.log(`[TEST FILTER] ${selectedTestCase}`);

} else {

    console.log('[TEST FILTER] ALL TEST CASES');

}

// ======================================================
// 8. REGISTER GLOBAL DATABASE HOOKS
// ======================================================

mocha.addFile(
    path.join(
        projectRoot,
        'automation/src/setup/database.hooks.ts'
    )
);

// ======================================================
// 9. REGISTER INTEGRATION TEST FILES
// ======================================================

for (const file of testFiles) {
    mocha.addFile(
        path.join(testDirectory, file)
    );
}

// ======================================================
// 10. EXECUTE REGRESSION
// ======================================================

async function main() {

    console.log('\n========== DUAL REPORTING ==========');
    console.log('[FRAMEWORK] Mocha + TypeScript');
    console.log('[TEST TYPE] API + PostgreSQL');
    console.log(`[TEST FILES DISCOVERED] ${testFiles.length}`);
    console.log(`[TEST FILTER] ${selectedTestCase || 'ALL'}`);
    console.log('[REPORTERS] Mochawesome + ReportPortal');
    console.log(`[EXECUTION] ${executionEnvironment}`);

    if (buildNumber && executionEnvironment === 'Jenkins') {
        console.log(`[BUILD NUMBER] ${buildNumber}`);
    }

    console.log('====================================\n');

    await mocha.loadFilesAsync();

    // Reject a filter that matches zero tests.
    // Otherwise Mocha could report success with 0 passing.
    if (selectedTestCase) {
        const rootSuite = mocha.suite;
        let matchedTests = 0;

        rootSuite.eachTest(test => {
            if (mocha._grep.test(test.fullTitle())) {
                matchedTests++;
            }
        });

        if (matchedTests === 0) {
            throw new Error(
                `[FILTER ERROR] Tidak ditemukan test untuk ${selectedTestCase}`
            );
        }

        console.log(`[MATCHED TEST CASES] ${matchedTests}`);
    }

    mocha.run(failures => {
        process.exitCode = failures > 0 ? 1 : 0;
    });
}

main().catch(error => {
    console.error('[DUAL REPORT ERROR]', error.message);
    process.exitCode = 1;
});
