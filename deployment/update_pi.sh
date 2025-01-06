#!/bin/bash
PI_HOSTS=("pi@192.168.106.152" "pi@192.168.106.151" "pi@192.168.106.159" "pi@192.168.106.154")

for PI_HOST in "${PI_HOSTS[@]}"; do
    echo "Starting update for $PI_HOST..."
    ssh $PI_HOST 'sudo apt-get update && sudo apt-get full-upgrade -y && sudo apt-get autoremove -y && sudo apt-get autoclean -y && sudo reboot' &
done

# Wait for all background processes to complete
wait
echo "All updates initiated!"
