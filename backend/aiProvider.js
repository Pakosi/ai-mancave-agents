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
    return "Building on that agent's point, ";
  }

  if (target && target.role === "user") {
    return "Responding to the user's latest idea, ";
  }

  if (priorAgentContext) {
    return "Building on the team's earlier thinking, ";
  }

  if (priorUserContext) {
    return "Earlier you pointed us in a useful direction, so ";
  }

  return "";
}

function generateAgentReply({ agent, message, context = {} }) {
  const contextCue = getContextCue(agent, context);
  const systemPrompt = (agent.systemPrompt || "").toLowerCase();
  const variation = (context.variation || "expand").toLowerCase();

  if (systemPrompt.includes("friendly")) {
    if (variation === "challenge") {
      return `${contextCue}what is the one question we need to answer before the team moves on?`;
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

    if (variation === "agree") {
      return `${contextCue}there is a strong offer here if we frame the outcome clearly.`;
    }

    return `${contextCue}the opportunity is strongest if we connect it to a clear buyer pain.`;
  }

  if (variation === "challenge") {
    return `${contextCue}I would pressure-test the assumption and define what evidence would prove it.`;
  }

  if (variation === "agree") {
    return `${contextCue}I agree with the direction; the next step is to make it specific and measurable.`;
  }

  return `${contextCue}I would turn this into a short plan with one owner and one measurable next step.`;
}

module.exports = {
  generateAgentReply,
};
