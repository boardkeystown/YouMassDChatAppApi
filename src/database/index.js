const mongoose = require('mongoose');
const logger = require("../logger");
mongoose.Promise = global.Promise;

async function connectToDatabase() {
    try {
        const user = process.env.DB_USER;
        const password = process.env.DB_PASS;
        const host = process.env.DB_HOST;
        // const connectionString = `mongodb+srv://${user}:${password}@${host}:${port}/${dbName}?replicaSet=${rs}`;
        const connectionString = `mongodb+srv://${user}:${password}@${host}/?retryWrites=true&w=majority`
        console.log("\n")
        console.log(connectionString)
        console.log("\n")
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 5000
        });
        logger.info('Connected to database');
    } catch (e) {
        logger.error(e);
    }
}

module.exports = connectToDatabase;

// const mongoose = require('mongoose');
// const logger = require("../logger");
// mongoose.Promise = global.Promise;

// let connectTimeout; // Store the timeout instance

// async function connectToDatabase() {
//     const user = process.env.DB_USER;
//     const password = process.env.DB_PASS;
//     const host = process.env.DB_HOST;
//     const connectionString = `mongodb+srv://${user}:${password}@${host}/?retryWrites=true&w=majority`;

//     // Use options for reconnecting to the database
//     const options = {
//         serverSelectionTimeoutMS: 300000, // 5min
//         reconnectTries: Number.MAX_VALUE, // retry indefinitely
//         reconnectInterval: 240000, // reconnect every 4 min
//     };
//     try {
//         await mongoose.connect(connectionString, options);
//         logger.info('Connected to database');
//         // Clear any previous timeout and set a new one for the desired duration
//         clearTimeout(connectTimeout);
//         connectTimeout = setTimeout(() => {
//             // Attempt to reconnect after the desired duration
//             connectToDatabase();
//         }, 60 * 60 * 1000); // 1 hour in milliseconds
//     } catch (e) {
//         logger.error(e);
//         // If connection fails, attempt to reconnect after the specified interval
//         setTimeout(() => {
//             connectToDatabase();
//         }, options.reconnectInterval);
//     }
// }

// module.exports = connectToDatabase;



