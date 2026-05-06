// Mock-first research provider boundary. Keep the fallback deterministic until search/browser adapters exist.

function cleanText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed === "" ? fallback : trimmed;
}

function createMockResearchProvider() {
  return {
    id: "mock-research",
    kind: "mock",
    name: "Mock Research Provider",
    researchTopic(context = {}) {
      const topic = cleanText(context.topic, "the opportunity");
      const roomName = cleanText(context.roomName, "HQ");
      const goal = context.goal && context.goal.currentGoal ? context.goal.currentGoal : "";
      const plan = context.plan && context.plan.currentObjective ? context.plan.currentObjective : "";

      return {
        topic,
        roomName,
        evidence: ["user signal", "market signal", "competitor signal"],
        summary: `${roomName} research should verify ${topic} with user, market, and competitor evidence${goal ? ` while aligning to ${goal}` : ""}${plan ? ` under ${plan}` : ""}.`,
      };
    },
    summarizeEvidence(context = {}) {
      const result = this.researchTopic(context);

      return `${result.summary} Evidence to gather: ${result.evidence.join(", ")}.`;
    },
  };
}

function getResearchProvider() {
  return createMockResearchProvider();
}

module.exports = {
  createMockResearchProvider,
  getResearchProvider,
};
