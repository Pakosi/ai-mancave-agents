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

function getSessionId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "default";
  }

  return value.trim();
}

const agents = {
  host: {
    id: "host",
    name: "Host",
    label: "HOST",
    color: "#10b981",
    systemPrompt: "Friendly, short replies that make the user feel welcomed.",
    reply(message, contextText) {
      const context = contextText ? ` I remember: ${contextText}.` : "";
      return `Glad you shared "${message}".${context}`;
    },
  },
  assistant: {
    id: "assistant",
    name: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
    systemPrompt: "Neutral, helpful replies that focus on useful next steps.",
    reply(message, contextText) {
      const context = contextText ? ` Recent context: ${contextText}.` : "";
      return `I can help with "${message}".${context}`;
    },
  },
  sales: {
    id: "sales",
    name: "Sales",
    label: "SALES",
    color: "#f97316",
    systemPrompt: "Persuasive replies that frame the message as an opportunity.",
    reply(message, contextText) {
      const context = contextText ? ` Building on ${contextText},` : "";
      return `${context} let's turn "${message}" into a win.`;
    },
  },
};

function getPublicAgents() {
  return Object.values(agents).map(({ id, name, label, color }) => ({
    id,
    name,
    label,
    color,
  }));
}

function getRecentContext(messages) {
  return messages
    .slice(-5)
    .map((item) => `${item.role}: ${item.message}`)
    .join("; ");
}

// test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive" });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/messages", (req, res) => {
  const sessionId = getSessionId(req.query.sessionId);
  const messages = readMessages().filter((item) => getSessionId(item.sessionId) === sessionId);

  res.json({ messages });
});

app.get("/api/agents", (req, res) => {
  res.json({ agents: getPublicAgents() });
});

app.post("/api/message", (req, res) => {
  const message = getValidMessage(req.body);
  const sessionId = getSessionId(req.body && req.body.sessionId);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const messages = readMessages();

  const storedMessage = {
    id: getNextMessageId(messages),
    sessionId,
    role: "user",
    message,
    createdAt: new Date().toISOString(),
  };

  messages.push(storedMessage);
  writeMessages(messages);

  return res.status(201).json(storedMessage);
});

app.post("/api/agents/:agentId/reply", (req, res) => {
  const { agentId } = req.params;
  const agent = agents[agentId];
  const sessionId = getSessionId(req.body && req.body.sessionId);

  if (!agent) {
    return res.status(400).json({ error: "invalid agentId" });
  }

  const message = getValidMessage(req.body);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const allMessages = readMessages();
  const sessionMessages = allMessages.filter((item) => getSessionId(item.sessionId) === sessionId);
  const contextText = getRecentContext(sessionMessages);
  const reply = agent.reply(message, contextText);
  const storedMessage = {
    id: getNextMessageId(allMessages),
    sessionId,
    role: "agent",
    agentId,
    message: reply,
    createdAt: new Date().toISOString(),
  };

  allMessages.push(storedMessage);
  writeMessages(allMessages);

  return res.json({
    agentId,
    reply,
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
