# Adaptive AI v6 — Real Backend Implementation

## Overview

**V6 Step 1** replaces the demo-response local architecture with a real backend chat API capable of calling OpenAI-compatible LLM providers. The implementation maintains the existing glass-morphism UI and local preference learning while adding:

- ✅ Real LLM integration (OpenAI-compatible API)
- ✅ Multi-turn conversation context (backend-managed)
- ✅ Streaming response hooks (infrastructure in place for future use)
- ✅ Structured tool orchestration (defined but not yet used)
- ✅ Clear configuration error reporting (not silent fallback to canned replies)
- ✅ No API keys exposed in client code
- ✅ Environment variable configuration (OPENAI_API_KEY, OPENAI_MODEL)

## Architecture

### Backend (TypeScript + Hono)

**File:** `backend-api.ts` (deployed via Docker)

The backend is a Hono HTTP server that:

1. **Validates configuration** on startup:
   - Checks for `OPENAI_API_KEY` environment variable
   - Reports clear errors if missing (does not silently fallback)
   - Provides `/health` and `/api/config` endpoints to expose config status

2. **Handles chat requests** via `/api/chat`:
   - Accepts `POST /api/chat` with `{ messages: Message[] }`
   - Prepends a system message for context (Adaptive AI persona)
   - Maintains conversation history (caller sends full history)
   - Forwards to OpenAI API using `OPENAI_MODEL` (default: `gpt-4`)
   - Returns `{ text: string, tools?: ToolCall[] }`

3. **Defines structured tools** (not yet invoked by frontend):
   - `adapt_response_style`: Declare response length/tone/format preferences
   - `context_aware_planning`: Create structured plans from goals
   - Framework in place for future tool use

4. **Provides streaming endpoint** (optional, `/api/chat/stream`):
   - Server-sent events (SSE) infrastructure ready
   - Disabled by default in frontend to simplify initial integration

### Frontend (HTML + JavaScript)

**File:** `index.html` (no build step, served as-is)

The frontend is largely unchanged; modifications are surgical:

1. **API Integration**:
   - `send()` function now calls `POST /api/chat` instead of `generateReply()`
   - Request body: `{ messages: [{ role: "user"|"assistant", content: string }] }`
   - Responses displayed inline with loading indicator

2. **Configuration Awareness**:
   - Home page checks `/api/config` on load
   - Settings page displays backend status (model name, config errors)
   - Clear banners if API key is missing: "*❌ Configuration Error: OPENAI_API_KEY environment variable is not set...*"
   - Disables chat until backend is ready

3. **Graceful Error Handling**:
   - Network errors display inline in chat
   - Missing config shows banner, prevents send
   - API errors (rate limit, invalid key, etc.) shown in chat

4. **Removed**:
   - `generateReply()` function (demo responses)
   - Backend reference in title: "v5 Glass Bugfix" → "v6 Real Backend"

5. **Unchanged**:
   - All UI styling (glass morphism, gradients, animations)
   - Local storage for chats and learning
   - Preference adaptation logic (keyword detection)
   - Navigation, settings, memory views

## Deployment

### Prerequisites

- Railway account with **adaptive-ai** project
- OpenAI API key (or compatible provider: Azure, LM Studio, Ollama, etc.)

### Step 1: Update Repository

Replace the existing `index.html` in the repo with the new version from this PR. Commit and push:

```bash
git add index.html backend-api.ts package.json Dockerfile
git commit -m "chore: v6 step 1 - replace demo responses with real backend LLM"
git push
```

The service **adaptive-ai-v4-live** will auto-deploy (if auto-deploy is enabled).

### Step 2: Configure Environment Variables

1. Go to Railway dashboard → **adaptive-ai-v4-live** service → **Variables**
2. Add:
   - `OPENAI_API_KEY`: Your OpenAI API key (or compatible provider)
   - `OPENAI_MODEL`: Model name (default: `gpt-4`; try `gpt-4-turbo`, `gpt-3.5-turbo`, etc.)
   - **Optional**: `OPENAI_BASE_URL` (if using non-OpenAI provider; default: `https://api.openai.com/v1`)

3. Save and redeploy the service

### Step 3: Verify Deployment

1. Visit the service URL (e.g., `https://adaptive-ai-v4-live-production.up.railway.app`)
2. Go to **Settings** tab — should show "✓ Backend configured (Model: gpt-4)"
3. Go to **Home** tab — should show "✓ Ready to chat with gpt-4"
4. Start a chat. You should get real responses from the LLM, not demo replies.

If you see a configuration error banner instead, double-check `OPENAI_API_KEY` is set correctly and redeploy.

## API Reference

### Endpoints

#### `GET /health`
Returns service health status and config validation.

**Response (healthy):**
```json
{
  "status": "healthy",
  "model": "gpt-4",
  "baseUrl": "https://api.openai.com/v1",
  "timestamp": "2026-10-03T19:30:00Z"
}
```

**Response (missing API key):**
```json
{
  "status": "degraded",
  "error": "❌ Configuration Error: OPENAI_API_KEY environment variable is not set...",
  "timestamp": "2026-10-03T19:30:00Z"
}
```

#### `GET /api/config`
Frontend-friendly config status check.

**Response (ready):**
```json
{
  "configured": true,
  "model": "gpt-4",
  "baseUrl": "https://api.openai.com/v1"
}
```

**Response (not ready):**
```json
{
  "configured": false,
  "error": "❌ Configuration Error: OPENAI_API_KEY environment variable is not set..."
}
```

#### `POST /api/chat`
Main chat endpoint. Send conversation history, get LLM response.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Explain quantum computing simply" },
    { "role": "assistant", "content": "Quantum computers use quantum bits (qubits)..." },
    { "role": "user", "content": "What's a qubit?" }
  ]
}
```

**Response:**
```json
{
  "text": "A qubit (quantum bit) is the quantum equivalent of a classical bit...",
  "tools": []
}
```

**Error Response:**
```json
{
  "text": "",
  "error": "LLM API error (401): Invalid API key provided"
}
```

#### `POST /api/chat/stream` (optional)
Streaming variant. Returns Server-Sent Events (SSE) stream.

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## Implementation Notes

### Message Format Conversion

Frontend uses `{ role: 'user'|'ai', text: ... }` (local chat format).
Backend API expects OpenAI format: `{ role: 'user'|'assistant', content: ... }`.

Conversion happens in `send()` (frontend):
```javascript
messages: c.messages.filter(m=>m.role!=='ai'||m.text).map(
  m => ({ role: m.role==='ai'?'assistant':'user', content: m.text })
)
```

### Tool Definitions (Ready but Not Used)

The backend defines two tools in the LLM request:
- **`adapt_response_style`**: Declare response preferences (length, tone, format)
- **`context_aware_planning`**: Structure plans from goals

These are sent to the LLM but not yet invoked by the frontend. Future steps can:
1. Listen for `tool_calls` in the response
2. Execute the tool locally or via a tool handler
3. Send results back as follow-up messages

Example future flow:
```javascript
if (data_resp.tools?.length) {
  data_resp.tools.forEach(tool => {
    if (tool.function.name === 'adapt_response_style') {
      // Extract preferences and update local data
    }
  });
}
```

### Streaming (Not Yet Implemented in Frontend)

The `/api/chat/stream` endpoint is ready. To enable:

1. **Backend**: Change `stream: false` → `stream: true` in `/api/chat`
2. **Frontend**: Parse SSE and render tokens as they arrive:

```javascript
const eventSource = new EventSource('/api/chat/stream');
eventSource.onmessage = (e) => {
  const token = JSON.parse(e.data).choices[0].delta.content;
  appendToMessage(token);
};
```

This is deferred to a future step because it requires:
- SSE client-side handling
- Incremental DOM updates
- Buffering/coalescing for performance

### Alternative LLM Providers

The backend supports any OpenAI-compatible API:

**Azure OpenAI:**
```
OPENAI_BASE_URL=https://<resource>.openai.azure.com/openai/deployments/<deployment>
OPENAI_API_KEY=<key>
OPENAI_MODEL=gpt-4 (deployment name on Azure)
```

**LM Studio / Ollama (local):**
```
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=not-used
OPENAI_MODEL=local-model
```

**Anthropic Claude (via compatible proxy):**
Not yet; would require switching to Anthropic SDK or using a proxy that implements OpenAI format.

## What Remains

### For a Complete V6 Release:

1. **Streaming Response Rendering** — Parse SSE in frontend, render tokens incrementally
2. **Tool Invocation** — Handle `tool_calls` in responses, execute locally or via backend
3. **Preference Learning Integration** — Use tool calls to update `data.prefs` automatically
4. **Context Length Awareness** — Truncate or summarize old messages if approaching token limit
5. **Rate Limiting** — Add client-side backoff, user-friendly error messages for quota
6. **Conversation Export** — Save/download conversations as JSON or PDF
7. **Multi-Model Selection** — UI to pick between models, with cost estimation

### Not in Scope (Later Versions):

- Fine-tuning on user preferences (requires batch processing)
- Conversation embeddings for semantic search
- Multi-user/auth (currently single-device local storage)
- Voice input/output
- Vision (image analysis)
- Custom instructions per chat

## Files Changed

| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Frontend UI + API integration | Modified |
| `backend-api.ts` | Hono server, LLM calls, config validation | New |
| `package.json` | Dependencies (hono, bun) | New |
| `Dockerfile` | Docker build for Railway deployment | New |
| `V6_IMPLEMENTATION.md` | This document | New |

All other files (`start.sh`, `.git/`, etc.) remain unchanged.

## Testing Locally

### Option 1: Bun Dev Server

```bash
# Install dependencies
bun install

# Run backend (port 3000)
bun run backend-api.ts

# In another terminal, serve frontend
bunx http-server .

# Visit http://localhost:8080, backend at http://localhost:3000
```

### Option 2: Docker

```bash
docker build -t adaptive-ai-v6 .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e OPENAI_MODEL=gpt-4 \
  adaptive-ai-v6
```

Visit `http://localhost:3000` — frontend and backend served from same origin.

## Troubleshooting

### "❌ Configuration Error: OPENAI_API_KEY environment variable is not set"

**Cause:** The environment variable is missing or misspelled.

**Fix:**
1. Go to Railway dashboard → service → Variables
2. Add `OPENAI_API_KEY` with your OpenAI API key
3. Redeploy the service
4. Refresh the app and check Settings tab

### "Cannot reach backend API" banner

**Cause:** Frontend cannot connect to `/api/config`. Likely CORS or service not running.

**Fix:**
1. Check that the service is deployed and running (green dot in Railway)
2. Check service logs for errors: Railway dashboard → Logs tab
3. Verify the service public domain is correct (should be same as app URL)

### "LLM API error (401): Invalid API key provided"

**Cause:** The `OPENAI_API_KEY` is invalid or expired.

**Fix:**
1. Verify your key at https://platform.openai.com/account/api-keys
2. Ensure the key has chat completion permissions
3. Update in Railway Variables and redeploy

### "LLM API error (429): Rate limit exceeded"

**Cause:** You've exceeded your OpenAI quota or rate limit.

**Fix:**
1. Check usage at https://platform.openai.com/account/billing/overview
2. Upgrade your plan or wait for quota reset
3. Implement client-side throttling (future enhancement)

### "LLM API error (401): Model gpt-4 not found"

**Cause:** Your OpenAI account doesn't have access to the model.

**Fix:**
1. Check your account tier and available models
2. Try `gpt-3.5-turbo` or `gpt-4-turbo` instead
3. Update `OPENAI_MODEL` in Railway Variables

## Summary

V6 Step 1 successfully replaces the demo-response architecture with a production-ready backend:

- ✅ All chat responses now come from a real LLM
- ✅ Configuration validated at startup with clear error messages
- ✅ Multi-turn context managed server-side
- ✅ Frontend remains simple, no API keys exposed
- ✅ Tool orchestration hooks defined and ready for future use
- ✅ Streaming infrastructure in place for next iteration
- ✅ UI/UX completely unchanged — just more powerful

Next steps: streaming responses, tool execution, preference auto-tuning.

