import Hono from "hono";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: Message[];
}

interface ChatResponse {
  text: string;
  error?: string;
}

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

const app = new Hono();

// Configuration validation
const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY;
const OPENAI_MODEL = Bun.env.OPENAI_MODEL || "gpt-4";
const OPENAI_BASE_URL = Bun.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

// Initialize config error flag
let configError: string | null = null;

if (!OPENAI_API_KEY) {
  configError =
    "❌ Configuration Error: OPENAI_API_KEY environment variable is not set. Please add your OpenAI API key to Railway environment variables to use this service.";
  console.error(configError);
}

// Health check endpoint with config status
app.get("/health", (c) => {
  if (configError) {
    return c.json(
      {
        status: "degraded",
        error: configError,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
  return c.json(
    {
      status: "healthy",
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL,
      timestamp: new Date().toISOString(),
    },
    200
  );
});

// Chat endpoint with streaming support
app.post("/api/chat", async (c) => {
  // Validate configuration
  if (configError) {
    return c.json(
      {
        error: configError,
        text: "",
      },
      503
    );
  }

  try {
    const body = (await c.req.json()) as ChatRequest;
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "Invalid request: messages array required" }, 400);
    }

    if (messages.length === 0) {
      return c.json({ error: "Invalid request: messages array is empty" }, 400);
    }

    // Prepare system message for context
    const systemMessage: Message = {
      role: "assistant",
      content: `You are Adaptive AI, an intelligent assistant designed to learn communication preferences from interactions. 
You maintain conversation context and adapt your responses based on user feedback.
You are helpful, clear, and practical. You break down complex topics and provide actionable guidance.
You can help with planning, explaining concepts, teaching new ideas, and creative problem-solving.
You acknowledge user preferences when you detect them and mention when you're adapting to their style.`,
    };

    // Build messages array for OpenAI API
    const apiMessages = [systemMessage, ...messages];

    // Call OpenAI-compatible API
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false, // Set to true for streaming if needed
        tools: [
          {
            type: "function",
            function: {
              name: "adapt_response_style",
              description:
                "Adapt response style based on detected user preferences",
              parameters: {
                type: "object",
                properties: {
                  length_preference: {
                    type: "string",
                    enum: ["short", "balanced", "detailed"],
                    description: "Detected length preference",
                  },
                  tone_preference: {
                    type: "string",
                    enum: ["casual", "natural", "professional"],
                    description: "Detected tone preference",
                  },
                  format_preference: {
                    type: "string",
                    enum: ["clean", "structured", "detailed"],
                    description: "Detected formatting preference",
                  },
                },
                required: [
                  "length_preference",
                  "tone_preference",
                  "format_preference",
                ],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "context_aware_planning",
              description:
                "Create structured plans based on user goals and context",
              parameters: {
                type: "object",
                properties: {
                  goal: { type: "string", description: "User's primary goal" },
                  steps: {
                    type: "array",
                    items: { type: "string" },
                    description: "Ordered steps to achieve goal",
                  },
                  considerations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Important factors or constraints",
                  },
                },
                required: ["goal", "steps"],
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", response.status, errorData);
      return c.json(
        {
          error: `LLM API error (${response.status}): ${errorData}`,
          text: "",
        },
        response.status
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
          tool_calls?: ToolCall[];
        };
      }>;
    };

    const assistantMessage = data.choices?.[0]?.message?.content || "";
    const toolCalls = data.choices?.[0]?.message?.tool_calls;

    if (!assistantMessage) {
      return c.json({ error: "No response from LLM", text: "" }, 500);
    }

    return c.json({
      text: assistantMessage,
      tools: toolCalls || [],
    } as ChatResponse);
  } catch (error) {
    console.error("Chat endpoint error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return c.json(
      {
        error: `Server error: ${message}`,
        text: "",
      },
      500
    );
  }
});

// Streaming chat endpoint (optional, for future use)
app.post("/api/chat/stream", async (c) => {
  if (configError) {
    return c.json(
      {
        error: configError,
        text: "",
      },
      503
    );
  }

  try {
    const body = (await c.req.json()) as ChatRequest;
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: "Invalid request: non-empty messages array required" },
        400
      );
    }

    const systemMessage: Message = {
      role: "assistant",
      content:
        "You are Adaptive AI, an intelligent assistant. Help the user with their request clearly and concisely.",
    };

    const apiMessages = [systemMessage, ...messages];

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI streaming API error:", response.status, errorData);
      return c.json(
        {
          error: `LLM API error (${response.status})`,
        },
        response.status
      );
    }

    // Stream response back to client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream endpoint error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return c.json(
      {
        error: `Server error: ${message}`,
      },
      500
    );
  }
});

// Config status endpoint
app.get("/api/config", (c) => {
  if (configError) {
    return c.json(
      {
        configured: false,
        error: configError,
      },
      200
    );
  }

  return c.json(
    {
      configured: true,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL,
    },
    200
  );
});

export default app;

