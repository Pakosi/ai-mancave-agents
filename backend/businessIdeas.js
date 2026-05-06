const allowedStatuses = new Set([
  "researching",
  "validating",
  "promising",
  "building",
  "paused",
  "killed",
]);

const statusWeights = {
  researching: 0,
  validating: 1,
  promising: 4,
  building: 3,
  paused: -3,
  killed: -10,
};

const ideaCategoryByAgentId = {
  sales: "Trading",
  assistant: "AI Automation",
  strategist: "Arbitrage",
  researcher: "Niche Research",
  builder: "MVP/Product",
  analyst: "Risk/Scoring",
  host: "Review / Ranking",
  manager: "Review / Ranking",
};

const ideaTitleHintsByAgentId = {
  sales: "Dealer revenue",
  assistant: "Workflow automation",
  strategist: "Opportunity spread",
  researcher: "Niche discovery",
  builder: "MVP prototype",
  analyst: "Risk model",
  host: "Idea ranking",
  manager: "Idea review",
};

const maxTextLength = 260;

function createEmptyBusinessIdeas() {
  return [];
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed === "" ? fallback : trimmed;
}

function normalizeNumber(value, fallback = 5) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(10, Math.max(0, Math.round(numericValue)));
}

function normalizeStatus(value, fallback = "researching") {
  if (typeof value !== "string") {
    return fallback;
  }

  const status = value.trim();

  return allowedStatuses.has(status) ? status : fallback;
}

function normalizeBusinessIdea(value, now = new Date().toISOString()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const title = cleanText(value.title);

  if (title === "") {
    return null;
  }

  return {
    id: Number.isInteger(value.id) && value.id > 0 ? value.id : null,
    createdAt: cleanText(value.createdAt, now),
    updatedAt: cleanText(value.updatedAt, now),
    title: title.slice(0, 80),
    category: cleanText(value.category, "general").slice(0, 40),
    description: cleanText(value.description).slice(0, maxTextLength),
    profitPotential: normalizeNumber(value.profitPotential),
    startupCost: normalizeNumber(value.startupCost),
    risk: normalizeNumber(value.risk),
    difficulty: normalizeNumber(value.difficulty),
    confidence: normalizeNumber(value.confidence),
    status: normalizeStatus(value.status),
    assignedAgentId: cleanText(value.assignedAgentId, null),
    nextAction: cleanText(value.nextAction).slice(0, maxTextLength),
    notes: cleanText(value.notes).slice(0, maxTextLength),
  };
}

function normalizeBusinessIdeas(value, now = new Date().toISOString()) {
  const ideas = Array.isArray(value)
    ? value
    : Array.isArray(value && value.ideas)
      ? value.ideas
      : [];

  const normalizedIdeas = ideas
    .map((idea) => normalizeBusinessIdea(idea, now))
    .filter(Boolean);

  const usedIds = new Set();
  let nextId = normalizedIdeas.reduce((maxId, idea) => Math.max(maxId, idea.id || 0), 0) + 1;

  return normalizedIdeas.map((idea) => {
    let id = idea.id;

    if (!Number.isInteger(id) || id < 1 || usedIds.has(id)) {
      id = nextId;
      nextId += 1;
    }

    usedIds.add(id);

    return {
      ...idea,
      id,
    };
  });
}

function getNextIdeaId(ideas) {
  return ideas.reduce((maxId, idea) => Math.max(maxId, idea.id), 0) + 1;
}

function createBusinessIdeaEntry({
  ideas,
  title,
  category = "general",
  description = "",
  profitPotential = 5,
  startupCost = 5,
  risk = 5,
  difficulty = 5,
  confidence = 5,
  status = "researching",
  assignedAgentId = null,
  nextAction = "",
  notes = "",
  now = new Date().toISOString(),
}) {
  const nextIdeas = normalizeBusinessIdeas(ideas, now);
  const idea = normalizeBusinessIdea({
    id: getNextIdeaId(nextIdeas),
    createdAt: now,
    updatedAt: now,
    title,
    category,
    description,
    profitPotential,
    startupCost,
    risk,
    difficulty,
    confidence,
    status,
    assignedAgentId,
    nextAction,
    notes,
  }, now);

  if (!idea) {
    return { ideas: nextIdeas, idea: null };
  }

  nextIdeas.push(idea);

  return { ideas: nextIdeas, idea };
}

function updateBusinessIdea({ ideas, ideaId, patch = {}, now = new Date().toISOString() }) {
  const nextIdeas = normalizeBusinessIdeas(ideas, now);
  const numericIdeaId = Number(ideaId);
  const index = nextIdeas.findIndex((idea) => idea.id === numericIdeaId);

  if (index < 0) {
    return { ideas: nextIdeas, idea: null };
  }

  const currentIdea = nextIdeas[index];
  const updatedIdea = normalizeBusinessIdea({
    ...currentIdea,
    ...patch,
    id: currentIdea.id,
    createdAt: currentIdea.createdAt,
    updatedAt: now,
  }, now);

  if (!updatedIdea) {
    return { ideas: nextIdeas, idea: null };
  }

  nextIdeas[index] = updatedIdea;

  return { ideas: nextIdeas, idea: updatedIdea };
}

function getBusinessIdeaScore(idea) {
  const statusWeight = statusWeights[idea.status] || 0;

  return (
    (idea.confidence * 2)
    + (idea.profitPotential * 1.5)
    + statusWeight
    - (idea.startupCost * 0.8)
    - (idea.risk * 1.3)
    - (idea.difficulty * 0.6)
  );
}

function getBusinessIdeaCategoryForAgent(agentId) {
  return ideaCategoryByAgentId[agentId] || "General";
}

function getBusinessIdeaTitleHintForAgent(agentId) {
  return ideaTitleHintsByAgentId[agentId] || "Business idea";
}

function cleanFocus(value, fallback) {
  const text = cleanText(value);

  return text !== "" ? text : fallback;
}

function getBusinessIdeaFocus({ agent, roomName, topic, task, plan, goal }) {
  const roomFocus = cleanFocus(roomName, "HQ");
  const topicFocus = cleanFocus(topic, plan && plan.currentObjective ? plan.currentObjective : "new opportunity");
  const taskFocus = task && task.title ? task.title : "";
  const goalFocus = goal && goal.currentGoal ? goal.currentGoal : "";
  const pieces = [taskFocus, goalFocus, topicFocus, roomFocus].filter(Boolean);
  const headline = pieces[0] || "new opportunity";

  return {
    headline: headline.slice(0, 80),
    description: `${agent.role}: ${topicFocus}. Current objective: ${plan.currentObjective}. ${taskFocus ? `Task focus: ${taskFocus}.` : ""}`.trim().slice(0, maxTextLength),
    nextAction: taskFocus
      ? `Move "${taskFocus}" one step forward`
      : `Clarify the next move for ${topicFocus}`,
  };
}

function getBusinessIdeaDraft({ agent, roomName, topic, task, plan, goal, rhythm }) {
  const category = getBusinessIdeaCategoryForAgent(agent.id);
  const focus = getBusinessIdeaFocus({ agent, roomName, topic, task, plan, goal });
  const titleHint = getBusinessIdeaTitleHintForAgent(agent.id);
  const baseConfidenceByAgent = {
    sales: 7,
    assistant: 6,
    strategist: 6,
    researcher: 5,
    builder: 7,
    analyst: 6,
    host: 5,
    manager: 5,
  };
  const baseProfitByAgent = {
    sales: 8,
    assistant: 7,
    strategist: 7,
    researcher: 5,
    builder: 7,
    analyst: 5,
    host: 4,
    manager: 4,
  };
  const baseRiskByAgent = {
    sales: 4,
    assistant: 4,
    strategist: 5,
    researcher: 3,
    builder: 5,
    analyst: 6,
    host: 4,
    manager: 4,
  };
  const baseDifficultyByAgent = {
    sales: 4,
    assistant: 4,
    strategist: 5,
    researcher: 5,
    builder: 6,
    analyst: 5,
    host: 3,
    manager: 4,
  };
  const baseStartupByAgent = {
    sales: 4,
    assistant: 3,
    strategist: 3,
    researcher: 2,
    builder: 6,
    analyst: 2,
    host: 2,
    manager: 3,
  };
  const phaseBias = {
    observe: { confidence: -1, status: "researching" },
    plan: { confidence: 0, status: "validating" },
    execute: { confidence: 1, status: "building" },
    review: { confidence: 1, status: "promising" },
  }[rhythm.phase] || { confidence: 0, status: "researching" };

  return {
    title: `${category}: ${titleHint} ${focus.headline}`.slice(0, 80),
    category,
    description: focus.description,
    profitPotential: baseProfitByAgent[agent.id] || 5,
    startupCost: baseStartupByAgent[agent.id] || 4,
    risk: baseRiskByAgent[agent.id] || 5,
    difficulty: baseDifficultyByAgent[agent.id] || 5,
    confidence: Math.min(10, Math.max(0, (baseConfidenceByAgent[agent.id] || 5) + phaseBias.confidence)),
    status: phaseBias.status,
    assignedAgentId: agent.id,
    nextAction: focus.nextAction,
    notes: `${agent.name} reviewed ${roomName}. ${goal && goal.currentGoal ? goal.currentGoal : plan.currentObjective}`.slice(0, maxTextLength),
  };
}

function getBusinessIdeaPatch({ agent, currentIdea, task, plan, goal, rhythm }) {
  const taskFocus = task && task.title ? task.title : "";
  const goalFocus = goal && goal.currentGoal ? goal.currentGoal : "";
  const currentStatus = currentIdea.status;
  const nextStatusByPhase = {
    observe: "researching",
    plan: "validating",
    execute: "building",
    review: "promising",
  };
  const status = agent.id === "analyst"
    ? (currentIdea.risk >= 7 ? "paused" : currentStatus)
    : (nextStatusByPhase[rhythm.phase] || currentStatus);
  const confidenceBump = {
    observe: 0,
    plan: 1,
    execute: 2,
    review: 1,
  }[rhythm.phase] || 0;
  const profitBump = agent.id === "sales" ? 1 : agent.id === "builder" ? 1 : 0;
  const riskDrop = agent.id === "analyst" ? 1 : agent.id === "researcher" ? 1 : 0;
  const difficultyDrop = agent.id === "builder" ? 1 : 0;
  const nextAction = taskFocus
    ? `Advance "${taskFocus}" into the next step`
    : currentIdea.nextAction || `Refine ${currentIdea.category}`;
  const notes = `${agent.name} updated ${currentIdea.title}. ${goalFocus || plan.currentObjective}`.trim();

  return {
    status,
    confidence: Math.min(10, Math.max(0, currentIdea.confidence + confidenceBump)),
    profitPotential: Math.min(10, Math.max(0, currentIdea.profitPotential + profitBump)),
    risk: Math.min(10, Math.max(0, currentIdea.risk - riskDrop)),
    difficulty: Math.min(10, Math.max(0, currentIdea.difficulty - difficultyDrop)),
    nextAction: nextAction.slice(0, maxTextLength),
    notes: notes.slice(0, maxTextLength),
  };
}

function isImportantBusinessIdeaChange(previousIdea, updatedIdea) {
  if (!previousIdea || !updatedIdea) {
    return false;
  }

  if (previousIdea.status !== updatedIdea.status) {
    return true;
  }

  const confidenceChange = Math.abs((updatedIdea.confidence || 0) - (previousIdea.confidence || 0));
  const profitChange = Math.abs((updatedIdea.profitPotential || 0) - (previousIdea.profitPotential || 0));
  const riskChange = Math.abs((updatedIdea.risk || 0) - (previousIdea.risk || 0));

  return confidenceChange >= 2 || profitChange >= 2 || riskChange >= 2;
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rankBusinessIdeas(ideas) {
  return normalizeBusinessIdeas(ideas)
    .slice()
    .sort((first, second) => {
      const scoreDifference = getBusinessIdeaScore(second) - getBusinessIdeaScore(first);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const updatedDifference = toTimestamp(second.updatedAt) - toTimestamp(first.updatedAt);

      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      return first.title.localeCompare(second.title);
    });
}

function getAgentDisplayName(agentId, agents = []) {
  if (!agentId) {
    return "Unassigned";
  }

  const agent = agents.find((item) => item.id === agentId);

  return agent ? agent.name : agentId;
}

function formatBusinessIdeaMarkdown(idea, agents = []) {
  if (!idea) {
    return "";
  }

  return [
    `# ${idea.title}`,
    "",
    `- Category: ${idea.category}`,
    `- Status: ${idea.status}`,
    `- Assigned Agent: ${getAgentDisplayName(idea.assignedAgentId, agents)}`,
    `- Confidence: ${idea.confidence}/10`,
    `- Profit Potential: ${idea.profitPotential}/10`,
    `- Startup Cost: ${idea.startupCost}/10`,
    `- Risk: ${idea.risk}/10`,
    `- Difficulty: ${idea.difficulty}/10`,
    `- Next Action: ${idea.nextAction || "No next action yet."}`,
    `- Notes: ${idea.notes || "None."}`,
    "",
    `- Created At: ${idea.createdAt}`,
    `- Updated At: ${idea.updatedAt}`,
  ].join("\n");
}

function formatBusinessIdeasMarkdown(ideas, agents = []) {
  const rankedIdeas = rankBusinessIdeas(ideas);
  const lines = [
    "# WOYS Business Ideas",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  if (rankedIdeas.length === 0) {
    lines.push("No business ideas yet.");
    return lines.join("\n");
  }

  rankedIdeas.slice(0, 10).forEach((idea, index) => {
    lines.push(
      `## ${index + 1}. ${idea.title}`,
      "",
      `- Category: ${idea.category}`,
      `- Status: ${idea.status}`,
      `- Assigned Agent: ${getAgentDisplayName(idea.assignedAgentId, agents)}`,
      `- Confidence: ${idea.confidence}/10`,
      `- Profit Potential: ${idea.profitPotential}/10`,
      `- Risk: ${idea.risk}/10`,
      `- Difficulty: ${idea.difficulty}/10`,
      `- Next Action: ${idea.nextAction || "No next action yet."}`,
      "",
    );
  });

  return lines.join("\n").trimEnd();
}

function getBusinessIdeaById(ideas, ideaId) {
  const numericIdeaId = Number(ideaId);

  if (!Number.isInteger(numericIdeaId) || numericIdeaId < 1) {
    return null;
  }

  return normalizeBusinessIdeas(ideas).find((idea) => idea.id === numericIdeaId) || null;
}

module.exports = {
  createBusinessIdeaEntry,
  createEmptyBusinessIdeas,
  formatBusinessIdeaMarkdown,
  formatBusinessIdeasMarkdown,
  getBusinessIdeaCategoryForAgent,
  getBusinessIdeaDraft,
  getBusinessIdeaPatch,
  getBusinessIdeaById,
  getBusinessIdeaScore,
  isImportantBusinessIdeaChange,
  normalizeBusinessIdeas,
  normalizeBusinessIdea,
  rankBusinessIdeas,
  updateBusinessIdea,
};
