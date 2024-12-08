#!/bin/bash
set -e  # Exit on error

# Configuration
PI_HOST="pi@192.168.68.121"
PI_PATH="/home/pi/parking-monitor"
IMAGE_NAME="parking-monitor:latest"
TAR_FILE="parking-monitor.tar"

# SSH key setup
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "Generating SSH key..."
    ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa || { echo "Failed to generate SSH key"; exit 1; }
fi

# Copy SSH key
ssh-copy-id -o StrictHostKeyChecking=no $PI_HOST || { echo "Failed to copy SSH key"; exit 1; }

# Build and save
echo "Building Docker image..."
docker build -t $IMAGE_NAME . || { echo "Docker build failed"; exit 1; }

echo "Saving Docker image..."
docker save $IMAGE_NAME > $TAR_FILE || { echo "Failed to save Docker image"; exit 1; }

# Deploy
echo "Creating directory and copying files..."
ssh $PI_HOST "mkdir -p $PI_PATH" || { echo "Failed to create directory"; exit 1; }
scp docker-compose.yml $TAR_FILE ./deployment/parking-monitor.service $PI_HOST:$PI_PATH/ || { echo "Failed to copy files"; exit 1; }

echo "Deploying to Pi..."
ssh $PI_HOST "cd $PI_PATH && \
    docker compose down && \
    docker load -i $TAR_FILE && \
    docker compose up -d && \
    sudo cp parking-monitor.service /etc/systemd/system/ && \
    sudo systemctl daemon-reload && \
    sudo systemctl enable parking-monitor && \
    sudo systemctl restart parking-monitor" || { echo "Deployment failed"; exit 1; }

# Status checks
echo "Checking service status..."
ssh $PI_HOST "sudo systemctl status parking-monitor"
echo "Checking Docker containers status..."
ssh $PI_HOST "cd $PI_PATH && docker compose ps"

# Cleanup
ssh $PI_HOST "cd $PI_PATH && rm $TAR_FILE"
rm $TAR_FILE

echo "Deployment complete!"
