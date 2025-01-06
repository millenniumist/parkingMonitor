#!/bin/bash
PI_PATH="/home/mill/parking-monitor"

# Docker installation check
check_docker() {
    echo "Checking Docker installation..."
    if ! command -v docker > /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
    fi

    echo "Checking Docker Compose installation..."
    if ! command -v docker-compose > /dev/null; then
        echo "Installing Docker Compose..."
        sudo apt update && sudo apt install -y docker-compose
    fi
}

# Run Docker check
check_docker

# Rest of the existing script...
# Clean up existing deployment
docker compose -p pm down || true
sudo systemctl stop parking-monitor || true
sudo systemctl disable parking-monitor || true
sudo rm -f /etc/systemd/system/parking-monitor.service
sudo systemctl daemon-reload

# Deploy new version
cd $PI_PATH
docker load -i parking-monitor.tar
docker compose -p pm up -d
sudo cp parking-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable parking-monitor
sudo systemctl restart parking-monitor

# Verify USB device and setup
sudo ls -l /dev/ttyUSB*
sudo udevadm trigger
sudo chmod 777 /dev/ttyUSB0
curl http://localhost:3031/reset-usb
sleep 1
curl http://localhost:3031/clock

# Clean up
rm parking-monitor.tar
