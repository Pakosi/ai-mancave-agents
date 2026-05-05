const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("./server");

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

test("GET /api/status returns ok", async (t) => {
  const server = await listen();

  t.after(() => {
    server.close();
  });

  const response = await getJson(server, "/api/status");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: "ok" });
});
