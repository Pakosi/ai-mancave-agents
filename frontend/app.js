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

  function saveSelectedAgentId(agentId, storage) {
    const selectedAgentStorage = storage || root.localStorage;

    if (selectedAgentStorage && typeof selectedAgentStorage.setItem === "function") {
      selectedAgentStorage.setItem("woysSelectedAgentId", agentId);
    }

    root.__woysSelectedAgentId = agentId;
  }

  function getSavedSelectedAgentId(storage) {
    const selectedAgentStorage = storage || root.localStorage;

    if (selectedAgentStorage && typeof selectedAgentStorage.getItem === "function") {
      return selectedAgentStorage.getItem("woysSelectedAgentId");
    }

    return root.__woysSelectedAgentId || null;
  }

  function getSelectedAgentId(agents, storage) {
    const savedAgentId = getSavedSelectedAgentId(storage);
    const savedAgent = agents.find((agent) => agent.id === savedAgentId);

    if (savedAgent) {
      return savedAgent.id;
    }

    return agents.length > 0 ? agents[0].id : "";
  }

  function saveSelectedRoomId(roomId, storage) {
    const selectedRoomStorage = storage || root.localStorage;

    if (selectedRoomStorage && typeof selectedRoomStorage.setItem === "function") {
      selectedRoomStorage.setItem("woysSelectedRoomId", roomId);
    }

    root.__woysSelectedRoomId = roomId;
  }

  function getSelectedRoomId(roomsOrStorage, storage) {
    const rooms = Array.isArray(roomsOrStorage) ? roomsOrStorage : null;
    const selectedRoomStorage = rooms ? storage || root.localStorage : roomsOrStorage || root.localStorage;
    let selectedRoomId = root.__woysSelectedRoomId || "main";

    if (selectedRoomStorage && typeof selectedRoomStorage.getItem === "function") {
      selectedRoomId = selectedRoomStorage.getItem("woysSelectedRoomId") || "main";
    }

    if (!rooms) {
      return selectedRoomId;
    }

    const selectedRoom = rooms.find((room) => room.id === selectedRoomId);

    if (selectedRoom) {
      return selectedRoom.id;
    }

    return rooms.length > 0 ? rooms[0].id : "main";
  }

  function loadMessages(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);
    const roomId = options.roomId || getSelectedRoomId(options.storage);
    const query = new URLSearchParams({ sessionId, roomId });

    return fetchJson(`${apiBaseUrl}/api/messages?${query.toString()}`, undefined, options.fetch)
      .then((data) => {
        if (options.onActivity) {
          options.onActivity(data.activity || {});
        }

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

  function loadRooms(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/rooms`, undefined, options.fetch)
      .then((data) => {
        if (options.onRooms) {
          options.onRooms(data.rooms);
        }

        return data.rooms;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadTasks(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const roomId = options.roomId || getSelectedRoomId(options.storage);
    const query = new URLSearchParams({ roomId });

    return fetchJson(`${apiBaseUrl}/api/tasks?${query.toString()}`, undefined, options.fetch)
      .then((data) => {
        if (options.onTasks) {
          options.onTasks(data.tasks);
        }

        return data.tasks;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadCompanyPlan(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/company-plan`, undefined, options.fetch)
      .then((data) => {
        if (options.onPlan) {
          options.onPlan(data.plan);
        }

        return data.plan;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadDecisions(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const roomId = options.roomId || "";
    const query = roomId ? `?${new URLSearchParams({ roomId }).toString()}` : "";

    return fetchJson(`${apiBaseUrl}/api/decisions${query}`, undefined, options.fetch)
      .then((data) => {
        if (options.onDecisions) {
          options.onDecisions(data.decisions);
        }

        return data.decisions;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadMemoryEvents(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const roomId = options.roomId || "";
    const query = roomId ? `?${new URLSearchParams({ roomId }).toString()}` : "";

    return fetchJson(`${apiBaseUrl}/api/memory-events${query}`, undefined, options.fetch)
      .then((data) => {
        if (options.onMemoryEvents) {
          options.onMemoryEvents(data.memoryEvents);
        }

        return data.memoryEvents;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadAgentGoals(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/agent-goals`, undefined, options.fetch)
      .then((data) => {
        if (options.onGoals) {
          options.onGoals(data.goals);
        }

        return data.goals;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadOperatingRhythm(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/operating-rhythm`, undefined, options.fetch)
      .then((data) => {
        if (options.onRhythm) {
          options.onRhythm(data.rhythm);
        }

        return data.rhythm;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function createTask(task, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const roomId = task.roomId || options.roomId || getSelectedRoomId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/tasks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          title: task.title,
          description: task.description,
          assignedAgentId: task.assignedAgentId,
        }),
      },
      options.fetch,
    )
      .then((data) => {
        if (options.onCreated) {
          options.onCreated(data);
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

  function updateTaskStatus(taskId, status, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(
      `${apiBaseUrl}/api/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
      options.fetch,
    )
      .then((data) => {
        if (options.onUpdated) {
          options.onUpdated(data);
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

  function sendMessage(message, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);
    const roomId = options.roomId || getSelectedRoomId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId, roomId }),
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
    const roomId = options.roomId || getSelectedRoomId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/agents/${encodeURIComponent(agentId)}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId, roomId }),
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
      text: agent.role ? `${agent.name} - ${agent.role}` : agent.name,
      label: agent.label,
      color: agent.color,
      role: agent.role || "",
    };
  }

  function mapRoomForOption(room) {
    return {
      brief: room.brief,
      value: room.id,
      text: room.name,
    };
  }

  function getSelectedRoom(rooms = [], roomId) {
    return rooms.find((room) => room.id === roomId) || null;
  }

  function getNextTaskStatus(status) {
    if (status === "open") {
      return "in_progress";
    }

    if (status === "in_progress") {
      return "done";
    }

    return "";
  }

  function isTaskRecentlyUpdated(task, now = Date.now(), windowMs = 10000) {
    if (!task.updatedAt) {
      return false;
    }

    return now - new Date(task.updatedAt).getTime() <= windowMs;
  }

  function mapTaskForDisplay(task, agents = [], options = {}) {
    const agent = agents.find((item) => item.id === task.assignedAgentId);
    const ownerAgentId = task.ownerAgentId || task.assignedAgentId || "";
    const ownerAgent = agents.find((item) => item.id === ownerAgentId);
    const nextStatus = getNextTaskStatus(task.status);
    const now = options.now || Date.now();
    const recentWindowMs = options.recentWindowMs || 10000;

    return {
      id: task.id,
      title: task.title,
      assignedAgent: agent ? agent.name : task.assignedAgentId,
      ownerAgentId,
      ownerName: ownerAgent ? ownerAgent.name : ownerAgentId,
      blockedReason: task.blockedReason || null,
      isHandedOff: Boolean(task.lastHandoffAt),
      status: task.status,
      statusText: task.status.replace("_", " "),
      isRecentlyUpdated: isTaskRecentlyUpdated(task, now, recentWindowMs),
      nextStatus,
      nextStatusText: nextStatus ? nextStatus.replace("_", " ") : "",
    };
  }

  function mapCompanyPlanForDisplay(plan = {}) {
    return {
      currentObjective: plan.currentObjective || "No objective set.",
      activePriorities: Array.isArray(plan.activePriorities) ? plan.activePriorities : [],
      keyRisks: Array.isArray(plan.keyRisks) ? plan.keyRisks : [],
      nextRecommendedActions: Array.isArray(plan.nextRecommendedActions) ? plan.nextRecommendedActions : [],
      recentDecisions: Array.isArray(plan.recentDecisions) ? plan.recentDecisions : [],
    };
  }

  function mapDecisionForDisplay(decision) {
    return {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      meta: `${decision.agentId || "agent"} · ${decision.roomId || "room"}`,
      timestamp: decision.timestamp,
    };
  }

  function mapMemoryEventForDisplay(event) {
    return {
      id: event.id,
      summary: event.summary,
      meta: `${event.type || "event"} · ${event.importance || "medium"}`,
      timestamp: event.timestamp,
    };
  }

  function mapAgentGoalForDisplay(goal, agents = []) {
    const agent = agents.find((item) => item.id === goal.agentId);

    return {
      agentId: goal.agentId,
      agentName: agent ? agent.name : goal.agentId,
      currentGoal: goal.currentGoal,
      focusArea: goal.focusArea,
      successCriteria: goal.successCriteria,
      activeRoomId: goal.activeRoomId,
      status: goal.status,
    };
  }

  function mapOperatingRhythmForDisplay(rhythm = {}) {
    return {
      phase: rhythm.phase || "observe",
      cycleText: rhythm.cycleNumber ? `Cycle ${rhythm.cycleNumber}` : "Cycle 1",
    };
  }

  function getRoomName(rooms = [], roomId) {
    const room = rooms.find((item) => item.id === roomId);

    return room ? room.name : roomId;
  }

  function getRoomActivityView(activity = {}, selectedRoomId, rooms = []) {
    const activeRoomName = getRoomName(rooms, selectedRoomId);
    const otherRoom = activity.otherRoom || null;

    return {
      activeRoomText: activeRoomName ? `Active room: ${activeRoomName}` : "Active room",
      noticeText: otherRoom ? `Activity in ${otherRoom.roomName || getRoomName(rooms, otherRoom.roomId)}` : "",
    };
  }

  const agentRoomPositions = {
    host: { left: "18%", top: "45%" },
    assistant: { left: "50%", top: "32%" },
    sales: { left: "78%", top: "50%" },
    strategist: { left: "30%", top: "25%" },
    researcher: { left: "66%", top: "24%" },
    builder: { left: "31%", top: "62%" },
    analyst: { left: "65%", top: "62%" },
    manager: { left: "50%", top: "48%" },
  };

  function mapAgentForRoom(agent, messages = []) {
    const latestMessage = [...messages]
      .reverse()
      .find((item) => item.role === "agent" && item.agentId === agent.id);

    return {
      id: agent.id,
      name: agent.name,
      label: agent.label,
      color: agent.color,
      role: agent.role || "",
      specialty: agent.expertise && agent.expertise.length > 0 ? agent.expertise[0] : agent.role || "",
      position: agentRoomPositions[agent.id] || { left: "50%", top: "50%" },
      latestMessage: latestMessage ? latestMessage.message : "Thinking...",
      latestMessageId: latestMessage ? latestMessage.id : null,
    };
  }

  function getNewestAgentMessage(messages = []) {
    return [...messages]
      .reverse()
      .find((item) => item.role === "agent") || null;
  }

  function getLatestUserMessage(messages = []) {
    const latestMessage = [...messages]
      .reverse()
      .find((item) => item.role === "user");

    return latestMessage ? latestMessage.message : "";
  }

  const api = {
    fetchJson,
    createTask,
    getAgentReply,
    getSessionId,
    getSelectedAgentId,
    getSavedSelectedAgentId,
    getRoomActivityView,
    getSelectedRoom,
    loadAgents,
    loadAgentGoals,
    loadCompanyPlan,
    loadDecisions,
    loadMemoryEvents,
    loadMessages,
    loadOperatingRhythm,
    loadRooms,
    loadTasks,
    mapAgentForOption,
    mapAgentGoalForDisplay,
    mapAgentForRoom,
    mapCompanyPlanForDisplay,
    mapDecisionForDisplay,
    mapMemoryEventForDisplay,
    mapOperatingRhythmForDisplay,
    mapMessageForDisplay,
    mapRoomForOption,
    mapTaskForDisplay,
    getNewestAgentMessage,
    getLatestUserMessage,
    saveSelectedAgentId,
    getSelectedRoomId,
    saveSelectedRoomId,
    sendMessage,
    updateTaskStatus,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.WOYSApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
