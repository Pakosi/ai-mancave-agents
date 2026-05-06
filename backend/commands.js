const {
  buildCeoDigest,
  createEmptyCeoDigest,
} = require("./ceoDigest");
const {
  getBusinessIdeaScore,
  rankBusinessIdeas,
  updateBusinessIdea,
} = require("./businessIdeas");
const { syncRecentDecisionsFromLog } = require("./companyPlan");

const commandCategoryLabels = {
  trading: "Trading",
  automation: "AI Automation",
  arbitrage: "Arbitrage",
  research: "Niche Research",
  product: "MVP/Product",
  risk: "Risk/Scoring",
};

const categoryAgentIds = {
  Trading: ["sales"],
  "AI Automation": ["assistant"],
  Arbitrage: ["strategist"],
  "Niche Research": ["researcher"],
  "MVP/Product": ["builder"],
  "Risk/Scoring": ["analyst"],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function titleCase(value) {
  return cleanText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseCommandText(value) {
  const text = cleanText(value).toLowerCase();

  if (text === "summarize today") {
    return { type: "summarize_today", rawText: cleanText(value) };
  }

  if (text === "rank ideas") {
    return { type: "rank_ideas", rawText: cleanText(value) };
  }

  if (text === "kill weak ideas") {
    return { type: "kill_weak_ideas", rawText: cleanText(value) };
  }

  if (text.startsWith("focus ")) {
    const categoryKey = text.replace(/^focus\s+/, "");

    return {
      type: "focus_category",
      category: commandCategoryLabels[categoryKey] || titleCase(categoryKey),
      rawText: cleanText(value),
    };
  }

  if (text.startsWith("prioritize ")) {
    const categoryKey = text.replace(/^prioritize\s+/, "");

    return {
      type: "prioritize_category",
      category: commandCategoryLabels[categoryKey] || titleCase(categoryKey),
      rawText: cleanText(value),
    };
  }

  return null;
}

function isCommandText(value) {
  return Boolean(parseCommandText(value));
}

function addUniqueFirst(items, item) {
  const cleanItem = cleanText(item);

  if (cleanItem === "") {
    return Array.isArray(items) ? items.slice() : [];
  }

  const list = Array.isArray(items) ? items : [];

  return [
    cleanItem,
    ...list.filter((existing) => cleanText(existing).toLowerCase() !== cleanItem.toLowerCase()),
  ].slice(0, 5);
}

function getCategoryAgentIds(category) {
  return categoryAgentIds[category] || [];
}

function getSummaryFromIdeas(ideas, category) {
  const rankedIdeas = category
    ? rankBusinessIdeas(ideas).filter((idea) => idea.category === category)
    : rankBusinessIdeas(ideas);

  if (rankedIdeas.length === 0) {
    return null;
  }

  return rankedIdeas[0];
}

function applyCategoryFocus({ plan, goals, ideas, category, now = new Date().toISOString(), emphasis = "focus" }) {
  const nextPlan = {
    ...plan,
    currentObjective: `Focus the HQ on ${category} opportunities.`,
    activePriorities: addUniqueFirst(plan.activePriorities, `Prioritize ${category} ideas`),
    nextRecommendedActions: addUniqueFirst(plan.nextRecommendedActions, `Advance the strongest ${category} idea`),
    recentDecisions: addUniqueFirst(plan.recentDecisions, `Command: ${emphasis} ${category}`),
    updatedAt: now,
  };
  const targetAgentIds = getCategoryAgentIds(category);
  const nextGoals = goals.map((goal) => {
    if (!targetAgentIds.includes(goal.agentId) && !["host", "manager"].includes(goal.agentId)) {
      return { ...goal };
    }

    return {
      ...goal,
      currentGoal: `Focus on ${category} opportunities.`,
      focusArea: category,
      successCriteria: `Advance one ${category} idea.`,
      activeRoomId: "main",
      lastUpdated: now,
      status: "active",
    };
  });
  const ideaSeed = getSummaryFromIdeas(ideas, category);
  let nextIdeas = ideas.map((idea) => ({ ...idea }));

  if (ideaSeed) {
    nextIdeas = nextIdeas.map((idea) => {
      if (idea.id !== ideaSeed.id) {
        return idea;
      }

      const patch = {
        status: idea.status === "building" ? "building" : "promising",
        confidence: Math.min(10, (idea.confidence || 0) + 1),
        nextAction: `Advance the ${category} opportunity`,
        notes: `${emphasis === "focus" ? "Focused" : "Prioritized"} on ${category}.`,
      };

      return updateBusinessIdea({
        ideas: [idea],
        ideaId: idea.id,
        patch,
        now,
      }).idea || idea;
    });
  }

  return {
    plan: nextPlan,
    goals: nextGoals,
    ideas: nextIdeas,
    summary: `${titleCase(emphasis)} ${category}.`,
  };
}

function applySummarizeToday({ plan, ideas, decisions, tasks, memoryEvents, now = new Date().toISOString() }) {
  const digest = buildCeoDigest({ ideas, decisions, tasks, memoryEvents, now });
  const nextPlan = syncRecentDecisionsFromLog({
    ...plan,
    currentObjective: "Summarize today and keep the strongest opportunity moving.",
    nextRecommendedActions: addUniqueFirst(plan.nextRecommendedActions, digest.recommendedNextAction),
    updatedAt: now,
  }, decisions, now);

  return {
    plan: nextPlan,
    digest,
    summary: digest.rankedOpportunitySummary,
  };
}

function applyRankIdeas({ plan, ideas, decisions, tasks, memoryEvents, now = new Date().toISOString() }) {
  const digest = buildCeoDigest({ ideas, decisions, tasks, memoryEvents, now });
  const nextPlan = {
    ...plan,
    currentObjective: "Rank ideas and keep the strongest one active.",
    activePriorities: addUniqueFirst(plan.activePriorities, "Rank and compare active ideas"),
    nextRecommendedActions: addUniqueFirst(plan.nextRecommendedActions, digest.recommendedNextAction),
    recentDecisions: addUniqueFirst(plan.recentDecisions, `Ranked ${rankBusinessIdeas(ideas)[0] ? rankBusinessIdeas(ideas)[0].title : "ideas"}`),
    updatedAt: now,
  };

  return {
    plan: nextPlan,
    digest,
    summary: digest.rankedOpportunitySummary,
  };
}

function applyKillWeakIdeas({ plan, ideas, decisions, tasks, memoryEvents, now = new Date().toISOString() }) {
  const rankedIdeas = rankBusinessIdeas(ideas);
  const weakIdeas = rankedIdeas.filter((idea) => getBusinessIdeaScore(idea) <= 4 && idea.status !== "killed");
  const nextIdeas = ideas.map((idea) => ({ ...idea }));

  weakIdeas.forEach((weakIdea) => {
    const index = nextIdeas.findIndex((idea) => idea.id === weakIdea.id);

    if (index >= 0) {
      const updated = updateBusinessIdea({
        ideas: nextIdeas,
        ideaId: weakIdea.id,
        patch: {
          status: "killed",
          nextAction: "Archive weak idea",
          notes: `Killed by command at ${now}.`,
        },
        now,
      });

      nextIdeas.splice(0, nextIdeas.length, ...updated.ideas);
    }
  });

  const digest = buildCeoDigest({ ideas: nextIdeas, decisions, tasks, memoryEvents, now });
  const nextPlan = {
    ...plan,
    currentObjective: "Remove weak ideas and protect focus.",
    keyRisks: addUniqueFirst(plan.keyRisks, "Weak ideas can dilute focus"),
    nextRecommendedActions: addUniqueFirst(plan.nextRecommendedActions, digest.recommendedNextAction),
    updatedAt: now,
  };

  return {
    plan: nextPlan,
    ideas: nextIdeas,
    digest,
    killedIdeas: weakIdeas.map((idea) => idea.title),
    summary: weakIdeas.length > 0 ? `Killed ${weakIdeas.length} weak idea${weakIdeas.length === 1 ? "" : "s"}.` : "No weak ideas to kill.",
  };
}

function executeCommand({
  commandText,
  plan,
  goals,
  ideas,
  decisions,
  tasks,
  memoryEvents,
  now = new Date().toISOString(),
}) {
  const parsed = parseCommandText(commandText);

  if (!parsed) {
    return {
      ok: false,
      error: "Unknown command",
    };
  }

  if (parsed.type === "summarize_today") {
    const result = applySummarizeToday({ plan, ideas, decisions, tasks, memoryEvents, now });

    return {
      ok: true,
      command: parsed,
      ...result,
      goals: goals.map((goal) => ({ ...goal })),
    };
  }

  if (parsed.type === "rank_ideas") {
    const result = applyRankIdeas({ plan, ideas, decisions, tasks, memoryEvents, now });

    return {
      ok: true,
      command: parsed,
      ...result,
      goals: goals.map((goal) => ({ ...goal })),
      ideas: ideas.map((idea) => ({ ...idea })),
    };
  }

  if (parsed.type === "kill_weak_ideas") {
    const result = applyKillWeakIdeas({ plan, ideas, decisions, tasks, memoryEvents, now });

    return {
      ok: true,
      command: parsed,
      ...result,
      goals: goals.map((goal) => ({ ...goal })),
    };
  }

  if (parsed.type === "focus_category" || parsed.type === "prioritize_category") {
    const result = applyCategoryFocus({
      plan,
      goals,
      ideas,
      category: parsed.category,
      now,
      emphasis: parsed.type === "focus_category" ? "focus" : "prioritize",
    });

    const digest = buildCeoDigest({ ideas: result.ideas, decisions, tasks, memoryEvents, now });

    return {
      ok: true,
      command: parsed,
      plan: result.plan,
      goals: result.goals,
      ideas: result.ideas,
      digest,
      summary: result.summary,
    };
  }

  return {
    ok: false,
    error: "Unknown command",
  };
}

module.exports = {
  applyCategoryFocus,
  applyKillWeakIdeas,
  applyRankIdeas,
  applySummarizeToday,
  executeCommand,
  isCommandText,
  parseCommandText,
};
