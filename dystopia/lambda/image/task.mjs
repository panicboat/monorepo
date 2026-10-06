import { spawn } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.env.AWS_LWA_PORT ?? 8080);

// Keep the tail only because a synchronous Lambda invocation cannot return more than 6 MB.
const maxOutputBytes = 256 * 1024;

function commandFor(event) {
  if (event?.task === "migrate") {
    return ["bundle", ["exec", "hanami", "db", "migrate", "--no-dump"]];
  }

  if (event?.task === "psql" && typeof event.sql === "string" && event.sql !== "") {
    return [
      "psql",
      [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-c", event.sql],
    ];
  }

  return null;
}

function run(command, args) {
  return new Promise((resolve) => {
    const chunks = [];
    // Pass arguments as an array because a shell would interpret SQL text.
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => resolve({ exitCode: 127, output: String(error) }));
    child.on("close", (exitCode) => {
      const output = Buffer.concat(chunks);
      resolve({ exitCode: exitCode ?? 1, output: output.subarray(-maxOutputBytes).toString("utf8") });
    });
  });
}

async function handle(body) {
  const event = JSON.parse(body);
  const command = commandFor(event);

  if (!command) {
    return { task: event?.task ?? null, exitCode: 1, output: "unknown task" };
  }

  const result = await run(...command);
  return { task: event.task, ...result };
}

const server = createServer(async (request, response) => {
  // Answer every non-POST request so the Lambda Web Adapter readiness check passes on any path.
  if (request.method !== "POST") {
    response.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  let result;
  try {
    result = await handle(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    result = { task: null, exitCode: 1, output: String(error) };
  }

  // Log the outcome without the output because query results can contain personal data.
  console.log(JSON.stringify({ task: result.task, exitCode: result.exitCode }));

  response
    .writeHead(result.exitCode === 0 ? 200 : 500, { "content-type": "application/json" })
    .end(JSON.stringify(result));
});

server.listen(port);
