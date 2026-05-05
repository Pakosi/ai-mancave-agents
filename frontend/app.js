(function (root) {
  const DEFAULT_API_BASE_URL = "http://localhost:3001";

  function getFetch(fetchImpl) {
    return fetchImpl || root.fetch;
  }

  function fetchJson(url, options, fetchImpl) {
    const request = getFetch(fetchImpl);

    return request(url, options).then((res) => {
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      return res.json();
    });
  }

  function getSessionId(storage) {
    const sessionStorage = storage || root.localStorage;

    if (!sessionStorage || typeof sessionStorage.getItem !== "function") {
      if (!root.__woysSessionId) {
        root.__woysSessionId = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      return root.__woysSessionId;
    }

    const existingSessionId = sessionStorage.getItem("woysSessionId");

    if (existingSessionId) {
      return existingSessionId;
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem("woysSessionId", sessionId);

    return sessionId;
  }

  function loadMessages(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);
    const query = new URLSearchParams({ sessionId });

    return fetchJson(`${apiBaseUrl}/api/messages?${query.toString()}`, undefined, options.fetch)
      .then((data) => {
        if (options.onMessages) {
          options.onMessages(data.messages);
        }

        return data.messages;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadAgents(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/agents`, undefined, options.fetch)
      .then((data) => {
        if (options.onAgents) {
          options.onAgents(data.agents);
        }

        return data.agents;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function sendMessage(message, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId }),
      },
      options.fetch,
    )
      .then((data) => {
        if (options.onSent) {
          options.onSent(data);
        }

        return data;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function getAgentReply(agentId, message, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/agents/${encodeURIComponent(agentId)}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId }),
      },
      options.fetch,
    )
      .then((data) => {
        if (options.onReply) {
          options.onReply(data);
        }

        return data;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function mapMessageForDisplay(item) {
    if (item.role === "agent") {
      return {
        classes: ["message", "agent", `agent-${item.agentId}`],
        text: `${item.agentId.toUpperCase()}: ${item.message}`,
        createdAt: item.createdAt,
      };
    }

    return {
      classes: ["message", "user"],
      text: item.message,
      createdAt: item.createdAt,
    };
  }

  function mapAgentForOption(agent) {
    return {
      value: agent.id,
      text: agent.name,
      label: agent.label,
      color: agent.color,
    };
  }

  const api = {
    fetchJson,
    getAgentReply,
    getSessionId,
    loadAgents,
    loadMessages,
    mapAgentForOption,
    mapMessageForDisplay,
    sendMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.WOYSApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
