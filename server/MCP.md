# CareerPilot MCP Server

CareerPilot exposes an authenticated Model Context Protocol (MCP) endpoint at `/mcp` through the existing Spring Boot backend. It reuses the current Clerk bearer-token authentication and resume services, so no separate service or hosting plan is required.

## Authentication

Send a valid CareerPilot Clerk session JWT with every request:

```http
Authorization: Bearer <clerk-session-token>
Content-Type: application/json
Accept: application/json
```

The endpoint is protected by the existing Spring Security configuration. Tool operations resolve the user from the verified JWT and scope resume listing and creation to that user. Never place session tokens in prompts, source control, or logs.

## Available tools

- `get_resume_schema` — returns the JSON schema for valid resume data.
- `get_resume_templates` — lists available templates.
- `list_my_resumes` — lists only the authenticated user's resumes.
- `create_resume_draft` — validates resume data and creates a resume in the authenticated user's account.
- `preview_resume` — renders HTML for review without saving a resume.

Resume content must remain truthful. Review drafts and previews before using them in applications. Gmail sending and destructive Drive actions are intentionally not exposed through MCP in this initial version.

## Local smoke test

Run the backend with the same environment variables required by the REST API, then send an MCP `initialize` request to `http://localhost:8080/mcp` using a valid bearer token:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": { "name": "local-test", "version": "1.0.0" }
  }
}
```

Then call `tools/list` to inspect the available tools. This initial endpoint uses JSON-RPC over authenticated HTTP; verify compatibility with your chosen MCP client before publishing it for general use.
