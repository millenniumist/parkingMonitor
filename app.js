require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const path = require('path');
const config = require('./config/config');
const routes = require('./routes');
const SerialPortService = require('./services/serialPort');

const app = express();


const getFormattedDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const accessLogStream = rfs.createStream(`access-${getFormattedDate()}.log`, {
    interval: '1d', 
    path: path.join(__dirname, config.logPath),
    compress: 'gzip',
    encoding: 'utf8'
});




accessLogStream.on('error', (err) => {
    console.error('Log stream error:', err);
});

// Add this function before setting up morgan
const decodeUrlParams = (str) => {
    try {
        return decodeURIComponent(str);
    } catch (e) {
        return str;
    }
};
const getBangkokDateTime = () => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bangkokTime = new Date(utcTime + (3600000 * 7));
    return bangkokTime.toISOString();
};

// Update the morgan format
app.use(morgan((tokens, req, res) => {
    const datetime = getBangkokDateTime();
    const status = tokens.status(req, res);
    const url = decodeUrlParams(tokens.url(req, res));
    const time = tokens['response-time'](req, res);
    
    return `${datetime} [${status}] ${url} ${time}ms`;
}, { 
    stream: accessLogStream,
    skip: (req) => req.url === '/favicon.ico'
}));


app.use(express.urlencoded({ extended: true }));
app.use(express.json());



app.set('view engine', 'ejs');
app.use('/', routes);

const server = app.listen(config.port, async () => {
    console.log(`Server running at http://localhost:${config.port}`);
    try {
        await SerialPortService.checkPort();
        SerialPortService.configurePort();
    } catch (error) {
        console.error('Serial port error:', error);
    }
});


// Graceful shutdown
const shutdown = () => {
    server.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
