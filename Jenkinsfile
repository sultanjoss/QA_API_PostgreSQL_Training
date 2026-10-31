
pipeline {

    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    // ==========================================
    // AUTOMATIC TRIGGERS
    // ==========================================

    triggers {
        pollSCM('H/5 * * * *')
        cron('TZ=Asia/Jakarta\n0 1 * * *')
    }

    // ==========================================
    // MANUAL BUILD PARAMETERS
    // ==========================================

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
            description: 'Test case yang dijalankan'
        )
    }

    // ==========================================
    // ENVIRONMENT
    // ==========================================

    environment {
        PATH = "/opt/homebrew/bin:/opt/homebrew/sbin:${env.PATH}"

        API_BASE_URL = 'http://127.0.0.1:3000'
        API_RESPONSE_SLA_MS = '3000'

        PGHOST = '127.0.0.1'
        PGPORT = '5433'
        PGDATABASE = 'qa_training_db'
        PGUSER = 'qa_training'

        RP_ENDPOINT = 'http://127.0.0.1:8080/api/v1'
        RP_PROJECT = 'mobile_automation_testing'
        RP_LAUNCH = 'API_PostgreSQL_Regression'
    }

    stages {

        stage('Checkout Staging') {
            steps {
                deleteDir()
                checkout scm

                sh '''
                    set -eu
                    git log -1 --oneline
                    test -f package.json
                    test -f automation/run-dual-report.cjs
                '''
            }
        }

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu
                    node --version
                    npm --version
                    echo "[ENVIRONMENT] READY"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Service Health Check') {
            steps {
                sh '''
                    set -eu

                    curl -fsS "$API_BASE_URL/health"

                    echo ""
                    echo "[API] HEALTHY"
                '''
            }
        }

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

                        # The existing npm script uses --env-file=.env.
                        # Environment variables from Jenkins take precedence.
                        touch .env
                        chmod 600 .env

                        # No report from an earlier execution.
                        rm -rf reports/mochawesome

                        echo "===== REGRESSION ====="
                        echo "TEST CASE: $TEST_CASE"

                        if [ "$TEST_CASE" = "ALL" ]; then
                            unset TEST_CASE_FILTER
                        else
                            export TEST_CASE_FILTER="$TEST_CASE"
                        fi

                        npm run test:all-report
                    '''
                }
            }
        }

        stage('Verify Test Report') {
            steps {
                sh '''
                    test -f reports/mochawesome/regression-report.json
                    test -f reports/mochawesome/regression-report.html
                    echo "[REPORT] READY"
                '''
            }
        }
    }

    post {
        always {
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

            sh 'rm -f .env'
        }

        success {
            echo '[JENKINS] REGRESSION SUCCESS'
        }

        failure {
            echo '[JENKINS] REGRESSION FAILED'
        }
    }
}
