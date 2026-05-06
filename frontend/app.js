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

  function fetchText(url, options, fetchImpl) {
    const request = getFetch(fetchImpl);

    return request(url, options).then((res) => {
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      return res.text();
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

  const visibleAgentDisplayById = {
    host: {
      name: "CEO / Principal",
      role: "Principal",
      label: "CEO",
      specialty: "facilitation",
    },
    assistant: {
      name: "AI Automation Agent",
      role: "Automation",
      label: "AUTO",
      specialty: "automation",
    },
    sales: {
      name: "Trading Agent",
      role: "Trading",
      label: "TRADING",
      specialty: "revenue",
    },
    strategist: {
      name: "Arbitrage Agent",
      role: "Arbitrage",
      label: "ARBITRAGE",
      specialty: "positioning",
    },
    researcher: {
      name: "Research Agent",
      role: "Research",
      label: "RESEARCH",
      specialty: "discovery",
    },
    builder: {
      name: "Builder Agent",
      role: "Builder",
      label: "BUILDER",
      specialty: "implementation",
    },
    analyst: {
      name: "Analyst Agent",
      role: "Analyst",
      label: "ANALYST",
      specialty: "analysis",
    },
    manager: {
      name: "CEO / Principal",
      role: "Coordinator",
      label: "CEO",
      specialty: "coordination",
    },
  };

  function getVisibleAgentDisplay(agent) {
    return visibleAgentDisplayById[agent.id] || {
      name: agent.name,
      role: agent.role || "",
      label: agent.label || agent.id.toUpperCase(),
      specialty: agent.expertise && agent.expertise.length > 0 ? agent.expertise[0] : agent.role || "",
    };
  }

  function getUserFacingAgentName(agentId, agents = []) {
    if (!agentId) {
      return "Unassigned";
    }

    const agent = agents.find((item) => item.id === agentId);

    if (agent) {
      return getVisibleAgentDisplay(agent).name;
    }

    return getVisibleAgentDisplay({ id: agentId, name: agentId, role: "", expertise: [] }).name;
  }

  function isVisibleAgent(agent) {
    return agent && agent.id !== "manager";
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

  function getVisibleAgents(agents = []) {
    return agents.filter(isVisibleAgent);
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

  function loadBusinessIdeas(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/business-ideas`, undefined, options.fetch)
      .then((data) => {
        if (options.onIdeas) {
          options.onIdeas(data.ideas);
        }

        return data.ideas;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadBusinessIdeasExport(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchText(`${apiBaseUrl}/api/exports/business-ideas`, undefined, options.fetch)
      .then((data) => {
        if (options.onExport) {
          options.onExport(data);
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

  function loadBusinessIdeaExport(ideaId, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchText(`${apiBaseUrl}/api/exports/business-ideas/${encodeURIComponent(ideaId)}`, undefined, options.fetch)
      .then((data) => {
        if (options.onExport) {
          options.onExport(data);
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

  function loadCeoDigest(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchJson(`${apiBaseUrl}/api/ceo-digest`, undefined, options.fetch)
      .then((data) => {
        if (options.onDigest) {
          options.onDigest(data.digest);
        }

        return data.digest;
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err);
        }

        throw err;
      });
  }

  function loadCeoDigestExport(options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;

    return fetchText(`${apiBaseUrl}/api/exports/ceo-digest`, undefined, options.fetch)
      .then((data) => {
        if (options.onExport) {
          options.onExport(data);
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

  function getExportPanelEmptyMessage() {
    return "Choose an export to view markdown, then use the buttons above to load a digest, ideas list, or idea report.";
  }

  function getExportPanelLoadedMessage({ title = "", kind = "export" } = {}) {
    if (title) {
      return kind === "idea" ? `Idea report: ${title}` : title;
    }

    return "Export loaded.";
  }

  function getExportCopyMessage({ clipboardAvailable = true, success = false } = {}) {
    if (success) {
      return "Copied export markdown.";
    }

    return clipboardAvailable
      ? "Copy failed. Select the markdown text and copy it manually."
      : "Copy unavailable. Select the markdown text and copy it manually.";
  }

  function parseCommandText(value) {
    const rawText = typeof value === "string" ? value.trim() : "";
    const text = rawText.toLowerCase();

    if (text === "summarize today") {
      return { type: "summarize_today", rawText };
    }

    if (text === "rank ideas") {
      return { type: "rank_ideas", rawText };
    }

    if (text === "kill weak ideas") {
      return { type: "kill_weak_ideas", rawText };
    }

    if (text.startsWith("focus ")) {
      return { type: "focus_category", rawText, category: rawText.slice(6).trim() };
    }

    if (text.startsWith("prioritize ")) {
      return { type: "prioritize_category", rawText, category: rawText.slice(11).trim() };
    }

    return null;
  }

  function isCommandText(value) {
    return Boolean(parseCommandText(value));
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

  function sendCommand(command, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || DEFAULT_API_BASE_URL;
    const sessionId = options.sessionId || getSessionId(options.storage);
    const roomId = options.roomId || getSelectedRoomId(options.storage);

    return fetchJson(
      `${apiBaseUrl}/api/commands`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command, sessionId, roomId }),
      },
      options.fetch,
    )
      .then((data) => {
        if (options.onCommand) {
          options.onCommand(data);
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
        text: `${getUserFacingAgentName(item.agentId)}: ${item.message}`,
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
    const display = getVisibleAgentDisplay(agent);

    return {
      value: agent.id,
      text: display.role ? `${display.name} - ${display.role}` : display.name,
      label: display.label,
      color: agent.color,
      role: display.role || "",
    };
  }

  function mapRoomForOption(room) {
    return {
      brief: room.brief,
      value: room.id,
      text: room.id === "main" ? "AI Mancave HQ" : "HQ",
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
      assignedAgent: getUserFacingAgentName(task.assignedAgentId, agents),
      ownerAgentId,
      ownerName: getUserFacingAgentName(ownerAgentId, agents),
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

  function mapBusinessIdeaForDisplay(idea, agents = []) {
    const status = idea.status || "researching";
    const statusClasses = {
      promising: "promising",
      building: "building",
      killed: "killed",
      validating: "validating",
      researching: "researching",
      paused: "paused",
    };

    return {
      id: idea.id,
      title: idea.title,
      category: idea.category || "general",
      status,
      statusClass: statusClasses[status] || "researching",
      assignedAgent: getUserFacingAgentName(idea.assignedAgentId, agents),
      confidence: Number.isFinite(Number(idea.confidence)) ? Number(idea.confidence) : 0,
      profitPotential: Number.isFinite(Number(idea.profitPotential)) ? Number(idea.profitPotential) : 0,
      nextAction: idea.nextAction || "No next action yet.",
      notes: idea.notes || "",
      description: idea.description || "",
    };
  }

  function mapCeoDigestForDisplay(digest = {}) {
    const topIdeas = Array.isArray(digest.topIdeas) ? digest.topIdeas : [];
    const newlyCreatedIdeas = Array.isArray(digest.newlyCreatedIdeas) ? digest.newlyCreatedIdeas : [];
    const pausedOrKilledIdeas = Array.isArray(digest.pausedOrKilledIdeas) ? digest.pausedOrKilledIdeas : [];
    const highestConfidenceOpportunity = digest.highestConfidenceOpportunity || null;
    const biggestRisk = digest.biggestRisk || null;

    return {
      updatedAt: digest.updatedAt || "",
      rankedOpportunitySummary: digest.rankedOpportunitySummary || "No business ideas yet.",
      topIdeas: topIdeas.slice(0, 3).map((idea) => `${idea.title} · ${idea.status}`),
      newlyCreatedIdeas: newlyCreatedIdeas.slice(0, 3).map((idea) => `${idea.title} · ${idea.status}`),
      pausedOrKilledIdeas: pausedOrKilledIdeas.slice(0, 3).map((idea) => `${idea.title} · ${idea.status}`),
      highestConfidenceOpportunity: highestConfidenceOpportunity ? `${highestConfidenceOpportunity.title} (${highestConfidenceOpportunity.confidence}/10)` : "None yet.",
      biggestRisk: biggestRisk ? `${biggestRisk.title} (${biggestRisk.risk}/10)` : "None yet.",
      recommendedNextAction: digest.recommendedNextAction || "Create the first idea.",
    };
  }

  function mapDecisionForDisplay(decision, rooms = []) {
    return {
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      meta: `${getUserFacingAgentName(decision.agentId || "")} · ${getRoomName(rooms, decision.roomId || "room")}`,
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
    return {
      agentId: goal.agentId,
      agentName: getUserFacingAgentName(goal.agentId, agents),
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
    if (roomId === "main") {
      return "AI Mancave HQ";
    }

    return "HQ";
  }

  function getRoomActivityView(activity = {}, selectedRoomId, rooms = []) {
    const activeRoomName = getRoomName(rooms, selectedRoomId);
    const otherRoom = activity.otherRoom || null;

    return {
      activeRoomText: activeRoomName ? `Active room: ${activeRoomName}` : "Active room",
      noticeText: otherRoom ? `Activity in ${getRoomName(rooms, otherRoom.roomId)}` : "",
    };
  }

  const agentRoomPositions = {
    host: { left: "14%", top: "44%" },
    assistant: { left: "50%", top: "18%" },
    sales: { left: "86%", top: "50%" },
    strategist: { left: "24%", top: "18%" },
    researcher: { left: "74%", top: "18%" },
    builder: { left: "24%", top: "70%" },
    analyst: { left: "74%", top: "70%" },
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

  const hqZoneMetadata = [
    {
      id: "command-desk",
      name: "CEO Command Desk",
      purpose: "Executive check-ins, summaries, and direction",
      primaryAgentIds: ["host", "manager"],
      relatedCategories: ["leadership", "planning", "summary"],
    },
    {
      id: "research-library",
      name: "Research / Library",
      purpose: "Discovery, sourcing, and competitor notes",
      primaryAgentIds: ["researcher"],
      relatedCategories: ["research", "discovery", "validation"],
    },
    {
      id: "builder-workstation",
      name: "Builder Workstation",
      purpose: "Implementation, fixes, and prototype work",
      primaryAgentIds: ["builder"],
      relatedCategories: ["build", "implementation", "mvp"],
    },
    {
      id: "analyst-desk",
      name: "Analyst Desk",
      purpose: "Metrics, risks, decisions, and scorekeeping",
      primaryAgentIds: ["analyst"],
      relatedCategories: ["analysis", "risk", "decision"],
    },
    {
      id: "automation-station",
      name: "Automation Station",
      purpose: "System wiring, tooling, and process automation",
      primaryAgentIds: ["assistant"],
      relatedCategories: ["automation", "ops", "tooling"],
    },
    {
      id: "trading-desk",
      name: "Trading Desk",
      purpose: "Revenue, offers, clients, and market action",
      primaryAgentIds: ["sales"],
      relatedCategories: ["trading", "revenue", "clients"],
    },
    {
      id: "brainstorm-lounge",
      name: "Brainstorm Lounge",
      purpose: "Positioning, prioritization, and planning",
      primaryAgentIds: ["strategist"],
      relatedCategories: ["strategy", "planning", "ideation"],
    },
  ];

  const hqWorkZoneLayouts = {
    "command-desk": {
      className: "command",
      left: 50,
      top: 64,
      width: 14,
      height: 7.5,
      poseClass: "station-command",
      workClass: "working-command",
      accent: "#d4a853",
    },
    "research-library": {
      className: "research",
      left: 14,
      top: 26,
      width: 11,
      height: 8,
      poseClass: "station-reading",
      workClass: "working-reading",
      accent: "#7fd8ef",
    },
    "builder-workstation": {
      className: "builder",
      left: 33,
      top: 59,
      width: 11,
      height: 6.5,
      poseClass: "station-typing",
      workClass: "working-typing",
      accent: "#ff9f7a",
    },
    "analyst-desk": {
      className: "analyst",
      left: 67,
      top: 59,
      width: 11,
      height: 6.5,
      poseClass: "station-charting",
      workClass: "working-charting",
      accent: "#a4b4c5",
    },
    "automation-station": {
      className: "automation",
      left: 50,
      top: 27,
      width: 11,
      height: 6.8,
      poseClass: "station-automation",
      workClass: "working-automation",
      accent: "#8cc0ff",
    },
    "trading-desk": {
      className: "trading",
      left: 80,
      top: 47,
      width: 10.5,
      height: 6.5,
      poseClass: "station-charting",
      workClass: "working-charting",
      accent: "#f6b35a",
    },
    "brainstorm-lounge": {
      className: "lounge",
      left: 26,
      top: 43,
      width: 11.5,
      height: 6.5,
      poseClass: "station-whiteboard",
      workClass: "working-whiteboard",
      accent: "#b892ff",
    },
  };

  const hqWorkZones = hqZoneMetadata.map((zone) => ({
    ...zone,
    label: zone.name,
    ...hqWorkZoneLayouts[zone.id],
  }));

  const hqWorkZoneMap = hqWorkZones.reduce((map, zone) => {
    map[zone.id] = zone;
    return map;
  }, {});

  const hqRouteState = new Map();
  const HQ_ROUTE_COOLDOWN_MS = 12000;
  const HQ_ROUTE_DWELL_MS = 9000;

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

  function getHQZoneMetadata() {
    return hqZoneMetadata.map((zone) => ({ ...zone }));
  }

  function getTextBlob(values = []) {
    return values
      .filter(Boolean)
      .map((item) => String(item).toLowerCase())
      .join(" ");
  }

  function includesAny(text, keywords = []) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  function getHQZoneForCategory(category = "") {
    const text = String(category).toLowerCase();

    if (includesAny(text, ["trade", "revenue", "client", "offer"])) {
      return "trading-desk";
    }

    if (includesAny(text, ["automation", "ops", "tool"])) {
      return "automation-station";
    }

    if (includesAny(text, ["arbitrage", "market"])) {
      return "trading-desk";
    }

    if (includesAny(text, ["research", "discover", "validate", "niche"])) {
      return "research-library";
    }

    if (includesAny(text, ["build", "mvp", "product", "implementation"])) {
      return "builder-workstation";
    }

    if (includesAny(text, ["risk", "analysis", "decision", "score"])) {
      return "analyst-desk";
    }

    if (includesAny(text, ["strategy", "plan", "priorit", "position"])) {
      return "brainstorm-lounge";
    }

    return "command-desk";
  }

  function getTaskStationId(task, phase, agentId) {
    const assignedStation = agentWorkZoneAssignments[agentId] || "command-desk";
    const text = getTextBlob([
      task.title,
      task.summary,
      task.nextAction,
      task.handoffReason,
      task.blockedReason,
      task.roomId,
    ]);

    if (agentId === "host" || agentId === "manager") {
      return assignedStation;
    }

    if (task.category) {
      return getHQZoneForCategory(task.category);
    }

    if (includesAny(text, ["trade", "revenue", "client", "offer"])) {
      return "trading-desk";
    }

    if (includesAny(text, ["automation", "ops", "tool"])) {
      return "automation-station";
    }

    if (includesAny(text, ["research", "discover", "validate", "niche"])) {
      return "research-library";
    }

    if (includesAny(text, ["build", "mvp", "product", "implementation"])) {
      return "builder-workstation";
    }

    if (includesAny(text, ["risk", "analysis", "decision", "score"])) {
      return "analyst-desk";
    }

    if (includesAny(text, ["strategy", "plan", "priorit", "position"])) {
      return "brainstorm-lounge";
    }

    return assignedStation;
  }

  function getRelevantIdeaForAgent(agent, ideas = [], phase = "observe") {
    const agentText = getTextBlob([agent.id, agent.role, agent.specialty, ...(agent.taskTendencies || [])]);

    return ideas
      .filter((idea) => idea && idea.status !== "killed")
      .map((idea) => {
        const text = getTextBlob([
          idea.title,
          idea.category,
          idea.description,
          idea.nextAction,
          idea.notes,
        ]);
        const categoryZoneId = getHQZoneForCategory(idea.category);
        let score = 0;

        if (includesAny(text, agentText.split(" ").filter(Boolean))) {
          score += 5;
        }

        if (categoryZoneId === (agentWorkZoneAssignments[agent.id] || "command-desk")) {
          score += 4;
        }

        if (idea.status === "building") {
          score += 4;
        } else if (idea.status === "promising") {
          score += 3;
        } else if (idea.status === "validating") {
          score += 2;
        } else if (idea.status === "researching") {
          score += 1;
        }

        score += Math.max(0, Math.min(10, Number(idea.confidence) || 0)) / 4;
        score += Math.max(0, Math.min(10, Number(idea.profitPotential) || 0)) / 5;

        if (phase === "plan" && includesAny(text, ["plan", "strategy", "priorit", "position", "roadmap"])) {
          score += 3;
        }

        if (phase === "review" && includesAny(text, ["risk", "decision", "summary", "review", "rank"])) {
          score += 3;
        }

        if (phase === "execute" && includesAny(text, ["build", "launch", "ship", "test", "validate"])) {
          score += 2;
        }

        return { idea, score, categoryZoneId };
      })
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        const firstUpdatedAt = first.idea.updatedAt || first.idea.createdAt || "";
        const secondUpdatedAt = second.idea.updatedAt || second.idea.createdAt || "";

        return String(secondUpdatedAt).localeCompare(String(firstUpdatedAt));
      })[0] || null;
  }

  function getHQHostCheckInTarget(context = {}) {
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const decisions = Array.isArray(context.decisions) ? context.decisions : [];
    const ideas = Array.isArray(context.ideas) ? context.ideas : [];
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
        scoreAgent(taskOwnerId, 8);
        scoreAgent(assignedByAgentId, 2);
      }

      if (task.handoffReason || task.lastHandoffAt) {
        scoreAgent(taskOwnerId, 5);
        scoreAgent(assignedByAgentId, 2);
      }

      if (task.status === "in_progress") {
        scoreAgent(taskOwnerId, 1);
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

    ideas
      .filter((idea) => idea && idea.status !== "killed")
      .forEach((idea) => {
        const category = getHQZoneForCategory(idea.category);
        const ideaScore = Math.max(0, Math.min(10, Number(idea.confidence) || 0)) + Math.max(0, Math.min(10, Number(idea.profitPotential) || 0));
        if (idea.status === "building" || idea.status === "promising") {
          const targetAgent = hqZoneMetadata.find((zone) => zone.id === category)?.primaryAgentIds?.[0] || "";
          scoreAgent(targetAgent, 2 + Math.round(ideaScore / 4));
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

    if (!bestAgentId || bestScore < 6) {
      return {
        targetAgentId: "",
        targetZoneId: "",
        routeReason: "",
      };
    }

    return {
      targetAgentId: bestAgentId,
      targetZoneId: agentWorkZoneAssignments[bestAgentId] || "command-desk",
      routeReason: `CEO check-in: ${bestAgentId}`,
    };
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

  function getHQAgentRouteDecision(agent, context = {}, routingState = hqRouteState, now = Date.now()) {
    const phase = context.phase || "observe";
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const ideas = Array.isArray(context.ideas) ? context.ideas : [];
    const decisions = Array.isArray(context.decisions) ? context.decisions : [];
    const memoryEvents = Array.isArray(context.memoryEvents) ? context.memoryEvents : [];
    const assignedStationId = agentWorkZoneAssignments[agent.id] || "command-desk";
    const homeZone = hqWorkZoneMap[assignedStationId] || hqWorkZoneMap["command-desk"];
    const current = routingState.get(agent.id) || {};

    let stationId = assignedStationId;
    let routeReason = `home station: ${homeZone.name}`;
    let targetAgentId = "";
    let targetIdeaId = "";

    if (agent.id === "host") {
      const hostTarget = getHQHostCheckInTarget({ tasks, decisions, ideas, memoryEvents });
      if (hostTarget.targetAgentId) {
        stationId = hostTarget.targetZoneId || assignedStationId;
        routeReason = hostTarget.routeReason || `CEO check-in: ${hostTarget.targetAgentId}`;
        targetAgentId = hostTarget.targetAgentId;
      } else {
        const rankedIdea = ideas
          .filter((idea) => idea && idea.status !== "killed")
          .map((idea) => ({
            idea,
            score:
              (idea.status === "building" ? 5 : idea.status === "promising" ? 4 : 0) +
              (Math.max(0, Math.min(10, Number(idea.confidence) || 0)) / 2) +
              (Math.max(0, Math.min(10, Number(idea.profitPotential) || 0)) / 3),
          }))
          .sort((first, second) => second.score - first.score)[0];

        if (rankedIdea && rankedIdea.score >= 6) {
          stationId = getHQZoneForCategory(rankedIdea.idea.category);
          routeReason = `CEO review: ${rankedIdea.idea.title}`;
          targetIdeaId = rankedIdea.idea.id;
        } else {
          stationId = assignedStationId;
          routeReason = "CEO command desk";
        }
      }
    } else {
      const task = getRelevantTaskForAgent(agent, tasks, phase);

      if (task) {
        const taskStationId = getTaskStationId(task, phase, agent.id);
        if (taskStationId === assignedStationId || (agent.id === "assistant" && taskStationId === "automation-station")) {
          stationId = taskStationId;
        } else {
          stationId = assignedStationId;
        }
        routeReason = task.blockedReason
          ? `blocked task: ${task.title}`
          : task.ownerAgentId === agent.id
            ? `owned task: ${task.title}`
            : `assigned task: ${task.title}`;
      } else {
        const relevantIdea = getRelevantIdeaForAgent(agent, ideas, phase);

        if (relevantIdea && relevantIdea.score >= 5.5 && (relevantIdea.categoryZoneId === assignedStationId || (agent.id === "assistant" && relevantIdea.categoryZoneId === "automation-station"))) {
          stationId = relevantIdea.categoryZoneId || assignedStationId;
          routeReason = `idea category: ${relevantIdea.idea.category || "general"}`;
          targetIdeaId = relevantIdea.idea.id;
        } else if (phase === "review" && ["analyst", "strategist"].includes(agent.id)) {
          stationId = agent.id === "analyst" ? "analyst-desk" : "brainstorm-lounge";
          routeReason = `${phase} phase: ${homeZone.name}`;
        } else if (phase === "plan" && agent.id === "strategist") {
          stationId = "brainstorm-lounge";
          routeReason = "planning phase: brainstorm lounge";
        } else {
          stationId = assignedStationId;
        }
      }
    }

    const previousStationId = current.stationId || "";
    const previousSwitchAt = current.lastSwitchAt || 0;
    const previousDwellUntil = current.dwellUntil || 0;
    const hasPreviousStation = Boolean(previousStationId);
    const allowedToSwitch = stationId === previousStationId || !hasPreviousStation || (now >= previousSwitchAt + HQ_ROUTE_COOLDOWN_MS && now >= previousDwellUntil);
    const finalStationId = allowedToSwitch ? stationId : (previousStationId || assignedStationId);
    const finalRouteReason = allowedToSwitch ? routeReason : (current.routeReason || routeReason);
    const switched = finalStationId !== previousStationId;

    const nextState = {
      stationId: finalStationId,
      routeReason: finalRouteReason,
      lastSwitchAt: switched ? now : previousSwitchAt,
      dwellUntil: switched ? now + HQ_ROUTE_DWELL_MS : previousDwellUntil,
      lastSeenAt: now,
      targetAgentId,
      targetIdeaId,
    };

    routingState.set(agent.id, nextState);

    return {
      stationId: finalStationId,
      stationLabel: hqWorkZoneMap[finalStationId] ? hqWorkZoneMap[finalStationId].label : homeZone.label,
      stationPurpose: hqWorkZoneMap[finalStationId] ? hqWorkZoneMap[finalStationId].purpose : homeZone.purpose,
      routeReason: finalRouteReason,
      targetAgentId,
      targetIdeaId,
      isRouteLocked: !allowedToSwitch && stationId !== previousStationId,
      isHomeStation: finalStationId === assignedStationId,
    };
  }

  function getHQInteractionEvent(agent, motion, context = {}) {
    if (!agent || !motion) {
      return null;
    }

    const agentById = context.agentById || context.agentsById || new Map();
    const phase = context.phase || "observe";
    const stationId = motion.stationId || "";
    const stationLabel = motion.stationLabel || "";
    const routeReason = String(motion.routeReason || "").toLowerCase();
    const targetAgent = motion.targetAgentId ? (agentById.get(motion.targetAgentId) || { id: motion.targetAgentId }) : null;
    const targetDisplay = targetAgent ? getVisibleAgentDisplay(targetAgent) : null;
    const targetName = targetDisplay ? targetDisplay.name : motion.targetAgentId || "";
    let text = "";
    let kind = "";
    let importance = 0;

    if (agent.id === "host" && motion.targetAgentId) {
      text = `CEO checked ${targetName}`;
      kind = "check-in";
      importance = 5;
    } else if (agent.id === "analyst" && (stationId === "analyst-desk" || routeReason.includes("risk") || routeReason.includes("review") || phase === "review")) {
      text = "Analyst reviewed risk";
      kind = "review";
      importance = 4;
    } else if (agent.id === "builder" && (stationId === "builder-workstation" || routeReason.includes("mvp") || routeReason.includes("build") || routeReason.includes("plan"))) {
      text = "Builder updated MVP plan";
      kind = "build";
      importance = 4;
    } else if (agent.id === "researcher" && (stationId === "research-library" || routeReason.includes("discover") || routeReason.includes("research"))) {
      text = "Research Agent logged discovery";
      kind = "discovery";
      importance = 4;
    } else if (agent.id === "sales" && (stationId === "trading-desk" || routeReason.includes("trade") || routeReason.includes("strategy") || routeReason.includes("revenue"))) {
      text = "Trading Agent reviewed strategy";
      kind = "strategy";
      importance = 4;
    } else if (agent.id === "strategist" && (stationId === "brainstorm-lounge" || routeReason.includes("plan") || routeReason.includes("priorit") || routeReason.includes("strategy"))) {
      text = "Arbitrage Agent refined priorities";
      kind = "planning";
      importance = 3;
    } else {
      return null;
    }

    return {
      id: `${agent.id}:${stationId}:${kind}:${text}`,
      agentId: agent.id,
      targetAgentId: motion.targetAgentId || "",
      targetIdeaId: motion.targetIdeaId || "",
      stationId,
      stationLabel,
      text,
      kind,
      importance,
      isImportant: importance >= 4,
      routeReason: motion.routeReason || "",
      createdAt: context.createdAt || new Date(context.now || Date.now()).toISOString(),
    };
  }

  function getHQInteractionEvents(motions = [], agents = [], context = {}) {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const phase = context.phase || "observe";

    return motions
      .map((entry) => getHQInteractionEvent(
        agentById.get(entry.agentId) || { id: entry.agentId },
        entry.motion || {},
        {
          ...context,
          phase,
          agentById,
        },
      ))
      .filter(Boolean);
  }

  function getHQAgentStationProfile(agent, context = {}) {
    const phase = context.phase || "observe";
    const tasks = Array.isArray(context.tasks) ? context.tasks : [];
    const ideas = Array.isArray(context.ideas) ? context.ideas : [];
    const decisions = Array.isArray(context.decisions) ? context.decisions : [];
    const memoryEvents = Array.isArray(context.memoryEvents) ? context.memoryEvents : [];
    const route = getHQAgentRouteDecision(agent, { phase, tasks, ideas, decisions, memoryEvents }, context.routingState, context.now);
    const assignedStationId = agentWorkZoneAssignments[agent.id] || "command-desk";
    const activeTask = getRelevantTaskForAgent(agent, tasks, phase);
    const activityLevel = activeTask ? (activeTask.status === "in_progress" ? 1 : 0.85) : (phase === "execute" ? 0.55 : phase === "review" ? 0.48 : 0.38);
    const motionIntensity = activeTask ? (activeTask.status === "in_progress" ? 1 : 0.82) : (phase === "execute" ? 0.58 : phase === "review" ? 0.46 : 0.35);

    return {
      stationId: route.stationId,
      stationLabel: route.stationLabel || (hqWorkZoneMap[route.stationId] ? hqWorkZoneMap[route.stationId].label : hqWorkZoneMap[assignedStationId].label),
      stationPurpose: route.stationPurpose || (hqWorkZoneMap[route.stationId] ? hqWorkZoneMap[route.stationId].purpose : hqWorkZoneMap[assignedStationId].purpose),
      routeReason: route.routeReason || "",
      poseClass: hqWorkZoneMap[route.stationId] ? hqWorkZoneMap[route.stationId].poseClass : hqWorkZoneMap[assignedStationId].poseClass,
      workClass: hqWorkZoneMap[route.stationId] ? hqWorkZoneMap[route.stationId].workClass : hqWorkZoneMap[assignedStationId].workClass,
      activityLevel,
      motionIntensity: memoryEvents.some((event) => event.importance >= 4) ? Math.max(motionIntensity, 0.75) : motionIntensity,
      taskId: activeTask ? activeTask.id : null,
      taskStatus: activeTask ? activeTask.status : null,
      isCheckingIn: Boolean(route.targetAgentId),
      isWorkingAtStation: route.stationId === assignedStationId,
      targetAgentId: route.targetAgentId || "",
      targetIdeaId: route.targetIdeaId || "",
      isRouteLocked: Boolean(route.isRouteLocked),
      isHomeStation: Boolean(route.isHomeStation),
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
      const targetZone = profile.targetAgentId ? (hqWorkZoneMap[agentWorkZoneAssignments[profile.targetAgentId]] || homeZone) : (hqWorkZoneMap[profile.stationId] || homeZone);
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
        stationPurpose: activeZone.purpose,
        poseClass: activeZone.poseClass,
        workClass: activeZone.workClass,
        isCheckingIn: activeZone.id !== "command-desk",
        isWorkingAtStation: activeZone.id === "command-desk",
        activityLevel: profile.activityLevel,
        motionIntensity: profile.motionIntensity,
        taskId: profile.taskId,
        taskStatus: profile.taskStatus,
        targetAgentId: profile.targetAgentId || "",
        routeReason: profile.routeReason || "",
        targetIdeaId: profile.targetIdeaId || "",
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
      stationPurpose: profile.stationPurpose || baseZone.purpose,
      routeReason: profile.routeReason || "",
      poseClass: profile.poseClass || baseZone.poseClass,
      workClass: profile.workClass || baseZone.workClass,
      isCheckingIn: false,
      isWorkingAtStation: profile.isWorkingAtStation,
      activityLevel: profile.activityLevel,
      motionIntensity: profile.motionIntensity,
      taskId: profile.taskId,
      taskStatus: profile.taskStatus,
      targetAgentId: "",
      targetIdeaId: profile.targetIdeaId || "",
    };
  }

  function mapAgentForRoom(agent, messages = []) {
    const latestMessage = [...messages]
      .reverse()
      .find((item) => item.role === "agent" && item.agentId === agent.id);
    const display = getVisibleAgentDisplay(agent);

    return {
      id: agent.id,
      name: display.name,
      label: display.label,
      color: agent.color,
      role: display.role || "",
      specialty: display.specialty || (agent.expertise && agent.expertise.length > 0 ? agent.expertise[0] : agent.role || ""),
      position: agentRoomPositions[agent.id] || { left: "50%", top: "50%" },
      appearance: getAgentCharacterStyle(agent),
      latestMessage: latestMessage ? latestMessage.message : "Thinking...",
      latestMessageId: latestMessage ? latestMessage.id : null,
    };
  }

  function getHQAgentRenderKey(agent = {}) {
    return agent.id ? String(agent.id) : "";
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
    getRoomName,
    getHQLayoutConfig,
    loadAgents,
    loadAgentGoals,
    loadBusinessIdeas,
    loadBusinessIdeasExport,
    loadBusinessIdeaExport,
    loadCeoDigest,
    loadCeoDigestExport,
    loadCompanyPlan,
    loadDecisions,
    loadMemoryEvents,
    loadMessages,
    loadOperatingRhythm,
    loadRooms,
    loadTasks,
    mapAgentForOption,
    getVisibleAgents,
    mapAgentGoalForDisplay,
    mapBusinessIdeaForDisplay,
    mapCeoDigestForDisplay,
    mapAgentForRoom,
    getAgentCharacterStyle,
    getHQWorkZones,
    getHQZoneMetadata,
    getHQAgentStationProfile,
    getHQAgentMotionState,
    getHQAgentRouteDecision,
    getHQInteractionEvent,
    getHQInteractionEvents,
    getHQAgentRenderKey,
    mapCompanyPlanForDisplay,
    mapDecisionForDisplay,
    mapMemoryEventForDisplay,
    mapOperatingRhythmForDisplay,
    mapMessageForDisplay,
    mapRoomForOption,
    mapTaskForDisplay,
    getExportPanelEmptyMessage,
    getExportPanelLoadedMessage,
    getExportCopyMessage,
    getNewestAgentMessage,
    getLatestUserMessage,
    isCommandText,
    parseCommandText,
    saveSelectedAgentId,
    getSelectedRoomId,
    saveSelectedRoomId,
    sendCommand,
    sendMessage,
    updateTaskStatus,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.WOYSApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
