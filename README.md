Package the application
docker build -t parking-monitor:latest .
docker save parking-monitor:latest > parking-monitor.tar

Send the image to the Raspberry Pi
scp docker-compose.yml parking-monitor.tar ./deployment pi@192.168.68.121:/home/pi/parking-monitor/

Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker pi

Install Docker Compose
sudo apt install docker-compose


Deploy the container on the Raspberry Pi
cd parking-monitor
docker compose down
docker load -i parking-monitor.tar
docker compose up -d
docker compose ps



