const SerialPortService = require('./services/serialPort');
const config = require('./config/config');

class DisplayService {
    static displayParkingFee(licensePlate, amount) {
        const formattedAmount = amount.toLocaleString('th-TH', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        const message = `${licensePlate},฿${formattedAmount}`;
        console.log('Sending to display:', message);
        SerialPortService.displayMessage(message);
    }
    

    static displayClock() {
        const now = new Date();
        const bangkokTime = new Date(now.getTime() + (config.timezoneOffset * 3600000));
        const hours = String(bangkokTime.getHours()).padStart(2, '0');
        const minutes = String(bangkokTime.getMinutes()).padStart(2, '0');
        SerialPortService.displayMessage(` ${hours}:${minutes}`);
    }
}

module.exports = DisplayService;
