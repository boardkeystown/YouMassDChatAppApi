require('dotenv').config();
const startServer = require('./src');
startServer().catch(err => {
    console.error(err);
    process.exit(1);
});