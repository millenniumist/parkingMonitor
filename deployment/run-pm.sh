#!/bin/bash

# Stop and remove the containers
docker compose down

# Load the Docker image
docker load -i parking-monitor.tar

# Start the containers in detached mode
docker compose up -d

# Display the status of the containers
docker compose ps
