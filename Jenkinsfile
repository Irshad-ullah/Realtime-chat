pipeline {
    agent any

    environment {
        REPO_URL = 'https://github.com/Irshad-ullah/Realtime-chat.git'
        APP_URL = 'http://app:3000'
        PROJECT_DIR = 'Realtime-chat'
    }

    stages {

        stage('Clone Repository') {
            steps {
                sh '''
                    rm -rf ${PROJECT_DIR} || true
                    git clone ${REPO_URL}
                '''
            }
        }

        stage('Start Application') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}

                    docker compose down -v || true
                    docker compose up -d

                    echo "Waiting for app to be ready..."

                    until curl -s http://localhost:3000 > /dev/null; do
                        echo "Still waiting..."
                        sleep 3
                    done

                    echo "App is ready!"
                '''
            }
        }

        stage('Verify App') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}
                    docker compose ps
                    curl -f http://localhost:3000
                '''
            }
        }

        stage('Run Selenium Tests') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}

                    docker run --rm \
                        --network realtime-chat_default \
                        -v $(pwd):/app \
                        -w /app \
                        -e BASE_URL=${APP_URL} \
                        joyzoursky/python-chromedriver:3.9-alpine \
                        sh -c "pip install -r tests/requirements.txt -q && pytest tests/test_realchat.py -v --tb=short"
                '''
            }
        }

        stage('Done') {
            steps {
                echo "✅ Pipeline completed successfully!"
            }
        }
    }

    post {
        failure {
            sh '''
                cd ${PROJECT_DIR}
                docker compose logs --tail=50 || true
            '''
        }
    }
