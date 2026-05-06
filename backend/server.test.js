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
  app.locals.agentThoughtIndex = 0;
  app.locals.agentThoughtState = {
    isThinking: false,
    nextAgentId: null,
    sessionId: "default",
    roomId: "main",
    roomName: "Main Office",
    topic: "",
  };
  app.locals.topicMemory = {};

  if (app.locals.agentThoughtTimer) {
    clearTimeout(app.locals.agentThoughtTimer);
    app.locals.agentThoughtTimer = null;
  }
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

test("GET /api/agents returns public agents", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/agents");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.body.agents.map((agent) => agent.id),
    ["host", "assistant", "sales"],
  );
  assert.deepEqual(Object.keys(response.body.agents[0]).sort(), [
    "color",
    "id",
    "label",
    "name",
  ]);
});

test("GET /api/agents does not expose systemPrompt", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/agents");

  assert.equal(response.statusCode, 200);

  for (const agent of response.body.agents) {
    assert.equal(agent.systemPrompt, undefined);
  }
});

test("GET /api/rooms returns public rooms", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/rooms");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.rooms, [
    { id: "main", name: "Main Office" },
    { id: "auto", name: "Auto Sales Lab" },
    { id: "marketing", name: "Marketing War Room" },
    { id: "ops", name: "Operations Desk" },
  ]);
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
  assert.equal(created.body.sessionId, "default");
  assert.equal(created.body.roomId, "main");
  assert.equal(created.body.role, "user");
  assert.equal(created.body.message, "Hello WOYS");
  assert.equal(typeof created.body.createdAt, "string");

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [created.body]);
});

test("POST /api/message stores user role", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/message", {
    message: "role check",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.role, "user");
  assert.equal(created.body.agentId, undefined);

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.equal(messages.body.messages[0].role, "user");
  assert.equal(messages.body.messages[0].agentId, undefined);
});

test("POST /api/message uses default session when sessionId is missing", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/message", {
    message: "default session",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.sessionId, "default");

  const messages = await getJson(server, "/api/messages?sessionId=default");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [created.body]);
});

test("POST /api/message uses main room when roomId is missing", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/message", {
    message: "main room",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.roomId, "main");

  const messages = await getJson(server, "/api/messages?sessionId=default&roomId=main");

  assert.equal(messages.statusCode, 200);
  assert.deepEqual(messages.body.messages, [created.body]);
});

test("GET /api/messages keeps sessions separate", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const alpha = await postJson(server, "/api/message", {
    message: "alpha message",
    sessionId: "alpha",
  });
  const beta = await postJson(server, "/api/message", {
    message: "beta message",
    sessionId: "beta",
  });

  const alphaMessages = await getJson(server, "/api/messages?sessionId=alpha");
  const betaMessages = await getJson(server, "/api/messages?sessionId=beta");

  assert.equal(alphaMessages.statusCode, 200);
  assert.equal(betaMessages.statusCode, 200);
  assert.deepEqual(alphaMessages.body.messages, [alpha.body]);
  assert.deepEqual(betaMessages.body.messages, [beta.body]);
});

test("GET /api/messages keeps rooms separate", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const main = await postJson(server, "/api/message", {
    message: "main message",
    sessionId: "alpha",
    roomId: "main",
  });
  const marketing = await postJson(server, "/api/message", {
    message: "marketing message",
    sessionId: "alpha",
    roomId: "marketing",
  });

  const mainMessages = await getJson(server, "/api/messages?sessionId=alpha&roomId=main");
  const marketingMessages = await getJson(server, "/api/messages?sessionId=alpha&roomId=marketing");

  assert.equal(mainMessages.statusCode, 200);
  assert.equal(marketingMessages.statusCode, 200);
  assert.deepEqual(mainMessages.body.messages, [main.body]);
  assert.deepEqual(marketingMessages.body.messages, [marketing.body]);
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
    assert.doesNotMatch(response.body.reply, /Recent context/);
    assert.ok(response.body.reply.length < 180);
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
  assert.doesNotMatch(response.body.reply, /Recent context/);
  assert.ok(response.body.reply.length < 180);
});

test("POST /api/agents/:agentId/reply uses context without exposing raw messages", async (t) => {
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
  assert.match(response.body.reply, /Earlier you pointed us|Building on the team's/);
  assert.doesNotMatch(response.body.reply, /Recent context/);
  assert.doesNotMatch(response.body.reply, /first context/);
  assert.doesNotMatch(response.body.reply, /second context/);
  assert.ok(response.body.reply.length < 180);
});

test("POST /api/agents/:agentId/reply stores agent role and agentId", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await postJson(server, "/api/agents/sales/reply", {
    message: "close this",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.agentId, "sales");

  const messages = await getJson(server, "/api/messages");

  assert.equal(messages.statusCode, 200);
  assert.equal(messages.body.messages.length, 1);
  assert.equal(messages.body.messages[0].role, "agent");
  assert.equal(messages.body.messages[0].agentId, "sales");
  assert.equal(messages.body.messages[0].sessionId, "default");
  assert.equal(messages.body.messages[0].roomId, "main");
  assert.equal(messages.body.messages[0].message, response.body.reply);
});

test("POST /api/agents/:agentId/reply stores messages in the requested room", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/agents/host/reply", {
    message: "work on auto follow-up",
    sessionId: "alpha",
    roomId: "auto",
  });

  const autoMessages = await getJson(server, "/api/messages?sessionId=alpha&roomId=auto");
  const mainMessages = await getJson(server, "/api/messages?sessionId=alpha&roomId=main");

  assert.equal(autoMessages.statusCode, 200);
  assert.equal(mainMessages.statusCode, 200);
  assert.equal(autoMessages.body.messages.length, 1);
  assert.equal(autoMessages.body.messages[0].roomId, "auto");
  assert.deepEqual(mainMessages.body.messages, []);
});

test("autonomous agent thought stores an agent message", () => {
  resetMessages();

  const thought = app.locals.createAgentThought(undefined, "main");

  assert.equal(thought.role, "agent");
  assert.equal(thought.sessionId, "default");
  assert.equal(thought.roomId, "main");
  assert.equal(typeof thought.agentId, "string");
  assert.doesNotMatch(thought.message, /Recent context/);
  assert.ok(thought.message.length < 180);
});

test("autonomous agent thought can respond to the latest user message", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/message", {
    message: "we should build a concierge onboarding offer",
  });

  const thought = app.locals.createAgentThought(undefined, "main");

  assert.equal(thought.role, "agent");
  assert.match(thought.message, /useful starting point|direction|question/);
  assert.doesNotMatch(thought.message, /Recent context/);
  assert.ok(thought.message.length < 180);
});

test("autonomous agent thoughts can respond to another agent", () => {
  resetMessages();

  app.locals.createAgentThought(undefined, "main");
  const secondThought = app.locals.createAgentThought(undefined, "main");

  assert.equal(secondThought.role, "agent");
  assert.match(secondThought.message, /point on the table/);
  assert.doesNotMatch(secondThought.message, /Recent context/);
  assert.ok(secondThought.message.length < 180);
});

test("autonomous agent thoughts avoid duplicate consecutive speakers", () => {
  resetMessages();

  const firstThought = app.locals.createAgentThought(undefined, "main");
  const secondThought = app.locals.createAgentThought(firstThought.agentId, "main");
  const thirdThought = app.locals.createAgentThought(undefined, "main");

  assert.notEqual(secondThought.agentId, firstThought.agentId);
  assert.notEqual(thirdThought.agentId, secondThought.agentId);
});

test("scheduled autonomous thought chooses a different next speaker", () => {
  resetMessages();

  const firstThought = app.locals.createAgentThought(undefined, "main");
  app.locals.scheduleNextAgentThought(1000000);

  const activity = app.locals.getAgentThoughtActivity("default", "auto");

  assert.equal(activity.isThinking, true);
  assert.notEqual(activity.nextAgentId, firstThought.agentId);

  clearTimeout(app.locals.agentThoughtTimer);
  app.locals.agentThoughtTimer = null;
});

test("autonomous agent thoughts rotate across rooms", () => {
  resetMessages();

  const firstThought = app.locals.createAgentThought();
  const secondThought = app.locals.createAgentThought();
  const thirdThought = app.locals.createAgentThought();
  const fourthThought = app.locals.createAgentThought();

  assert.deepEqual(
    [firstThought.roomId, secondThought.roomId, thirdThought.roomId, fourthThought.roomId],
    ["main", "auto", "marketing", "ops"],
  );
});

test("autonomous room context stays isolated", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/message", {
    message: "dealership pipeline",
    roomId: "auto",
  });
  await postJson(server, "/api/message", {
    message: "campaign funnel",
    roomId: "marketing",
  });

  app.locals.createAgentThought(undefined, "auto");
  app.locals.createAgentThought(undefined, "marketing");

  assert.match(app.locals.topicMemory["default:auto"], /dealership|pipeline/);
  assert.doesNotMatch(app.locals.topicMemory["default:auto"], /campaign|funnel/);
  assert.match(app.locals.topicMemory["default:marketing"], /campaign|funnel/);
  assert.doesNotMatch(app.locals.topicMemory["default:marketing"], /dealership|pipeline/);
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
