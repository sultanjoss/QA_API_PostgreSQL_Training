
pipeline {

    // ==================================================
    // 1. JENKINS EXECUTION AGENT
    // ==================================================

    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    // ==================================================
    // 2. AUTOMATIC BUILD TRIGGERS
    // ==================================================

    triggers {

        // Check GitHub staging for changes every ~5 minutes
        pollSCM('H/5 * * * *')

        // Nightly regression at 21:00 WIB
        cron('TZ=Asia/Jakarta\n0 21 * * *')
    }

    // ==================================================
    // 3. MANUAL BUILD PARAMETERS
    // ==================================================

    parameters {
        choice(
            name: 'TEST_CASE',
            choices: [
                'ALL',
                'TC-API-DB-001',
                'TC-API-DB-002',
                'TC-API-DB-003',
                'TC-API-DB-004',
                'TC-API-DB-005',
                'TC-API-DB-006'
            ],
            description: 'Select test case to execute'
        )
    }

    // ==================================================
    // 4. ENVIRONMENT CONFIGURATION
    // ==================================================

    environment {

        // macOS Homebrew
        PATH = "/opt/homebrew/bin:/opt/homebrew/sbin:${env.PATH}"

        // Express REST API
        API_BASE_URL = 'http://127.0.0.1:3000'
        API_RESPONSE_SLA_MS = '3000'

        // PostgreSQL Database
        PGHOST = '127.0.0.1'
        PGPORT = '5433'
        PGDATABASE = 'qa_training_db'
        PGUSER = 'qa_training'

        // ReportPortal
        RP_ENDPOINT = 'http://127.0.0.1:8080/api/v1'
        RP_PROJECT = 'mobile_automation_testing'
        RP_LAUNCH = 'API_PostgreSQL_Regression'
    }

    // ==================================================
    // 5. PIPELINE STAGES
    // ==================================================

    stages {

        // ==============================================
        // STAGE 1 - CHECKOUT GITHUB STAGING
        // ==============================================

        stage('Checkout Staging') {
            steps {

                deleteDir()
                checkout scm

                sh '''
                    set -eu

                    echo "===== GITHUB CHECKOUT ====="
                    git log -1 --oneline

                    echo "===== SOURCE VALIDATION ====="
                    test -f package.json
                    test -f automation/run-dual-report.cjs

                    echo "[CHECKOUT] READY"
                '''
            }
        }

        // ==============================================
        // STAGE 2 - ENVIRONMENT CHECK
        // ==============================================

        stage('Environment Check') {
            steps {

                sh '''
                    set -eu

                    echo "===== NODE.JS ====="
                    node --version

                    echo "===== NPM ====="
                    npm --version

                    echo "===== JENKINS BUILD ====="
                    echo "Job: $JOB_NAME"
                    echo "Build: $BUILD_NUMBER"

                    echo "[ENVIRONMENT] READY"
                '''
            }
        }

        // ==============================================
        // STAGE 3 - INSTALL DEPENDENCIES
        // ==============================================

        stage('Install Dependencies') {
            steps {

                sh '''
                    set -eu

                    echo "===== INSTALL DEPENDENCIES ====="
                    npm ci

                    echo "[DEPENDENCIES] READY"
                '''
            }
        }

        // ==============================================
        // STAGE 4 - SERVICE HEALTH CHECK
        // ==============================================

        stage('Service Health Check') {
            steps {

                sh '''
                    set -eu

                    echo "===== EXPRESS API HEALTH ====="

                    curl --fail --silent --show-error \
                        "$API_BASE_URL/health"

                    echo ""
                    echo "[API] HEALTHY"
                '''
            }
        }

        // ==============================================
        // STAGE 5 - API + POSTGRESQL REGRESSION
        // ==============================================

        stage('API PostgreSQL Regression') {
            steps {

                withCredentials([

                    string(
                        credentialsId: 'qa-postgres-password',
                        variable: 'DB_PASSWORD'
                    ),

                    string(
                        credentialsId: 'qa-reportportal-api-key',
                        variable: 'RP_API_KEY'
                    )

                ]) {

                    sh '''
                        set -eu

                        # ----------------------------------
                        # Resolve Test Case Parameter
                        # ----------------------------------

                        SELECTED_TEST_CASE="${TEST_CASE:-ALL}"

                        echo "===== REGRESSION CONFIGURATION ====="
                        echo "Selected TC: $SELECTED_TEST_CASE"

                        # ----------------------------------
                        # Prepare Environment
                        # ----------------------------------

                        # Required by npm --env-file=.env
                        # Jenkins credentials take precedence
                        touch .env
                        chmod 600 .env

                        # Remove previous regression reports
                        rm -rf reports/mochawesome

                        # ----------------------------------
                        # Apply Test Case Filter
                        # ----------------------------------

                        if [ "$SELECTED_TEST_CASE" = "ALL" ]; then

                            unset TEST_CASE_FILTER

                            echo "[FILTER] ALL TEST CASES"

                        else

                            export TEST_CASE_FILTER="$SELECTED_TEST_CASE"

                            echo "[FILTER] $TEST_CASE_FILTER"

                        fi

                        # ----------------------------------
                        # Execute Dual Reporting
                        # ----------------------------------

                        echo "===== EXECUTE REGRESSION ====="

                        npm run test:all-report

                        echo "[REGRESSION] EXECUTION COMPLETED"
                    '''
                }
            }
        }

        // ==============================================
        // STAGE 6 - VERIFY TEST REPORT
        // ==============================================

        stage('Verify Test Report') {
            steps {

                sh '''
                    set -eu

                    echo "===== VERIFY MOCHAWESOME REPORT ====="

                    test -f reports/mochawesome/regression-report.json
                    test -f reports/mochawesome/regression-report.html

                    echo "[REPORT] READY"
                '''
            }
        }
    }

    // ==================================================
    // 6. POST BUILD ACTIONS
    // ==================================================

    post {

        always {

            // ------------------------------------------
            // Publish Mochawesome HTML and JSON
            // ------------------------------------------

            script {

                if (fileExists('reports/mochawesome/regression-report.html')) {

                    publishHTML(target: [
                        reportName: 'API PostgreSQL Mochawesome',
                        reportDir: 'reports/mochawesome',
                        reportFiles: 'regression-report.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true,
                        allowMissing: false
                    ])

                    archiveArtifacts(
                        artifacts: 'reports/mochawesome/**/*',
                        allowEmptyArchive: false
                    )
                }
            }

            // ------------------------------------------
            // Cleanup Temporary Environment File
            // ------------------------------------------

            sh '''
                rm -f .env
                echo "[CLEANUP] COMPLETED"
            '''
        }

        success {
            echo '[JENKINS] API PostgreSQL Regression PASSED'
        }

        failure {
            echo '[JENKINS] API PostgreSQL Regression FAILED'
        }
    }
}
