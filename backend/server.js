const express = require("express");
const cors = require("cors");

const app = express();

app.locals.messages = [];
app.locals.nextMessageId = 1;

app.use(cors());
app.use(express.json());

// test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive" });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/messages", (req, res) => {
  res.json({ messages: app.locals.messages });
});

app.post("/api/message", (req, res) => {
  const { message } = req.body;

  if (typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "message is required" });
  }

  const storedMessage = {
    id: app.locals.nextMessageId,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  app.locals.nextMessageId += 1;
  app.locals.messages.push(storedMessage);

  return res.status(201).json(storedMessage);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("AI Mancave Backend Running");
});

if (require.main === module) {
  app.listen(3001, () => {
    console.log("Server running on port 3001");
  });
}

module.exports = app;
