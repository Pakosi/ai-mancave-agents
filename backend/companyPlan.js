const defaultCompanyPlan = {
  currentObjective: "Turn WOYS into a practical agent workspace for small-team planning and execution.",
  activePriorities: [
    "Validate room-based agent workflows",
    "Keep autonomous tasks tied to business outcomes",
  ],
  keyRisks: [
    "Agent activity may become repetitive without clear decisions",
  ],
  nextRecommendedActions: [
    "Use each room to create one concrete next task",
  ],
  recentDecisions: [
    "Use lightweight JSON persistence and rule-based agents",
  ],
  updatedAt: null,
};

const maxItems = 5;

function createDefaultCompanyPlan(now = new Date().toISOString()) {
  return {
    ...defaultCompanyPlan,
    activePriorities: [...defaultCompanyPlan.activePriorities],
    keyRisks: [...defaultCompanyPlan.keyRisks],
    nextRecommendedActions: [...defaultCompanyPlan.nextRecommendedActions],
    recentDecisions: [...defaultCompanyPlan.recentDecisions],
    updatedAt: now,
  };
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string" && item.trim() !== "")
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function normalizeCompanyPlan(value, now = new Date().toISOString()) {
  const fallback = createDefaultCompanyPlan(now);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const activePriorities = normalizeList(value.activePriorities);
  const keyRisks = normalizeList(value.keyRisks);
  const nextRecommendedActions = normalizeList(value.nextRecommendedActions);
  const recentDecisions = normalizeList(value.recentDecisions);

  return {
    currentObjective: typeof value.currentObjective === "string" && value.currentObjective.trim() !== ""
      ? value.currentObjective.trim()
      : fallback.currentObjective,
    activePriorities: activePriorities.length > 0 ? activePriorities : fallback.activePriorities,
    keyRisks: keyRisks.length > 0 ? keyRisks : fallback.keyRisks,
    nextRecommendedActions: nextRecommendedActions.length > 0 ? nextRecommendedActions : fallback.nextRecommendedActions,
    recentDecisions: recentDecisions.length > 0 ? recentDecisions : fallback.recentDecisions,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim() !== "" ? value.updatedAt : now,
  };
}

function addUniqueFirst(items, item) {
  const cleanItem = typeof item === "string" ? item.trim() : "";

  if (cleanItem === "") {
    return items.slice(0, maxItems);
  }

  return [
    cleanItem,
    ...items.filter((existing) => existing.toLowerCase() !== cleanItem.toLowerCase()),
  ].slice(0, maxItems);
}

function getAgentPlanContribution({ agent, roomName, topic, task }) {
  const focus = topic && topic !== "the current business idea" ? topic : roomName;
  const taskCue = task ? ` via "${task.title}"` : "";

  if (agent.id === "strategist") {
    return {
      activePriorities: `Prioritize ${focus} by impact, effort, and positioning`,
    };
  }

  if (agent.id === "analyst") {
    return {
      keyRisks: `Define success metrics and decision risks for ${focus}`,
    };
  }

  if (agent.id === "builder") {
    return {
      nextRecommendedActions: `Ship the next product step for ${focus}${taskCue}`,
    };
  }

  if (agent.id === "researcher") {
    return {
      nextRecommendedActions: `Gather user, market, or competitor evidence for ${focus}`,
    };
  }

  if (agent.id === "sales") {
    return {
      nextRecommendedActions: `Validate buyer demand and revenue angle for ${focus}`,
    };
  }

  if (agent.id === "manager") {
    return {
      nextRecommendedActions: `Assign owner and checkpoint for ${focus}${taskCue}`,
      recentDecisions: `Coordinate ${roomName} work around the current objective`,
    };
  }

  if (agent.id === "host") {
    return {
      recentDecisions: `Keep ${roomName} discussion organized around one next step`,
    };
  }

  return {};
}

function updateCompanyPlanForAgent({ plan, agent, roomName, topic, task, now = new Date().toISOString() }) {
  const nextPlan = normalizeCompanyPlan(plan, now);
  const contribution = getAgentPlanContribution({ agent, roomName, topic, task });

  if (contribution.activePriorities) {
    nextPlan.activePriorities = addUniqueFirst(nextPlan.activePriorities, contribution.activePriorities);
  }

  if (contribution.keyRisks) {
    nextPlan.keyRisks = addUniqueFirst(nextPlan.keyRisks, contribution.keyRisks);
  }

  if (contribution.nextRecommendedActions) {
    nextPlan.nextRecommendedActions = addUniqueFirst(nextPlan.nextRecommendedActions, contribution.nextRecommendedActions);
  }

  if (contribution.recentDecisions) {
    nextPlan.recentDecisions = addUniqueFirst(nextPlan.recentDecisions, contribution.recentDecisions);
  }

  nextPlan.updatedAt = now;

  return nextPlan;
}

function getPrimaryPlanFocus(plan) {
  const normalizedPlan = normalizeCompanyPlan(plan);
  const priority = normalizedPlan.activePriorities[0];

  return priority || normalizedPlan.currentObjective;
}

module.exports = {
  createDefaultCompanyPlan,
  getPrimaryPlanFocus,
  normalizeCompanyPlan,
  updateCompanyPlanForAgent,
};
