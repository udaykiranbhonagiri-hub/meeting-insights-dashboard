"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
};

type MeetingInsights = {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  topics: string[];
  questions: string[];
};

type Meeting = MeetingInsights & {
  id: string;
  title: string;
  created_at: string;
};

export default function Home() {
 const [title, setTitle] = useState("");
const [transcript, setTranscript] = useState("");
const [fileName, setFileName] = useState("");
  const [insights, setInsights] =
    useState<MeetingInsights | null>(null);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    loadMeetings();
  }, []);

  async function loadMeetings() {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const response = await fetch("/api/meetings", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Failed to load meeting history.",
        );
      }

      setMeetings(data.meetings ?? []);
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Failed to load meeting history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "text/plain",
      "text/markdown",
    ];

    const isAllowedType =
      allowedTypes.includes(file.type) ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");

    if (!isAllowedType) {
      setError("Please upload a .txt or .md file.");
      event.target.value = "";
      return;
    }

    if (file.size > 1_000_000) {
      setError("File is too large. Maximum size is 1 MB.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();

      if (!text.trim()) {
        setError("The uploaded file is empty.");
        event.target.value = "";
        return;
      }

      setTranscript(text);
      setFileName(file.name);
      setError("");
    } catch {
      setError("Could not read the uploaded file.");
    }
  }

  async function analyzeMeeting(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!transcript.trim()) {
      setError("Please enter a meeting transcript.");
      return;
    }

    setLoading(true);
    setError("");
    setInsights(null);
    setSelectedMeetingId(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          transcript,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details
            ? `${data.error}: ${data.details}`
            : data.error || "Failed to analyze meeting.",
        );
      }

      setInsights({
  summary: data.summary,
  keyPoints: data.keyPoints,
  decisions: data.decisions,
  actionItems: data.actionItems.map(
    (item: Omit<ActionItem, "completed"> & { completed?: boolean }) => ({
      ...item,
      completed: item.completed ?? false,
    }),
  ),
  topics: data.topics,
  questions: data.questions,
});

      await loadMeetings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the meeting.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openMeeting(meeting: Meeting) {
    setSelectedMeetingId(meeting.id);

    setInsights({
      summary: meeting.summary,
      keyPoints: meeting.key_points,
      decisions: meeting.decisions,
      actionItems: meeting.action_items.map((item) => ({
  ...item,
  completed: item.completed ?? false,
})),
      topics: meeting.topics,
      questions: meeting.questions,
    });

    setError("");
  }
async function toggleActionItem(
  meetingId: string,
  actionIndex: number,
) {
  if (!insights) {
    return;
  }

  const actionItem = insights.actionItems[actionIndex];

  if (!actionItem) {
    return;
  }

  const newCompletedState = !actionItem.completed;

  const previousItems = insights.actionItems;

  setInsights({
    ...insights,
    actionItems: previousItems.map((item, index) =>
      index === actionIndex
        ? {
            ...item,
            completed: newCompletedState,
          }
        : item,
    ),
  });

  try {
    const response = await fetch("/api/meetings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meetingId,
        actionIndex,
        completed: newCompletedState,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.details ||
          data.error ||
          "Failed to update action item.",
      );
    }

    setMeetings((currentMeetings) =>
      currentMeetings.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              action_items: data.actionItems,
            }
          : meeting,
      ),
    );
  } catch (err) {
    setInsights({
      ...insights,
      actionItems: previousItems,
    });

    setError(
      err instanceof Error
        ? err.message
        : "Failed to update action item.",
    );
  }
}
  function clearWorkspace() {
  setTitle("");
  setTranscript("");
  setFileName("");
  setInsights(null);
  setSelectedMeetingId(null);
  setError("");
}

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="mb-2 text-sm font-medium text-blue-400">
            AI POWERED
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Meeting Insights Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Analyze meeting transcripts and automatically extract
            summaries, decisions, action items, topics, and questions.
          </p>
        </header>

        <form
          onSubmit={analyzeMeeting}
          className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <h2 className="text-xl font-semibold">
            Analyze a Meeting
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Paste your meeting transcript below or upload a text file.
          </p>
          <label className="mt-5 block">
  <span className="text-sm font-medium text-slate-300">
    Meeting Title
  </span>

  <input
    type="text"
    value={title}
    onChange={(event) => setTitle(event.target.value)}
    placeholder="e.g. Frontend Project Meeting"
    maxLength={120}
    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
  />
</label>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white">
              Upload Transcript
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <p className="text-sm text-slate-400">
                Loaded:{" "}
                <span className="font-medium text-slate-300">
                  {fileName}
                </span>
              </p>
            )}
          </div>

          <textarea
            value={transcript}
            onChange={(event) =>
              setTranscript(event.target.value)
            }
            placeholder="Paste your meeting transcript here..."
            className="mt-5 min-h-56 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />

          <div className="mt-2 flex justify-end">
            <p className="text-xs text-slate-500">
              {transcript.length.toLocaleString()} / 100,000
              characters
            </p>
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Analyze Meeting"}
            </button>

            <button
              type="button"
              onClick={clearWorkspace}
              disabled={
                loading || (!transcript && !insights)
              }
              className="ml-3 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </p>
          )}
        </form>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Recent Meetings
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Previously analyzed meetings saved in your database.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMeetings}
              disabled={historyLoading}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-40"
            >
              {historyLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {historyError && (
            <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {historyError}
            </p>
          )}

          {!historyLoading &&
            !historyError &&
            meetings.length === 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center">
                <p className="text-sm text-slate-400">
                  No saved meetings yet.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Analyze a meeting to create your first history item.
                </p>
              </div>
            )}

          {meetings.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {meetings.map((meeting) => {
                const isSelected =
                  meeting.id === selectedMeetingId;

                return (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => openMeeting(meeting)}
                    className={`rounded-xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-950/30"
                        : "border-slate-800 bg-slate-950 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 font-medium">
                        {meeting.title}
                      </h3>

                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDate(meeting.created_at)}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm leading-5 text-slate-400">
                      {meeting.summary}
                    </p>

                    <div className="mt-4 flex gap-4 text-xs text-slate-500">
                      <span>
                        {meeting.action_items.length} actions
                      </span>

                      <span>
                        {meeting.decisions.length} decisions
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Action Items"
            value={insights?.actionItems.length ?? 0}
          />

          <StatCard
            title="Decisions"
            value={insights?.decisions.length ?? 0}
          />

          <StatCard
            title="Topics"
            value={insights?.topics.length ?? 0}
          />

          <StatCard
            title="Questions"
            value={insights?.questions.length ?? 0}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <InsightCard title="Summary">
            <p className="text-sm leading-6 text-slate-400">
              {insights?.summary ??
                "Your AI-generated meeting summary will appear here."}
            </p>
          </InsightCard>

          <InsightCard title="Key Discussion Points">
            {insights ? (
              <BulletList items={insights.keyPoints} />
            ) : (
              <Placeholder text="Important discussion points will appear here." />
            )}
          </InsightCard>

          <InsightCard title="Decisions">
            {insights ? (
              <BulletList items={insights.decisions} />
            ) : (
              <Placeholder text="Decisions identified from the meeting will appear here." />
            )}
          </InsightCard>

          <InsightCard title="Topics">
            {insights ? (
              <BulletList items={insights.topics} />
            ) : (
              <Placeholder text="Topics discussed in the meeting will appear here." />
            )}
          </InsightCard>

          <div className="lg:col-span-2">
            <InsightCard title="Action Items">
              {insights ? (
                insights.actionItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="px-3 py-3">
                            Task
                          </th>
                          <th className="px-3 py-3">
                            Owner
                          </th>
                          <th className="px-3 py-3">
                            Deadline
                          </th>
                          <th className="px-3 py-3">
                            Priority
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {insights.actionItems.map(
                          (item, index) => (
                            <tr
                              key={`${item.task}-${index}`}
                              className="border-b border-slate-800 last:border-0"
                            >
                              <td className="px-3 py-4">
                                {item.task}
                              </td>

                              <td className="px-3 py-4 text-slate-300">
                                {item.owner}
                              </td>

                              <td className="px-3 py-4 text-slate-300">
                                {item.deadline}
                              </td>

                              <td className="px-3 py-4">
                                <PriorityBadge
                                  priority={item.priority}
                                />
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No action items were identified.
                  </p>
                )
              ) : (
                <Placeholder text="Tasks, owners, deadlines, and priorities will appear here." />
              )}
            </InsightCard>
          </div>

          <InsightCard title="Questions">
            {insights ? (
              <BulletList items={insights.questions} />
            ) : (
              <Placeholder text="Important unanswered questions will appear here." />
            )}
          </InsightCard>
        </section>
      </div>
    </main>
  );
}

type StatCardProps = {
  title: string;
  value: number;
};

function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  children: React.ReactNode;
};

function InsightCard({
  title,
  children,
}: InsightCardProps) {
  return (
    <div className="min-h-48 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold">
        {title}
      </h2>

      <div className="mt-4">
        {children}
      </div>
    </div>
  );
}

function BulletList({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No information was identified.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex gap-3 text-sm leading-6 text-slate-400"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Placeholder({
  text,
}: {
  text: string;
}) {
  return (
    <p className="text-sm leading-6 text-slate-500">
      {text}
    </p>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: ActionItem["priority"];
}) {
  return (
    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs">
      {priority}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}