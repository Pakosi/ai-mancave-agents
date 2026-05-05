const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("./server");

function resetMessages() {
  app.locals.messages = [];
  app.locals.nextMessageId = 1;
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
