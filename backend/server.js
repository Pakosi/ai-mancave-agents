const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const { generateAgentReply } = require("./aiProvider");

const app = express();

app.locals.messagesFile = path.join(__dirname, "data", "messages.json");
app.locals.tasksFile = path.join(__dirname, "data", "tasks.json");
app.locals.agentThoughtIndex = 0;
app.locals.agentThoughtState = {
  isThinking: false,
  nextAgentId: null,
  sessionId: "default",
  roomId: "main",
  roomName: "Main Office",
  topic: "",
};
app.locals.topicMemory = {};

app.use(cors());
app.use(express.json());

function ensureJsonFile(filePath) {
  const dataDir = path.dirname(filePath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n");
  }
}

function readJsonFile(filePath) {
  ensureJsonFile(filePath);

  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

function writeJsonFile(filePath, items) {
  ensureJsonFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`);
}

function readMessages() {
  return readJsonFile(app.locals.messagesFile);
}

function writeMessages(messages) {
  writeJsonFile(app.locals.messagesFile, messages);
}

function readTasks() {
  return readJsonFile(app.locals.tasksFile);
}

function writeTasks(tasks) {
  writeJsonFile(app.locals.tasksFile, tasks);
}

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

function getNextMessageId(messages) {
  return getNextId(messages);
}

function getValidMessage(body) {
  const { message } = body || {};

  if (typeof message !== "string" || message.trim() === "") {
    return null;
  }

  return message.trim();
}

function getValidText(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function getValidDescription(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    return null;
  }

  return value.trim();
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
const taskStatuses = new Set(["open", "in_progress", "done"]);
const autonomousSessionId = "default";

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

function getRoomName(roomId) {
  return rooms[roomId] ? rooms[roomId].name : roomId;
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

function getRoomTasks(tasks, roomId) {
  return tasks.filter((item) => getRoomId(item.roomId) === roomId);
}

function createTask({ roomId, title, description, assignedAgentId, tasks }) {
  const now = new Date().toISOString();
  const task = {
    id: getNextId(tasks),
    roomId,
    title,
    description,
    status: "open",
    assignedAgentId,
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);
  writeTasks(tasks);

  return task;
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

function chooseNextThoughtRoom() {
  const roomList = Object.values(rooms);

  return roomList[app.locals.agentThoughtIndex % roomList.length];
}

function createAgentThought(agentId, roomId = chooseNextThoughtRoom().id) {
  const sessionId = autonomousSessionId;
  const normalizedRoomId = getRoomId(roomId);
  const allMessages = readMessages();
  const contextMessages = getRoomMessages(allMessages, sessionId, normalizedRoomId);
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
  const topic = updateTopicMemory(sessionId, normalizedRoomId, contextMessages);
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
    roomId: normalizedRoomId,
    message: reply,
    messages: allMessages,
  });

  app.locals.agentThoughtState = {
    isThinking: false,
    nextAgentId: null,
    sessionId,
    roomId: normalizedRoomId,
    roomName: getRoomName(normalizedRoomId),
    topic,
  };

  maybeCreateAutonomousTask({
    agentId: agent.id,
    roomId: normalizedRoomId,
    topic,
    message: reply,
  });

  return storedMessage;
}

function maybeCreateAutonomousTask({ agentId, roomId, topic, message }) {
  if (app.locals.agentThoughtIndex % 4 !== 0) {
    return null;
  }

  const tasks = readTasks();
  const openRoomTasks = getRoomTasks(tasks, roomId).filter((task) => task.status !== "done");

  if (openRoomTasks.length >= 3) {
    return null;
  }

  const cleanTopic = topic && topic !== "the current business idea" ? topic : "next room idea";
  const title = `Clarify ${cleanTopic}`.slice(0, 80);
  const description = `Follow up on: ${message}`.slice(0, 160);

  return createTask({
    roomId,
    title,
    description,
    assignedAgentId: agentId,
    tasks,
  });
}

function getRandomThoughtDelay() {
  return 2000 + Math.floor(Math.random() * 3001);
}

function getAgentThoughtActivity(sessionId = autonomousSessionId, roomId = "main") {
  const state = app.locals.agentThoughtState;
  const normalizedRoomId = getRoomId(roomId);
  const stateRoomId = getRoomId(state.roomId);
  const isThinking = Boolean(state.isThinking);
  const isCurrentRoom = stateRoomId === normalizedRoomId;
  const otherRoom = isThinking && !isCurrentRoom
    ? {
      roomId: stateRoomId,
      roomName: state.roomName || getRoomName(stateRoomId),
      nextAgentId: state.nextAgentId,
      topic: state.topic || "",
    }
    : null;

  return {
    isThinking: isCurrentRoom && isThinking,
    nextAgentId: isCurrentRoom ? state.nextAgentId : null,
    roomId: isCurrentRoom ? stateRoomId : normalizedRoomId,
    roomName: getRoomName(normalizedRoomId),
    topic: isCurrentRoom ? state.topic || "" : "",
    otherRoom,
  };
}

function scheduleNextAgentThought(delay = getRandomThoughtDelay()) {
  if (app.locals.agentThoughtTimer) {
    clearTimeout(app.locals.agentThoughtTimer);
  }

  const sessionId = autonomousSessionId;
  const room = chooseNextThoughtRoom();
  const roomId = room.id;
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
    roomName: room.name,
    topic,
  };

  app.locals.agentThoughtTimer = setTimeout(() => {
    app.locals.agentThoughtTimer = null;
    createAgentThought(agent.id, roomId);
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

app.get("/api/tasks", (req, res) => {
  const roomId = getRoomId(req.query.roomId);
  const tasks = getRoomTasks(readTasks(), roomId);

  res.json({ tasks });
});

app.post("/api/tasks", (req, res) => {
  const roomId = getRoomId(req.body && req.body.roomId);
  const title = getValidText(req.body && req.body.title);
  const description = getValidDescription(req.body && req.body.description);
  const assignedAgentId = getValidText(req.body && req.body.assignedAgentId);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (description === null) {
    return res.status(400).json({ error: "description must be a string" });
  }

  if (!assignedAgentId || !agents[assignedAgentId]) {
    return res.status(400).json({ error: "valid assignedAgentId is required" });
  }

  const tasks = readTasks();
  const task = createTask({
    roomId,
    title,
    description,
    assignedAgentId,
    tasks,
  });

  return res.status(201).json(task);
});

app.patch("/api/tasks/:taskId", (req, res) => {
  const taskId = Number(req.params.taskId);
  const status = req.body && req.body.status;

  if (!Number.isInteger(taskId) || taskId < 1) {
    return res.status(400).json({ error: "invalid taskId" });
  }

  if (!taskStatuses.has(status)) {
    return res.status(400).json({ error: "valid status is required" });
  }

  const tasks = readTasks();
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "task not found" });
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
  writeTasks(tasks);

  return res.json(task);
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
app.locals.readTasksForTest = readTasks;
app.locals.scheduleNextAgentThought = scheduleNextAgentThought;
app.locals.startAgentThoughtLoop = startAgentThoughtLoop;

module.exports = app;
