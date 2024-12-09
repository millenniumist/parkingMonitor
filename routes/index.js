const express = require('express');
const router = express.Router();
const SerialPortService = require('../services/serialPort');

let persistedData = {};
let viewMode = "CLOCK";
let clockInterval;
let currentTimeout = null;  // Add this line

// Clear any existing timeouts/intervals
const clearExistingTimers = () => {
    if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
    }
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
};

const displayParkingFeeToLEDMatrix = (licensePlate, amount) => {
    const amountString = amount.toString();
    const amountWithFraction = amount.toLocaleString('th-TH', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    });
    const formattedAmount = `฿${amountWithFraction}`;
    const message = `${licensePlate},${formattedAmount}`;
    SerialPortService.displayDynamicMessage(message);
};

const updateClock = () => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const bangkokTime = new Date(utcTime + (3600000 * 7));
    
    const hours = String(bangkokTime.getHours()).padStart(2, '0');
    const minutes = String(bangkokTime.getMinutes()).padStart(2, '0');
    const seconds = String(bangkokTime.getSeconds()).padStart(2, '0');
    
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = days[bangkokTime.getDay()];
    const date = String(bangkokTime.getDate()).padStart(2, '0');
    const month = String(bangkokTime.getMonth() + 1).padStart(2, '0');

    const line1 = ` ${hours}:${minutes}:${seconds} `;
    const line2 = `${date}.${month}.${dayName.slice(0, 3)}`;
    
    const message = `${line1},${line2}`;
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
    clearExistingTimers();
    const { plateLetter, plateNumber, plateProvince, amount } = req.query;
    const isPlateInfoComplete = plateLetter && plateNumber && plateProvince;
    
    const renderData = {
        displayPlateLine1: isPlateInfoComplete ? `${plateLetter} - ${plateNumber}` : "",
        displayPlateLine2: plateProvince,
        displayFeeLine1: isPlateInfoComplete ? amount : "0.0"
    };
    res.render('index', renderData);
});

router.get('/plateInfo', (req, res) => {
    clearExistingTimers();
    viewMode = "PLATE";
    persistedData = {
        plateLetter: req.query.plateLetter || "",
        plateNumber: req.query.plateNumber || "",
        plateProvince: req.query.plateProvince || ""
    };

    const message = `${persistedData.plateLetter}-${persistedData.plateNumber}`;
    SerialPortService.displayMessage(message);
    res.status(204).end();
});

router.get('/charges', (req, res) => {
    clearExistingTimers();
    viewMode = "CHARGE";
    persistedData = {
        plateLetter: req.query.plateLetter || "",
        plateNumber: req.query.plateNumber || "",
        plateProvince: req.query.plateProvince || "",
        amount: req.query.amount || "0.0"
    };

    const licensePlate = `${persistedData.plateLetter}${persistedData.plateNumber}`;
    displayParkingFeeToLEDMatrix(licensePlate, persistedData.amount);
    res.status(204).end();
});

router.get('/clock', (req, res) => {
    clearExistingTimers();
    viewMode = "CLOCK";
    persistedData = {};
    startDisplayClockToLEDMatrix();
    res.status(204).end();
});

router.get('/thankyou', (req, res) => {
    clearExistingTimers();
    viewMode = "THANK_YOU";
    const licensePlate = persistedData.plateLetter && persistedData.plateNumber ? 
        `${persistedData.plateLetter}${persistedData.plateNumber}` : "";
    
    SerialPortService.displayMessage(`${licensePlate},ขอบคุณค่ะ`);
    res.status(204).end();
});

router.get('/blacklisted', (req, res) => {
    clearExistingTimers();
    viewMode = "BLACKLIST";
    
    SerialPortService.displayMessage("ไม่อนุญาติ คุณจอดเกิน 24 ชั่วโมง กรุณาติดต่อ หรือรอเจ้่าหน้าที่");
    
    currentTimeout = setTimeout(() => {
        SerialPortService.displayMessage("  โปรดรอ, เจ้่าหน้าที่");
        currentTimeout = null;
    }, 30000);
    
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
