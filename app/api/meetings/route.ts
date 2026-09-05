import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  completed?: boolean;
};

function normalizeActionItems(items: unknown): ActionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      task: typeof item.task === "string" ? item.task : "",
      owner: typeof item.owner === "string" ? item.owner : "Unassigned",
      deadline:
        typeof item.deadline === "string"
          ? item.deadline
          : "Not specified",
      priority:
        item.priority === "High" ||
        item.priority === "Medium" ||
        item.priority === "Low"
          ? item.priority
          : "Medium",
      completed:
        typeof item.completed === "boolean"
          ? item.completed
          : false,
    }));
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("meetings")
      .select(
        "id, title, summary, key_points, decisions, action_items, topics, questions, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase meetings query failed:", error);

      return NextResponse.json(
        {
          error: "Failed to load meeting history.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const meetings = (data ?? []).map((meeting) => ({
      ...meeting,
      action_items: normalizeActionItems(meeting.action_items),
    }));

    return NextResponse.json({
      meetings,
    });
  } catch (error) {
    console.error("Meeting history failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to load meeting history.",
        details: message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const meetingId = body?.meetingId;
    const actionIndex = body?.actionIndex;
    const completed = body?.completed;

    if (
      typeof meetingId !== "string" ||
      meetingId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A valid meeting ID is required." },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(actionIndex) ||
      actionIndex < 0
    ) {
      return NextResponse.json(
        { error: "A valid action item index is required." },
        { status: 400 },
      );
    }

    if (typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Completed must be a boolean." },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("id, action_items")
      .eq("id", meetingId)
      .single();

    if (fetchError || !meeting) {
      return NextResponse.json(
        {
          error: "Meeting not found.",
          details: fetchError?.message,
        },
        { status: 404 },
      );
    }

    const actionItems = normalizeActionItems(
      meeting.action_items,
    );

    if (actionIndex >= actionItems.length) {
      return NextResponse.json(
        { error: "Action item does not exist." },
        { status: 400 },
      );
    }

    actionItems[actionIndex].completed = completed;

    const { error: updateError } = await supabase
      .from("meetings")
      .update({
        action_items: actionItems,
      })
      .eq("id", meetingId);

    if (updateError) {
      console.error(
        "Supabase action-item update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          error: "Failed to update action item.",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      actionItems,
    });
  } catch (error) {
    console.error("Action-item update failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return NextResponse.json(
      {
        error: "Failed to update action item.",
        details: message,
      },
      { status: 500 },
    );
  }
}