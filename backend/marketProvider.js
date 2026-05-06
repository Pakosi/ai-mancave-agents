// Mock-first market data provider boundary. Use deterministic snapshots until a real data source is added.

function cleanText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed === "" ? fallback : trimmed;
}

function createMockMarketProvider() {
  return {
    id: "mock-market",
    kind: "mock",
    name: "Mock Market Provider",
    getMarketSnapshot(context = {}) {
      const category = cleanText(context.category, "General");
      const topic = cleanText(context.topic, context.plan && context.plan.currentObjective ? context.plan.currentObjective : "opportunity");
      const roomName = cleanText(context.roomName, "HQ");

      return {
        category,
        topic,
        roomName,
        demandSignal: "stable",
        competitionSignal: "moderate",
        pricingSignal: "unclear",
        summary: `${category} looks worth watching from ${roomName}; validate demand before scaling ${topic}.`,
      };
    },
    summarizeOpportunity(context = {}) {
      const snapshot = this.getMarketSnapshot(context);

      return `${snapshot.summary} Demand is ${snapshot.demandSignal}, competition is ${snapshot.competitionSignal}, and pricing remains ${snapshot.pricingSignal}.`;
    },
  };
}

function getMarketProvider() {
  return createMockMarketProvider();
}

module.exports = {
  createMockMarketProvider,
  getMarketProvider,
};
