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

module.exports = {
  createBusinessIdeaEntry,
  createEmptyBusinessIdeas,
  getBusinessIdeaScore,
  normalizeBusinessIdeas,
  normalizeBusinessIdea,
  rankBusinessIdeas,
  updateBusinessIdea,
};
