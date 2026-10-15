import { MCPServerStdio } from "@openai/agents";
import nextEnv from "@next/env";
import { getServersConfig } from "../src/mcp/servers.config";

nextEnv.loadEnvConfig(process.cwd());

for (const config of getServersConfig()) {
  console.log(`[${config.name}]${config.enabled ? "" : " disabled"}`);
  if (!config.enabled) continue;

  const server = new MCPServerStdio({ ...config, cwd: process.cwd() });
  try {
    await server.connect();
    console.log("Tools:", (await server.listTools()).map((tool) => tool.name));
    try {
      console.log("Resources:", (await server.listResources()).resources.map((resource) => resource.uri));
    } catch (error) {
      if ((error as { code?: number }).code !== -32601) throw error;
      console.log("Resources: not supported");
    }
  } finally {
    await server.close();
  }
}
