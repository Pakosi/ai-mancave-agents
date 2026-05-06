const maxTitleLength = 80;
const maxTextLength = 220;

function createEmptyDecisionLog() {
  return {
    decisions: [],
    memoryEvents: [],
  };
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  return value.trim();
}

function trimText(value, maxLength) {
  return cleanText(value).slice(0, maxLength);
}

function normalizeDecisionEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = Number(value.id);
  const title = trimText(value.title, maxTitleLength);
  const summary = trimText(value.summary, maxTextLength);

  if (!Number.isInteger(id) || id < 1 || title === "" || summary === "") {
    return null;
  }

  const entry = {
    id,
    timestamp: cleanText(value.timestamp, new Date().toISOString()),
    roomId: cleanText(value.roomId, "main"),
    agentId: cleanText(value.agentId, "host"),
    title,
    summary,
    reason: trimText(value.reason, maxTextLength),
    impact: trimText(value.impact, maxTextLength),
  };

  if (Number.isInteger(value.relatedTaskId) && value.relatedTaskId > 0) {
    entry.relatedTaskId = value.relatedTaskId;
  }

  return entry;
}

function normalizeMemoryEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = Number(value.id);
  const summary = trimText(value.summary, maxTextLength);

  if (!Number.isInteger(id) || id < 1 || summary === "") {
    return null;
  }

  return {
    id,
    timestamp: cleanText(value.timestamp, new Date().toISOString()),
    roomId: cleanText(value.roomId, "main"),
    type: cleanText(value.type, "event"),
    summary,
    importance: cleanText(value.importance, "medium"),
  };
}

function normalizeDecisionLog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyDecisionLog();
  }

  return {
    decisions: Array.isArray(value.decisions)
      ? value.decisions.map(normalizeDecisionEntry).filter(Boolean)
      : [],
    memoryEvents: Array.isArray(value.memoryEvents)
      ? value.memoryEvents.map(normalizeMemoryEvent).filter(Boolean)
      : [],
  };
}

function getNextEntryId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

function createDecisionEntry({ log, roomId, agentId, title, summary, reason, impact, relatedTaskId, now = new Date().toISOString() }) {
  const nextLog = normalizeDecisionLog(log);
  const entry = {
    id: getNextEntryId(nextLog.decisions),
    timestamp: now,
    roomId,
    agentId,
    title: trimText(title, maxTitleLength),
    summary: trimText(summary, maxTextLength),
    reason: trimText(reason, maxTextLength),
    impact: trimText(impact, maxTextLength),
  };

  if (Number.isInteger(relatedTaskId) && relatedTaskId > 0) {
    entry.relatedTaskId = relatedTaskId;
  }

  const normalizedEntry = normalizeDecisionEntry(entry);

  if (!normalizedEntry) {
    return { log: nextLog, entry: null };
  }

  nextLog.decisions.push(normalizedEntry);

  return { log: nextLog, entry: normalizedEntry };
}

function createMemoryEvent({ log, roomId, type, summary, importance = "medium", now = new Date().toISOString() }) {
  const nextLog = normalizeDecisionLog(log);
  const entry = normalizeMemoryEvent({
    id: getNextEntryId(nextLog.memoryEvents),
    timestamp: now,
    roomId,
    type,
    summary,
    importance,
  });

  if (!entry) {
    return { log: nextLog, entry: null };
  }

  nextLog.memoryEvents.push(entry);

  return { log: nextLog, entry };
}

function filterByRoom(items, roomId) {
  if (!roomId) {
    return items;
  }

  return items.filter((item) => item.roomId === roomId);
}

function getDecisionDraft({ agent, roomName, roomId, topic, task, plan }) {
  const focus = topic && topic !== "the current business idea" ? topic : roomName;
  const taskTitle = task ? task.title : plan.currentObjective;
  const titleByAgent = {
    analyst: `Track risk for ${focus}`,
    host: `Align ${roomName} discussion`,
    manager: `Coordinate next owner for ${focus}`,
    strategist: `Prioritize ${focus}`,
  };
  const impactByAgent = {
    analyst: "Makes success criteria and decision risk explicit.",
    host: "Keeps the room organized around a clear next step.",
    manager: "Improves ownership and follow-through.",
    strategist: "Keeps effort tied to positioning and priority.",
  };

  return {
    roomId,
    agentId: agent.id,
    title: titleByAgent[agent.id] || `Decide next step for ${focus}`,
    summary: `${agent.name} set direction for ${taskTitle}.`,
    reason: `Room focus: ${roomName}. Current objective: ${plan.currentObjective}`,
    impact: impactByAgent[agent.id] || "Keeps autonomous work connected to the plan.",
    relatedTaskId: task ? task.id : undefined,
  };
}

module.exports = {
  createDecisionEntry,
  createEmptyDecisionLog,
  createMemoryEvent,
  filterByRoom,
  getDecisionDraft,
  normalizeDecisionLog,
};
