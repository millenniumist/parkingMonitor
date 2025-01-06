#!/bin/bash
PI_HOSTS=("mill@192.168.68.119")
PI_PATH="/home/mill/parking-monitor"

# Build and save Docker image
docker build -t parking-monitor:latest .
docker save parking-monitor:latest > parking-monitor.tar

for PI_HOST in "${PI_HOSTS[@]}"; do
    # Create directory and copy files
    ssh $PI_HOST "mkdir -p $PI_PATH"
    scp docker-compose.yml parking-monitor.tar ./deployment/parking-monitor.service ./deployment/host-installation/host-operation.sh $PI_HOST:$PI_PATH/

    # Make the host operation script executable
    ssh $PI_HOST "chmod +x $PI_PATH/host-operation.sh"

    # Clean up tar file
    rm parking-monitor.tar
done
