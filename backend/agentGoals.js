const phases = ["observe", "plan", "execute", "review"];
const statuses = new Set(["active", "blocked", "complete"]);

function getOperatingRhythm(thoughtIndex = 0) {
  const safeIndex = Number.isInteger(thoughtIndex) && thoughtIndex >= 0 ? thoughtIndex : 0;
  const phase = phases[safeIndex % phases.length];

  return {
    phase,
    cycleNumber: Math.floor(safeIndex / phases.length) + 1,
    phases: [...phases],
  };
}

function createGoalForAgent(agent, now = new Date().toISOString()) {
  const preferredRoom = agent.preferredRooms && agent.preferredRooms.length > 0 ? agent.preferredRooms[0] : "main";
  const focusArea = agent.expertise && agent.expertise.length > 0 ? agent.expertise[0] : agent.role;

  return {
    agentId: agent.id,
    currentGoal: `Advance ${focusArea} for the AI Mancave HQ.`,
    focusArea,
    successCriteria: `Produce one useful ${focusArea} outcome or next step.`,
    activeRoomId: preferredRoom,
    lastUpdated: now,
    status: "active",
  };
}

function createDefaultAgentGoals(agents, now = new Date().toISOString()) {
  return Object.values(agents).map((agent) => createGoalForAgent(agent, now));
}

function normalizeGoal(value, agentsById, now = new Date().toISOString()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const agentId = typeof value.agentId === "string" ? value.agentId.trim() : "";

  if (!agentsById[agentId]) {
    return null;
  }

  const fallback = createGoalForAgent(agentsById[agentId], now);
  const status = statuses.has(value.status) ? value.status : fallback.status;

  return {
    agentId,
    currentGoal: typeof value.currentGoal === "string" && value.currentGoal.trim() !== ""
      ? value.currentGoal.trim()
      : fallback.currentGoal,
    focusArea: typeof value.focusArea === "string" && value.focusArea.trim() !== ""
      ? value.focusArea.trim()
      : fallback.focusArea,
    successCriteria: typeof value.successCriteria === "string" && value.successCriteria.trim() !== ""
      ? value.successCriteria.trim()
      : fallback.successCriteria,
    activeRoomId: typeof value.activeRoomId === "string" && value.activeRoomId.trim() !== ""
      ? value.activeRoomId.trim()
      : fallback.activeRoomId,
    lastUpdated: typeof value.lastUpdated === "string" && value.lastUpdated.trim() !== "" ? value.lastUpdated : now,
    status,
  };
}

function normalizeAgentGoals(value, agents, now = new Date().toISOString()) {
  const agentsById = Object.fromEntries(Object.values(agents).map((agent) => [agent.id, agent]));
  const existingGoals = Array.isArray(value) ? value.map((item) => normalizeGoal(item, agentsById, now)).filter(Boolean) : [];
  const goalsByAgentId = Object.fromEntries(existingGoals.map((goal) => [goal.agentId, goal]));

  return Object.values(agents).map((agent) => goalsByAgentId[agent.id] || createGoalForAgent(agent, now));
}

function getGoalForAgent(goals, agentId) {
  return goals.find((goal) => goal.agentId === agentId) || null;
}

function goalMatchesTask(task, goal) {
  if (!goal) {
    return false;
  }

  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  const terms = [goal.currentGoal, goal.focusArea, goal.successCriteria]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);

  return terms.some((word) => text.includes(word));
}

function updateGoalForCoordinator({ goals, agent, roomId, topic, phase, now = new Date().toISOString() }) {
  const nextGoals = goals.map((goal) => ({ ...goal }));

  if (!agent || !["host", "manager"].includes(agent.id)) {
    return { goals: nextGoals, updatedGoal: null };
  }

  const targetGoal = nextGoals.find((goal) => goal.activeRoomId === roomId && goal.status === "active")
    || nextGoals.find((goal) => goal.status === "active")
    || nextGoals[0];

  if (!targetGoal) {
    return { goals: nextGoals, updatedGoal: null };
  }

  const focus = topic && topic !== "the current business idea" ? topic : targetGoal.focusArea;
  targetGoal.currentGoal = `${phase}: move ${focus} forward in the HQ.`;
  targetGoal.successCriteria = `Finish one ${phase} step and leave a clear next action.`;
  targetGoal.activeRoomId = roomId;
  targetGoal.lastUpdated = now;

  return { goals: nextGoals, updatedGoal: targetGoal };
}

module.exports = {
  createDefaultAgentGoals,
  getGoalForAgent,
  getOperatingRhythm,
  goalMatchesTask,
  normalizeAgentGoals,
  updateGoalForCoordinator,
};
