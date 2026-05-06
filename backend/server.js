const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const { generateAgentReply } = require("./aiProvider");

const app = express();

app.locals.messagesFile = path.join(__dirname, "data", "messages.json");
app.locals.agentThoughtIndex = 0;

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

function getRoomId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "main";
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
  },
  assistant: {
    id: "assistant",
    name: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
    systemPrompt: "Neutral, helpful replies that focus on useful next steps.",
  },
  sales: {
    id: "sales",
    name: "Sales",
    label: "SALES",
    color: "#f97316",
    systemPrompt: "Persuasive replies that frame the message as an opportunity.",
  },
};

const businessTopic = "AI Mancave: a practical workspace where agents brainstorm offers, support flows, and sales angles for small teams.";
const thoughtPrompts = [
  "Find one useful business idea for the room.",
  "Turn the current discussion into a practical next step.",
  "Suggest a way to package this into a service or offer.",
  "Look for a support or onboarding improvement.",
  "Connect the latest idea to revenue or customer value.",
];
const thoughtVariations = ["expand", "agree", "challenge"];

function getPublicAgents() {
  return Object.values(agents).map(({ id, name, label, color }) => ({
    id,
    name,
    label,
    color,
  }));
}

function getRoomMessages(messages, sessionId, roomId) {
  return messages.filter((item) => (
    getSessionId(item.sessionId) === sessionId && getRoomId(item.roomId) === roomId
  ));
}

function storeAgentMessage({ agentId, sessionId, roomId, message, messages }) {
  const storedMessage = {
    id: getNextMessageId(messages),
    sessionId,
    roomId,
    role: "agent",
    agentId,
    message,
    createdAt: new Date().toISOString(),
  };

  messages.push(storedMessage);
  writeMessages(messages);

  return storedMessage;
}

function getLatestMessageByRole(messages, role) {
  return [...messages]
    .reverse()
    .find((item) => item.role === role) || null;
}

function createAgentThought() {
  const agentList = Object.values(agents);
  const agent = agentList[app.locals.agentThoughtIndex % agentList.length];
  const prompt = thoughtPrompts[app.locals.agentThoughtIndex % thoughtPrompts.length];
  const variation = thoughtVariations[app.locals.agentThoughtIndex % thoughtVariations.length];
  const sessionId = "default";
  const roomId = "main";
  const allMessages = readMessages();
  const contextMessages = getRoomMessages(allMessages, sessionId, roomId);
  const shouldTargetUser = app.locals.agentThoughtIndex % 2 === 0;
  const targetMessage = shouldTargetUser
    ? getLatestMessageByRole(contextMessages, "user")
    : getLatestMessageByRole(contextMessages, "agent");
  const fallbackMessage = `${businessTopic} ${prompt}`;
  const selectedMessage = targetMessage ? targetMessage.message : fallbackMessage;
  const reply = generateAgentReply({
    agent,
    message: selectedMessage,
    context: {
      topic: businessTopic,
      messages: contextMessages,
      target: targetMessage,
      variation,
    },
  });

  app.locals.agentThoughtIndex += 1;

  return storeAgentMessage({
    agentId: agent.id,
    sessionId,
    roomId,
    message: reply,
    messages: allMessages,
  });
}

function startAgentThoughtLoop() {
  if (app.locals.agentThoughtTimer) {
    return;
  }

  app.locals.agentThoughtTimer = setInterval(createAgentThought, 15000);
  setTimeout(createAgentThought, 3000);
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
  const roomId = getRoomId(req.query.roomId);
  const messages = getRoomMessages(readMessages(), sessionId, roomId);

  res.json({ messages });
});

app.get("/api/agents", (req, res) => {
  res.json({ agents: getPublicAgents() });
});

app.post("/api/message", (req, res) => {
  const message = getValidMessage(req.body);
  const sessionId = getSessionId(req.body && req.body.sessionId);
  const roomId = getRoomId(req.body && req.body.roomId);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const messages = readMessages();

  const storedMessage = {
    id: getNextMessageId(messages),
    sessionId,
    roomId,
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
  const roomId = getRoomId(req.body && req.body.roomId);

  if (!agent) {
    return res.status(400).json({ error: "invalid agentId" });
  }

  const message = getValidMessage(req.body);

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const allMessages = readMessages();
  const sessionMessages = getRoomMessages(allMessages, sessionId, roomId);
  const reply = generateAgentReply({
    agent,
    message,
    context: {
      topic: businessTopic,
      messages: sessionMessages,
    },
  });

  storeAgentMessage({
    agentId,
    sessionId,
    roomId,
    message: reply,
    messages: allMessages,
  });

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
  startAgentThoughtLoop();
}

app.locals.createAgentThought = createAgentThought;
app.locals.startAgentThoughtLoop = startAgentThoughtLoop;

module.exports = app;
