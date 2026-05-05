const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const app = require("./server");

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "woys-messages-"));

function resetMessages() {
  app.locals.messagesFile = path.join(testDataDir, `${Date.now()}-${Math.random()}.json`);
}

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve(server);
    });

    server.on("error", reject);
  });
}

function getJson(server, path) {
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path,
      },
      (res) => {
        let body = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: JSON.parse(body),
            });
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("error", reject);
  });
}

function postJson(server, path, data) {
  const { port } = server.address();
  const body = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: JSON.parse(responseBody),
            });
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("error", reject);
    req.end(body);
  });
}

test("GET /api/status returns ok", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/status");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("POST /api/message stores a message and GET /api/messages returns it", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/message", {
    message: "Hello WOYS",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.id, 1);
  assert.equal(created.body.message, "Hello WOYS");
  assert.equal(typeof created.body.createdAt, "string");

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [created.body]);
});

test("POST /api/message returns 400 when message is missing", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/message", {});

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "message is required" });
});

test("POST /api/message returns 400 when message is empty", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/message", {
    message: "",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "message is required" });
});

test("POST /api/message returns 400 when message is not a string", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/message", {
    message: 123,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "message is required" });
});

test("GET /api/messages returns multiple messages in order", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const first = await postJson(server, "/api/message", {
    message: "one",
  });
  const second = await postJson(server, "/api/message", {
    message: "two",
  });
  const third = await postJson(server, "/api/message", {
    message: "three",
  });

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [first.body, second.body, third.body]);
});

test("POST /api/message trims message before storing it", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/message", {
    message: "   hello   ",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.message, "hello");

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.equal(messages.body.messages[0].message, "hello");
});

test("messages persist through file storage", async (t) => {
  resetMessages();

  const firstServer = await listen();

  const created = await postJson(firstServer, "/api/message", {
    message: "persist me",
  });

  firstServer.close();

  const secondServer = await listen();

  t.after(() => {
    secondServer.close();
  });

  const messages = await getJson(secondServer, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [created.body]);
});

test("POST /api/agents/:agentId/reply returns correct structure for each agent", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const agents = ["host", "assistant", "sales"];

  for (const agentId of agents) {
    const response = await postJson(server, `/api/agents/${agentId}/reply`, {
      message: "   hello agent   ",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.agentId, agentId);
    assert.equal(typeof response.body.reply, "string");
    assert.notEqual(response.body.reply.length, 0);
  }
});

test("POST /api/agents/:agentId/reply works when no prior messages exist", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/agents/assistant/reply", {
    message: "fresh topic",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.agentId, "assistant");
  assert.match(response.body.reply, /fresh topic/);
  assert.doesNotMatch(response.body.reply, /Recent context:/);
});

test("POST /api/agents/:agentId/reply references prior saved messages", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/message", {
    message: "first context",
  });
  await postJson(server, "/api/message", {
    message: "second context",
  });

  const response = await postJson(server, "/api/agents/assistant/reply", {
    message: "latest ask",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.agentId, "assistant");
  assert.match(response.body.reply, /latest ask/);
  assert.match(response.body.reply, /first context/);
  assert.match(response.body.reply, /second context/);
});

test("POST /api/agents/:agentId/reply returns 400 for an invalid agentId", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/agents/unknown/reply", {
    message: "hello",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "invalid agentId" });
});

test("POST /api/agents/:agentId/reply returns 400 for an invalid message", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/agents/host/reply", {
    message: "",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "message is required" });
});
