// server/server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");


const app = express();
const server = http.createServer(app);

/*
  Socket.IO configuration
*/

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },

  transports: ["websocket", "polling"],

  maxHttpBufferSize: 20 * 1024 * 1024,

  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

/*
  Connected users tracker
*/

const users = new Map();

/*
  Multer setup (for HTTP upload)
*/

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  }
});

/*
  Client connection handler
*/

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);
  console.log("Total clients:", io.engine.clientsCount);

  socket.onAny((event) => {
    console.log("Event:", event);
  });

  const memInterval = setInterval(() => {
    const used = process.memoryUsage();

    console.log(
      "Memory MB:",
      Math.round(used.heapUsed / 1024 / 1024)
    );

  }, 10000);

  /*
    USER JOIN
  */

  socket.on("user:join", ({ name }) => {
    users.set(socket.id, { name, joinedAt: new Date() });
    io.emit("users:update", Array.from(users.values()));
  });

  /*
    USER TYPING
  */

  socket.on("user:typing", ({ name, isTyping }) => {
    socket.broadcast.emit("user:typing", { name, isTyping });
  });

  // Send current users list to newly connected client
  socket.emit("users:update", Array.from(users.values()));

  /*
    FILE START
  */

  socket.on("file:start", (meta) => {
    socket.broadcast.emit("file:start", meta);
  });

  /*
    FILE CHUNK
  */

  socket.on("file:chunk", (chunk) => {
    socket.broadcast.emit("file:chunk", chunk);
  });

  /*
    CHAT MESSAGE
  */

  socket.on("chat message", (msg) => {
    socket.broadcast.emit("chat message", msg);
  });

  /*
    DISCONNECT
  */

  socket.on("disconnect", (reason) => {

    console.log("Disconnected:", socket.id);
    console.log("Reason:", reason);
    console.log("Total clients:", io.engine.clientsCount);

    clearInterval(memInterval);

    users.delete(socket.id);
    io.emit("users:update", Array.from(users.values()));

  });

});

/*
  NEW: HTTP Upload Endpoint
*/

const crypto = require("crypto");

app.post("/upload", upload.single("file"), (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).send("No file received");
    }

    console.log(
      "HTTP upload received:",
      req.file.originalname
    );

    const transferId =
      Date.now().toString();

    const buffer = req.file.buffer;

    /*
      Compute SHA-256 hash
    */

    const hash = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    const base64Data =
      buffer.toString("base64");

    io.emit("file:start", {
      transferId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      totalChunks: 1,
      hash: hash,
      senderName: "HTTP Sender"
    });

    io.emit("file:chunk", {
      transferId,
      index: 0,
      data: base64Data
    });

    io.emit("file:complete", {
      transferId
    });

    res.send("Upload successful");

  } catch (err) {

    console.error(err);

    res.status(500).send(
      "Upload failed"
    );

  }

});

/*
  Serve Static Frontend (Production)
*/
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

/*
  Start server
*/

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server on port", PORT);
});