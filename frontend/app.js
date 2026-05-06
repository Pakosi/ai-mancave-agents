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
      text: agent.name,
      label: agent.label,
      color: agent.color,
    };
  }

  function mapRoomForOption(room) {
    return {
      value: room.id,
      text: room.name,
    };
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

  function mapTaskForDisplay(task, agents = []) {
    const agent = agents.find((item) => item.id === task.assignedAgentId);
    const nextStatus = getNextTaskStatus(task.status);

    return {
      id: task.id,
      title: task.title,
      assignedAgent: agent ? agent.name : task.assignedAgentId,
      status: task.status,
      statusText: task.status.replace("_", " "),
      nextStatus,
      nextStatusText: nextStatus ? nextStatus.replace("_", " ") : "",
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
    loadAgents,
    loadMessages,
    loadRooms,
    loadTasks,
    mapAgentForOption,
    mapAgentForRoom,
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
