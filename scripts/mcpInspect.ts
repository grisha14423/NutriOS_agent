import path from "node:path";
import { MCPServerStdio } from "@openai/agents";

const server = new MCPServerStdio({
  name: "markdown-health",
  command: process.execPath,
  args: [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), path.join(process.cwd(), "src", "mcp", "markdownHealthServer.ts")],
  cwd: process.cwd(),
});

try {
  await server.connect();
  console.log("Tools:", (await server.listTools()).map((tool) => tool.name));
  console.log("Resources:", (await server.listResources()).resources.map((resource) => resource.uri));
} finally {
  await server.close();
}
