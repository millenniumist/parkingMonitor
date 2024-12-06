const os = require('os');

const getSerialPort = () => {
    switch (os.platform()) {
        case 'darwin': // macOS
            return '/dev/tty.usbserial-0001';
        case 'linux':
            return '/dev/ttyUSB0';
        default:
            return '/dev/ttyUSB0';
    }
};

module.exports = {
    port: process.env.NODE_PORT || 3030,
    enabledLEDMatrix: process.env.APP_ENABLED_LED_MATRIX || true,
    serialPortFile: process.env.APP_SERIAL_PORT_FILE || getSerialPort(),
    timezoneOffset: 7,
    logPath: 'log',
    isDevelopment: process.env.NODE_ENV !== 'production'
};
