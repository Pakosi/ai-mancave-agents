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

  function getHQLayoutConfig() {
    return {
      roomId: "main",
      roomLabel: "AI Mancave HQ",
      showRoomSelector: false,
    };
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

  const agentCharacterStyles = {
    host: {
      head: "#d9c49d",
      torso: "#184d52",
      trim: "#d4a853",
      accent: "#f8e7be",
      shadow: "#071717",
    },
    assistant: {
      head: "#cbd5e1",
      torso: "#284d91",
      trim: "#8cc0ff",
      accent: "#eff6ff",
      shadow: "#0d1728",
    },
    sales: {
      head: "#d6b08a",
      torso: "#8a4312",
      trim: "#f6b35a",
      accent: "#ffe3ba",
      shadow: "#261006",
    },
    strategist: {
      head: "#d7c4f2",
      torso: "#513089",
      trim: "#b892ff",
      accent: "#f4ebff",
      shadow: "#180b2e",
    },
    researcher: {
      head: "#b8d9e8",
      torso: "#0d5f73",
      trim: "#7fd8ef",
      accent: "#dff8ff",
      shadow: "#061921",
    },
    builder: {
      head: "#d4b39a",
      torso: "#8f1f1f",
      trim: "#ff9f7a",
      accent: "#ffe4d7",
      shadow: "#240707",
    },
    analyst: {
      head: "#cad2d8",
      torso: "#4f5f73",
      trim: "#a4b4c5",
      accent: "#edf2f7",
      shadow: "#101722",
    },
    manager: {
      head: "#dbc39a",
      torso: "#6b4a10",
      trim: "#e5c15e",
      accent: "#fbefce",
      shadow: "#181106",
    },
  };

  function getAgentCharacterStyle(agent) {
    return agentCharacterStyles[agent.id] || {
      head: agent.color || "#c8b08a",
      torso: agent.color || "#5a3e1b",
      trim: "#d4a853",
      accent: "#f4ead3",
      shadow: "#100b07",
    };
  }

  const agentMotionRoutes = {
    host: {
      cycleMs: 24000,
      observe: [
        { left: 18, top: 45 },
        { left: 24, top: 39 },
        { left: 32, top: 43 },
        { left: 22, top: 50 },
      ],
      plan: [
        { left: 18, top: 45 },
        { left: 29, top: 38 },
        { left: 44, top: 34 },
        { left: 25, top: 48 },
      ],
      execute: [
        { left: 18, top: 45 },
        { left: 25, top: 43 },
        { left: 35, top: 41 },
        { left: 21, top: 47 },
      ],
      review: [
        { left: 18, top: 45 },
        { left: 27, top: 39 },
        { left: 40, top: 42 },
        { left: 23, top: 48 },
      ],
    },
    assistant: {
      cycleMs: 30000,
      observe: [
        { left: 50, top: 32 },
        { left: 47, top: 30 },
        { left: 53, top: 33 },
      ],
      plan: [
        { left: 50, top: 32 },
        { left: 48, top: 29 },
        { left: 52, top: 34 },
      ],
      execute: [
        { left: 50, top: 32 },
        { left: 47, top: 31 },
        { left: 53, top: 33 },
      ],
      review: [
        { left: 50, top: 32 },
        { left: 49, top: 30 },
        { left: 51, top: 33 },
      ],
    },
    sales: {
      cycleMs: 32000,
      observe: [
        { left: 78, top: 50 },
        { left: 75, top: 48 },
        { left: 81, top: 52 },
      ],
      plan: [
        { left: 78, top: 50 },
        { left: 74, top: 47 },
        { left: 80, top: 51 },
      ],
      execute: [
        { left: 78, top: 50 },
        { left: 76, top: 49 },
        { left: 81, top: 52 },
      ],
      review: [
        { left: 78, top: 50 },
        { left: 75, top: 49 },
        { left: 79, top: 52 },
      ],
    },
    strategist: {
      cycleMs: 30000,
      observe: [
        { left: 30, top: 25 },
        { left: 27, top: 28 },
        { left: 33, top: 24 },
      ],
      plan: [
        { left: 30, top: 25 },
        { left: 24, top: 21 },
        { left: 35, top: 26 },
      ],
      execute: [
        { left: 30, top: 25 },
        { left: 28, top: 27 },
        { left: 32, top: 24 },
      ],
      review: [
        { left: 30, top: 25 },
        { left: 26, top: 23 },
        { left: 34, top: 25 },
      ],
    },
    researcher: {
      cycleMs: 32000,
      observe: [
        { left: 66, top: 24 },
        { left: 62, top: 27 },
        { left: 70, top: 23 },
      ],
      plan: [
        { left: 66, top: 24 },
        { left: 63, top: 21 },
        { left: 69, top: 26 },
      ],
      execute: [
        { left: 66, top: 24 },
        { left: 64, top: 26 },
        { left: 69, top: 23 },
      ],
      review: [
        { left: 66, top: 24 },
        { left: 63, top: 25 },
        { left: 68, top: 22 },
      ],
    },
    builder: {
      cycleMs: 30000,
      observe: [
        { left: 31, top: 62 },
        { left: 28, top: 65 },
        { left: 35, top: 61 },
      ],
      plan: [
        { left: 31, top: 62 },
        { left: 27, top: 60 },
        { left: 34, top: 64 },
      ],
      execute: [
        { left: 31, top: 62 },
        { left: 29, top: 64 },
        { left: 34, top: 61 },
      ],
      review: [
        { left: 31, top: 62 },
        { left: 29, top: 63 },
        { left: 33, top: 60 },
      ],
    },
    analyst: {
      cycleMs: 32000,
      observe: [
        { left: 65, top: 62 },
        { left: 62, top: 65 },
        { left: 68, top: 60 },
      ],
      plan: [
        { left: 65, top: 62 },
        { left: 61, top: 60 },
        { left: 69, top: 64 },
      ],
      execute: [
        { left: 65, top: 62 },
        { left: 63, top: 64 },
        { left: 68, top: 61 },
      ],
      review: [
        { left: 65, top: 62 },
        { left: 62, top: 63 },
        { left: 67, top: 60 },
      ],
    },
    manager: {
      cycleMs: 28000,
      observe: [
        { left: 50, top: 48 },
        { left: 47, top: 45 },
        { left: 53, top: 49 },
      ],
      plan: [
        { left: 50, top: 48 },
        { left: 49, top: 43 },
        { left: 54, top: 50 },
      ],
      execute: [
        { left: 50, top: 48 },
        { left: 48, top: 46 },
        { left: 52, top: 49 },
      ],
      review: [
        { left: 50, top: 48 },
        { left: 48, top: 47 },
        { left: 52, top: 45 },
      ],
    },
    default: {
      cycleMs: 24000,
      observe: [
        { left: 50, top: 50 },
        { left: 49, top: 49 },
        { left: 51, top: 51 },
      ],
      plan: [
        { left: 50, top: 50 },
        { left: 49, top: 48 },
        { left: 51, top: 52 },
      ],
      execute: [
        { left: 50, top: 50 },
        { left: 49, top: 50 },
        { left: 51, top: 49 },
      ],
      review: [
        { left: 50, top: 50 },
        { left: 49, top: 49 },
        { left: 51, top: 50 },
      ],
    },
  };

  const hqWorkZones = [
    {
      id: "command-desk",
      label: "CEO Command Desk",
      className: "command",
      left: 50,
      top: 64,
      width: 14,
      height: 7.5,
      poseClass: "station-command",
      workClass: "working-command",
      accent: "#d4a853",
    },
    {
      id: "research-library",
      label: "Research / Library",
      className: "research",
      left: 14,
      top: 26,
      width: 11,
      height: 8,
      poseClass: "station-reading",
      workClass: "working-reading",
      accent: "#7fd8ef",
    },
    {
      id: "builder-workstation",
      label: "Builder Workstation",
      className: "builder",
      left: 33,
      top: 59,
      width: 11,
      height: 6.5,
      poseClass: "station-typing",
      workClass: "working-typing",
      accent: "#ff9f7a",
    },
    {
      id: "analyst-desk",
      label: "Analyst Desk",
      className: "analyst",
      left: 67,
      top: 59,
      width: 11,
      height: 6.5,
      poseClass: "station-charting",
      workClass: "working-charting",
      accent: "#a4b4c5",
    },
    {
      id: "automation-station",
      label: "Automation Station",
      className: "automation",
      left: 50,
      top: 27,
      width: 11,
      height: 6.8,
      poseClass: "station-automation",
      workClass: "working-automation",
      accent: "#8cc0ff",
    },
    {
      id: "trading-desk",
      label: "Trading Desk",
      className: "trading",
      left: 80,
      top: 47,
      width: 10.5,
      height: 6.5,
      poseClass: "station-charting",
      workClass: "working-charting",
      accent: "#f6b35a",
    },
    {
      id: "brainstorm-lounge",
      label: "Brainstorm Lounge",
      className: "lounge",
      left: 26,
      top: 43,
      width: 11.5,
      height: 6.5,
      poseClass: "station-whiteboard",
      workClass: "working-whiteboard",
      accent: "#b892ff",
    },
  ];

  const hqWorkZoneMap = hqWorkZones.reduce((map, zone) => {
    map[zone.id] = zone;
    return map;
  }, {});

  const agentWorkZoneAssignments = {
    host: "command-desk",
    assistant: "automation-station",
    sales: "trading-desk",
    strategist: "brainstorm-lounge",
    researcher: "research-library",
    builder: "builder-workstation",
    analyst: "analyst-desk",
    manager: "command-desk",
  };

  const hostCheckInRoutes = {
    observe: ["command-desk", "research-library", "builder-workstation", "analyst-desk", "trading-desk", "brainstorm-lounge", "command-desk"],
    plan: ["command-desk", "brainstorm-lounge", "automation-station", "trading-desk", "command-desk"],
    execute: ["command-desk", "automation-station", "builder-workstation", "command-desk"],
    review: ["command-desk", "analyst-desk", "research-library", "command-desk"],
  };

  const workLoopOffsets = {
    observe: [
      { left: -0.4, top: 0.1 },
      { left: 0.25, top: -0.15 },
      { left: 0.15, top: 0.05 },
      { left: -0.1, top: 0 },
    ],
    plan: [
      { left: 0, top: 0 },
      { left: -0.3, top: -0.1 },
      { left: 0.25, top: 0.08 },
      { left: 0.1, top: 0 },
    ],
    execute: [
      { left: -0.25, top: 0.05 },
      { left: 0.25, top: -0.05 },
      { left: 0.12, top: 0.02 },
      { left: -0.08, top: 0 },
    ],
    review: [
      { left: 0, top: 0 },
      { left: -0.15, top: 0.1 },
      { left: 0.2, top: -0.08 },
      { left: 0.05, top: 0 },
    ],
  };

  function getHQWorkZones() {
    return hqWorkZones.map((zone) => ({ ...zone }));
  }

  const stationKeywordRules = [
    {
      stationId: "research-library",
      keywords: ["research", "user", "market", "competitor", "discovery", "interview", "study", "library", "read"],
    },
    {
      stationId: "builder-workstation",
      keywords: ["build", "builder", "implement", "code", "feature", "ship", "fix", "frontend", "backend", "prototype"],
    },
    {
      stationId: "analyst-desk",
      keywords: ["analysis", "analyze", "metric", "metrics", "risk", "dashboard", "decision", "report", "data", "measure"],
    },
    {
      stationId: "trading-desk",
      keywords: ["sales", "customer", "client", "offer", "revenue", "validate", "pitch", "demo", "pricing", "trading"],
    },
    {
      stationId: "brainstorm-lounge",
      keywords: ["strategy", "strategic", "plan", "priorit", "positioning", "roadmap", "brainstorm", "whiteboard", "review"],
    },
    {
      stationId: "automation-station",
      keywords: ["automation", "workflow", "bridge", "assistant", "context", "ops", "coordination", "handoff"],
    },
    {
      stationId: "command-desk",
      keywords: ["summary", "check-in", "checkin", "checkpoint", "coordinate", "blocked", "owner", "decision", "lead"],
    },
  ];

  function getTextBlob(values = []) {
    return values
      .filter(Boolean)
      .map((item) => String(item).toLowerCase())
      .join(" ");
  }

  function includesAny(text, keywords = []) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  function getStationIdForText(text, fallbackStationId) {
    const normalizedText = String(text || "").toLowerCase();

    for (const rule of stationKeywordRules) {
      if (includesAny(normalizedText, rule.keywords)) {
        return rule.stationId;
      }
    }

    return fallbackStationId;
  }

  function getTaskStationId(task, phase, agentId) {
    const text = getTextBlob([
      task.title,
      task.summary,
      task.nextAction,
      task.handoffReason,
      task.blockedReason,
      task.roomId,
    ]);
    const assignedStation = agentWorkZoneAssignments[agentId] || "command-desk";
    const keywordStation = getStationIdForText(text, assignedStation);

    if (phase === "review" && includesAny(text, ["summary", "check-in", "checkpoint", "decision", "coordinate", "handoff"])) {
      return agentId === "host" || agentId === "manager" ? "command-desk" : "brainstorm-lounge";
    }

    if (phase === "plan" && includesAny(text, ["plan", "strategy", "priorit", "roadmap", "positioning"])) {
      return "brainstorm-lounge";
    }

    return keywordStation;
  }

  function getRelevantTaskForAgent(agent, tasks = [], phase = "observe") {
    const agentTendencies = getTextBlob(agent.taskTendencies || []);

    return tasks
      .filter((task) => task && task.status !== "done")
      .map((task) => {
        const text = getTextBlob([
          task.title,
          task.summary,
          task.nextAction,
          task.blockedReason,
          task.handoffReason,
        ]);
        let score = 0;

        if (task.ownerAgentId === agent.id) {
          score += 8;
        }

        if (task.assignedAgentId === agent.id) {
          score += 6;
        }

        if (task.assignedByAgentId === agent.id) {
          score += 2;
        }

        if (task.blockedReason) {
          score += 1;
        }

        if (includesAny(text, agentTendencies.split(" ").filter(Boolean))) {
          score += 4;
        }

        if (phase === "plan" && includesAny(text, ["plan", "strategy", "priorit", "roadmap", "positioning"])) {
          score += 3;
        }

        if (phase === "execute" && includesAny(text, ["build", "research", "fix", "validate", "analyze", "sales", "automation"])) {
          score += 2;
        }

        if (phase === "review" && includesAny(text, ["summary", "decision", "risk", "handoff", "blocked"])) {
          score += 3;
        }

        return { task, score };
      })
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        const firstUpdatedAt = first.task.updatedAt || first.task.createdAt || "";
        const secondUpdatedAt = second.task.updatedAt || second.task.createdAt || "";

        return String(secondUpdatedAt).localeCompare(String(firstUpdatedAt));
      })[0]?.task || null;
  }

  function getHQHostCheckInTargetAgentId(context = {}) {
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const decisions = Array.isArray(context.decisions) ? context.decisions : [];
    const scores = new Map();

    function scoreAgent(agentId, points) {
      if (!agentId) {
        return;
      }

      scores.set(agentId, (scores.get(agentId) || 0) + points);
    }

    tasks.forEach((task) => {
      const taskOwnerId = task.ownerAgentId || task.assignedAgentId || null;
      const assignedByAgentId = task.assignedByAgentId || null;

      if (task.blockedReason) {
        scoreAgent(taskOwnerId, 6);
        scoreAgent(assignedByAgentId, 2);
      }

      if (task.handoffReason || task.lastHandoffAt) {
        scoreAgent(taskOwnerId, 4);
        scoreAgent(assignedByAgentId, 2);
      }
    });

    decisions.forEach((decision) => {
      if (decision.agentId) {
        scoreAgent(decision.agentId, 3);
      }

      if (decision.relatedTaskId) {
        const relatedTask = tasks.find((task) => String(task.id) === String(decision.relatedTaskId));
        if (relatedTask) {
          scoreAgent(relatedTask.ownerAgentId || relatedTask.assignedAgentId, 2);
        }
      }
    });

    let bestAgentId = "";
    let bestScore = 0;

    Array.from(scores.entries()).forEach(([agentId, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestAgentId = agentId;
      }
    });

    return bestAgentId;
  }

  function getHQAgentStationProfile(agent, context = {}) {
    const phase = context.phase || "observe";
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const decisions = Array.isArray(context.decisions) ? context.decisions : [];
    const memoryEvents = Array.isArray(context.memoryEvents) ? context.memoryEvents : [];
    const assignedStationId = agentWorkZoneAssignments[agent.id] || "command-desk";
    const task = getRelevantTaskForAgent(agent, tasks, phase);
    const hasActiveTask = Boolean(task);
    const taskStationId = task ? getTaskStationId(task, phase, agent.id) : assignedStationId;
    const baseStationId = taskStationId || assignedStationId;
    let stationId = baseStationId;
    let activityLevel = hasActiveTask ? 0.8 : 0.38;
    let motionIntensity = hasActiveTask ? 0.9 : 0.35;

    if (agent.id === "host") {
      const targetAgentId = getHQHostCheckInTargetAgentId({ tasks, decisions, memoryEvents });
      const targetStationId = targetAgentId ? (agentWorkZoneAssignments[targetAgentId] || "command-desk") : "command-desk";

      if (phase === "plan") {
        stationId = targetAgentId ? "brainstorm-lounge" : "command-desk";
      } else if (phase === "review") {
        stationId = targetAgentId ? targetStationId : "command-desk";
      } else if (phase === "execute") {
        stationId = targetAgentId ? targetStationId : "command-desk";
      } else {
        stationId = targetAgentId ? targetStationId : "command-desk";
      }

      return {
        stationId,
        stationLabel: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].label : "CEO Command Desk",
        poseClass: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].poseClass : "station-command",
        workClass: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].workClass : "working-command",
        activityLevel: targetAgentId ? 0.82 : 0.55,
        motionIntensity: targetAgentId ? 0.82 : 0.55,
        taskId: task ? task.id : null,
        taskStatus: task ? task.status : null,
        isCheckingIn: Boolean(targetAgentId),
        isWorkingAtStation: stationId === "command-desk",
        targetAgentId,
      };
    }

    if (phase === "plan" || phase === "review") {
      if (["strategist", "manager"].includes(agent.id)) {
        stationId = "brainstorm-lounge";
      } else if (agent.id === "analyst") {
        stationId = phase === "review" ? "analyst-desk" : "brainstorm-lounge";
      } else if (agent.id === "sales") {
        stationId = "trading-desk";
      } else if (agent.id === "researcher") {
        stationId = "research-library";
      } else if (agent.id === "builder") {
        stationId = "builder-workstation";
      } else if (agent.id === "assistant") {
        stationId = "automation-station";
      }
    }

    if (task && task.blockedReason) {
      activityLevel = 0.55;
      motionIntensity = 0.42;
      if (agent.id === "manager") {
        stationId = "command-desk";
      }
    } else if (task && task.status === "in_progress") {
      activityLevel = 1;
      motionIntensity = 1;
    } else if (task) {
      activityLevel = 0.85;
      motionIntensity = 0.82;
    } else if (phase === "execute") {
      activityLevel = 0.55;
      motionIntensity = 0.58;
    } else if (phase === "review") {
      activityLevel = 0.48;
      motionIntensity = 0.46;
    }

    if (memoryEvents.some((event) => event.importance >= 4)) {
      motionIntensity = Math.max(motionIntensity, 0.75);
    }

    return {
      stationId,
      stationLabel: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].label : hqWorkZoneMap[assignedStationId].label,
      poseClass: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].poseClass : hqWorkZoneMap[assignedStationId].poseClass,
      workClass: hqWorkZoneMap[stationId] ? hqWorkZoneMap[stationId].workClass : hqWorkZoneMap[assignedStationId].workClass,
      activityLevel,
      motionIntensity,
      taskId: task ? task.id : null,
      taskStatus: task ? task.status : null,
      isCheckingIn: false,
      isWorkingAtStation: true,
    };
  }

  function parsePercent(value) {
    return Number.parseFloat(String(value).replace("%", "")) || 0;
  }

  function formatPercent(value) {
    return `${Math.max(0, Math.min(100, value)).toFixed(1).replace(/\.0$/, "")}%`;
  }

  function interpolatePoint(start, end, progress) {
    return {
      left: start.left + ((end.left - start.left) * progress),
      top: start.top + ((end.top - start.top) * progress),
    };
  }

  function getHQAgentMotionState(agent, options = {}) {
    const profile = getHQAgentStationProfile(agent, options);
    const phase = options.phase || "observe";
    const now = options.now || Date.now();
    const orderIndex = options.index || 0;
    const zoneId = agentWorkZoneAssignments[agent.id] || "command-desk";
    const homeZone = hqWorkZoneMap[zoneId] || hqWorkZoneMap["command-desk"];
    const baseZone = hqWorkZoneMap[profile.stationId] || hqWorkZoneMap[zoneId] || hqWorkZoneMap["command-desk"];
    const cycleSeed = (agent.id.length * 937) + (orderIndex * 791);

    if (agent.id === "host") {
      const targetZone = profile.targetAgentId ? (hqWorkZoneMap[agentWorkZoneAssignments[profile.targetAgentId]] || homeZone) : homeZone;
      const routeIds = hostCheckInRoutes[phase] || hostCheckInRoutes.observe;
      const route = routeIds.map((id) => {
        if (id === "command-desk" || id === targetZone.id) {
          return hqWorkZoneMap[id] || homeZone;
        }

        return hqWorkZoneMap[id] || homeZone;
      });
      if (profile.targetAgentId && !route.some((zone) => zone.id === targetZone.id)) {
        route.splice(1, 0, targetZone);
      }
      const cycleMs = 22000;
      const elapsed = (now + cycleSeed) % cycleMs;
      const segmentCount = Math.max(1, route.length - 1);
      const segmentMs = cycleMs / segmentCount;
      const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsed / segmentMs));
      const segmentProgress = (elapsed % segmentMs) / segmentMs;
      const dwellProgress = segmentProgress < 0.18 || segmentProgress > 0.82;
      const eased = segmentProgress * segmentProgress * (3 - (2 * segmentProgress));
      const start = route[segmentIndex];
      const end = route[(segmentIndex + 1) % route.length];
      const point = interpolatePoint(start, end, eased);
      const activeZone = dwellProgress ? end : start;

      return {
        left: formatPercent(point.left),
        top: formatPercent(point.top),
        zIndex: Math.round(100 + point.top),
        isWalking: !dwellProgress,
        stationId: activeZone.id,
        stationLabel: activeZone.label,
        poseClass: activeZone.poseClass,
        workClass: activeZone.workClass,
        isCheckingIn: activeZone.id !== "command-desk",
        isWorkingAtStation: activeZone.id === "command-desk",
        activityLevel: profile.activityLevel,
        motionIntensity: profile.motionIntensity,
        taskId: profile.taskId,
        taskStatus: profile.taskStatus,
        targetAgentId: profile.targetAgentId || "",
      };
    }

    const offsets = workLoopOffsets[phase] || workLoopOffsets.observe;
    const cycleMs = 26000 + (agent.id.length * 250);
    const elapsed = (now + cycleSeed) % cycleMs;
    const segmentCount = offsets.length - 1;
    const segmentMs = cycleMs / segmentCount;
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsed / segmentMs));
    const segmentProgress = (elapsed % segmentMs) / segmentMs;
    const eased = segmentProgress * segmentProgress * (3 - (2 * segmentProgress));
    const point = interpolatePoint(offsets[segmentIndex], offsets[(segmentIndex + 1) % offsets.length], eased);
    const baseLeft = baseZone.left + point.left;
    const baseTop = baseZone.top + point.top;

    return {
      left: formatPercent(baseLeft),
      top: formatPercent(baseTop),
      zIndex: Math.round(100 + baseTop),
      isWalking: segmentProgress > 0.1 && segmentProgress < 0.9 && profile.motionIntensity > 0.45,
      stationId: profile.stationId || baseZone.id,
      stationLabel: profile.stationLabel || baseZone.label,
      poseClass: profile.poseClass || baseZone.poseClass,
      workClass: profile.workClass || baseZone.workClass,
      isCheckingIn: false,
      isWorkingAtStation: profile.isWorkingAtStation,
      activityLevel: profile.activityLevel,
      motionIntensity: profile.motionIntensity,
      taskId: profile.taskId,
      taskStatus: profile.taskStatus,
      targetAgentId: "",
    };
  }

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
      appearance: getAgentCharacterStyle(agent),
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
    getHQLayoutConfig,
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
    getAgentCharacterStyle,
    getHQWorkZones,
    getHQAgentStationProfile,
    getHQAgentMotionState,
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
