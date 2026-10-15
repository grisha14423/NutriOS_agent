import path from "node:path";

export type McpServerConfig = {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
};

const npx = (args: string[]) => process.platform === "win32"
  ? { command: "cmd", args: ["/c", "npx", "--no-install", ...args] }
  : { command: "npx", args: ["--no-install", ...args] };

export const getServersConfig = (): McpServerConfig[] => {
  const root = process.cwd();
  return [
  {
    name: "markdown-health",
    command: process.execPath,
    args: [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "src", "mcp", "markdownHealthServer.ts")],
    enabled: true,
  },
  {
    name: "filesystem",
    ...npx(["mcp-server-filesystem", path.join(root, "data"), path.join(root, "plans")]),
    enabled: true,
  },
  {
    name: "weather",
    // @cynosure-mcp/weather@1.0.5 из package.json; npx запускает локальный bin.
    ...npx(["weather"]),
    enabled: true,
  },
  {
    name: "notion",
    ...npx(["notion-mcp-server"]),
    env: process.env.NOTION_TOKEN ? { NOTION_TOKEN: process.env.NOTION_TOKEN } : undefined,
    enabled: Boolean(process.env.NOTION_TOKEN),
  },
  ];
};
