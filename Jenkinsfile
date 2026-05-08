pipeline {
    agent any

    environment {
        DOCKERHUB_USER = '1rshadullah'          // replace with your Docker Hub username
        APP_IMAGE      = "${1rshadullah}/realchat-app"
        IMAGE_TAG      = "${latest}"
        APP_URL        = 'http://localhost:3000'
    }

    stages {

        stage('Checkout') {
            steps {
                // Pull latest code from GitHub
                checkout scm
            }
        }

        stage('Start Application') {
            steps {
                // Start the app + MongoDB containers so Selenium tests have a live target
                sh 'docker-compose up -d'
                sh 'sleep 10'   // give containers time to be ready
            }
        }

        stage('Run Selenium Tests') {
            steps {
                // Pull the pre-built image (Python 3.11 + Chrome + ChromeDriver — no build needed)
                // Mount the workspace so the container can see the test files
                sh """
                    docker run --rm \
                        --network host \
                        -v \$(pwd):/app \
                        -w /app \
                        -e BASE_URL=${APP_URL} \
                        joyzoursky/python-chromedriver:py3.11 \
                        sh -c "pip install -r tests/requirements.txt -q && pytest tests/test_realchat.py -v --tb=short"
                """
            }
        }

        stage('Build App Image') {
            steps {
                sh "docker build -t ${APP_IMAGE}:${IMAGE_TAG} -t ${APP_IMAGE}:latest ."
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                        docker push ${APP_IMAGE}:${IMAGE_TAG}
                        docker push ${APP_IMAGE}:latest
                    """
                }
            }
        }

        stage('Deploy') {
            steps {
                // Pull the new image and restart only the app container (mongo keeps running)
                sh 'docker-compose pull app'
                sh 'docker-compose up -d --no-deps app'
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
        success {
            echo "Build ${BUILD_NUMBER} deployed successfully"
        }
        failure {
            sh 'docker-compose logs app || true'
            echo "Build ${BUILD_NUMBER} failed — check logs above"
        }
    }
}
