const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const { generateAgentReply } = require("./aiProvider");

const app = express();

app.locals.messagesFile = path.join(__dirname, "data", "messages.json");
app.locals.agentThoughtIndex = 0;
app.locals.agentThoughtState = {
  isThinking: false,
  nextAgentId: null,
  sessionId: "default",
  roomId: "main",
  topic: "",
};
app.locals.topicMemory = {};

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

const rooms = {
  main: {
    id: "main",
    name: "Main Office",
  },
  auto: {
    id: "auto",
    name: "Auto Sales Lab",
  },
  marketing: {
    id: "marketing",
    name: "Marketing War Room",
  },
  ops: {
    id: "ops",
    name: "Operations Desk",
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
const agentResponseModes = ["agree", "expand", "question", "challenge"];

function getPublicAgents() {
  return Object.values(agents).map(({ id, name, label, color }) => ({
    id,
    name,
    label,
    color,
  }));
}

function getPublicRooms() {
  return Object.values(rooms).map(({ id, name }) => ({
    id,
    name,
  }));
}

function getRoomMessages(messages, sessionId, roomId) {
  return messages.filter((item) => (
    getSessionId(item.sessionId) === sessionId && getRoomId(item.roomId) === roomId
  ));
}

function getTopicKey(sessionId, roomId) {
  return `${sessionId}:${roomId}`;
}

function extractTopic(messages) {
  const recentText = messages
    .slice(-5)
    .map((item) => item.message)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const stopWords = new Set([
    "about",
    "agent",
    "around",
    "build",
    "could",
    "first",
    "from",
    "have",
    "hello",
    "idea",
    "into",
    "make",
    "next",
    "offer",
    "should",
    "that",
    "their",
    "there",
    "this",
    "turn",
    "useful",
    "what",
    "where",
    "with",
    "would",
  ]);
  const words = recentText
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  return words.slice(0, 3).join(" ");
}

function updateTopicMemory(sessionId, roomId, messages) {
  const topic = extractTopic(messages);
  const key = getTopicKey(sessionId, roomId);

  if (topic) {
    app.locals.topicMemory[key] = topic;
  }

  return app.locals.topicMemory[key] || "the current business idea";
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

function getLatestMessage(messages) {
  return messages[messages.length - 1] || null;
}

function chooseNextAgent(lastSpeakerId) {
  const agentList = Object.values(agents);
  const availableAgents = agentList.filter((agent) => agent.id !== lastSpeakerId);
  const candidates = availableAgents.length > 0 ? availableAgents : agentList;
  const agent = candidates[app.locals.agentThoughtIndex % candidates.length];

  return agent;
}

function getAgentResponseMode(targetMessage) {
  if (!targetMessage || targetMessage.role === "user") {
    return thoughtVariations[app.locals.agentThoughtIndex % thoughtVariations.length];
  }

  return agentResponseModes[app.locals.agentThoughtIndex % agentResponseModes.length];
}

function createAgentThought(agentId) {
  const sessionId = "default";
  const roomId = "main";
  const allMessages = readMessages();
  const contextMessages = getRoomMessages(allMessages, sessionId, roomId);
  const lastMessage = getLatestMessage(contextMessages);
  const lastSpeakerId = lastMessage && lastMessage.role === "agent" ? lastMessage.agentId : null;
  const requestedAgent = agents[agentId];
  const agent = requestedAgent && requestedAgent.id !== lastSpeakerId
    ? requestedAgent
    : chooseNextAgent(lastSpeakerId);
  const prompt = thoughtPrompts[app.locals.agentThoughtIndex % thoughtPrompts.length];
  const targetMessage = lastMessage || getLatestMessageByRole(contextMessages, "user");
  const fallbackMessage = `${businessTopic} ${prompt}`;
  const selectedMessage = targetMessage ? targetMessage.message : fallbackMessage;
  const topic = updateTopicMemory(sessionId, roomId, contextMessages);
  const variation = getAgentResponseMode(targetMessage);
  const reply = generateAgentReply({
    agent,
    message: selectedMessage,
    context: {
      topic,
      messages: contextMessages,
      target: targetMessage,
      variation,
    },
  });

  app.locals.agentThoughtIndex += 1;

  const storedMessage = storeAgentMessage({
    agentId: agent.id,
    sessionId,
    roomId,
    message: reply,
    messages: allMessages,
  });

  app.locals.agentThoughtState = {
    isThinking: false,
    nextAgentId: null,
    sessionId,
    roomId,
    topic,
  };

  return storedMessage;
}

function getRandomThoughtDelay() {
  return 2000 + Math.floor(Math.random() * 3001);
}

function getAgentThoughtActivity(sessionId = "default", roomId = "main") {
  const state = app.locals.agentThoughtState;
  const isCurrentRoom = getSessionId(state.sessionId) === sessionId && getRoomId(state.roomId) === roomId;

  return {
    isThinking: isCurrentRoom && Boolean(state.isThinking),
    nextAgentId: isCurrentRoom ? state.nextAgentId : null,
    topic: isCurrentRoom ? state.topic || "" : "",
  };
}

function scheduleNextAgentThought(delay = getRandomThoughtDelay()) {
  if (app.locals.agentThoughtTimer) {
    clearTimeout(app.locals.agentThoughtTimer);
  }

  const sessionId = "default";
  const roomId = "main";
  const contextMessages = getRoomMessages(readMessages(), sessionId, roomId);
  const lastMessage = getLatestMessage(contextMessages);
  const lastSpeakerId = lastMessage && lastMessage.role === "agent" ? lastMessage.agentId : null;
  const agent = chooseNextAgent(lastSpeakerId);
  const topic = updateTopicMemory(sessionId, roomId, contextMessages);

  app.locals.agentThoughtState = {
    isThinking: true,
    nextAgentId: agent.id,
    sessionId,
    roomId,
    topic,
  };

  app.locals.agentThoughtTimer = setTimeout(() => {
    app.locals.agentThoughtTimer = null;
    createAgentThought(agent.id);
    scheduleNextAgentThought();
  }, delay);
}

function startAgentThoughtLoop() {
  if (app.locals.agentThoughtTimer) {
    return;
  }

  scheduleNextAgentThought(getRandomThoughtDelay());
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

  res.json({
    messages,
    activity: getAgentThoughtActivity(sessionId, roomId),
  });
});

app.get("/api/agents", (req, res) => {
  res.json({ agents: getPublicAgents() });
});

app.get("/api/rooms", (req, res) => {
  res.json({ rooms: getPublicRooms() });
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
  const topic = updateTopicMemory(sessionId, roomId, sessionMessages);
  const reply = generateAgentReply({
    agent,
    message,
    context: {
      topic,
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
app.locals.getAgentThoughtActivity = getAgentThoughtActivity;
app.locals.scheduleNextAgentThought = scheduleNextAgentThought;
app.locals.startAgentThoughtLoop = startAgentThoughtLoop;

module.exports = app;
