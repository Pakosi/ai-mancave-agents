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
  getHQLayoutConfig,
  getHQAgentStationProfile,
  getHQAgentMotionState,
  getHQWorkZones,
  getRoomActivityView,
  getSelectedRoom,
  getAgentCharacterStyle,
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
  mapAgentGoalForDisplay,
  mapBusinessIdeaForDisplay,
  mapCeoDigestForDisplay,
  mapAgentForRoom,
  isCommandText,
  parseCommandText,
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
  saveSelectedAgentId,
  saveSelectedRoomId,
  sendCommand,
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

test("loadCompanyPlan calls /api/company-plan and returns plan", async () => {
  const calls = [];
  const callbacks = [];
  const responsePlan = {
    currentObjective: "Launch WOYS pilot",
    activePriorities: ["Validate workflow"],
    keyRisks: ["Scope drift"],
    nextRecommendedActions: ["Interview users"],
    recentDecisions: ["Focus pilot"],
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ plan: responsePlan }));
  };

  const plan = await loadCompanyPlan({
    apiBaseUrl: "http://test.local",
    fetch,
    onPlan(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(plan, responsePlan);
  assert.deepEqual(callbacks, [responsePlan]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/company-plan");
  assert.equal(calls[0].options, undefined);
});

test("loadCompanyPlan calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("network down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    loadCompanyPlan({
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /network down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("loadBusinessIdeas calls /api/business-ideas and returns ideas", async () => {
  const calls = [];
  const callbacks = [];
  const responseIdeas = [
    {
      id: 1,
      title: "Deal flow dashboard",
      category: "sales",
      status: "promising",
      assignedAgentId: "sales",
      confidence: 8,
      profitPotential: 9,
      nextAction: "Validate with one customer",
    },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ ideas: responseIdeas }));
  };

  const ideas = await loadBusinessIdeas({
    apiBaseUrl: "http://test.local",
    fetch,
    onIdeas(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(ideas, responseIdeas);
  assert.deepEqual(callbacks, [responseIdeas]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/business-ideas");
  assert.equal(calls[0].options, undefined);
});

test("loadBusinessIdeas calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("idea fetch down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    loadBusinessIdeas({
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /idea fetch down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("loadBusinessIdeasExport calls export endpoint and returns markdown", async () => {
  const calls = [];
  const callbacks = [];
  const markdown = "# WOYS Business Ideas\n\n- Priority idea";
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(markdown),
    });
  };

  const exported = await loadBusinessIdeasExport({
    apiBaseUrl: "http://test.local",
    fetch,
    onExport(text) {
      callbacks.push(text);
    },
  });

  assert.equal(exported, markdown);
  assert.deepEqual(callbacks, [markdown]);
  assert.equal(calls[0].url, "http://test.local/api/exports/business-ideas");
  assert.equal(calls[0].options, undefined);
});

test("loadBusinessIdeaExport calls single idea export endpoint and returns markdown", async () => {
  const calls = [];
  const markdown = "# Priority idea";
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(markdown),
    });
  };

  const exported = await loadBusinessIdeaExport(7, {
    apiBaseUrl: "http://test.local",
    fetch,
  });

  assert.equal(exported, markdown);
  assert.equal(calls[0].url, "http://test.local/api/exports/business-ideas/7");
});

test("loadCeoDigest calls /api/ceo-digest and returns digest", async () => {
  const calls = [];
  const callbacks = [];
  const responseDigest = {
    updatedAt: "2026-05-06T13:00:00.000Z",
    rankedOpportunitySummary: "Top idea: Deal flow dashboard",
    topIdeas: [
      { title: "Deal flow dashboard", status: "promising" },
    ],
    newlyCreatedIdeas: [],
    pausedOrKilledIdeas: [],
    highestConfidenceOpportunity: { title: "Deal flow dashboard", confidence: 8 },
    biggestRisk: { title: "Ops cleanup", risk: 7 },
    recommendedNextAction: "Validate with one customer",
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ digest: responseDigest }));
  };

  const digest = await loadCeoDigest({
    apiBaseUrl: "http://test.local",
    fetch,
    onDigest(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(digest, responseDigest);
  assert.deepEqual(callbacks, [responseDigest]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/ceo-digest");
  assert.equal(calls[0].options, undefined);
});

test("loadCeoDigest calls onError and rejects when fetch fails", async () => {
  const fetchError = new Error("digest fetch down");
  const errors = [];
  const fetch = () => Promise.reject(fetchError);

  await assert.rejects(
    loadCeoDigest({
      fetch,
      onError(err) {
        errors.push(err);
      },
    }),
    /digest fetch down/,
  );

  assert.deepEqual(errors, [fetchError]);
});

test("loadCeoDigestExport calls export endpoint and returns markdown", async () => {
  const calls = [];
  const markdown = "# CEO Digest";
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(markdown),
    });
  };

  const exported = await loadCeoDigestExport({
    apiBaseUrl: "http://test.local",
    fetch,
  });

  assert.equal(exported, markdown);
  assert.equal(calls[0].url, "http://test.local/api/exports/ceo-digest");
  assert.equal(calls[0].options, undefined);
});

test("export panel helpers surface copy and empty-state messaging", () => {
  assert.match(getExportPanelEmptyMessage(), /load a digest/i);
  assert.equal(getExportPanelLoadedMessage({ title: "Auto idea", kind: "idea" }), "Idea report: Auto idea");
  assert.equal(getExportPanelLoadedMessage({ kind: "export" }), "Export loaded.");
  assert.equal(getExportCopyMessage({ success: true }), "Copied export markdown.");
  assert.match(getExportCopyMessage({ clipboardAvailable: true }), /Copy failed/i);
  assert.match(getExportCopyMessage({ clipboardAvailable: false }), /Copy unavailable/i);
});

test("parseCommandText and isCommandText recognize supported commands", () => {
  assert.deepEqual(parseCommandText("rank ideas"), {
    type: "rank_ideas",
    rawText: "rank ideas",
  });
  assert.deepEqual(parseCommandText("focus trading"), {
    type: "focus_category",
    rawText: "focus trading",
    category: "trading",
  });
  assert.equal(isCommandText("summarize today"), true);
  assert.equal(isCommandText("hello there"), false);
});

test("sendCommand sends POST to /api/commands and returns the result", async () => {
  const calls = [];
  const callbacks = [];
  const response = {
    summary: "Ranked ideas.",
    command: { type: "rank_ideas" },
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse(response));
  };

  const result = await sendCommand("rank ideas", {
    apiBaseUrl: "http://test.local",
    fetch,
    sessionId: "session-1",
    roomId: "main",
    onCommand(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(result, response);
  assert.deepEqual(callbacks, [response]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://test.local/api/commands");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/json",
  });
  assert.equal(
    calls[0].options.body,
    JSON.stringify({ command: "rank ideas", sessionId: "session-1", roomId: "main" }),
  );
});

test("loadDecisions calls /api/decisions with room filter", async () => {
  const calls = [];
  const callbacks = [];
  const responseDecisions = [
    { id: 1, roomId: "ops", title: "Assign owner" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ decisions: responseDecisions }));
  };

  const decisions = await loadDecisions({
    apiBaseUrl: "http://test.local",
    fetch,
    roomId: "ops",
    onDecisions(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(decisions, responseDecisions);
  assert.deepEqual(callbacks, [responseDecisions]);
  assert.equal(calls[0].url, "http://test.local/api/decisions?roomId=ops");
  assert.equal(calls[0].options, undefined);
});

test("loadMemoryEvents calls /api/memory-events with room filter", async () => {
  const calls = [];
  const callbacks = [];
  const responseEvents = [
    { id: 1, roomId: "ops", type: "task_completed" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ memoryEvents: responseEvents }));
  };

  const events = await loadMemoryEvents({
    apiBaseUrl: "http://test.local",
    fetch,
    roomId: "ops",
    onMemoryEvents(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(events, responseEvents);
  assert.deepEqual(callbacks, [responseEvents]);
  assert.equal(calls[0].url, "http://test.local/api/memory-events?roomId=ops");
  assert.equal(calls[0].options, undefined);
});

test("mapBusinessIdeaForDisplay surfaces active project fields and highlights", () => {
  const view = mapBusinessIdeaForDisplay({
    id: 1,
    title: "Deal flow dashboard",
    category: "sales",
    status: "building",
    assignedAgentId: "sales",
    confidence: 8,
    profitPotential: 9,
    nextAction: "Validate with one customer",
  }, [
    { id: "sales", name: "Sales", role: "Revenue specialist" },
  ]);

  assert.equal(view.title, "Deal flow dashboard");
  assert.equal(view.category, "sales");
  assert.equal(view.status, "building");
  assert.equal(view.statusClass, "building");
  assert.equal(view.assignedAgent, "Sales");
  assert.equal(view.confidence, 8);
  assert.equal(view.profitPotential, 9);
  assert.equal(view.nextAction, "Validate with one customer");
});

test("mapBusinessIdeaForDisplay keeps empty idea state readable", () => {
  const view = mapBusinessIdeaForDisplay({
    id: 2,
    title: "Paused idea",
    status: "killed",
  });

  assert.equal(view.assignedAgent, "Unassigned");
  assert.equal(view.statusClass, "killed");
  assert.equal(view.nextAction, "No next action yet.");
});

test("mapCeoDigestForDisplay formats digest summary and empty state", () => {
  const view = mapCeoDigestForDisplay({
    updatedAt: "2026-05-06T13:00:00.000Z",
    rankedOpportunitySummary: "Top idea: Deal flow dashboard",
    topIdeas: [
      { title: "Deal flow dashboard", status: "promising" },
      { title: "Automation station", status: "building" },
    ],
    newlyCreatedIdeas: [
      { title: "New idea", status: "researching" },
    ],
    pausedOrKilledIdeas: [
      { title: "Paused idea", status: "paused" },
    ],
    highestConfidenceOpportunity: { title: "Deal flow dashboard", confidence: 8 },
    biggestRisk: { title: "Ops cleanup", risk: 7 },
    recommendedNextAction: "Validate with one customer",
  });

  assert.equal(view.rankedOpportunitySummary, "Top idea: Deal flow dashboard");
  assert.deepEqual(view.topIdeas, [
    "Deal flow dashboard · promising",
    "Automation station · building",
  ]);
  assert.equal(view.highestConfidenceOpportunity, "Deal flow dashboard (8/10)");
  assert.equal(view.biggestRisk, "Ops cleanup (7/10)");
  assert.equal(view.recommendedNextAction, "Validate with one customer");

  const empty = mapCeoDigestForDisplay();
  assert.equal(empty.rankedOpportunitySummary, "No business ideas yet.");
  assert.deepEqual(empty.topIdeas, []);
  assert.equal(empty.recommendedNextAction, "Create the first idea.");
});

test("loadAgentGoals calls /api/agent-goals and returns goals", async () => {
  const calls = [];
  const callbacks = [];
  const responseGoals = [
    { agentId: "manager", currentGoal: "Coordinate work" },
  ];
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ goals: responseGoals }));
  };

  const goals = await loadAgentGoals({
    apiBaseUrl: "http://test.local",
    fetch,
    onGoals(items) {
      callbacks.push(items);
    },
  });

  assert.deepEqual(goals, responseGoals);
  assert.deepEqual(callbacks, [responseGoals]);
  assert.equal(calls[0].url, "http://test.local/api/agent-goals");
  assert.equal(calls[0].options, undefined);
});

test("loadOperatingRhythm calls /api/operating-rhythm and returns rhythm", async () => {
  const calls = [];
  const callbacks = [];
  const responseRhythm = {
    phase: "execute",
    cycleNumber: 2,
    phases: ["observe", "plan", "execute", "review"],
  };
  const fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(mockResponse({ rhythm: responseRhythm }));
  };

  const rhythm = await loadOperatingRhythm({
    apiBaseUrl: "http://test.local",
    fetch,
    onRhythm(item) {
      callbacks.push(item);
    },
  });

  assert.deepEqual(rhythm, responseRhythm);
  assert.deepEqual(callbacks, [responseRhythm]);
  assert.equal(calls[0].url, "http://test.local/api/operating-rhythm");
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
    role: "General helper",
  });

  assert.deepEqual(option, {
    value: "assistant",
    text: "Assistant - General helper",
    label: "ASSISTANT",
    color: "#3b82f6",
    role: "General helper",
  });
});

test("getSelectedAgentId can select newly added specialized agents", () => {
  const storage = mockStorage({
    woysSelectedAgentId: "builder",
  });
  const agents = [
    { id: "host" },
    { id: "strategist" },
    { id: "researcher" },
    { id: "builder" },
    { id: "analyst" },
    { id: "manager" },
  ];

  assert.equal(getSelectedAgentId(agents, storage), "builder");
});

test("mapRoomForOption maps backend room for dropdown use", () => {
  const option = mapRoomForOption({
    brief: "Plan campaigns and content angles.",
    id: "marketing",
    name: "Marketing War Room",
  });

  assert.deepEqual(option, {
    brief: "Plan campaigns and content angles.",
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
    ownerAgentId: "sales",
    ownerName: "Sales",
    blockedReason: null,
    isHandedOff: false,
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

test("mapTaskForDisplay includes owner and blocked handoff fields", () => {
  const handedOff = mapTaskForDisplay({
    id: 5,
    title: "Workflow docs",
    assignedAgentId: "assistant",
    ownerAgentId: "builder",
    lastHandoffAt: "2026-05-06T10:00:00.000Z",
    blockedReason: "Needs design input first.",
    status: "in_progress",
    updatedAt: "2026-05-06T10:00:00.000Z",
  }, [
    { id: "assistant", name: "Assistant" },
    { id: "builder", name: "Builder" },
  ]);

  assert.equal(handedOff.ownerAgentId, "builder");
  assert.equal(handedOff.ownerName, "Builder");
  assert.equal(handedOff.assignedAgent, "Assistant");
  assert.equal(handedOff.blockedReason, "Needs design input first.");
  assert.equal(handedOff.isHandedOff, true);
});

test("mapCompanyPlanForDisplay maps compact plan data", () => {
  const plan = mapCompanyPlanForDisplay({
    currentObjective: "Launch WOYS pilot",
    activePriorities: ["Validate workflow"],
    keyRisks: ["Scope drift"],
    nextRecommendedActions: ["Interview users"],
    recentDecisions: ["Focus pilot"],
  });

  assert.deepEqual(plan, {
    currentObjective: "Launch WOYS pilot",
    activePriorities: ["Validate workflow"],
    keyRisks: ["Scope drift"],
    nextRecommendedActions: ["Interview users"],
    recentDecisions: ["Focus pilot"],
  });
});

test("mapCompanyPlanForDisplay handles missing plan fields", () => {
  const plan = mapCompanyPlanForDisplay({});

  assert.deepEqual(plan, {
    currentObjective: "No objective set.",
    activePriorities: [],
    keyRisks: [],
    nextRecommendedActions: [],
    recentDecisions: [],
  });
});

test("mapDecisionForDisplay maps decision panel data", () => {
  const decision = mapDecisionForDisplay({
    id: 7,
    title: "Prioritize pilot",
    summary: "Focus on the pilot workflow.",
    agentId: "strategist",
    roomId: "marketing",
    timestamp: "2026-05-06T10:00:00.000Z",
  });

  assert.deepEqual(decision, {
    id: 7,
    title: "Prioritize pilot",
    summary: "Focus on the pilot workflow.",
    meta: "strategist · marketing",
    timestamp: "2026-05-06T10:00:00.000Z",
  });
});

test("mapMemoryEventForDisplay maps memory panel data", () => {
  const event = mapMemoryEventForDisplay({
    id: 3,
    type: "task_completed",
    summary: "Completed checklist.",
    importance: "high",
    timestamp: "2026-05-06T10:00:00.000Z",
  });

  assert.deepEqual(event, {
    id: 3,
    summary: "Completed checklist.",
    meta: "task_completed · high",
    timestamp: "2026-05-06T10:00:00.000Z",
  });
});

test("mapAgentGoalForDisplay maps goal panel data", () => {
  const goal = mapAgentGoalForDisplay({
    agentId: "manager",
    currentGoal: "Coordinate the room",
    focusArea: "coordination",
    successCriteria: "Owners are clear",
    activeRoomId: "ops",
    status: "active",
  }, [
    { id: "manager", name: "Manager" },
  ]);

  assert.deepEqual(goal, {
    agentId: "manager",
    agentName: "Manager",
    currentGoal: "Coordinate the room",
    focusArea: "coordination",
    successCriteria: "Owners are clear",
    activeRoomId: "ops",
    status: "active",
  });
});

test("mapOperatingRhythmForDisplay maps phase display", () => {
  assert.deepEqual(mapOperatingRhythmForDisplay({
    phase: "review",
    cycleNumber: 3,
  }), {
    phase: "review",
    cycleText: "Cycle 3",
  });
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
    role: "",
    specialty: "",
    position: { left: "50%", top: "32%" },
    appearance: {
      head: "#cbd5e1",
      torso: "#284d91",
      trim: "#8cc0ff",
      accent: "#eff6ff",
      shadow: "#0d1728",
    },
    latestMessage: "latest assistant thought",
    latestMessageId: 3,
  });
});

test("mapAgentForRoom includes specialized agent role and stable position", () => {
  const roomAgent = mapAgentForRoom({
    id: "manager",
    name: "Manager",
    label: "MANAGER",
    color: "#be123c",
    role: "Task manager",
    expertise: ["coordination", "progress tracking"],
  }, []);

  assert.deepEqual(roomAgent, {
    id: "manager",
    name: "Manager",
    label: "MANAGER",
    color: "#be123c",
    role: "Task manager",
    specialty: "coordination",
    position: { left: "50%", top: "48%" },
    appearance: {
      head: "#dbc39a",
      torso: "#6b4a10",
      trim: "#e5c15e",
      accent: "#fbefce",
      shadow: "#181106",
    },
    latestMessage: "Thinking...",
    latestMessageId: null,
  });
});

test("getAgentCharacterStyle returns a distinct fixed style per agent", () => {
  assert.deepEqual(getAgentCharacterStyle({ id: "sales", color: "#f97316" }), {
    head: "#d6b08a",
    torso: "#8a4312",
    trim: "#f6b35a",
    accent: "#ffe3ba",
    shadow: "#261006",
  });
});

test("getHQWorkZones returns the workstation layout", () => {
  const zones = getHQWorkZones();

  assert.equal(zones.length >= 7, true);
  assert.deepEqual(zones[0], {
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
  });
  assert.equal(zones.some((zone) => zone.id === "trading-desk"), true);
});

test("getHQAgentStationProfile chooses a task-matched research station", () => {
  const profile = getHQAgentStationProfile({
    id: "researcher",
    taskTendencies: ["research", "discover", "learn"],
  }, {
    phase: "execute",
    tasks: [
      {
        id: 7,
        title: "Research competitor launch timing",
        status: "in_progress",
        ownerAgentId: "researcher",
      },
    ],
  });

  assert.deepEqual(profile, {
    stationId: "research-library",
    stationLabel: "Research / Library",
    poseClass: "station-reading",
    workClass: "working-reading",
    activityLevel: 1,
    motionIntensity: 1,
    taskId: 7,
    taskStatus: "in_progress",
    isCheckingIn: false,
    isWorkingAtStation: true,
  });
});

test("getHQAgentStationProfile prefers blocked-task agents for host check-ins", () => {
  const profile = getHQAgentStationProfile({ id: "host" }, {
    phase: "execute",
    tasks: [
      {
        id: 4,
        title: "Sales follow-up",
        status: "open",
        ownerAgentId: "sales",
        blockedReason: "Waiting on final offer copy",
      },
      {
        id: 9,
        title: "Builder release",
        status: "open",
        ownerAgentId: "builder",
      },
    ],
    decisions: [
      { id: 1, agentId: "builder", title: "Release scope" },
    ],
  });

  assert.equal(profile.stationId, "trading-desk");
  assert.equal(profile.stationLabel, "Trading Desk");
  assert.equal(profile.targetAgentId, "sales");
  assert.equal(profile.isCheckingIn, true);
});

test("getHQAgentMotionState keeps builders near their workstation", () => {
  const motion = getHQAgentMotionState({ id: "builder" }, {
    phase: "execute",
    now: 1200,
    index: 0,
  });

  assert.equal(motion.stationId, "builder-workstation");
  assert.equal(motion.workClass, "working-typing");
  assert.equal(motion.isWorkingAtStation, true);
  assert.match(motion.left, /%$/);
  assert.match(motion.top, /%$/);
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

test("getSelectedRoom returns room with brief", () => {
  const room = getSelectedRoom([
    { id: "main", name: "Main Office", brief: "Coordinate the overall WOYS business." },
    { id: "ops", name: "Operations Desk", brief: "Improve delivery systems." },
  ], "ops");

  assert.deepEqual(room, {
    id: "ops",
    name: "Operations Desk",
    brief: "Improve delivery systems.",
  });
});

test("getHQLayoutConfig returns fixed HQ room settings", () => {
  assert.deepEqual(getHQLayoutConfig(), {
    roomId: "main",
    roomLabel: "AI Mancave HQ",
    showRoomSelector: false,
  });
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
