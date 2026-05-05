const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fetchJson,
  getAgentReply,
  loadMessages,
  sendMessage,
} = require("./app");

function mockResponse(body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    json: () => Promise.resolve(body),
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
    onMessages(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(messages, responseMessages);
  assert.deepEqual(callbacks, [responseMessages]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/messages");
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
  assert.equal(calls[0].options.body, JSON.stringify({ message: "Hello WOYS" }));
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
  assert.equal(calls[0].options.body, JSON.stringify({ message: "hello" }));
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
