function getLatestAgentReference(agent, context) {
  const messages = context.messages || [];
  const previousAgentMessage = [...messages]
    .reverse()
    .find((item) => item.role === "agent" && item.agentId !== agent.id);

  if (!previousAgentMessage) {
    return "";
  }

  return ` Building on ${previousAgentMessage.agentId}'s note,`;
}

function getContextText(context) {
  return (context.messages || [])
    .slice(-5)
    .map((item) => `${item.role}: ${item.message}`)
    .join("; ");
}

function generateAgentReply({ agent, message, context = {} }) {
  const recentContext = getContextText(context);
  const agentReference = getLatestAgentReference(agent, context);
  const contextText = recentContext ? ` Recent context: ${recentContext}.` : "";
  const systemPrompt = (agent.systemPrompt || "").toLowerCase();

  if (systemPrompt.includes("friendly")) {
    return `${agentReference} glad you shared "${message}".${contextText}`;
  }

  if (systemPrompt.includes("persuasive")) {
    return `${agentReference} let's turn "${message}" into a concrete offer.${contextText}`;
  }

  return `${agentReference} I can help shape "${message}" into next steps.${contextText}`;
}

module.exports = {
  generateAgentReply,
};
