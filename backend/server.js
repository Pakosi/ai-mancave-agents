const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const { getAiProvider } = require("./aiProvider");
const {
  createDefaultAgentGoals,
  getGoalForAgent,
  getOperatingRhythm,
  goalMatchesTask,
  normalizeAgentGoals,
  updateGoalForCoordinator,
} = require("./agentGoals");
const {
  createEmptyBusinessIdeas,
  createBusinessIdeaEntry,
  getBusinessIdeaCategoryForAgent,
  getBusinessIdeaById,
  getBusinessIdeaDraft,
  getBusinessIdeaPatch,
  isImportantBusinessIdeaChange,
  formatBusinessIdeaMarkdown,
  formatBusinessIdeasMarkdown,
  normalizeBusinessIdeas,
  rankBusinessIdeas,
  updateBusinessIdea,
} = require("./businessIdeas");
const {
  buildCeoDigest,
  createEmptyCeoDigest,
  formatCeoDigestMarkdown,
} = require("./ceoDigest");
const {
  executeCommand,
  parseCommandText,
} = require("./commands");
const {
  createDefaultCompanyPlan,
  getPrimaryPlanFocus,
  normalizeCompanyPlan,
  syncRecentDecisionsFromLog,
  updateCompanyPlanForAgent,
} = require("./companyPlan");
const {
  createDecisionEntry,
  createEmptyDecisionLog,
  createMemoryEvent,
  filterByRoom,
  getDecisionDraft,
  normalizeDecisionLog,
} = require("./decisionLog");
const {
  getMarketProvider,
} = require("./marketProvider");
const {
  getResearchProvider,
} = require("./researchProvider");

const app = express();

app.locals.messagesFile = path.join(__dirname, "data", "messages.json");
app.locals.tasksFile = path.join(__dirname, "data", "tasks.json");
app.locals.companyPlanFile = path.join(__dirname, "data", "company-plan.json");
app.locals.decisionLogFile = path.join(__dirname, "data", "decision-log.json");
app.locals.agentGoalsFile = path.join(__dirname, "data", "agent-goals.json");
app.locals.businessIdeasFile = path.join(__dirname, "data", "business-ideas.json");
app.locals.ceoDigestFile = path.join(__dirname, "data", "ceo-digest.json");
app.locals.providers = {
  ai: getAiProvider(),
  market: getMarketProvider(),
  research: getResearchProvider(),
};
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

function sendMarkdown(res, markdown) {
  return res.set("Content-Type", "text/markdown; charset=utf-8").send(`${markdown}\n`);
}

function readMessages() {
  return readJsonFile(app.locals.messagesFile);
}

function writeMessages(messages) {
  writeJsonFile(app.locals.messagesFile, messages);
}

function normalizeTasks(tasks) {
  return tasks.map((task) => ({
    ...task,
    ownerAgentId: task.ownerAgentId !== undefined ? task.ownerAgentId : (task.assignedAgentId || null),
    assignedByAgentId: task.assignedByAgentId !== undefined ? task.assignedByAgentId : (task.assignedAgentId || null),
    handoffReason: task.handoffReason !== undefined ? task.handoffReason : null,
    lastHandoffAt: task.lastHandoffAt !== undefined ? task.lastHandoffAt : null,
    blockedReason: task.blockedReason !== undefined ? task.blockedReason : null,
  }));
}

function readTasks() {
  return normalizeTasks(readJsonFile(app.locals.tasksFile));
}

function writeTasks(tasks) {
  writeJsonFile(app.locals.tasksFile, tasks);
}

function readCompanyPlan() {
  if (!fs.existsSync(app.locals.companyPlanFile)) {
    const plan = createDefaultCompanyPlan();
    writeJsonFile(app.locals.companyPlanFile, plan);

    return plan;
  }

  const plan = normalizeCompanyPlan(readJsonFile(app.locals.companyPlanFile));
  writeJsonFile(app.locals.companyPlanFile, plan);

  return plan;
}

function writeCompanyPlan(plan) {
  const normalizedPlan = normalizeCompanyPlan(plan);
  writeJsonFile(app.locals.companyPlanFile, normalizedPlan);

  return normalizedPlan;
}

function readDecisionLog() {
  if (!fs.existsSync(app.locals.decisionLogFile)) {
    const log = createEmptyDecisionLog();
    writeJsonFile(app.locals.decisionLogFile, log);

    return log;
  }

  const log = normalizeDecisionLog(readJsonFile(app.locals.decisionLogFile));
  writeJsonFile(app.locals.decisionLogFile, log);

  return log;
}

function writeDecisionLog(log) {
  const normalizedLog = normalizeDecisionLog(log);
  writeJsonFile(app.locals.decisionLogFile, normalizedLog);

  return normalizedLog;
}

function readAgentGoals() {
  if (!fs.existsSync(app.locals.agentGoalsFile)) {
    const goals = createDefaultAgentGoals(agents);
    writeJsonFile(app.locals.agentGoalsFile, goals);

    return goals;
  }

  const goals = normalizeAgentGoals(readJsonFile(app.locals.agentGoalsFile), agents);
  writeJsonFile(app.locals.agentGoalsFile, goals);

  return goals;
}

function writeAgentGoals(goals) {
  const normalizedGoals = normalizeAgentGoals(goals, agents);
  writeJsonFile(app.locals.agentGoalsFile, normalizedGoals);

  return normalizedGoals;
}

function readBusinessIdeas() {
  if (!fs.existsSync(app.locals.businessIdeasFile)) {
    const ideas = createEmptyBusinessIdeas();
    writeJsonFile(app.locals.businessIdeasFile, ideas);

    return ideas;
  }

  const ideas = normalizeBusinessIdeas(readJsonFile(app.locals.businessIdeasFile));
  writeJsonFile(app.locals.businessIdeasFile, ideas);

  return ideas;
}

function writeBusinessIdeas(ideas) {
  const normalizedIdeas = normalizeBusinessIdeas(ideas);
  writeJsonFile(app.locals.businessIdeasFile, normalizedIdeas);

  return normalizedIdeas;
}

function readCeoDigest() {
  if (!fs.existsSync(app.locals.ceoDigestFile)) {
    const digest = createEmptyCeoDigest();
    writeJsonFile(app.locals.ceoDigestFile, digest);

    return digest;
  }

  const digest = readJsonFile(app.locals.ceoDigestFile);
  const normalizedDigest = digest && typeof digest === "object" && !Array.isArray(digest)
    ? {
        ...createEmptyCeoDigest(digest.updatedAt || new Date().toISOString()),
        ...digest,
      }
    : createEmptyCeoDigest();

  writeJsonFile(app.locals.ceoDigestFile, normalizedDigest);

  return normalizedDigest;
}

function writeCeoDigest(digest) {
  const normalizedDigest = digest && typeof digest === "object" && !Array.isArray(digest)
    ? {
        ...createEmptyCeoDigest(digest.updatedAt || new Date().toISOString()),
        ...digest,
      }
    : createEmptyCeoDigest();

  writeJsonFile(app.locals.ceoDigestFile, normalizedDigest);

  return normalizedDigest;
}

function refreshCeoDigest() {
  const digest = buildCeoDigest({
    ideas: readBusinessIdeas(),
    decisions: readDecisionLog().decisions,
    tasks: readTasks(),
    memoryEvents: readDecisionLog().memoryEvents,
  });

  return writeCeoDigest(digest);
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
    role: "Discussion coordinator",
    expertise: ["facilitation", "summaries", "alignment"],
    preferredRooms: ["main", "ops"],
    behaviorStyle: "organized and concise",
    taskTendencies: ["coordinate", "summarize", "align"],
    allowedActions: ["reply", "summarize", "create_tasks"],
    systemPrompt: "Friendly, short replies that coordinate the room and summarize direction.",
  },
  assistant: {
    id: "assistant",
    name: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
    role: "General helper",
    expertise: ["context bridging", "next steps", "support"],
    preferredRooms: ["main", "ops", "marketing"],
    behaviorStyle: "helpful and connective",
    taskTendencies: ["document", "bridge", "clarify"],
    allowedActions: ["reply", "create_tasks", "advance_tasks"],
    systemPrompt: "Neutral, helpful replies that bridge context and focus on useful next steps.",
  },
  sales: {
    id: "sales",
    name: "Sales",
    label: "SALES",
    color: "#f97316",
    role: "Revenue specialist",
    expertise: ["customer validation", "offers", "revenue"],
    preferredRooms: ["auto", "marketing", "main"],
    behaviorStyle: "buyer-focused and direct",
    taskTendencies: ["validate", "offer", "revenue"],
    allowedActions: ["reply", "create_tasks", "advance_tasks"],
    systemPrompt: "Persuasive replies that frame the message as a customer or revenue opportunity.",
  },
  strategist: {
    id: "strategist",
    name: "Strategist",
    label: "STRATEGIST",
    color: "#7c3aed",
    role: "Planning strategist",
    expertise: ["positioning", "prioritization", "planning"],
    preferredRooms: ["main", "marketing"],
    behaviorStyle: "structured and priority-minded",
    taskTendencies: ["plan", "position", "prioritize"],
    allowedActions: ["reply", "create_tasks", "prioritize_tasks"],
    systemPrompt: "Strategic replies that clarify positioning, priorities, and planning tradeoffs.",
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    label: "RESEARCH",
    color: "#0891b2",
    role: "Discovery lead",
    expertise: ["market discovery", "user research", "competitor scans"],
    preferredRooms: ["marketing", "auto"],
    behaviorStyle: "curious and evidence-seeking",
    taskTendencies: ["research", "discover", "compare"],
    allowedActions: ["reply", "create_tasks"],
    systemPrompt: "Research replies that identify user, market, and competitor evidence gaps.",
  },
  builder: {
    id: "builder",
    name: "Builder",
    label: "BUILDER",
    color: "#0f766e",
    role: "Product builder",
    expertise: ["implementation", "product workflow", "technical delivery"],
    preferredRooms: ["ops", "main"],
    behaviorStyle: "practical and implementation-focused",
    taskTendencies: ["build", "ship", "workflow"],
    allowedActions: ["reply", "advance_tasks", "create_tasks"],
    systemPrompt: "Builder replies that turn ideas into product and implementation steps.",
  },
  analyst: {
    id: "analyst",
    name: "Analyst",
    label: "ANALYST",
    color: "#64748b",
    role: "Metrics and risk analyst",
    expertise: ["metrics", "risks", "decision gaps"],
    preferredRooms: ["main", "ops", "marketing"],
    behaviorStyle: "measured and evidence-based",
    taskTendencies: ["measure", "risk", "decide"],
    allowedActions: ["reply", "create_tasks"],
    systemPrompt: "Analyst replies that surface metrics, risks, and decision gaps.",
  },
  manager: {
    id: "manager",
    name: "Manager",
    label: "MANAGER",
    color: "#be123c",
    role: "Task manager",
    expertise: ["coordination", "progress tracking", "ownership"],
    preferredRooms: ["main", "ops"],
    behaviorStyle: "clear and action-oriented",
    taskTendencies: ["assign", "track", "advance"],
    allowedActions: ["reply", "advance_tasks", "create_tasks", "prioritize_tasks"],
    systemPrompt: "Manager replies that coordinate ownership, status, and next steps.",
  },
};

const rooms = {
  main: {
    id: "main",
    name: "Main Office",
    brief: "Coordinate the overall WOYS business, product direction, and agent teamwork.",
  },
  auto: {
    id: "auto",
    name: "Auto Sales Lab",
    brief: "Develop dealership sales workflows, follow-up scripts, and buyer conversion ideas.",
  },
  marketing: {
    id: "marketing",
    name: "Marketing War Room",
    brief: "Plan campaigns, content angles, positioning, and lead generation experiments.",
  },
  ops: {
    id: "ops",
    name: "Operations Desk",
    brief: "Improve delivery systems, internal checklists, support flows, and repeatable operations.",
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
  return Object.values(agents).map(({
    id,
    name,
    label,
    color,
    role,
    expertise,
    preferredRooms,
    behaviorStyle,
    taskTendencies,
    allowedActions,
  }) => ({
    allowedActions,
    behaviorStyle,
    color,
    expertise,
    id,
    label,
    name,
    preferredRooms,
    role,
    taskTendencies,
  }));
}

function getPublicRooms() {
  return Object.values(rooms).map(({ id, name, brief }) => ({
    brief,
    id,
    name,
  }));
}

function getRoomName(roomId) {
  return rooms[roomId] ? rooms[roomId].name : roomId;
}

function getRoomBrief(roomId) {
  return rooms[roomId] ? rooms[roomId].brief : rooms.main.brief;
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

function getActiveRoomTasks(tasks, roomId) {
  return getRoomTasks(tasks, roomId).filter((task) => (
    task.status === "open" || task.status === "in_progress"
  ));
}

function textMatchesTerms(text, terms) {
  return terms.some((term) => {
    const words = term
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4);

    return words.some((word) => text.includes(word));
  });
}

function taskMatchesAgent(task, agent) {
  if (!agent) {
    return false;
  }

  if (task.ownerAgentId === agent.id) {
    return true;
  }

  if (task.assignedAgentId === agent.id) {
    return true;
  }

  const text = `${task.title} ${task.description || ""}`.toLowerCase();

  return textMatchesTerms(text, agent.taskTendencies);
}

function taskMatchesPlan(task, plan) {
  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  const terms = [
    plan.currentObjective,
    ...plan.activePriorities,
  ];

  return textMatchesTerms(text, terms);
}

function selectRoomTask(tasks, roomId, agent, plan = readCompanyPlan(), goal = null) {
  const activeTasks = getActiveRoomTasks(tasks, roomId);

  if (activeTasks.length === 0) {
    return null;
  }

  if (agent && agent.id === "manager") {
    const blockedTasks = activeTasks.filter((task) => task.blockedReason);

    if (blockedTasks.length > 0) {
      return blockedTasks[app.locals.agentThoughtIndex % blockedTasks.length];
    }
  }

  const ownedTasks = agent ? activeTasks.filter((task) => task.ownerAgentId === agent.id) : [];
  const specializedTasks = activeTasks.filter((task) => taskMatchesAgent(task, agent));
  const planTasks = activeTasks.filter((task) => taskMatchesPlan(task, plan));
  const planSpecializedTasks = specializedTasks.filter((task) => taskMatchesPlan(task, plan));
  const goalTasks = activeTasks.filter((task) => goalMatchesTask(task, goal));
  const goalSpecializedTasks = specializedTasks.filter((task) => goalMatchesTask(task, goal));
  let candidates = activeTasks;

  if (ownedTasks.length > 0) {
    candidates = ownedTasks;
  } else if (planSpecializedTasks.length > 0) {
    candidates = planSpecializedTasks;
  } else if (goalSpecializedTasks.length > 0) {
    candidates = goalSpecializedTasks;
  } else if (specializedTasks.length > 0) {
    candidates = specializedTasks;
  } else if (goalTasks.length > 0) {
    candidates = goalTasks;
  } else if (planTasks.length > 0) {
    candidates = planTasks;
  }

  return candidates[app.locals.agentThoughtIndex % candidates.length];
}

function findBestAgentForTask(task, excludeAgentId) {
  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  const agentList = Object.values(agents);
  let bestAgent = null;
  let bestScore = 0;

  for (const agent of agentList) {
    if (agent.id === excludeAgentId) {
      continue;
    }

    const score = agent.taskTendencies.filter((term) => text.includes(term.toLowerCase())).length;

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

function handoffTask({ task, fromAgentId, toAgentId, reason, tasks, messages, sessionId, isImportant }) {
  if (!agents[toAgentId]) {
    return null;
  }

  task.ownerAgentId = toAgentId;
  task.handoffReason = reason;
  task.lastHandoffAt = new Date().toISOString();
  task.updatedAt = task.lastHandoffAt;
  writeTasks(tasks);

  storeAgentMessage({
    agentId: fromAgentId,
    sessionId,
    roomId: task.roomId,
    message: `Handoff: "${task.title}" to ${agents[toAgentId].name}. ${reason}`,
    messages,
  });

  if (isImportant) {
    const fromName = agents[fromAgentId] ? agents[fromAgentId].name : fromAgentId;
    const result = createMemoryEvent({
      log: readDecisionLog(),
      roomId: task.roomId,
      type: "task_handoff",
      summary: `${fromName} handed off "${task.title}" to ${agents[toAgentId].name}: ${reason}`,
      importance: "medium",
    });

    if (result.entry) {
      writeDecisionLog(result.log);
    }
  }

  return task;
}

function maybeHandoffAutonomousTask({ agentId, sessionId, taskId, rhythm }) {
  if (!taskId) {
    return null;
  }

  const agent = agents[agentId];

  if (!agent) {
    return null;
  }

  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);

  if (!task || task.status === "done") {
    return null;
  }

  const isCoordinator = agent.id === "manager" || agent.id === "host";

  if (isCoordinator && rhythm.phase === "review" && app.locals.agentThoughtIndex % 3 === 1) {
    const bestAgent = findBestAgentForTask(task, agentId);

    if (bestAgent && bestAgent.id !== task.ownerAgentId) {
      return handoffTask({
        task,
        fromAgentId: agentId,
        toAgentId: bestAgent.id,
        reason: `${agent.name} reassigned to better-suited owner.`,
        tasks,
        messages: readMessages(),
        sessionId,
        isImportant: true,
      });
    }
  }

  if (!isCoordinator && task.ownerAgentId !== agentId && rhythm.phase !== "execute" && app.locals.agentThoughtIndex % 5 === 0) {
    const bestAgent = findBestAgentForTask(task, null);

    if (bestAgent && bestAgent.id !== agentId && bestAgent.id !== task.ownerAgentId) {
      return handoffTask({
        task,
        fromAgentId: agentId,
        toAgentId: bestAgent.id,
        reason: `${agent.name} identified better owner.`,
        tasks,
        messages: readMessages(),
        sessionId,
        isImportant: false,
      });
    }
  }

  if (agent.id === "manager" && task.blockedReason && app.locals.agentThoughtIndex % 4 === 2) {
    const bestAgent = findBestAgentForTask(task, task.ownerAgentId);
    const toAgentId = bestAgent ? bestAgent.id : "assistant";

    if (agents[toAgentId]) {
      task.blockedReason = null;

      return handoffTask({
        task,
        fromAgentId: agentId,
        toAgentId,
        reason: "Manager unblocked and reassigned.",
        tasks,
        messages: readMessages(),
        sessionId,
        isImportant: true,
      });
    }
  }

  return null;
}

function getNextTaskStatus(status) {
  if (status === "open") {
    return "in_progress";
  }

  if (status === "in_progress") {
    return "done";
  }

  return "";
}

function canMoveTaskStatus(currentStatus, nextStatus) {
  return getNextTaskStatus(currentStatus) === nextStatus;
}

function createTask({ roomId, title, description, assignedAgentId, assignedByAgentId, tasks }) {
  const now = new Date().toISOString();
  const task = {
    id: getNextId(tasks),
    roomId,
    title,
    description,
    status: "open",
    assignedAgentId,
    assignedByAgentId: assignedByAgentId || assignedAgentId,
    ownerAgentId: assignedAgentId,
    handoffReason: null,
    lastHandoffAt: null,
    blockedReason: null,
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);
  writeTasks(tasks);

  return task;
}

function updateTaskStatus({ task, status, tasks }) {
  if (!canMoveTaskStatus(task.status, status)) {
    return null;
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
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

function storeTaskStatusMessage({ task, agentId, sessionId, messages }) {
  return storeAgentMessage({
    agentId,
    sessionId,
    roomId: task.roomId,
    message: `Task update: "${task.title}" is now ${task.status.replace("_", " ")}.`,
    messages,
  });
}

function maybeCreateTaskMemoryEvent(task) {
  if (!task || task.status !== "done") {
    return null;
  }

  const result = createMemoryEvent({
    log: readDecisionLog(),
    roomId: task.roomId,
    type: "task_completed",
    summary: `Completed "${task.title}".`,
    importance: "high",
  });

  if (!result.entry) {
    return null;
  }

  writeDecisionLog(result.log);

  return result.entry;
}

function addTaskReference(reply, task) {
  if (!task) {
    return reply;
  }

  return `${reply} For "${task.title}", the next move is clear.`;
}

function addRoomBriefCue(reply, roomId) {
  const room = rooms[roomId] || rooms.main;

  if (roomId === "auto") {
    return `${reply} Keep it tied to dealer follow-up.`;
  }

  if (roomId === "marketing") {
    return `${reply} Frame it as a campaign test.`;
  }

  if (roomId === "ops") {
    return `${reply} Make it repeatable for operations.`;
  }

  return `${reply} Keep the team aligned on ${room.name}.`;
}

function getLatestMessageByRole(messages, role) {
  return [...messages]
    .reverse()
    .find((item) => item.role === role) || null;
}

function getLatestMessage(messages) {
  return messages[messages.length - 1] || null;
}

function chooseNextAgent(lastSpeakerId, roomId) {
  const agentList = Object.values(agents);
  const roomAgents = roomId
    ? agentList.filter((agent) => agent.preferredRooms.includes(roomId))
    : agentList;
  const roomCandidates = roomAgents.length > 0 ? roomAgents : agentList;
  const availableAgents = roomCandidates.filter((agent) => agent.id !== lastSpeakerId);
  const candidates = availableAgents.length > 0 ? availableAgents : roomCandidates;
  const agent = candidates[app.locals.agentThoughtIndex % candidates.length];

  return agent;
}

function getAgentTaskDraft(agent, roomId, topic, message, plan = readCompanyPlan(), goal = null, rhythm = getOperatingRhythm()) {
  const roomBrief = getRoomBrief(roomId);
  const planFocus = getPrimaryPlanFocus(plan);
  const goalFocus = goal ? goal.currentGoal : planFocus;
  const cleanTopic = topic && topic !== "the current business idea" ? topic : goalFocus;
  const tendency = agent.taskTendencies[app.locals.agentThoughtIndex % agent.taskTendencies.length];
  const prefixByAgent = {
    analyst: "Define metrics and risks for",
    builder: "Build next workflow for",
    host: "Summarize direction for",
    manager: "Assign owner and next step for",
    researcher: "Research evidence for",
    sales: "Validate offer for",
    strategist: "Prioritize plan for",
  };
  const prefix = prefixByAgent[agent.id] || `Clarify ${tendency} for`;

  return {
    title: `${rhythm.phase}: ${prefix} ${cleanTopic}`.slice(0, 80),
    description: `${agent.role}: ${roomBrief} Goal: ${goalFocus} Objective: ${plan.currentObjective} Follow up on: ${message}`.slice(0, 240),
  };
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
  const allTasks = readTasks();
  const companyPlan = readCompanyPlan();
  const rhythm = getOperatingRhythm(app.locals.agentThoughtIndex);
  const agentGoals = readAgentGoals();
  const contextMessages = getRoomMessages(allMessages, sessionId, normalizedRoomId);
  const lastMessage = getLatestMessage(contextMessages);
  const lastSpeakerId = lastMessage && lastMessage.role === "agent" ? lastMessage.agentId : null;
  const requestedAgent = agents[agentId];
  const agent = requestedAgent && requestedAgent.id !== lastSpeakerId
    ? requestedAgent
    : chooseNextAgent(lastSpeakerId, normalizedRoomId);
  const agentGoal = getGoalForAgent(agentGoals, agent.id);
  const selectedTask = selectRoomTask(allTasks, normalizedRoomId, agent, companyPlan, agentGoal);
  const prompt = thoughtPrompts[app.locals.agentThoughtIndex % thoughtPrompts.length];
  const targetMessage = lastMessage || getLatestMessageByRole(contextMessages, "user");
  const roomBrief = getRoomBrief(normalizedRoomId);
  const fallbackMessage = `${businessTopic} ${roomBrief} Phase: ${rhythm.phase}. Goal: ${agentGoal ? agentGoal.currentGoal : "no goal"}. Objective: ${companyPlan.currentObjective} ${prompt}`;
  const selectedMessage = selectedTask
    ? `${targetMessage ? targetMessage.message : fallbackMessage} Task focus: ${selectedTask.title}`
    : targetMessage ? `${targetMessage.message} Phase: ${rhythm.phase}. Goal: ${agentGoal ? agentGoal.currentGoal : "no goal"}. Objective: ${companyPlan.currentObjective}` : fallbackMessage;
  const topic = updateTopicMemory(sessionId, normalizedRoomId, contextMessages);
  const variation = getAgentResponseMode(targetMessage);
  const reply = addRoomBriefCue(addTaskReference(app.locals.providers.ai.generateReply({
    agent,
    message: selectedMessage,
    context: {
      topic: roomBrief,
      messages: contextMessages,
      target: targetMessage,
      variation,
      phase: rhythm.phase,
      goal: agentGoal,
    },
  }), selectedTask), normalizedRoomId);

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

  maybeAdvanceAutonomousTask({
    agentId: agent.id,
    sessionId,
    task: selectedTask,
    tasks: allTasks,
    rhythm,
  });
  maybeCreateAutonomousTask({
    agentId: agent.id,
    roomId: normalizedRoomId,
    topic,
    message: reply,
    plan: companyPlan,
    goal: agentGoal,
    rhythm,
  });
  maybeHandoffAutonomousTask({
    agentId: agent.id,
    sessionId,
    taskId: selectedTask ? selectedTask.id : null,
    rhythm,
  });
  maybeUpdateCompanyPlan({
    agent,
    roomId: normalizedRoomId,
    topic,
    task: selectedTask,
    plan: companyPlan,
    rhythm,
  });
  maybeUpdateAgentGoals({
    agent,
    goals: agentGoals,
    roomId: normalizedRoomId,
    topic,
    rhythm,
  });
  maybeUpdateBusinessIdeas({
    agent,
    roomId: normalizedRoomId,
    topic,
    task: selectedTask,
    plan: companyPlan,
    goal: agentGoal,
    rhythm,
  });

  return storedMessage;
}

function maybeCreateAutonomousDecision({ agent, roomId, topic, task, plan }) {
  if (!agent || !["analyst", "host", "manager", "strategist"].includes(agent.id)) {
    return null;
  }

  if (app.locals.agentThoughtIndex % 3 !== 0) {
    return null;
  }

  const draft = getDecisionDraft({
    agent,
    roomName: getRoomName(roomId),
    roomId,
    topic,
    task,
    plan,
  });
  const result = createDecisionEntry({
    log: readDecisionLog(),
    ...draft,
  });

  if (!result.entry) {
    return null;
  }

  writeDecisionLog(result.log);

  return result.entry;
}

function syncCompanyPlanDecisions() {
  const log = readDecisionLog();

  if (log.decisions.length === 0) {
    return readCompanyPlan();
  }

  return writeCompanyPlan(syncRecentDecisionsFromLog(readCompanyPlan(), log.decisions));
}

function maybeUpdateCompanyPlan({ agent, roomId, topic, task, plan }) {
  if (!agent) {
    return null;
  }

  const decision = maybeCreateAutonomousDecision({
    agent,
    roomId,
    topic,
    task,
    plan: plan || readCompanyPlan(),
  });

  if ((agent.id === "host" || agent.id === "manager") && app.locals.agentThoughtIndex % 2 !== 0) {
    return decision ? syncCompanyPlanDecisions() : null;
  }

  const updatedPlan = updateCompanyPlanForAgent({
    plan: readCompanyPlan(),
    agent,
    roomName: getRoomName(roomId),
    topic,
    task,
  });

  const writtenPlan = writeCompanyPlan(updatedPlan);

  if (decision) {
    return syncCompanyPlanDecisions();
  }

  return writtenPlan;
}

function maybeUpdateAgentGoals({ agent, goals, roomId, topic, rhythm }) {
  const result = updateGoalForCoordinator({
    goals,
    agent,
    roomId,
    topic,
    phase: rhythm.phase,
  });

  if (!result.updatedGoal) {
    return null;
  }

  writeAgentGoals(result.goals);

  if (rhythm.phase === "review") {
    const memory = createMemoryEvent({
      log: readDecisionLog(),
      roomId,
      type: "goal_updated",
      summary: `${agent.name} updated ${result.updatedGoal.agentId} goal: ${result.updatedGoal.currentGoal}`,
      importance: "medium",
    });

    if (memory.entry) {
      writeDecisionLog(memory.log);
    }
  }

  return result.updatedGoal;
}

function getBusinessIdeaForAgent(ideas, agent) {
  const rankedIdeas = rankBusinessIdeas(ideas);
  const assignedIdea = rankedIdeas.find((idea) => idea.assignedAgentId === agent.id);
  const category = getBusinessIdeaCategoryForAgent(agent.id);
  const categoryIdea = rankedIdeas.find((idea) => idea.category === category);

  return assignedIdea || categoryIdea || rankedIdeas[0] || null;
}

function getBusinessIdeaFeedMessage(action, idea, agent) {
  const suffix = idea.nextAction ? ` Next: ${idea.nextAction}.` : "";

  return `${action}: "${idea.title}" for ${idea.category}. Status: ${idea.status}.${suffix} (${agent.name})`;
}

function maybeUpdateBusinessIdeas({ agent, roomId, topic, task, plan, goal, rhythm }) {
  if (!agent) {
    return null;
  }

  const now = new Date().toISOString();
  const currentIdeas = readBusinessIdeas();
  const messages = readMessages();
  const isCoordinator = ["host", "manager"].includes(agent.id);

  if (currentIdeas.length === 0) {
      const draft = getBusinessIdeaDraft({
        agent,
        roomName: getRoomName(roomId),
        topic,
        task,
        plan: plan || readCompanyPlan(),
        goal,
        rhythm,
        providers: app.locals.providers,
      });
    const created = createBusinessIdeaEntry({
      ideas: currentIdeas,
      ...draft,
      now,
    });

    if (!created.idea) {
      return null;
    }

    writeBusinessIdeas(created.ideas);
    storeAgentMessage({
      agentId: agent.id,
      sessionId: autonomousSessionId,
      roomId,
      message: getBusinessIdeaFeedMessage("Idea created", created.idea, agent),
      messages,
    });
    refreshCeoDigest();

    return created.idea;
  }

  if (isCoordinator) {
    if (rhythm.phase !== "review" && app.locals.agentThoughtIndex % 2 !== 0) {
      return null;
    }

    const rankedIdeas = rankBusinessIdeas(currentIdeas);
    const topIdea = rankedIdeas[0];

    if (!topIdea) {
      return null;
    }

    const promotedStatus = topIdea.status === "researching" || topIdea.status === "validating"
      ? "promising"
      : topIdea.status;
    const reviewNote = `${agent.name} reviewed ${rankedIdeas.length} ideas. Top idea: ${topIdea.title}.`;
    const updateResult = updateBusinessIdea({
      ideas: currentIdeas,
      ideaId: topIdea.id,
      patch: {
        status: promotedStatus,
        notes: reviewNote,
        nextAction: `Keep ${promotedStatus === "promising" ? "pushing" : "tracking"} ${topIdea.title}`,
        confidence: Math.min(10, topIdea.confidence + (promotedStatus === "promising" ? 1 : 0)),
      },
      now,
    });

    if (!updateResult.idea) {
      return null;
    }

    writeBusinessIdeas(updateResult.ideas);
    storeAgentMessage({
      agentId: agent.id,
      sessionId: autonomousSessionId,
      roomId,
      message: getBusinessIdeaFeedMessage("Idea review", updateResult.idea, agent),
      messages,
    });
    refreshCeoDigest();

    return updateResult.idea;
  }

  const targetIdea = getBusinessIdeaForAgent(currentIdeas, agent);

  if (!targetIdea) {
    const draft = getBusinessIdeaDraft({
      agent,
      roomName: getRoomName(roomId),
      topic,
      task,
      plan: plan || readCompanyPlan(),
      goal,
      rhythm,
      providers: app.locals.providers,
    });
    const created = createBusinessIdeaEntry({
      ideas: currentIdeas,
      ...draft,
      now,
    });

    if (!created.idea) {
      return null;
    }

    writeBusinessIdeas(created.ideas);
    storeAgentMessage({
      agentId: agent.id,
      sessionId: autonomousSessionId,
      roomId,
      message: getBusinessIdeaFeedMessage("Idea created", created.idea, agent),
      messages,
    });

    return created.idea;
  }

  const patch = getBusinessIdeaPatch({
    agent,
    currentIdea: targetIdea,
    task,
    plan: plan || readCompanyPlan(),
    goal,
    rhythm,
    providers: app.locals.providers,
  });
  const updateResult = updateBusinessIdea({
    ideas: currentIdeas,
    ideaId: targetIdea.id,
    patch,
    now,
  });

  if (!updateResult.idea) {
    return null;
  }

  writeBusinessIdeas(updateResult.ideas);

  if (isImportantBusinessIdeaChange(targetIdea, updateResult.idea) || app.locals.agentThoughtIndex % 4 === 0) {
    storeAgentMessage({
      agentId: agent.id,
      sessionId: autonomousSessionId,
      roomId,
      message: getBusinessIdeaFeedMessage("Idea update", updateResult.idea, agent),
      messages,
    });
    refreshCeoDigest();
  }

  return updateResult.idea;
}

function maybeAdvanceAutonomousTask({ agentId, sessionId, task, tasks, rhythm = getOperatingRhythm(app.locals.agentThoughtIndex) }) {
  const agent = agents[agentId];

  if (!agent || !agent.allowedActions.includes("advance_tasks")) {
    return null;
  }

  if (!task || (rhythm.phase !== "execute" && app.locals.agentThoughtIndex % 2 !== 0)) {
    return null;
  }

  const nextStatus = getNextTaskStatus(task.status);

  if (!nextStatus) {
    return null;
  }

  const updatedTask = updateTaskStatus({
    task,
    status: nextStatus,
    tasks,
  });

  if (!updatedTask) {
    return null;
  }

  maybeCreateTaskMemoryEvent(updatedTask);

  return storeTaskStatusMessage({
    task: updatedTask,
    agentId,
    sessionId,
    messages: readMessages(),
  });
}

function maybeCreateAutonomousTask({
  agentId,
  roomId,
  topic,
  message,
  plan = readCompanyPlan(),
  goal = null,
  rhythm = getOperatingRhythm(app.locals.agentThoughtIndex),
}) {
  const agent = agents[agentId];

  if (!agent || !agent.allowedActions.includes("create_tasks")) {
    return null;
  }

  if (app.locals.agentThoughtIndex % 4 !== 0) {
    return null;
  }

  const tasks = readTasks();
  const openRoomTasks = getRoomTasks(tasks, roomId).filter((task) => task.status !== "done");

  if (openRoomTasks.length >= 3) {
    return null;
  }

  const draft = getAgentTaskDraft(agent, roomId, topic, message, plan, goal, rhythm);

  return createTask({
    roomId,
    title: draft.title,
    description: draft.description,
    assignedAgentId: agentId,
    assignedByAgentId: agentId,
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
  const agent = chooseNextAgent(lastSpeakerId, roomId);
  const topic = updateTopicMemory(sessionId, roomId, contextMessages);
  const roomBrief = getRoomBrief(roomId);

  app.locals.agentThoughtState = {
    isThinking: true,
    nextAgentId: agent.id,
    sessionId,
    roomId,
    roomName: room.name,
    topic: topic === "the current business idea" ? roomBrief : topic,
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

app.get("/api/company-plan", (req, res) => {
  res.json({ plan: readCompanyPlan() });
});

app.get("/api/business-ideas", (req, res) => {
  res.json({ ideas: rankBusinessIdeas(readBusinessIdeas()) });
});

app.get("/api/ceo-digest", (req, res) => {
  res.json({ digest: refreshCeoDigest() });
});

app.get("/api/exports/ceo-digest", (req, res) => {
  const digest = refreshCeoDigest();
  const markdown = formatCeoDigestMarkdown(digest);

  sendMarkdown(res, markdown);
});

app.get("/api/exports/business-ideas", (req, res) => {
  const ideas = rankBusinessIdeas(readBusinessIdeas());
  const markdown = formatBusinessIdeasMarkdown(ideas, getPublicAgents());

  sendMarkdown(res, markdown);
});

app.get("/api/exports/business-ideas/:ideaId", (req, res) => {
  const ideas = rankBusinessIdeas(readBusinessIdeas());
  const idea = getBusinessIdeaById(ideas, req.params.ideaId);

  if (!idea) {
    return res.status(404).json({ error: "idea not found" });
  }

  const markdown = formatBusinessIdeaMarkdown(idea, getPublicAgents());

  sendMarkdown(res, markdown);
});

app.post("/api/commands", (req, res) => {
  const commandText = getValidMessage({
    message: req.body && (req.body.command || req.body.message),
  });
  const sessionId = getSessionId(req.body && req.body.sessionId);
  const roomId = getRoomId(req.body && req.body.roomId);

  if (!commandText) {
    return res.status(400).json({ error: "command is required" });
  }

  const result = executeCommand({
    commandText,
    plan: readCompanyPlan(),
    goals: readAgentGoals(),
    ideas: readBusinessIdeas(),
    decisions: readDecisionLog().decisions,
    tasks: readTasks(),
    memoryEvents: readDecisionLog().memoryEvents,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error || "unknown command" });
  }

  if (result.plan) {
    writeCompanyPlan(result.plan);
  }

  if (result.goals) {
    writeAgentGoals(result.goals);
  }

  if (result.ideas) {
    writeBusinessIdeas(result.ideas);
  }

  if (result.digest) {
    writeCeoDigest(result.digest);
  } else {
    refreshCeoDigest();
  }

  const messages = readMessages();
  const feedMessage = result.summary || `Command executed: ${commandText}`;
  const commandMessage = storeAgentMessage({
    agentId: "host",
    sessionId,
    roomId,
    message: `Command: ${feedMessage}`,
    messages,
  });

  return res.status(200).json({
    command: parseCommandText(commandText),
    summary: feedMessage,
    message: commandMessage,
    plan: result.plan || readCompanyPlan(),
    goals: result.goals || readAgentGoals(),
    ideas: result.ideas || readBusinessIdeas(),
    digest: result.digest || readCeoDigest(),
  });
});

app.get("/api/decisions", (req, res) => {
  const roomId = getValidText(req.query.roomId);
  const log = readDecisionLog();

  res.json({ decisions: filterByRoom(log.decisions, roomId) });
});

app.get("/api/memory-events", (req, res) => {
  const roomId = getValidText(req.query.roomId);
  const log = readDecisionLog();

  res.json({ memoryEvents: filterByRoom(log.memoryEvents, roomId) });
});

app.get("/api/agent-goals", (req, res) => {
  res.json({ goals: readAgentGoals() });
});

app.get("/api/operating-rhythm", (req, res) => {
  res.json({ rhythm: getOperatingRhythm(app.locals.agentThoughtIndex) });
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
  const body = req.body || {};
  const hasStatus = "status" in body;
  const status = hasStatus ? body.status : undefined;
  const hasBlockedReason = "blockedReason" in body;
  const blockedReason = hasBlockedReason ? (body.blockedReason || null) : undefined;

  if (!Number.isInteger(taskId) || taskId < 1) {
    return res.status(400).json({ error: "invalid taskId" });
  }

  if (!hasStatus && !hasBlockedReason) {
    return res.status(400).json({ error: "valid status is required" });
  }

  if (hasStatus && !taskStatuses.has(status)) {
    return res.status(400).json({ error: "valid status is required" });
  }

  const tasks = readTasks();
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "task not found" });
  }

  if (hasStatus) {
    const updatedTask = updateTaskStatus({ task, status, tasks });

    if (!updatedTask) {
      return res.status(400).json({ error: "invalid status progression" });
    }

    storeTaskStatusMessage({
      task: updatedTask,
      agentId: updatedTask.assignedAgentId,
      sessionId: autonomousSessionId,
      messages: readMessages(),
    });
    maybeCreateTaskMemoryEvent(updatedTask);
  }

  if (hasBlockedReason) {
    task.blockedReason = blockedReason;
    task.updatedAt = new Date().toISOString();
    writeTasks(tasks);
  }

  return res.json(task);
});

app.patch("/api/tasks/:taskId/handoff", (req, res) => {
  const taskId = Number(req.params.taskId);
  const body = req.body || {};
  const actingAgentId = getValidText(body.actingAgentId);
  const toAgentId = getValidText(body.toAgentId);
  const reason = getValidText(body.reason);

  if (!Number.isInteger(taskId) || taskId < 1) {
    return res.status(400).json({ error: "invalid taskId" });
  }

  if (!actingAgentId || !["manager", "host"].includes(actingAgentId)) {
    return res.status(400).json({ error: "only manager or host can reassign tasks" });
  }

  if (!toAgentId || !agents[toAgentId]) {
    return res.status(400).json({ error: "valid toAgentId is required" });
  }

  if (!reason) {
    return res.status(400).json({ error: "reason is required" });
  }

  const tasks = readTasks();
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "task not found" });
  }

  if (task.status === "done") {
    return res.status(400).json({ error: "cannot handoff a completed task" });
  }

  const updatedTask = handoffTask({
    task,
    fromAgentId: actingAgentId,
    toAgentId,
    reason,
    tasks,
    messages: readMessages(),
    sessionId: autonomousSessionId,
    isImportant: true,
  });

  return res.json(updatedTask);
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
  const roomBrief = getRoomBrief(roomId);
  const reply = addRoomBriefCue(app.locals.providers.ai.generateReply({
    agent,
    message: `${message} Room brief: ${roomBrief}`,
    context: {
      topic: roomBrief,
      messages: sessionMessages,
    },
  }), roomId);

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
app.locals.getOperatingRhythmForTest = getOperatingRhythm;
app.locals.getAgentThoughtActivity = getAgentThoughtActivity;
app.locals.readAgentGoalsForTest = readAgentGoals;
app.locals.readDecisionLogForTest = readDecisionLog;
app.locals.readCompanyPlanForTest = readCompanyPlan;
app.locals.readBusinessIdeasForTest = readBusinessIdeas;
app.locals.readCeoDigestForTest = readCeoDigest;
app.locals.readMessagesForTest = readMessages;
app.locals.readTasksForTest = readTasks;
app.locals.scheduleNextAgentThought = scheduleNextAgentThought;
app.locals.selectRoomTaskForTest = selectRoomTask;
app.locals.writeDecisionLogForTest = writeDecisionLog;
app.locals.writeCompanyPlanForTest = writeCompanyPlan;
app.locals.writeBusinessIdeasForTest = writeBusinessIdeas;
app.locals.writeCeoDigestForTest = writeCeoDigest;
app.locals.writeAgentGoalsForTest = writeAgentGoals;
app.locals.startAgentThoughtLoop = startAgentThoughtLoop;
app.locals.handoffTaskForTest = handoffTask;
app.locals.findBestAgentForTaskForTest = findBestAgentForTask;
app.locals.maybeHandoffAutonomousTaskForTest = maybeHandoffAutonomousTask;
app.locals.maybeUpdateBusinessIdeasForTest = maybeUpdateBusinessIdeas;
app.locals.refreshCeoDigestForTest = refreshCeoDigest;

module.exports = app;
