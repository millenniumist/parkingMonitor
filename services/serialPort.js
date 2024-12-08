const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const config = require('../config/config');

class SerialPortService {

    static currentInterval = null;
    static SCROLL_DELAY = 150; // Faster scroll speed (was 300)
    static DISPLAY_WIDTH = 10;
    static PADDING = '     '; // More padding for smoother transition

    static displayMessage(message) {
        this.stopDynamic(); // Stop any existing dynamic display
        if (config.isDevelopment) {
            console.log('Display message (development):', message);
            return;
        }
        
        if (config.serialPortFile) {
            exec(`echo "${message}" > ${config.serialPortFile}`);
        }
    }

    static displayDynamicMessage(message) {
        this.stopDynamic(); // Stop any existing dynamic display
        
        if (config.isDevelopment) {
            console.log('Display dynamic message (development):', message);
            return;
        }

        let position = 0;
        this.currentInterval = setInterval(() => {
            const [line1, line2] = message.split(',');
            const shiftedLine1 = this.shiftText(line1, position);
            const shiftedLine2 = line2 ? this.shiftText(line2, position) : '';
            const displayMessage = line2 ? `${shiftedLine1},${shiftedLine2}` : shiftedLine1;
            
            if (config.serialPortFile) {
                exec(`echo "${displayMessage}" > ${config.serialPortFile}`);
            }
            
            position = (position + 1) % (line1.length + this.PADDING.length);
        }, this.SCROLL_DELAY);
    }

    static shiftText(text, position) {
        const paddedText = text + this.PADDING + text;
        return paddedText.substring(position, position + this.DISPLAY_WIDTH);
    }

    static stopDynamic() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    }

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

}

module.exports = SerialPortService;
