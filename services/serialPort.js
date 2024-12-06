const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const config = require('../config/config');

class SerialPortService {
    static configurePort() {
        if (config.isDevelopment) {
            console.log('Development mode: Serial port configuration simulated');
            return;
        }
    
        const sttyCommand = os.platform() === 'darwin' 
        ? `stty -f ${config.serialPortFile} 57600 cs8 -cstopb -parenb`
        : `stty -F ${config.serialPortFile} 57600 cs8 -cstopb -parenb`;

    exec(sttyCommand, (execErr) => {
        if (execErr) {
            console.log(`Failed to configure serial port: ${execErr.message}`);
        } else {
            console.log('Serial port configured successfully');
        }
    });
}
    
    

static checkPort() {
    return new Promise((resolve, reject) => {
        if (config.isDevelopment) {
            console.log('Development mode: Skipping serial port check');
            resolve(true);
            return;
        }

        if (!config.serialPortFile) {
            reject(new Error('Serial port path not configured'));
            return;
        }

        fs.access(config.serialPortFile, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}


    static displayMessage(message) {
        if (config.isDevelopment) {
            console.log('Display message (development):', message);
            return;
        }
        
        if (config.serialPortFile) {
            exec(`echo "${message}" > ${config.serialPortFile}`);
        }
    }
}

module.exports = SerialPortService;
