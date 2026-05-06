const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fetchJson,
  createTask,
  getAgentReply,
  getSessionId,
  getSelectedAgentId,
  getSelectedRoomId,
  getLatestUserMessage,
  getNewestAgentMessage,
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
  saveSelectedAgentId,
  saveSelectedRoomId,
  sendMessage,
  updateTaskStatus,
} = require("./app");

function mockResponse(body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    json: () => Promise.resolve(body),
  };
}

function mockStorage(values = {}) {
  return {
    getItem(key) {
      return values[key] || null;
    },
    setItem(key, value) {
      values[key] = value;
    },
    values,
  };
}

test("fetchJson resolves when response ok is true", async () => {
  const fetch = () => Promise.resolve(mockResponse({ status: "ok" }));

  const data = await fetchJson("http://test.local/api/status", undefined, fetch);

  assert.deepEqual(data, { status: "ok" });
});

test("fetchJson rejects when response ok is false", async () => {
  const fetch = () => Promise.resolve(mockResponse({ error: "bad" }, {
    ok: false,
    status: 500,
  }));

  await assert.rejects(
    fetchJson("http://test.local/api/messages", undefined, fetch),
    /Request failed with status 500/,
  );
});

test("loadMessages calls /api/messages, returns messages, and triggers onMessages", async () => {
  const calls = [];
  const callbacks = [];
  const activityCallbacks = [];
  const responseMessages = [
    { id: 1, message: "one" },
    { id: 2, message: "two" },
  ];
  const responseActivity = {
    isThinking: true,
    nextAgentId: "assistant",
    topic: "onboarding",
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({
      messages: responseMessages,
      activity: responseActivity,
    }));
  };

  const messages = await loadMessages({
    apiBaseUrl: "http://test.local",
    fetch,
    sessionId: "session-1",
    roomId: "support",
    onMessages(items) {
      callbacks.push(items);
    },
    onActivity(activity) {
      activityCallbacks.push(activity);
    },
  });

  assert.deepEqual(messages, responseMessages);
  assert.deepEqual(callbacks, [responseMessages]);
  assert.deepEqual(activityCallbacks, [responseActivity]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/messages?sessionId=session-1&roomId=support");
  assert.equal(calls[0].options, undefined);
});

test("loadAgents calls /api/agents and returns agents", async () => {
  const calls = [];
  const callbacks = [];
  const responseAgents = [
    { id: "host", name: "Host", label: "HOST", color: "#10b981" },
    { id: "sales", name: "Sales", label: "SALES", color: "#f97316" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ agents: responseAgents }));
  };

  const agents = await loadAgents({
    apiBaseUrl: "http://test.local",
    fetch,
    onAgents(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(agents, responseAgents);
  assert.deepEqual(callbacks, [responseAgents]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/agents");
  assert.equal(calls[0].options, undefined);
});

test("loadRooms calls /api/rooms and returns rooms", async () => {
  const calls = [];
  const callbacks = [];
  const responseRooms = [
    { id: "main", name: "Main Office" },
    { id: "auto", name: "Auto Sales Lab" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ rooms: responseRooms }));
  };

  const rooms = await loadRooms({
    apiBaseUrl: "http://test.local",
    fetch,
    onRooms(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(rooms, responseRooms);
  assert.deepEqual(callbacks, [responseRooms]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/rooms");
  assert.equal(calls[0].options, undefined);
});

test("loadTasks calls /api/tasks for selected room and returns tasks", async () => {
  const calls = [];
  const callbacks = [];
  const responseTasks = [
    { id: 1, roomId: "auto", title: "Follow up", status: "open" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ tasks: responseTasks }));
  };

  const tasks = await loadTasks({
    apiBaseUrl: "http://test.local",
    fetch,
    roomId: "auto",
    onTasks(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(tasks, responseTasks);
  assert.deepEqual(callbacks, [responseTasks]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/tasks?roomId=auto");
  assert.equal(calls[0].options, undefined);
});

test("loadMessages calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("network down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    loadMessages({
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /network down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("sendMessage sends POST, correct body, and triggers onSent", async () => {
  const calls = [];
  const callbacks = [];
  const responseMessage = { id: 1, message: "Hello WOYS" };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse(responseMessage, { status: 201 }));
  };

  const message = await sendMessage("Hello WOYS", {
    apiBaseUrl: "http://test.local",
    fetch,
    sessionId: "session-1",
    roomId: "support",
    onSent(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(message, responseMessage);
  assert.deepEqual(callbacks, [responseMessage]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/message");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(
    calls[0].options.body,
    JSON.stringify({ message: "Hello WOYS", sessionId: "session-1", roomId: "support" }),
  );
});

test("sendMessage calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("network down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    sendMessage("Hello WOYS", {
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /network down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("getAgentReply calls selected agent endpoint and triggers onReply", async () => {
  const calls = [];
  const callbacks = [];
  const response = {
    agentId: "sales",
    reply: "Great choice. Let's turn hello into a win.",
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse(response));
  };

  const reply = await getAgentReply("sales", "hello", {
    apiBaseUrl: "http://test.local",
    fetch,
    sessionId: "session-1",
    roomId: "support",
    onReply(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(reply, response);
  assert.deepEqual(callbacks, [response]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/agents/sales/reply");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(
    calls[0].options.body,
    JSON.stringify({ message: "hello", sessionId: "session-1", roomId: "support" }),
  );
});

test("createTask sends POST with correct body and triggers onCreated", async () => {
  const calls = [];
  const callbacks = [];
  const responseTask = {
    id: 1,
    roomId: "ops",
    title: "Clean checklist",
    description: "Remove duplicate steps",
    assignedAgentId: "assistant",
    status: "open",
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse(responseTask, { status: 201 }));
  };

  const task = await createTask({
    roomId: "ops",
    title: "Clean checklist",
    description: "Remove duplicate steps",
    assignedAgentId: "assistant",
  }, {
    apiBaseUrl: "http://test.local",
    fetch,
    onCreated(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(task, responseTask);
  assert.deepEqual(callbacks, [responseTask]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/tasks");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(
    calls[0].options.body,
    JSON.stringify({
      roomId: "ops",
      title: "Clean checklist",
      description: "Remove duplicate steps",
      assignedAgentId: "assistant",
    }),
  );
});

test("updateTaskStatus sends PATCH with correct body and triggers onUpdated", async () => {
  const calls = [];
  const callbacks = [];
  const responseTask = {
    id: 7,
    status: "in_progress",
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse(responseTask));
  };

  const task = await updateTaskStatus(7, "in_progress", {
    apiBaseUrl: "http://test.local",
    fetch,
    onUpdated(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(task, responseTask);
  assert.deepEqual(callbacks, [responseTask]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/tasks/7");
  assert.equal(calls[0].options.method, "PATCH");
  assert.equal(calls[0].options.body, JSON.stringify({ status: "in_progress" }));
});

test("getAgentReply calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("network down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    getAgentReply("host", "hello", {
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /network down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("mapMessageForDisplay handles user and agent roles", () => {
  const user = mapMessageForDisplay({
    role: "user",
    message: "hello",
    createdAt: "2026-05-05T00:00:00.000Z",
  });

  assert.deepEqual(user, {
    classes: ["message", "user"],
    text: "hello",
    createdAt: "2026-05-05T00:00:00.000Z",
  });

  const agent = mapMessageForDisplay({
    role: "agent",
    agentId: "host",
    message: "welcome",
    createdAt: "2026-05-05T00:00:01.000Z",
  });

  assert.deepEqual(agent, {
    classes: ["message", "agent", "agent-host"],
    text: "HOST: welcome",
    createdAt: "2026-05-05T00:00:01.000Z",
  });
});

test("mapAgentForOption maps backend agent for dropdown use", () => {
  const option = mapAgentForOption({
    id: "assistant",
    name: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
  });

  assert.deepEqual(option, {
    value: "assistant",
    text: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
  });
});

test("mapRoomForOption maps backend room for dropdown use", () => {
  const option = mapRoomForOption({
    id: "marketing",
    name: "Marketing War Room",
  });

  assert.deepEqual(option, {
    value: "marketing",
    text: "Marketing War Room",
  });
});

test("mapTaskForDisplay maps task state and next action", () => {
  const task = mapTaskForDisplay({
    id: 3,
    title: "Draft pitch",
    assignedAgentId: "sales",
    status: "open",
    updatedAt: "2026-05-05T12:00:00.000Z",
  }, [
    { id: "sales", name: "Sales" },
  ], {
    now: new Date("2026-05-05T12:00:03.000Z").getTime(),
    recentWindowMs: 10000,
  });

  assert.deepEqual(task, {
    id: 3,
    title: "Draft pitch",
    assignedAgent: "Sales",
    status: "open",
    statusText: "open",
    isRecentlyUpdated: true,
    nextStatus: "in_progress",
    nextStatusText: "in progress",
  });

  const done = mapTaskForDisplay({
    id: 4,
    title: "Done task",
    assignedAgentId: "host",
    status: "done",
    updatedAt: "2026-05-05T12:00:00.000Z",
  }, [], {
    now: new Date("2026-05-05T12:01:00.000Z").getTime(),
    recentWindowMs: 10000,
  });

  assert.equal(done.isRecentlyUpdated, false);
  assert.equal(done.nextStatus, "");
  assert.equal(done.nextStatusText, "");
});

test("mapAgentForRoom adds fixed position and latest agent message", () => {
  const roomAgent = mapAgentForRoom(
    { id: "assistant", name: "Assistant", label: "ASSISTANT", color: "#3b82f6" },
    [
      { id: 1, role: "agent", agentId: "assistant", message: "older" },
      { role: "agent", agentId: "sales", message: "sales thought" },
      { id: 3, role: "agent", agentId: "assistant", message: "latest assistant thought" },
    ],
  );

  assert.deepEqual(roomAgent, {
    id: "assistant",
    name: "Assistant",
    label: "ASSISTANT",
    color: "#3b82f6",
    position: { left: "50%", top: "32%" },
    latestMessage: "latest assistant thought",
    latestMessageId: 3,
  });
});

test("getNewestAgentMessage returns latest agent message", () => {
  const latest = getNewestAgentMessage([
    { id: 1, role: "agent", agentId: "host", message: "first" },
    { id: 2, role: "user", message: "user" },
    { id: 3, role: "agent", agentId: "sales", message: "second" },
  ]);

  assert.deepEqual(latest, {
    id: 3,
    role: "agent",
    agentId: "sales",
    message: "second",
  });
});

test("getLatestUserMessage returns the latest user message", () => {
  const latest = getLatestUserMessage([
    { role: "user", message: "first" },
    { role: "agent", message: "agent" },
    { role: "user", message: "second" },
  ]);

  assert.equal(latest, "second");
});

test("getSessionId reuses or creates localStorage session id", () => {
  const storage = mockStorage();

  const created = getSessionId(storage);
  const reused = getSessionId(storage);

  assert.match(created, /^session-/);
  assert.equal(reused, created);
  assert.equal(storage.values.woysSessionId, created);
});

test("saveSelectedAgentId saves selected agent", () => {
  const storage = mockStorage();

  saveSelectedAgentId("sales", storage);

  assert.equal(storage.values.woysSelectedAgentId, "sales");
});

test("getSelectedAgentId reuses saved selected agent", () => {
  const storage = mockStorage({
    woysSelectedAgentId: "assistant",
  });
  const agents = [
    { id: "host" },
    { id: "assistant" },
    { id: "sales" },
  ];

  assert.equal(getSelectedAgentId(agents, storage), "assistant");
});

test("getSelectedAgentId falls back when saved selected agent is invalid", () => {
  const storage = mockStorage({
    woysSelectedAgentId: "missing",
  });
  const agents = [
    { id: "host" },
    { id: "assistant" },
  ];

  assert.equal(getSelectedAgentId(agents, storage), "host");
});

test("saveSelectedRoomId saves selected room", () => {
  const storage = mockStorage();

  saveSelectedRoomId("support", storage);

  assert.equal(storage.values.woysSelectedRoomId, "support");
});

test("getSelectedRoomId reuses saved selected room", () => {
  const storage = mockStorage({
    woysSelectedRoomId: "auto",
  });

  assert.equal(getSelectedRoomId(storage), "auto");
});

test("getSelectedRoomId reuses saved room when it exists in loaded rooms", () => {
  const storage = mockStorage({
    woysSelectedRoomId: "marketing",
  });
  const rooms = [
    { id: "main" },
    { id: "marketing" },
  ];

  assert.equal(getSelectedRoomId(rooms, storage), "marketing");
});

test("getSelectedRoomId falls back when saved room is invalid", () => {
  const storage = mockStorage({
    woysSelectedRoomId: "missing",
  });
  const rooms = [
    { id: "main" },
    { id: "ops" },
  ];

  assert.equal(getSelectedRoomId(rooms, storage), "main");
});

test("getRoomActivityView shows active room and other room notice", () => {
  const rooms = [
    { id: "main", name: "Main Office" },
    { id: "marketing", name: "Marketing War Room" },
  ];

  const view = getRoomActivityView({
    otherRoom: {
      roomId: "marketing",
      roomName: "Marketing War Room",
    },
  }, "main", rooms);

  assert.deepEqual(view, {
    activeRoomText: "Active room: Main Office",
    noticeText: "Activity in Marketing War Room",
  });
});

test("getRoomActivityView hides notice for current room activity", () => {
  const rooms = [
    { id: "ops", name: "Operations Desk" },
  ];

  const view = getRoomActivityView({
    isThinking: true,
    roomId: "ops",
  }, "ops", rooms);

  assert.deepEqual(view, {
    activeRoomText: "Active room: Operations Desk",
    noticeText: "",
  });
});
