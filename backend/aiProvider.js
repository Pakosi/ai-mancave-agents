function hasPriorUserContext(messages) {
  return messages.some((item) => item.role === "user");
}

function hasPriorAgentContext(messages, agentId) {
  return messages.some((item) => item.role === "agent" && item.agentId !== agentId);
}

function getContextCue(agent, context) {
  const messages = context.messages || [];
  const priorUserContext = hasPriorUserContext(messages);
  const priorAgentContext = hasPriorAgentContext(messages, agent.id);

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

  if (systemPrompt.includes("friendly")) {
    return `${contextCue}let's keep this moving with one clear next step.`;
  }

  if (systemPrompt.includes("persuasive")) {
    return `${contextCue}there is a strong offer here if we frame the outcome clearly.`;
  }

  return `${contextCue}I would turn this into a short plan with one owner and one measurable next step.`;
}

module.exports = {
  generateAgentReply,
};
