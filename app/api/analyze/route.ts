import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
};

type MeetingInsights = {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  topics: string[];
  questions: string[];
};

function isValidMeetingInsights(data: unknown): data is MeetingInsights {
  if (!data || typeof data !== "object") {
    return false;
  }

  const value = data as Record<string, unknown>;

  if (
    typeof value.summary !== "string" ||
    !Array.isArray(value.keyPoints) ||
    !Array.isArray(value.decisions) ||
    !Array.isArray(value.actionItems) ||
    !Array.isArray(value.topics) ||
    !Array.isArray(value.questions)
  ) {
    return false;
  }

  return value.actionItems.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const actionItem = item as Record<string, unknown>;

    return (
      typeof actionItem.task === "string" &&
      typeof actionItem.owner === "string" &&
      typeof actionItem.deadline === "string" &&
      ["High", "Medium", "Low"].includes(
        actionItem.priority as string,
      )
    );
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const transcript = body?.transcript;
    const title = body?.title;
    const meetingTitle =
    typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled Meeting";

    if (
      typeof transcript !== "string" ||
      transcript.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "A meeting transcript is required.",
        },
        { status: 400 },
      );
    }

    if (transcript.length > 100_000) {
      return NextResponse.json(
        {
          error: "Transcript is too large.",
        },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are a meeting analysis assistant.

Analyze the following meeting transcript.

Extract only information that is supported by the transcript.

Rules:

- Do not invent information.
- Write a concise but informative summary.
- keyPoints should contain important discussion points.
- decisions should contain only decisions that were actually made.
- actionItems should contain only tasks that were actually assigned or clearly stated.
- If an action item owner is unknown, use "Unassigned".
- If a deadline is unknown, use "Not specified".
- Priority must be exactly "High", "Medium", or "Low".
- topics should contain the main subjects discussed.
- questions should contain important unanswered questions.
- If there are no items for a list, return an empty array.

Meeting transcript:

${transcript}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
            },

            keyPoints: {
              type: "array",
              items: {
                type: "string",
              },
            },

            decisions: {
              type: "array",
              items: {
                type: "string",
              },
            },

            actionItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task: {
                    type: "string",
                  },
                  owner: {
                    type: "string",
                  },
                  deadline: {
                    type: "string",
                  },
                  priority: {
                    type: "string",
                    enum: ["High", "Medium", "Low"],
                  },
                },
                required: [
                  "task",
                  "owner",
                  "deadline",
                  "priority",
                ],
              },
            },

            topics: {
              type: "array",
              items: {
                type: "string",
              },
            },

            questions: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },

          required: [
            "summary",
            "keyPoints",
            "decisions",
            "actionItems",
            "topics",
            "questions",
          ],
        },
      },
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          error: "Gemini returned an empty response.",
        },
        { status: 502 },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
          rawResponse: text,
        },
        { status: 502 },
      );
    }

    if (!isValidMeetingInsights(parsed)) {
      return NextResponse.json(
        {
          error:
            "Gemini returned an unexpected response structure.",
        },
        { status: 502 },
      );
    }

    const supabase = createServerSupabaseClient();

const { data: meeting, error: databaseError } = await supabase
  .from("meetings")
  .insert({
    transcript,
    summary: parsed.summary,
    key_points: parsed.keyPoints,
    decisions: parsed.decisions,
    action_items: parsed.actionItems.map((item) => ({
  ...item,
  completed: false,
})),
    topics: parsed.topics,
    questions: parsed.questions,
  })
  .select()
  .single();

if (databaseError) {
  console.error("Supabase insert failed:", databaseError);

  return NextResponse.json(
    {
      error: "Meeting was analyzed but could not be saved.",
      details: databaseError.message,
    },
    { status: 500 },
  );
}

return NextResponse.json({
  ...parsed,
  actionItems: parsed.actionItems.map((item) => ({
    ...item,
    completed: false,
  })),
  meetingId: meeting.id,
  createdAt: meeting.created_at,
});
  } catch (error) {
    console.error("Meeting analysis failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to analyze the meeting.",
        details: message,
      },
      { status: 500 },
    );
  }
}