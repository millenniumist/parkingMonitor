const express = require("express");
const router = express.Router();
const path = require("path");
const SerialPortService = require("../services/serialPort");
const { exec } = require("child_process");
const fs = require("fs");

let persistedData = {};
let viewMode = "CLOCK";
let clockInterval;
let currentTimeout = null; // Add this line
const BASE_URL = "http://localhost:3030";

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
    return `${dateNum}.${month}.${dayName.slice(0, 3)}`;
  };

  const displayClock = () => {
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
  };

  // Initial display
  displayClock();

  // Set up interval
  return setInterval(displayClock, 1000);
};

router.get("/", (req, res) => {
  clearExistingTimers();
  const { plateLetter, plateNumber, plateProvince, amount } = req.query;
  const isPlateInfoComplete = plateLetter && plateNumber && plateProvince;

  const renderData = {
    displayPlateLine1: isPlateInfoComplete ? `${plateLetter} - ${plateNumber}` : "",
    displayPlateLine2: plateProvince,
    displayFeeLine1: isPlateInfoComplete ? amount : "0.0",
  };
  res.render("index", renderData);
});

router.get("/plateInfo", (req, res) => {
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
});

router.get("/charges", (req, res) => {
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
});

router.get("/clock", (req, res) => {
  clearExistingTimers();
  viewMode = "CLOCK";
  persistedData = {};
  clockInterval = handleClockDisplay();
  res.status(204).end();
});

router.get("/thankyou", (req, res) => {
  clearExistingTimers();
  viewMode = "THANK_YOU";
  const licensePlate =
    persistedData.plateLetter && persistedData.plateNumber
      ? `${persistedData.plateLetter}${persistedData.plateNumber}`
      : "";
  SerialPortService.displayDynamicMessage(`${licensePlate},ขอบคุณค่ะ`);
  res.status(204).end();
});

router.get("/welcome", (req, res) => {
  clearExistingTimers();
  viewMode = "WELCOME";
  const licensePlate =
    persistedData.plateLetter && persistedData.plateNumber
      ? `${persistedData.plateLetter}${persistedData.plateNumber}`
      : "";
  SerialPortService.displayDynamicBothLines(`${licensePlate},ยินดีต้อนรับ`);;
  res.status(204).end();
});



router.get("/blacklisted", (req, res) => {
  clearExistingTimers();
  viewMode = "BLACKLIST";
  SerialPortService.displayMessage(
    "ไม่อนุญาติ คุณจอดเกิน 24 ชั่วโมง กรุณาติดต่อ หรือรอเจ้่าหน้าที่"
  );

  currentTimeout = setTimeout(() => {
    SerialPortService.displayMessage("  โปรดรอ, เจ้่าหน้าที่");
    currentTimeout = null;
  }, 30000);

  res.status(204).end();
});

router.get("/reset-usb", (req, res) => {
    resetUSB();
    res.status(204).end();
});

router.get("/clear", (req, res) => {
  try {
    clearExistingTimers();
    SerialPortService.clearDisplay();
  } catch (error) {
    console.error("Error clearing display:", error);
  }
  res.status(204).end();
});

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendUpdate = () => {
    persistedData.viewMode = viewMode;
    res.write(`data: ${JSON.stringify(persistedData)}\n\n`);
  };

  sendUpdate();
  const intervalId = setInterval(sendUpdate, 1000);

  req.on("close", () => {
    clearInterval(intervalId);
  });
});

module.exports = router;
