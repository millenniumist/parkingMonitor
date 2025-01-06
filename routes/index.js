const express = require("express");
const router = express.Router();
const path = require("path");
const SerialPortService = require("../services/serialPort");
const { exec } = require("child_process");
const fs = require("fs");

let persistedData = {};
let viewMode = "CLOCK";
let clockInterval;
let currentTimeout = null;
const BASE_URL = "http://localhost:3030";

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

const resetUSB = () => {
  fs.writeFileSync("/sys/bus/usb/devices/usb1/authorized", "0");
  fs.writeFileSync("/sys/bus/usb/devices/usb1/authorized", "1");
};

const handleClockDisplay = () => {
  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[date.getDay()];
    const dateNum = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${dateNum}.${month}.${dayName.slice(0, 2).toUpperCase()}`;
  };

  const displayClock = () => {
    try {
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const bangkokTime = new Date(utcTime + 3600000 * 7);

      const line1 = `${formatTime(bangkokTime)}`;
      const line2 = formatDate(bangkokTime);
      const message = `${line1},${line2}`;

      if (bangkokTime.getSeconds() === 59 && bangkokTime.getMilliseconds() < 20) {
        resetUSB();
      }

      SerialPortService.displayMessage(message, "white");
    } catch (error) {
      console.error('Clock display error:', error);
    }
  };

  displayClock();
  return setInterval(displayClock, 1000);
};

router.get("/", (req, res) => {
  try {
    clearExistingTimers();
    const { plateLetter, plateNumber, plateProvince, amount } = req.query;
    const isPlateInfoComplete = plateLetter && plateNumber && plateProvince;

    const renderData = {
      displayPlateLine1: isPlateInfoComplete ? `${plateLetter} - ${plateNumber}` : "",
      displayPlateLine2: plateProvince,
      displayFeeLine1: isPlateInfoComplete ? amount : "0.0",
    };
    res.render("index", renderData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/plateInfo", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "PLATE";
    persistedData = {
      plateLetter: req.query.plateLetter || "",
      plateNumber: req.query.plateNumber || "",
      plateProvince: req.query.plateProvince || "",
    };

    const message = `${persistedData.plateLetter}-${persistedData.plateNumber}`;
    SerialPortService.displayMessage(message);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/charges", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "CHARGE";
    persistedData = {
      plateLetter: req.query.plateLetter || "",
      plateNumber: req.query.plateNumber || "",
      plateProvince: req.query.plateProvince || "",
      amount: req.query.amount || "฿0",
    };

    const licensePlate = `${persistedData.plateLetter}${persistedData.plateNumber}`;
    const message = `${licensePlate},฿${persistedData.amount}`;
    SerialPortService.displayDynamicMessage(message);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/clock", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "CLOCK";
    persistedData = {};
    clockInterval = handleClockDisplay();
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/thankyou", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "THANK_YOU";
    
    const plateLetter = req.query.plateLetter || persistedData.plateLetter || "";
    const plateNumber = req.query.plateNumber || persistedData.plateNumber || "";
    const licensePlate = plateLetter && plateNumber ? `${plateLetter}${plateNumber}` : "";
    
    SerialPortService.displayDynamicMessage(`${licensePlate},ขอบคุณค่ะ`);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/welcome", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "WELCOME";
    
    const plateLetter = req.query.plateLetter || persistedData.plateLetter || "";
    const plateNumber = req.query.plateNumber || persistedData.plateNumber || "";
    const licensePlate = plateLetter && plateNumber ? `${plateLetter}${plateNumber}` : "";
    
    SerialPortService.displayDynamicBothLines(`${licensePlate},ยินดีต้อนรับ`);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/forbidden", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "FORBIDDEN";
    SerialPortService.displayDynamicMessage(`กรุณาติดต่อประชาสัมพันธ์,ไม่อนุญาติ`);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/blacklisted", (req, res) => {
  try {
    clearExistingTimers();
    viewMode = "BLACKLIST";
    SerialPortService.displayMessage("ไม่อนุญาติ กรุณาติดต่อเจ้่าหน้าที่");

    currentTimeout = setTimeout(() => {
      SerialPortService.displayMessage("  ติดต่อ, เจ้่าหน้าที่");
      currentTimeout = null;
    }, 30000);

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/reset-usb", (req, res) => {
  try {
    resetUSB();
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/clear", (req, res) => {
  try {
    clearExistingTimers();
    SerialPortService.clearDisplay();
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/events", (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendUpdate = () => {
      try {
        persistedData.viewMode = viewMode;
        res.write(`data: ${JSON.stringify(persistedData)}\n\n`);
      } catch (error) {
        console.error('SSE update error:', error);
      }
    };

    sendUpdate();
    const intervalId = setInterval(sendUpdate, 1000);

    req.on("close", () => {
      clearInterval(intervalId);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
