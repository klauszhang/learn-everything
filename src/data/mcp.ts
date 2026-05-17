// Illustrative MCP server manifests — hand-authored, not real API output.

export interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: object;
}

export interface MCPServer {
  id: string;
  name: string;
  transport: "stdio" | "http";
  description: string;
  tools: MCPToolDef[];
  /** Approximate token count for all tool defs combined — illustrative. */
  estimatedTokens: number;
}

export const mockServers: MCPServer[] = [
  {
    id: "github",
    name: "github",
    transport: "http",
    description: "GitHub repository management",
    estimatedTokens: 420,
    tools: [
      {
        name: "create_pull_request",
        description: "Create a pull request. Requires a branch that differs from base.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "PR title." },
            body: { type: "string", description: "PR description in markdown." },
            base: { type: "string", description: "Base branch (e.g. 'main')." },
            head: { type: "string", description: "Head branch with your changes." },
          },
          required: ["title", "base", "head"],
        },
      },
      {
        name: "list_pull_requests",
        description: "List open pull requests for a repository.",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Owner/repo slug." },
            state: { type: "string", enum: ["open", "closed", "all"] },
          },
          required: ["repo"],
        },
      },
    ],
  },
  {
    id: "sentry",
    name: "sentry",
    transport: "http",
    description: "Error monitoring and issue tracking",
    estimatedTokens: 310,
    tools: [
      {
        name: "list_issues",
        description: "List recent Sentry issues for a project, filtered by status.",
        inputSchema: {
          type: "object",
          properties: {
            project: { type: "string", description: "Sentry project slug." },
            status: { type: "string", enum: ["unresolved", "resolved", "ignored"] },
          },
          required: ["project"],
        },
      },
    ],
  },
  {
    id: "filesystem",
    name: "filesystem",
    transport: "stdio",
    description: "Local file system access (read-only)",
    estimatedTokens: 280,
    tools: [
      {
        name: "read_file",
        description: "Read the contents of a file at the given path.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute or project-relative path." },
          },
          required: ["path"],
        },
      },
      {
        name: "list_directory",
        description: "List files and subdirectories at a given path.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path to list." },
          },
          required: ["path"],
        },
      },
    ],
  },
];

/** Token budget for the tool-defs segment when NO MCP servers are connected (built-in tools only). */
export const BASE_TOOL_TOKENS = 480;
