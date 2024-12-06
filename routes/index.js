const express = require('express');
const router = express.Router();
const SerialPortService = require('../services/serialPort');

let persistedData = {};
let viewMode = "CLOCK";
let clockInterval;

const displayParkingFeeToLEDMatrix = (licensePlate, amount) => {
    const amountString = amount.toString();
    const amountWithFraction = amount.toLocaleString('th-TH', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    });
    const formattedAmount = `฿${amountWithFraction}`;
    const message = `${licensePlate},${formattedAmount}`;
    SerialPortService.displayMessage(message);
};

const updateClock = () => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const bangkokTime = new Date(utcTime + (3600000 * 7));
    
    const hours = String(bangkokTime.getHours()).padStart(2, '0');
    const minutes = String(bangkokTime.getMinutes()).padStart(2, '0');
    const message = ` ${hours}:${minutes}`;
    
    SerialPortService.displayMessage(message);
};

const startDisplayClockToLEDMatrix = () => {
    if (!clockInterval) {
        updateClock();
        clockInterval = setInterval(updateClock, 1000);
    }
};

const stopDisplayClockToLEDMatrix = () => {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
};

router.get('/', (req, res) => {
    console.log('Received index request:', req.query); // Add this debug log
    const { plateLetter, plateNumber, plateProvince, amount } = req.query;
    const isPlateInfoComplete = plateLetter && plateNumber && plateProvince;
    console.log('Is plate info complete:', isPlateInfoComplete); // Add this debug log

    const renderData = {
        displayPlateLine1: isPlateInfoComplete ? `${plateLetter} - ${plateNumber}` : "",
        displayPlateLine2: plateProvince,
        displayFeeLine1: isPlateInfoComplete ? amount : "0.0"
    };
    console.log('Rendering with data:', renderData); // Add this debug log
    res.render('index', renderData);
});


router.get('/plateInfo', (req, res) => {
    console.log('Received plateInfo request:', req.query); // Add this debug log
    viewMode = "PLATE";
    persistedData = {
        plateLetter: req.query.plateLetter || "",
        plateNumber: req.query.plateNumber || "",
        plateProvince: req.query.plateProvince || ""
    };
    console.log('Persisted data:', persistedData); // Add this debug log

    const message = `${persistedData.plateLetter}-${persistedData.plateNumber}`;
    console.log('Sending message:', message); // Add this debug log
    stopDisplayClockToLEDMatrix();
    SerialPortService.displayMessage(message);
    res.status(204).end();
});


router.get('/charges', (req, res) => {
    viewMode = "CHARGE";
    persistedData = {
        plateLetter: req.query.plateLetter || "",
        plateNumber: req.query.plateNumber || "",
        plateProvince: req.query.plateProvince || "",
        amount: req.query.amount || "0.0"
    };

    const licensePlate = `${persistedData.plateLetter}-${persistedData.plateNumber}`;
    stopDisplayClockToLEDMatrix();
    displayParkingFeeToLEDMatrix(licensePlate, persistedData.amount);
    res.status(204).end();
});

router.get('/clock', (req, res) => {
    viewMode = "CLOCK";
    persistedData = {};
    startDisplayClockToLEDMatrix();
    res.status(204).end();
});

router.get('/thankyou', (req, res) => {
    viewMode = "THANK_YOU";
    persistedData = {};
    stopDisplayClockToLEDMatrix();
    SerialPortService.displayMessage("ขอบคุณที่ใช้บริการ");
    res.status(204).end();
});

router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendUpdate = () => {
        persistedData.viewMode = viewMode;
        res.write(`data: ${JSON.stringify(persistedData)}\n\n`);
    };

    sendUpdate();
    const intervalId = setInterval(sendUpdate, 1000);

    req.on('close', () => {
        clearInterval(intervalId);
    });
});

module.exports = router;
