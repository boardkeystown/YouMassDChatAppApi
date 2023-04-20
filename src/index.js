// NOTE:
// Some parts of this project are borrowed snippets or
// design structure from educational resources.
// Although these probably could have been utilized better.
// Educational Resources:
// - https://github.com/WebDevSimplified/Nodejs-User-Authentication
// - https://github.com/maxim04/video-1-nodejs-jwt

const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors')
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectToDatabase = require("./database");
const path = require('path');
const bcrypt = require('bcrypt')


let refreshTokens = [];

//See .env
const DEPLOY_MODE = (process.env.DEPLOY_MODE === 'true') ? true : false;
const port = process.env.PORT || 3001;
const CLIENT_URL = (DEPLOY_MODE) ?
    process.env.CLIENT_URL_DEPLOY :
    process.env.CLIENT_URL_DEV;

// set up cross origin
app.use(cors());
app.use(express.json());

// static home page
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
    console.log(__dirname)
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

//Make the server
const server = http.createServer(app);
const maxPayloadSize = 8;//mb
const byteSize = 1024;
const io = new Server(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"],
    },
    maxHttpBufferSize: maxPayloadSize * byteSize * byteSize,
});

//account schema for mods
const jannyAccountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

app.post('/api/janny_create_account', async (req, res, next) => {
    try {
        await connectToDatabase(); // Invoke the function and wait for it to complete
        if (req.body.auth_pass !== process.env.JANNY_PASS) {
            return res.status(401).json({ message: 'Stop Being Cringe!' });
        } else {
            const db = mongoose.connection.useDb('appdata');
            // Define the User model
            const Janny = db.model('Janny', jannyAccountSchema, 'janny');
            // Query for existing user with the same name, lname, and age
            const hashedPassword = await bcrypt.hash(process.env.SALTY_SALT +
                req.body.password,
                10);
            const existingJanny = await Janny.findOne({
                name: req.body.name
            });
            if (existingJanny) {
                return res.status(401).json({ message: 'Stop Being Cringe!' });
            }
            const newJanny = new Janny({
                name: req.body.name,
                password: hashedPassword
            });
            await newJanny.save();
            res.status(201).json(
                {
                    message: 'New Janny created successfully',
                    name: req.body.name,
                });
        }
    } catch (error) {
        console.error('Failed to create janny', error);
        next(error); // Pass the error to the error handling middleware
    }
});

app.post('/api/janny_login', async (req, res, next) => {
    try {
        // Invoke the function and wait for it to complete
        // await connectToDatabase();
        const db = mongoose.connection.useDb('appdata');
        const Janny = db.model('Janny', jannyAccountSchema, 'janny');
        const existingJanny = await Janny.findOne({
            name: req.body.name
        });
        if (existingJanny) {
            const userName = await existingJanny.get("name");
            const userDBHashed = await existingJanny.get("password");
            if(await bcrypt.compare(process.env.SALTY_SALT+req.body.password, userDBHashed)) {
                const playLoad = {
                    user: userName
                };
                const AccessTokenExpires = {
                    expiresIn: '30s'
                }
                const accessToken = jwt.sign(playLoad,
                                             process.env.ACCESS_TOKEN_SECRET,
                                             AccessTokenExpires);
                const RefreshTokenExpires = {
                    expiresIn: '10m'
                }
                const refreshToken = jwt.sign(playLoad,
                                             process.env.REFRESH_TOKEN_SECRET,
                                             RefreshTokenExpires)
                // if we are already logged in then remove the current refresh
                // or should we error?
                const index = refreshTokens
                                .findIndex(item => item.user ===userName);
                if (index>=0)  {
                    refreshTokens.splice(index, 1);
                }
                refreshTokens.push({
                                    user: userName,
                                    refreshToken:refreshToken
                                  });
                return res.status(201).json({
                                            message: "Login success!",
                                            accessToken: accessToken
                                            });
            } else {
                return res.status(401).json({ message: 'Stop Being Cringe!' });
            }
        } else {
            return res.status(401).json({ message: 'Stop Being Cringe!' });
        }
    } catch (error) {
        console.error('Failed to login janny', error);
        next(error); // Pass the error to the error handling middleware
    }
});

function authenticateToken(req, res, next) {
    let headers = JSON.parse(JSON.stringify(req.headers));
    let authHeader = headers.authorization;
    try {
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) {
            return res.status(401).json({ message: 'Stop Being Cringe!' });
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
            if (err) {
                const decodedPayload = jwt.decode(token);
                // search for refresh token
                const index = refreshTokens.findIndex(item => item.user === decodedPayload.user);
                if (index < 0)  {
                    return res.status(403).json({
                        message: "Invalid Token!"
                    });
                }
                const refreshToken = refreshTokens[index].refreshToken;
                // Verify refresh token and issue new access token
                jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
                    if (err) {
                        // remove the old token
                        refreshTokens.splice(index, 1);
                        return res.status(403).json({
                            message: "Invalid Refresh Token!"
                        });
                    } else {
                        const playLoad = {
                            user: decodedPayload.user
                        };
                        const newAccessToken = jwt.sign(playLoad,
                            process.env.ACCESS_TOKEN_SECRET,
                            { expiresIn: '30s' });
                        // req.body.newAccessToken = `Bearer ${newAccessToken}`;
                        req.body.newAccessToken = `${newAccessToken}`;
                    }
                    next();
                });
            } else {
                next();
            }
        });
    } catch (err) {
        return res.status(500).json({
            message: "Internal Server Error!"
        });
    }
}


app.get('/api/get_test', authenticateToken, async (req, res) => {
    // console.log(JSON.parse(JSON.stringify(req.headers)))
    // console.log(JSON.parse(JSON.stringify(req.body)))
    const data = JSON.parse(JSON.stringify(req.body));
    return res.status(201).json({
        message: "Good!",
        newAccessToken: data.newAccessToken
    });

});


app.post('/api/remove_post', authenticateToken, async (req, res) => {
    // await connectToDatabase();
    const data = JSON.parse(JSON.stringify(req.body));
    const collectionName = routeToCollection.get(data.boardRoute) || false;
    // if we do not know the collection name
    if (collectionName===false) {
        return res.status(404).json({
            message: "Invalid board route"
        });
    }
    const db = mongoose.connection.useDb('appdata');
    const TestRoomMessages = db.model("TestRoom",messageSchema,collectionName);
    try {
        // Find the message by _id
        const message = await TestRoomMessages.findOne({ _id: data.messageID });

        if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }
        // Update the message_text field
        message.username = '[Post Removed]';
        message.message_text = '[Post Removed]';
        message.base64Data = undefined;
        // Save the updated message back to the database
        await message.save();

        return res.status(201).json({
            message: "Message updated successfully",
            newAccessToken: data.newAccessToken
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

const routeToCollection = new Map();
routeToCollection.set('/Test','testRoom');
routeToCollection.set('/Collage_Of_Engineering','collageOfEngineering');
routeToCollection.set('/CVPOOA', 'collegeOfVisualAndPooformingArts');
routeToCollection.set('/CLARTS', 'collegeOfLiberalArts');
routeToCollection.set('/CBUSS', 'collegeOfBusiness');

app.post('/api/get_message',async (req,res) => {
    // await connectToDatabase();
    const data = JSON.parse(JSON.stringify(req.body));
    const collectionName = routeToCollection.get(data.boardRoute) || false;
    if (collectionName===false) {
        return res.status(202).json({
            username: "202",
            date_sent: "",
            date_time: "",
            message_text: "ERROR FINDING MESSAGE",
            base64Data: undefined
        })
    }
    const db = mongoose.connection.useDb('appdata');
    const TestRoomMessages = db.model("TestRoom",messageSchema,collectionName);

    TestRoomMessages.findOne({ _id: data.messageID })
    .then(message => {
        if (message) {
            // console.log('Message found:', message);
            return res.status(201).json({
                username: message.username,
                date_sent: message.date_sent,
                date_time: message.date_time,
                message_text: message.message_text,
                base64Data: (message.base64Data)?message.base64Data:undefined
            })

        } else {
            return res.status(202).json({
                username: "202",
                date_sent: "",
                date_time: "",
                message_text: "ERROR FINDING MESSAGE",
                base64Data: undefined
            })
        }
    })
    .catch(error => {
        console.error('Error finding message:', error);
        return res.status(404).json({
            message: "message no found"
        })

    });

});


const messageSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    date_sent: {
        type: String,
        required: true
    },
    date_time: {
        type: String,
        required: true
    },
    message_text: {
        type: String,
        required: true
    },
    base64Data: {
        type: String,
        required: false
    }
});

async function mkRoom(route,modelName,collectionName) {
    const db = mongoose.connection.useDb('appdata');
    const testRoom = io.of(route);
    const TestRoomMessages = db.model(modelName,messageSchema,collectionName);
    testRoom.on("connection", async (socket) => {
        console.log(`User Connected: ${socket.id}\nTo ${route}`);
        try {
            // send previous messages
            const NUMBER_MEG_TO_GET = 30;
            const messages = await TestRoomMessages.find({}).sort({_id: -1})
                                   .limit(NUMBER_MEG_TO_GET).exec();
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                // console.log(msg);
                // console.log({messageID: msg._id.toString()})
                socket.emit("receive_message", {messageID: msg._id.toString()});
            }
        } catch (err) {
            console.error(err);

        }
        socket.on("send_message_force_update", (data) => {
            socket.emit("receive_message_force_update", data);
            socket.broadcast.emit("receive_message_force_update", data);
        })
        socket.on("disconnecting", (reason) => {
            console.log(`User Test Room disconnect: ${socket.id}`)
            console.log(reason)
            console.log('^^Reasons')
        });
        socket.on("send_message", (data) => {
            console.log ( {
                username: data.username,
                date_sent: data.date_sent,
                date_time: data.date_time,
                message_text: (data.message_text)?data.message_text:"",
                base64Data: (data.base64Data)?true:false
                }
            )
            // Store the sent message in the db
            const newMessages = new TestRoomMessages({
                username: data.username,
                date_sent: data.date_sent,
                date_time: data.date_time,
                message_text: (data.message_text)?data.message_text:" ",
                base64Data: (data.base64Data)?data.base64Data:undefined
            });
            newMessages.save()
            .then(savedMessage => {
                console.log("save message _id:", savedMessage._id._id.toString());
                // current_messages.push(data);
                // let sendData = {
                //     messageID: savedMessage._id._id.toString(),
                //     username: data.username,
                //     date_sent: data.date_sent,
                //     date_time: data.date_time,
                //     message_text: data.message_text,
                //     base64Data: (data.base64Data)?data.base64Data:undefined
                // }
                let sendData = {
                    messageID: savedMessage._id._id.toString()
                }
                socket.emit("receive_message", sendData);
                socket.broadcast.emit("receive_message", sendData);
            })
            .catch(error => {
                console.error("Error saving message:", error);
            });
        });
    })
}

async function startServer() {
    await connectToDatabase();

    const db = mongoose.connection.useDb('appdata');

    await mkRoom("/Test",
                 "TestRoom",
                 "testRoom");


    await mkRoom("/Collage_Of_Engineering",
                 "CollageOfEngineering",
                 "collageOfEngineering");

    await mkRoom("/CVPOOA",
                 "CollegeOfVisualAndPooformingArts",
                 "collegeOfVisualAndPooformingArts");

    await mkRoom("/CLARTS",
                 "CollegeOfLiberalArts",
                 "collegeOfLiberalArts");

    await mkRoom("/CBUSS",
                 "CollegeOfBusiness",
                 "collegeOfBusiness");

    server.listen(port, () => {
        console.log("SERVER IS RUNNING");
        console.log(`Server listening to port:${port}`);
    });


}
module.exports = startServer;

//TODO: Maybe server will have a timer to delete all 
//messages after some amount of time
/*
MyModel.countDocuments({}, (err, count) => {
  if (err) {
    console.log(err);
  } else {
    MyModel.find()
      .sort({ _id: -1 })
      .skip(30)
      .exec((err, docs) => {
        if (err) {
          console.log(err);
        } else {
          const idsToDelete = docs.map(doc => doc._id);
          MyModel.deleteMany({ _id: { $nin: idsToDelete } }, err => {
            if (err) {
              console.log(err);
            } else {
              console.log(`Deleted ${count - 30} documents.`);
            }
          });
        }
      });
  }
});
*/ 

// function intervalFunc() {
//     console.log('Cant stop me now!');
// }
// setInterval(intervalFunc, 1500);