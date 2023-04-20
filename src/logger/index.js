const pino = require('pino');
const logger = pino({
    level: "info",
    timestamp: pino.stdTimeFunctions.isoTime
});
module.exports = logger;
