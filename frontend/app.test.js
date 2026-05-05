const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fetchJson,
  getAgentReply,
  getSessionId,
  getSelectedAgentId,
  getSelectedRoomId,
  loadAgents,
  loadMessages,
  mapAgentForOption,
  mapMessageForDisplay,
  saveSelectedAgentId,
  saveSelectedRoomId,
  sendMessage,
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
  const responseMessages = [
    { id: 1, message: "one" },
    { id: 2, message: "two" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ messages: responseMessages }));
  };

  const messages = await loadMessages({
    apiBaseUrl: "http://test.local",
    fetch,
    sessionId: "session-1",
    roomId: "support",
    onMessages(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(messages, responseMessages);
  assert.deepEqual(callbacks, [responseMessages]);
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
    woysSelectedRoomId: "sales",
  });

  assert.equal(getSelectedRoomId(storage), "sales");
});
