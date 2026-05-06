const { rankBusinessIdeas } = require("./businessIdeas");

function createEmptyCeoDigest(now = new Date().toISOString()) {
  return {
    updatedAt: now,
    rankedOpportunitySummary: "No business ideas yet.",
    topIdeas: [],
    newlyCreatedIdeas: [],
    pausedOrKilledIdeas: [],
    highestConfidenceOpportunity: null,
    biggestRisk: null,
    recommendedNextAction: "Create the first idea.",
  };
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed === "" ? fallback : trimmed;
}

function summarizeIdea(idea) {
  if (!idea) {
    return null;
  }

  return {
    id: idea.id,
    title: idea.title,
    category: idea.category,
    status: idea.status,
    confidence: idea.confidence,
    profitPotential: idea.profitPotential,
    risk: idea.risk,
    difficulty: idea.difficulty,
    assignedAgentId: idea.assignedAgentId || null,
    nextAction: cleanText(idea.nextAction, "No next action yet."),
    notes: cleanText(idea.notes, ""),
    updatedAt: idea.updatedAt,
    createdAt: idea.createdAt,
  };
}

function getLatestItem(items, predicate = () => true) {
  return items.find(predicate) || null;
}

function buildCeoDigest({
  ideas = [],
  decisions = [],
  tasks = [],
  memoryEvents = [],
  now = new Date().toISOString(),
}) {
  const rankedIdeas = rankBusinessIdeas(ideas);
  const topIdeas = rankedIdeas.slice(0, 3).map(summarizeIdea).filter(Boolean);
  const newlyCreatedIdeas = rankedIdeas
    .slice()
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, 3)
    .map(summarizeIdea)
    .filter(Boolean);
  const pausedOrKilledIdeas = rankedIdeas
    .filter((idea) => ["paused", "killed"].includes(idea.status))
    .slice()
    .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt))
    .slice(0, 3)
    .map(summarizeIdea)
    .filter(Boolean);
  const highestConfidenceOpportunity = rankedIdeas
    .slice()
    .sort((first, second) => {
      if (second.confidence !== first.confidence) {
        return second.confidence - first.confidence;
      }

      const updatedDifference = new Date(second.updatedAt) - new Date(first.updatedAt);

      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      return first.title.localeCompare(second.title);
    })[0] || null;
  const biggestRisk = rankedIdeas
    .slice()
    .sort((first, second) => {
      if (second.risk !== first.risk) {
        return second.risk - first.risk;
      }

      return new Date(second.updatedAt) - new Date(first.updatedAt);
    })[0] || null;
  const blockedTask = tasks.find((task) => task.blockedReason) || null;
  const latestDecision = decisions.length > 0
    ? decisions.slice().sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))[0]
    : null;
  const latestImportantMemory = memoryEvents.length > 0
    ? memoryEvents.slice().sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))[0]
    : null;
  const topIdea = topIdeas[0] || null;
  const confidenceLabel = highestConfidenceOpportunity ? `${highestConfidenceOpportunity.title} (${highestConfidenceOpportunity.confidence}/10)` : "none";
  const riskLabel = biggestRisk ? `${biggestRisk.title} (${biggestRisk.risk}/10)` : "none";
  const summaryBits = [
    topIdea ? `Top idea: ${topIdea.title}` : "No ranked ideas yet",
    highestConfidenceOpportunity ? `Highest confidence: ${confidenceLabel}` : "",
    biggestRisk ? `Biggest risk: ${riskLabel}` : "",
    latestDecision ? `Recent decision: ${latestDecision.title}` : "",
    latestImportantMemory ? `Recent memory: ${latestImportantMemory.summary}` : "",
  ].filter(Boolean);

  let recommendedNextAction = topIdea ? topIdea.nextAction : "Create the first idea.";

  if (blockedTask) {
    recommendedNextAction = `Unblock task "${blockedTask.title}" before scaling ideas.`;
  } else if (latestDecision && latestDecision.impact) {
    recommendedNextAction = latestDecision.impact;
  } else if (latestImportantMemory && latestImportantMemory.summary) {
    recommendedNextAction = latestImportantMemory.summary;
  }

  return {
    updatedAt: now,
    rankedOpportunitySummary: summaryBits.join(" · ") || "No business ideas yet.",
    topIdeas,
    newlyCreatedIdeas,
    pausedOrKilledIdeas,
    highestConfidenceOpportunity: summarizeIdea(highestConfidenceOpportunity),
    biggestRisk: summarizeIdea(biggestRisk),
    recommendedNextAction,
  };
}

function formatIdeaSummaryLine(idea) {
  if (!idea) {
    return "";
  }

  return `- ${idea.title} (${idea.status}, confidence ${idea.confidence}/10, profit ${idea.profitPotential}/10)`;
}

function formatCeoDigestMarkdown(digest = createEmptyCeoDigest()) {
  const normalizedDigest = digest && typeof digest === "object" ? digest : createEmptyCeoDigest();
  const lines = [
    "# CEO Digest",
    "",
    `Updated: ${normalizedDigest.updatedAt || new Date().toISOString()}`,
    "",
    "## Ranked Opportunity Summary",
    normalizedDigest.rankedOpportunitySummary || "No business ideas yet.",
    "",
    "## Top Ideas",
  ];

  if (!Array.isArray(normalizedDigest.topIdeas) || normalizedDigest.topIdeas.length === 0) {
    lines.push("- None yet.");
  } else {
    normalizedDigest.topIdeas.forEach((idea) => {
      lines.push(formatIdeaSummaryLine(idea));
    });
  }

  lines.push("", "## Newly Created Ideas");

  if (!Array.isArray(normalizedDigest.newlyCreatedIdeas) || normalizedDigest.newlyCreatedIdeas.length === 0) {
    lines.push("- None yet.");
  } else {
    normalizedDigest.newlyCreatedIdeas.forEach((idea) => {
      lines.push(formatIdeaSummaryLine(idea));
    });
  }

  lines.push("", "## Paused / Killed Ideas");

  if (!Array.isArray(normalizedDigest.pausedOrKilledIdeas) || normalizedDigest.pausedOrKilledIdeas.length === 0) {
    lines.push("- None yet.");
  } else {
    normalizedDigest.pausedOrKilledIdeas.forEach((idea) => {
      lines.push(formatIdeaSummaryLine(idea));
    });
  }

  lines.push(
    "",
    "## Highest Confidence Opportunity",
    normalizedDigest.highestConfidenceOpportunity
      ? `- ${normalizedDigest.highestConfidenceOpportunity.title} (${normalizedDigest.highestConfidenceOpportunity.confidence}/10)`
      : "- None yet.",
    "",
    "## Biggest Risk",
    normalizedDigest.biggestRisk
      ? `- ${normalizedDigest.biggestRisk.title} (${normalizedDigest.biggestRisk.risk}/10)`
      : "- None yet.",
    "",
    "## Recommended Next Action",
    normalizedDigest.recommendedNextAction || "Create the first idea.",
  );

  return lines.join("\n");
}

module.exports = {
  buildCeoDigest,
  createEmptyCeoDigest,
  formatCeoDigestMarkdown,
  summarizeIdea,
};
