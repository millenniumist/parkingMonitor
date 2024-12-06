#!/bin/bash
PI_HOST="pi@192.168.68.121"
PI_PATH="/home/pi/parking-monitor"

# Setup SSH key if not exists
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "Generating SSH key..."
    ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
fi

# Copy SSH key to Pi (will ask for password only once)
ssh-copy-id -o StrictHostKeyChecking=no $PI_HOST

# Build and deploy
echo "Building Docker image..."
docker build -t parking-monitor:latest .

echo "Saving Docker image..."
docker save parking-monitor:latest > parking-monitor.tar

echo "Creating directory on Pi..."
ssh $PI_HOST "mkdir -p $PI_PATH"

echo "Copying files to Pi..."
scp docker-compose.yml parking-monitor.tar ./deployment/* $PI_HOST:$PI_PATH/

echo "Setting up systemd service..."
ssh $PI_HOST "sudo cp $PI_PATH/parking-monitor.service /etc/systemd/system/ && \
              sudo chmod +x $PI_PATH/run-pm.sh && \
              sudo systemctl daemon-reload && \
              sudo systemctl enable parking-monitor && \
              sudo systemctl restart parking-monitor"

echo "Deployment complete!"
