#!/bin/bash
PI_HOST="pi@192.168.106.139"
PI_PATH="/home/pi/parking-monitor"

# Function to update SSH known hosts
update_ssh_connection() {
    echo "Cleaning up old SSH known hosts entry..."
    ssh-keygen -R $(echo $PI_HOST | cut -d@ -f2)
}

# Function to test connection
test_connection() {
    echo "Testing connection to Pi..."
    if ! ping -c 1 $(echo $PI_HOST | cut -d@ -f2) &> /dev/null; then
        echo "Cannot reach Pi at ${PI_HOST}"
        echo "Please enter new Pi IP address:"
        read new_ip
        PI_HOST="pi@${new_ip}"
        update_ssh_connection
    fi
}

# # Setup SSH key if not exists
# if [ ! -f ~/.ssh/id_rsa ]; then
#     echo "Generating SSH key..."
#     ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
# fi

# Test and update connection if needed
test_connection

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
scp docker-compose.yml parking-monitor.tar ./deployment/parking-monitor.service $PI_HOST:$PI_PATH/

echo "Deploying to Pi..."
ssh $PI_HOST "cd $PI_PATH && \
    docker compose down && \
    docker load -i parking-monitor.tar && \
    docker compose up -d && \
    sudo cp parking-monitor.service /etc/systemd/system/ && \
    sudo systemctl daemon-reload && \
    sudo systemctl enable parking-monitor && \
    sudo systemctl restart parking-monitor"

# Check statuses
echo "Checking service status..."
ssh $PI_HOST "sudo systemctl status parking-monitor"

echo "Checking Docker containers status..."
ssh $PI_HOST "cd $PI_PATH && docker compose ps"

echo "Deployment complete!"
