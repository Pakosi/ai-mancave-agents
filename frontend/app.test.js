const assert = require("node:assert/strict");
const test = require("node:test");

const { fetchJson, loadMessages, sendMessage } = require("./app");

function mockResponse(body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    json: () => Promise.resolve(body),
  };
}

test("loadMessages calls /api/messages", async () => {
  const calls = [];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ messages: [] }));
  };

  const messages = await loadMessages({
    apiBaseUrl: "http://test.local",
    fetch,
  });

  assert.deepEqual(messages, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/messages");
  assert.equal(calls[0].options, undefined);
});

test("sendMessage sends POST to /api/message with correct body", async () => {
  const calls = [];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ id: 1, message: "Hello WOYS" }, { status: 201 }));
  };

  const message = await sendMessage("Hello WOYS", {
    apiBaseUrl: "http://test.local",
    fetch,
  });

  assert.deepEqual(message, { id: 1, message: "Hello WOYS" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/message");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(calls[0].options.body, JSON.stringify({ message: "Hello WOYS" }));
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

test("fetchJson rejects when response is not ok", async () => {
  const fetch = () => Promise.resolve(mockResponse({ error: "bad" }, {
    ok: false,
    status: 500,
  }));

  await assert.rejects(
    fetchJson("http://test.local/api/messages", undefined, fetch),
    /Request failed with status 500/,
  );
});
