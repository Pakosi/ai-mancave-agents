// Mock-first AI provider boundary. Keep local behavior here until a real local LLM adapter exists.

function hasPriorUserContext(messages) {
  return messages.some((item) => item.role === "user");
}

function hasPriorAgentContext(messages, agentId) {
  return messages.some((item) => item.role === "agent" && item.agentId !== agentId);
}

function getContextCue(agent, context) {
  const messages = context.messages || [];
  const target = context.target || null;
  const priorUserContext = hasPriorUserContext(messages);
  const priorAgentContext = hasPriorAgentContext(messages, agent.id);

  if (target && target.role === "agent") {
    return "I hear the point on the table, and ";
  }

  if (target && target.role === "user") {
    return "That gives us a useful starting point, so ";
  }

  if (priorAgentContext) {
    return "The team is circling a useful direction, so ";
  }

  if (priorUserContext) {
    return "Earlier you pointed us in a useful direction, so ";
  }

  return "";
}

function generateAgentReply({ agent, message, context = {} }) {
  const contextCue = getContextCue(agent, context);
  const systemPrompt = (agent.systemPrompt || "").toLowerCase();
  const topic = context.topic ? ` around ${context.topic}` : "";
  const variation = (context.variation || "expand").toLowerCase();
  const role = (agent.role || "").toLowerCase();
  const phase = (context.phase || "").toLowerCase();

  if (phase === "observe" && role.includes("planning")) {
    return `${contextCue}strategic observation: find the gap before we choose the priority.`;
  }

  if (role.includes("planning")) {
    if (phase === "plan") {
      return `${contextCue}the planning move is to choose the priority and turn it into a concrete task.`;
    }

    if (variation === "challenge") {
      return `${contextCue}we should rank the options by urgency, upside, and effort${topic}.`;
    }

    return `${contextCue}the strategic move is to pick one priority and define the planning task.`;
  }

  if (role.includes("discovery")) {
    if (phase === "observe") {
      return `${contextCue}I am checking discovery gaps before we treat this as validated.`;
    }

    if (variation === "question") {
      return `${contextCue}what user or competitor signal would prove this is worth pursuing${topic}?`;
    }

    return `${contextCue}we need a focused discovery task before treating this as validated.`;
  }

  if (role.includes("product")) {
    if (phase === "execute") {
      return `${contextCue}I would move the active build task forward and leave a small demo point.`;
    }

    return `${contextCue}I would turn this into a small build step with a clear handoff and demo point.`;
  }

  if (role.includes("metrics")) {
    return `${contextCue}the risk is unclear success criteria; define the metric and decision threshold.`;
  }

  if (role.includes("task manager")) {
    if (phase === "execute") {
      return `${contextCue}move the active task forward, confirm the owner, and set the next checkpoint.`;
    }

    return `${contextCue}assign one owner, move the active task forward, and note the next checkpoint.`;
  }

  if (phase === "observe") {
    return `${contextCue}I am checking gaps before we commit.`;
  }

  if (phase === "review") {
    return `${contextCue}capture progress, decisions, and the next handoff.`;
  }

  if (role.includes("discussion")) {
    if (variation === "challenge") {
      return `${contextCue}what is the one question we need to answer before the team moves on${topic}?`;
    }

    return `${contextCue}let's keep the room organized around one decision and one next step.`;
  }

  if (systemPrompt.includes("friendly")) {
    if (variation === "challenge") {
      return `${contextCue}what is the one question we need to answer before the team moves on${topic}?`;
    }

    if (variation === "question") {
      return `${contextCue}who should own the next step, and what would make it feel finished?`;
    }

    if (variation === "agree") {
      return `${contextCue}that feels like a useful direction; let's turn it into the next room decision.`;
    }

    return `${contextCue}let's keep this moving with one clear next step.`;
  }

  if (systemPrompt.includes("persuasive")) {
    if (variation === "challenge") {
      return `${contextCue}how do we make money from this without making the offer too broad?`;
    }

    if (variation === "question") {
      return `${contextCue}who pays first, and what outcome would make the offer easy to say yes to?`;
    }

    if (variation === "agree") {
      return `${contextCue}there is a strong offer here if we frame the outcome clearly.`;
    }

    return `${contextCue}the opportunity is strongest if we connect it to a clear buyer pain.`;
  }

  if (variation === "challenge") {
    return `${contextCue}I would pressure-test the assumption and define what evidence would prove it.`;
  }

  if (variation === "question") {
    return `${contextCue}what constraint should we solve for first: speed, cost, or customer confidence?`;
  }

  if (variation === "agree") {
    return `${contextCue}I agree with the direction; the next step is to make it specific and measurable.`;
  }

  return `${contextCue}I would turn this into a short plan with one owner and one measurable next step.`;
}

function createMockAiProvider() {
  return {
    id: "mock-ai",
    kind: "mock",
    name: "Mock AI Provider",
    generateReply: generateAgentReply,
  };
}

function getAiProvider() {
  return createMockAiProvider();
}

module.exports = {
  createMockAiProvider,
  generateAgentReply,
  getAiProvider,
};
