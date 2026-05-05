const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const app = express();

app.locals.messagesFile = path.join(__dirname, "data", "messages.json");

app.use(cors());
app.use(express.json());

function ensureMessagesFile() {
  const dataDir = path.dirname(app.locals.messagesFile);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(app.locals.messagesFile)) {
    fs.writeFileSync(app.locals.messagesFile, "[]\n");
  }
}

function readMessages() {
  ensureMessagesFile();

  const data = fs.readFileSync(app.locals.messagesFile, "utf8");
  return JSON.parse(data);
}

function writeMessages(messages) {
  ensureMessagesFile();
  fs.writeFileSync(app.locals.messagesFile, `${JSON.stringify(messages, null, 2)}\n`);
}

function getNextMessageId(messages) {
  return messages.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

function getValidMessage(body) {
  const { message } = body || {};

  if (typeof message !== "string" || message.trim() === "") {
    return null;
  }

  return message.trim();
}

// test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive" });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/messages", (req, res) => {
  res.json({ messages: readMessages() });
});

app.post("/api/message", (req, res) => {
  const message = getValidMessage(req.body);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const messages = readMessages();

  const storedMessage = {
    id: getNextMessageId(messages),
    message,
    createdAt: new Date().toISOString(),
  };

  messages.push(storedMessage);
  writeMessages(messages);

  return res.status(201).json(storedMessage);
});

app.post("/api/agent/reply", (req, res) => {
  const message = getValidMessage(req.body);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  return res.json({
    reply: `Agent received: ${message}`,
  });
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
