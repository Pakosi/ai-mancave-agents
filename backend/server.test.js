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
  app.locals.tasksFile = path.join(testDataDir, `${Date.now()}-${Math.random()}-tasks.json`);
  app.locals.companyPlanFile = path.join(testDataDir, `${Date.now()}-${Math.random()}-company-plan.json`);
  app.locals.decisionLogFile = path.join(testDataDir, `${Date.now()}-${Math.random()}-decision-log.json`);
  app.locals.agentGoalsFile = path.join(testDataDir, `${Date.now()}-${Math.random()}-agent-goals.json`);
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

function patchJson(server, path, data) {
  const { port } = server.address();
  const body = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "PATCH",
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
    ["host", "assistant", "sales", "strategist", "researcher", "builder", "analyst", "manager"],
  );
  assert.deepEqual(Object.keys(response.body.agents[0]).sort(), [
    "allowedActions",
    "behaviorStyle",
    "color",
    "expertise",
    "id",
    "label",
    "name",
    "preferredRooms",
    "role",
    "taskTendencies",
  ]);
});

test("GET /api/agents returns specialization data for each agent", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/agents");

  assert.equal(response.statusCode, 200);

  for (const agent of response.body.agents) {
    assert.equal(typeof agent.role, "string");
    assert.ok(agent.role.length > 0);
    assert.equal(typeof agent.behaviorStyle, "string");
    assert.ok(agent.behaviorStyle.length > 0);
    assert.ok(Array.isArray(agent.expertise));
    assert.ok(agent.expertise.length > 0);
    assert.ok(Array.isArray(agent.preferredRooms));
    assert.ok(agent.preferredRooms.length > 0);
    assert.ok(Array.isArray(agent.taskTendencies));
    assert.ok(agent.taskTendencies.length > 0);
    assert.ok(Array.isArray(agent.allowedActions));
    assert.ok(agent.allowedActions.includes("reply"));
  }
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
  assert.deepEqual(response.body.rooms.map((room) => ({
    id: room.id,
    name: room.name,
  })), [
    { id: "main", name: "Main Office" },
    { id: "auto", name: "Auto Sales Lab" },
    { id: "marketing", name: "Marketing War Room" },
    { id: "ops", name: "Operations Desk" },
  ]);

  for (const room of response.body.rooms) {
    assert.equal(typeof room.brief, "string");
    assert.ok(room.brief.length > 10);
  }
});

test("GET /api/company-plan returns shared planning state", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/company-plan");

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.plan.currentObjective, "string");
  assert.ok(response.body.plan.currentObjective.length > 10);
  assert.ok(Array.isArray(response.body.plan.activePriorities));
  assert.ok(Array.isArray(response.body.plan.keyRisks));
  assert.ok(Array.isArray(response.body.plan.nextRecommendedActions));
  assert.ok(Array.isArray(response.body.plan.recentDecisions));
  assert.equal(typeof response.body.plan.updatedAt, "string");
});

test("GET /api/decisions and /api/memory-events return decision log state", async (t) => {
  resetMessages();
  app.locals.writeDecisionLogForTest({
    decisions: [
      {
        id: 1,
        timestamp: "2026-05-06T10:00:00.000Z",
        roomId: "main",
        agentId: "strategist",
        title: "Prioritize onboarding",
        summary: "Focus on onboarding flow.",
        reason: "It supports the current objective.",
        impact: "Clearer execution.",
      },
      {
        id: 2,
        timestamp: "2026-05-06T10:01:00.000Z",
        roomId: "ops",
        agentId: "manager",
        title: "Assign checklist owner",
        summary: "Move checklist ownership forward.",
        reason: "Ops needs accountability.",
        impact: "Better follow-through.",
      },
    ],
    memoryEvents: [
      {
        id: 1,
        timestamp: "2026-05-06T10:02:00.000Z",
        roomId: "ops",
        type: "task_completed",
        summary: "Completed checklist.",
        importance: "high",
      },
    ],
  });

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const decisions = await getJson(server, "/api/decisions");
  const opsDecisions = await getJson(server, "/api/decisions?roomId=ops");
  const memoryEvents = await getJson(server, "/api/memory-events?roomId=ops");

  assert.equal(decisions.statusCode, 200);
  assert.equal(opsDecisions.statusCode, 200);
  assert.equal(memoryEvents.statusCode, 200);
  assert.equal(decisions.body.decisions.length, 2);
  assert.deepEqual(opsDecisions.body.decisions.map((decision) => decision.roomId), ["ops"]);
  assert.equal(memoryEvents.body.memoryEvents.length, 1);
  assert.equal(memoryEvents.body.memoryEvents[0].importance, "high");
});

test("GET /api/agent-goals returns persisted agent goals", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/agent-goals");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.goals.length, 8);

  for (const goal of response.body.goals) {
    assert.equal(typeof goal.agentId, "string");
    assert.equal(typeof goal.currentGoal, "string");
    assert.equal(typeof goal.focusArea, "string");
    assert.equal(typeof goal.successCriteria, "string");
    assert.equal(typeof goal.activeRoomId, "string");
    assert.equal(typeof goal.lastUpdated, "string");
    assert.match(goal.status, /^(active|blocked|complete)$/);
  }
});

test("GET /api/operating-rhythm returns current phase", async (t) => {
  resetMessages();
  app.locals.agentThoughtIndex = 2;

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/operating-rhythm");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.rhythm.phase, "execute");
  assert.equal(response.body.rhythm.cycleNumber, 1);
  assert.deepEqual(response.body.rhythm.phases, ["observe", "plan", "execute", "review"]);
});

test("agent goals persist through file storage", () => {
  resetMessages();

  app.locals.writeAgentGoalsForTest([
    {
      agentId: "manager",
      currentGoal: "Coordinate launch tasks",
      focusArea: "coordination",
      successCriteria: "Every task has an owner",
      activeRoomId: "ops",
      lastUpdated: "2026-05-06T10:00:00.000Z",
      status: "active",
    },
  ]);

  const goals = app.locals.readAgentGoalsForTest();
  const managerGoal = goals.find((goal) => goal.agentId === "manager");

  assert.equal(managerGoal.currentGoal, "Coordinate launch tasks");
  assert.equal(managerGoal.activeRoomId, "ops");
});

test("decision log persists through file storage", () => {
  resetMessages();

  app.locals.writeDecisionLogForTest({
    decisions: [
      {
        id: 1,
        timestamp: "2026-05-06T10:00:00.000Z",
        roomId: "marketing",
        agentId: "host",
        title: "Align campaign test",
        summary: "Keep campaign work focused.",
        reason: "Marketing needs a clear next step.",
        impact: "Better campaign execution.",
      },
    ],
    memoryEvents: [
      {
        id: 1,
        timestamp: "2026-05-06T10:03:00.000Z",
        roomId: "marketing",
        type: "task_completed",
        summary: "Campaign brief finished.",
        importance: "high",
      },
    ],
  });

  const log = app.locals.readDecisionLogForTest();

  assert.equal(log.decisions[0].title, "Align campaign test");
  assert.equal(log.memoryEvents[0].summary, "Campaign brief finished.");
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

test("POST /api/tasks creates a task and GET /api/tasks returns it", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    roomId: "marketing",
    title: "Draft launch plan",
    description: "Outline the first campaign",
    assignedAgentId: "assistant",
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.id, 1);
  assert.equal(created.body.roomId, "marketing");
  assert.equal(created.body.title, "Draft launch plan");
  assert.equal(created.body.description, "Outline the first campaign");
  assert.equal(created.body.status, "open");
  assert.equal(created.body.assignedAgentId, "assistant");
  assert.equal(typeof created.body.createdAt, "string");
  assert.equal(typeof created.body.updatedAt, "string");

  const tasks = await getJson(server, "/api/tasks?roomId=marketing");

  assert.equal(tasks.statusCode, 200);
  assert.deepEqual(tasks.body.tasks, [created.body]);
});

test("PATCH /api/tasks/:taskId updates task status", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Document handoff",
    description: "Make the workflow clear",
    assignedAgentId: "host",
  });
  const updated = await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "in_progress",
  });

  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.status, "in_progress");
  assert.equal(updated.body.id, created.body.id);
  assert.notEqual(updated.body.updatedAt, undefined);

  const done = await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "done",
  });

  assert.equal(done.statusCode, 200);
  assert.equal(done.body.status, "done");
});

test("PATCH /api/tasks/:taskId rejects invalid status progression", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Skip ahead",
    assignedAgentId: "assistant",
  });
  const invalid = await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "done",
  });

  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: "invalid status progression" });
});

test("PATCH /api/tasks/:taskId creates an agent message", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    roomId: "auto",
    title: "Qualify lead list",
    assignedAgentId: "sales",
  });
  await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "in_progress",
  });

  const messages = await getJson(server, "/api/messages?roomId=auto");

  assert.equal(messages.statusCode, 200);
  assert.equal(messages.body.messages.length, 1);
  assert.equal(messages.body.messages[0].role, "agent");
  assert.equal(messages.body.messages[0].agentId, "sales");
  assert.match(messages.body.messages[0].message, /Qualify lead list/);
  assert.match(messages.body.messages[0].message, /in progress/);
});

test("GET /api/tasks keeps rooms separate", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const auto = await postJson(server, "/api/tasks", {
    roomId: "auto",
    title: "Call dealer leads",
    description: "Prioritize warm prospects",
    assignedAgentId: "sales",
  });
  const ops = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Clean checklist",
    description: "Remove duplicate steps",
    assignedAgentId: "assistant",
  });

  const autoTasks = await getJson(server, "/api/tasks?roomId=auto");
  const opsTasks = await getJson(server, "/api/tasks?roomId=ops");

  assert.equal(autoTasks.statusCode, 200);
  assert.equal(opsTasks.statusCode, 200);
  assert.deepEqual(autoTasks.body.tasks, [auto.body]);
  assert.deepEqual(opsTasks.body.tasks, [ops.body]);
});

test("POST /api/tasks validates title, description, and assigned agent", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const missingTitle = await postJson(server, "/api/tasks", {
    assignedAgentId: "host",
  });
  const invalidDescription = await postJson(server, "/api/tasks", {
    title: "Bad description",
    description: 123,
    assignedAgentId: "host",
  });
  const invalidAgent = await postJson(server, "/api/tasks", {
    title: "Bad agent",
    assignedAgentId: "unknown",
  });

  assert.equal(missingTitle.statusCode, 400);
  assert.deepEqual(missingTitle.body, { error: "title is required" });
  assert.equal(invalidDescription.statusCode, 400);
  assert.deepEqual(invalidDescription.body, { error: "description must be a string" });
  assert.equal(invalidAgent.statusCode, 400);
  assert.deepEqual(invalidAgent.body, { error: "valid assignedAgentId is required" });
});

test("PATCH /api/tasks/:taskId validates status", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    title: "Status check",
    assignedAgentId: "host",
  });
  const invalid = await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "blocked",
  });

  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: "valid status is required" });
});

test("POST /api/agents/:agentId/reply returns correct structure for each agent", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const agents = ["host", "assistant", "sales", "strategist", "researcher", "builder", "analyst", "manager"];

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

test("POST /api/agents/:agentId/reply uses room brief context", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const auto = await postJson(server, "/api/agents/sales/reply", {
    message: "what should we improve",
    roomId: "auto",
  });
  const marketing = await postJson(server, "/api/agents/sales/reply", {
    message: "what should we improve",
    roomId: "marketing",
  });

  assert.equal(auto.statusCode, 200);
  assert.equal(marketing.statusCode, 200);
  assert.notEqual(auto.body.reply, marketing.body.reply);
  assert.match(auto.body.reply, /dealer follow-up/);
  assert.match(marketing.body.reply, /campaign test/);
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

test("task helper selects active tasks for a room", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const auto = await postJson(server, "/api/tasks", {
    roomId: "auto",
    title: "Review auto lead script",
    assignedAgentId: "sales",
  });
  await postJson(server, "/api/tasks", {
    roomId: "marketing",
    title: "Review campaign copy",
    assignedAgentId: "assistant",
  });

  const selectedTask = app.locals.selectRoomTaskForTest(app.locals.readTasksForTest(), "auto");

  assert.equal(selectedTask.id, auto.body.id);
  assert.equal(selectedTask.roomId, "auto");
});

test("autonomous agent thought references active room task", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/tasks", {
    roomId: "main",
    title: "Map onboarding handoff",
    assignedAgentId: "assistant",
  });

  const thought = app.locals.createAgentThought(undefined, "main");

  assert.match(thought.message, /Map onboarding handoff/);
});

test("autonomous agent thought uses room brief context", () => {
  resetMessages();

  const thought = app.locals.createAgentThought(undefined, "marketing");

  assert.match(thought.message, /campaign test/);
});

test("specialized agents produce capability-aware autonomous replies", () => {
  resetMessages();

  const strategist = app.locals.createAgentThought("strategist", "marketing");
  const researcher = app.locals.createAgentThought("researcher", "auto");
  const builder = app.locals.createAgentThought("builder", "ops");
  const analyst = app.locals.createAgentThought("analyst", "main");
  const manager = app.locals.createAgentThought("manager", "ops");

  assert.match(strategist.message, /strategic|priority|planning/i);
  assert.match(researcher.message, /discovery|validated|competitor|user/i);
  assert.match(builder.message, /build|implementation|handoff|demo/i);
  assert.match(analyst.message, /risk|metric|decision/i);
  assert.match(manager.message, /owner|task|checkpoint/i);
});

test("autonomous task creation uses agent tendencies", () => {
  resetMessages();
  app.locals.agentThoughtIndex = 3;

  const thought = app.locals.createAgentThought("researcher", "marketing");
  const tasks = app.locals.readTasksForTest();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].assignedAgentId, thought.agentId);
  assert.match(tasks[0].title, /Research evidence/);
  assert.match(tasks[0].description, /Discovery lead/);
});

test("autonomous agents update company plan by specialization", () => {
  resetMessages();

  app.locals.createAgentThought("strategist", "marketing");
  app.locals.createAgentThought("analyst", "main");
  app.locals.createAgentThought("builder", "ops");
  app.locals.agentThoughtIndex = 1;
  app.locals.createAgentThought("manager", "ops");

  const plan = app.locals.readCompanyPlanForTest();

  assert.match(plan.activePriorities[0], /Prioritize/);
  assert.match(plan.keyRisks[0], /success metrics|decision risks/);
  assert.match(plan.nextRecommendedActions[0], /Assign owner|Ship the next product step/);
  assert.match(plan.recentDecisions[0], /Coordinate/);
});

test("autonomous eligible agents can create decision entries and sync plan decisions", () => {
  resetMessages();
  app.locals.agentThoughtIndex = 2;

  app.locals.createAgentThought("strategist", "marketing");

  const log = app.locals.readDecisionLogForTest();
  const plan = app.locals.readCompanyPlanForTest();

  assert.equal(log.decisions.length, 1);
  assert.equal(log.decisions[0].agentId, "strategist");
  assert.equal(log.decisions[0].roomId, "marketing");
  assert.match(log.decisions[0].title, /Prioritize/);
  assert.deepEqual(plan.recentDecisions.slice(0, 1), [log.decisions[0].title]);
});

test("autonomous manager updates agent goals and can create goal memory during review", () => {
  resetMessages();
  app.locals.agentThoughtIndex = 3;

  app.locals.createAgentThought("manager", "ops");

  const goals = app.locals.readAgentGoalsForTest();
  const log = app.locals.readDecisionLogForTest();
  const updatedGoal = goals.find((goal) => goal.activeRoomId === "ops" && goal.currentGoal.startsWith("review:"));

  assert.ok(updatedGoal);
  assert.match(updatedGoal.successCriteria, /review step/);
  assert.ok(log.memoryEvents.some((event) => (
    event.type === "goal_updated" && event.summary.includes(updatedGoal.agentId)
  )));
});

test("agent goals influence autonomous task selection", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  app.locals.writeAgentGoalsForTest([
    {
      agentId: "assistant",
      currentGoal: "Improve onboarding checklist",
      focusArea: "onboarding",
      successCriteria: "Finish onboarding checklist",
      activeRoomId: "ops",
      lastUpdated: "2026-05-06T10:00:00.000Z",
      status: "active",
    },
  ]);
  await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Generic support cleanup",
    assignedAgentId: "host",
  });
  const goalTask = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Improve onboarding checklist",
    assignedAgentId: "host",
  });

  const selectedTask = app.locals.selectRoomTaskForTest(
    app.locals.readTasksForTest(),
    "ops",
    undefined,
    app.locals.readCompanyPlanForTest(),
    app.locals.readAgentGoalsForTest().find((goal) => goal.agentId === "assistant"),
  );

  assert.equal(selectedTask.id, goalTask.body.id);
});

test("operating rhythm phase influences autonomous replies and task creation", () => {
  resetMessages();
  app.locals.agentThoughtIndex = 0;

  const observeThought = app.locals.createAgentThought("researcher", "marketing");

  assert.match(observeThought.message, /gaps|context|missing proof/);

  app.locals.agentThoughtIndex = 3;
  app.locals.createAgentThought("strategist", "marketing");
  const tasks = app.locals.readTasksForTest();

  assert.match(tasks[0].title, /^review:/);
  assert.match(tasks[0].description, /Goal:/);
});

test("task completion creates a memory event", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  const created = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Complete handoff checklist",
    assignedAgentId: "manager",
  });
  await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "in_progress",
  });
  await patchJson(server, `/api/tasks/${created.body.id}`, {
    status: "done",
  });

  const log = app.locals.readDecisionLogForTest();

  assert.equal(log.memoryEvents.length, 1);
  assert.equal(log.memoryEvents[0].roomId, "ops");
  assert.equal(log.memoryEvents[0].type, "task_completed");
  assert.match(log.memoryEvents[0].summary, /Complete handoff checklist/);
  assert.equal(log.memoryEvents[0].importance, "high");
});

test("autonomous task creation includes current objective from company plan", () => {
  resetMessages();
  app.locals.agentThoughtIndex = 3;
  app.locals.writeCompanyPlanForTest({
    currentObjective: "Launch the WOYS pilot with dealership teams",
    activePriorities: ["Validate dealership buyer workflow"],
    keyRisks: ["Pilot scope may drift"],
    nextRecommendedActions: ["Interview dealer operators"],
    recentDecisions: ["Focus on auto sales lab"],
    updatedAt: new Date().toISOString(),
  });

  app.locals.createAgentThought("sales", "auto");
  const tasks = app.locals.readTasksForTest();

  assert.equal(tasks.length, 1);
  assert.match(tasks[0].description, /Launch the WOYS pilot with dealership teams/);
});

test("task selection can use company plan priorities", async (t) => {
  resetMessages();

  const server = await listen();

  t.after(() => {
    server.close();
  });

  app.locals.writeCompanyPlanForTest({
    currentObjective: "Improve delivery",
    activePriorities: ["Tighten onboarding checklist"],
    keyRisks: ["Unclear owner"],
    nextRecommendedActions: ["Pick one handoff"],
    recentDecisions: ["Focus operations"],
    updatedAt: new Date().toISOString(),
  });
  await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Generic ops cleanup",
    assignedAgentId: "assistant",
  });
  const priorityTask = await postJson(server, "/api/tasks", {
    roomId: "ops",
    title: "Tighten onboarding checklist",
    assignedAgentId: "assistant",
  });

  const selectedTask = app.locals.selectRoomTaskForTest(app.locals.readTasksForTest(), "ops");

  assert.equal(selectedTask.id, priorityTask.body.id);
});

test("autonomous agent thought can advance a task and store update message", async (t) => {
  resetMessages();
  app.locals.agentThoughtIndex = 1;

  const server = await listen();

  t.after(() => {
    server.close();
  });

  await postJson(server, "/api/tasks", {
    roomId: "main",
    title: "Tighten sales offer",
    assignedAgentId: "sales",
  });

  app.locals.createAgentThought(undefined, "main");

  const tasks = await getJson(server, "/api/tasks?roomId=main");
  const messages = await getJson(server, "/api/messages?roomId=main");

  assert.equal(tasks.body.tasks[0].status, "in_progress");
  assert.equal(messages.body.messages.length, 2);
  assert.match(messages.body.messages[1].message, /Tighten sales offer/);
  assert.match(messages.body.messages[1].message, /in progress/);
});

test("autonomous agent thoughts sometimes create room tasks", () => {
  resetMessages();

  app.locals.createAgentThought();
  app.locals.createAgentThought();
  app.locals.createAgentThought();
  const thought = app.locals.createAgentThought();

  const tasks = app.locals.readTasksForTest();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].roomId, thought.roomId);
  assert.equal(tasks[0].status, "open");
  assert.equal(tasks[0].assignedAgentId, thought.agentId);
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
