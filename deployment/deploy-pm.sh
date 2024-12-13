#!/bin/bash
PI_HOST="pi@192.168.68.121"
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

# Function to force kill any process using port 3031
force_free_port() {
    echo "Force killing any process using port 3031..."
    ssh $PI_HOST "sudo fuser -k 3031/tcp || true && \
        sudo docker ps -q | xargs -r docker stop && \
        sudo docker system prune -f"
}

# Function to clean up existing services
cleanup_services() {
    echo "Cleaning up existing services..."
    ssh $PI_HOST "cd $PI_PATH && \
        docker compose -p pm down || true && \
        sudo systemctl stop parking-monitor || true && \
        sudo systemctl disable parking-monitor || true && \
        sudo rm -f /etc/systemd/system/parking-monitor.service && \
        sudo systemctl daemon-reload"
}

# Function to setup USB permissions
setup_usb_permissions() {
    echo "Setting up USB permissions..."
    ssh $PI_HOST "sudo usermod -a -G dialout pi && \
        sudo udevadm control --reload-rules && \
        sudo udevadm trigger && \
        for port in \$(ls /dev/ttyUSB* 2>/dev/null); do sudo chmod 777 \$port; done && \
        sudo sh -c 'echo 0 > /sys/bus/usb/devices/usb1/authorized' && \
        sleep 0.1 && \
        sudo sh -c 'echo 1 > /sys/bus/usb/devices/usb1/authorized'"
}

# Function to verify USB device
verify_usb_device() {
    echo "Verifying USB device..."
    ssh $PI_HOST "sudo ls -l /dev/ttyUSB* && \
        sudo udevadm trigger && \
        sudo chmod 777 /dev/ttyUSB0 || true"
}

# Main deployment flow
echo "Starting deployment process..."
test_connection

# Copy SSH key to Pi
ssh-copy-id -o StrictHostKeyChecking=no $PI_HOST

# Build and prepare deployment
echo "Building Docker image..."
docker build -t parking-monitor:latest .

echo "Saving Docker image..."
docker save parking-monitor:latest > parking-monitor.tar

echo "Creating directory on Pi..."
ssh $PI_HOST "mkdir -p $PI_PATH"

echo "Copying files to Pi..."
scp docker-compose.yml parking-monitor.tar ./deployment/parking-monitor.service $PI_HOST:$PI_PATH/

# Clean up existing deployment
cleanup_services
force_free_port



# Deploy new version
echo "Deploying to Pi..."
ssh $PI_HOST "cd $PI_PATH && \
    docker load -i parking-monitor.tar && \
    docker compose -p pm up -d && \
    sudo cp parking-monitor.service /etc/systemd/system/ && \
    sudo systemctl daemon-reload && \
    sudo systemctl enable parking-monitor && \
    sudo systemctl restart parking-monitor"

# Verify deployment
echo "Checking service status..."
ssh $PI_HOST "sudo systemctl status parking-monitor"

echo "Checking Docker containers status..."
ssh $PI_HOST "cd $PI_PATH && docker compose -p pm ps"

# Clean up local tar file
rm parking-monitor.tar

# Setup USB devices
setup_usb_permissions
sleep 1  # Allow USB device to fully initialize
verify_usb_device
ssh $PI_HOST "curl http://localhost:3031/clock"

echo "Deployment complete!"
