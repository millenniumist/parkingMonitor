#!/bin/bash
echo 0 > /sys/bus/usb/devices/usb1/authorized
sleep 2
echo 1 > /sys/bus/usb/devices/usb1/authorized
chmod 777 /dev/ttyUSB*
