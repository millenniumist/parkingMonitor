#!/bin/bash
PI_HOSTS=("pi@192.168.106.152" "pi@192.168.106.151" "pi@192.168.106.159"  "pi@192.168.106.154"  )
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

check_docker() {
    echo "Checking Docker installation on Pi..."
    if ! ssh $PI_HOST "command -v docker > /dev/null"; then
        echo "Installing Docker on Pi..."
        ssh $PI_HOST "curl -fsSL https://get.docker.com -o get-docker.sh && \
            sudo sh get-docker.sh && \
            sudo usermod -aG docker pi"
    fi

    echo "Checking Docker Compose installation..."
    if ! ssh $PI_HOST "command -v docker-compose > /dev/null"; then
        echo "Installing Docker Compose on Pi..."
        ssh $PI_HOST "sudo apt update && sudo apt install -y docker-compose"
    fi
}

check_docker_daemon() {
    echo "Checking if Docker daemon is running..."
    if ! docker info > /dev/null 2>&1; then
        echo "Docker daemon is not running. Starting Docker..."
        open -a Docker
        # Wait for Docker to start
        while ! docker info > /dev/null 2>&1; do
            echo "Waiting for Docker to start..."
            sleep 5
        done
        echo "Docker daemon is now running"
    fi
}

verify_usb_device() {
    echo "Verifying USB device..."
    ssh $PI_HOST "sudo ls -l /dev/ttyUSB* && \
        sudo udevadm trigger && \
        sudo chmod 777 /dev/ttyUSB0 || true"
}

# Main deployment flow
for PI_HOST in "${PI_HOSTS[@]}"; do
    echo "Deploying to $PI_HOST..."
    test_connection
    ssh-copy-id -o StrictHostKeyChecking=no $PI_HOST
    check_docker
    check_docker_daemon


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
    # setup_usb_permissions
    ssh $PI_HOST "curl http://localhost:3031/reset-usb"
    sleep 1  # Allow USB device to fully initialize
    verify_usb_device
    ssh $PI_HOST "curl http://localhost:3031/clock"


    echo "Deployment complete!"
done

# New section for final key cleanup
echo "Performing final SSH key cleanup..."
for PI_HOST in "${PI_HOSTS[@]}"; do
    ssh-keygen -R $(echo $PI_HOST | cut -d@ -f2)
done
echo "SSH key cleanup completed!"