Next: action-item completion tracking.

We’ll turn this:

Action Items
────────────────────────────────
Finish login       Priya   Thursday   High
Integrate API      Amit    Friday      High
Update docs        Amit    Friday      Medium

into:

☐ Finish login
☑ Integrate API
☐ Update docs

The status will be saved in Supabase, so refreshing the page will not lose it.

1. Update src/app/api/analyze/route.ts

Find the Supabase insert section.

Currently it should contain:

action_items: parsed.actionItems,

Replace it with:

action_items: parsed.actionItems.map((item) => ({
  ...item,
  completed: false,
})),

Then find the final response:

return NextResponse.json({
  ...parsed,
  meetingId: meeting.id,
  createdAt: meeting.created_at,
});

Replace it with:

return NextResponse.json({
  ...parsed,
  actionItems: parsed.actionItems.map((item) => ({
    ...item,
    completed: false,
  })),
  meetingId: meeting.id,
  createdAt: meeting.created_at,
});

This means every newly analyzed action item starts as:

{
  "task": "...",
  "owner": "...",
  "deadline": "...",
  "priority": "High",
  "completed": false
}
2. Update /api/meetings

Open:

src/app/api/meetings/route.ts

Replace the entire file with:

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

This gives us:

GET   /api/meetings
PATCH /api/meetings

without introducing another route.

3. Update the ActionItem type in page.tsx

Open:

src/app/page.tsx

Find:

type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
};

Replace with:

type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
};
4. Update the Meeting type

Keep this:

type Meeting = MeetingInsights & {
  id: string;
  title: string;
  created_at: string;
};

No change is required.

5. Add the completion handler

Inside Home(), before clearWorkspace(), add:

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

The UI changes immediately, then the database is updated. If the database update fails, the UI rolls back.

6. Fix analyzeMeeting()

We need newly analyzed meetings to have completed: false.

Find:

setInsights({
  summary: data.summary,
  keyPoints: data.keyPoints,
  decisions: data.decisions,
  actionItems: data.actionItems,
  topics: data.topics,
  questions: data.questions,
});

Replace with:

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
7. Fix openMeeting()

Find:

actionItems: meeting.action_items,

Replace with:

actionItems: meeting.action_items.map((item) => ({
  ...item,
  completed: item.completed ?? false,
})),

This is important for your old meetings, because they were saved before we introduced completed.

8. Replace the Action Items table

Find this section inside the Action Items card:

{insights.actionItems.length > 0 ? (
  <div className="overflow-x-auto">

Replace the whole contents of that insights.actionItems.length > 0 ? (...) branch with:

{insights.actionItems.length > 0 ? (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-800 text-slate-400">
        <tr>
          <th className="px-3 py-3">Done</th>
          <th className="px-3 py-3">Task</th>
          <th className="px-3 py-3">Owner</th>
          <th className="px-3 py-3">Deadline</th>
          <th className="px-3 py-3">Priority</th>
        </tr>
      </thead>

      <tbody>
        {insights.actionItems.map((item, index) => (
          <tr
            key={`${item.task}-${index}`}
            className="border-b border-slate-800 last:border-0"
          >
            <td className="px-3 py-4">
              <button
                type="button"
                onClick={() => {
                  if (selectedMeetingId) {
                    toggleActionItem(
                      selectedMeetingId,
                      index,
                    );
                  }
                }}
                disabled={!selectedMeetingId}
                aria-label={
                  item.completed
                    ? "Mark action item as incomplete"
                    : "Mark action item as complete"
                }
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
                  item.completed
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : "border-slate-600 hover:border-blue-500"
                }`}
              >
                {item.completed ? "✓" : ""}
              </button>
            </td>

            <td
              className={`px-3 py-4 ${
                item.completed
                  ? "text-slate-500 line-through"
                  : ""
              }`}
            >
              {item.task}
            </td>

            <td className="px-3 py-4 text-slate-300">
              {item.owner}
            </td>

            <td className="px-3 py-4 text-slate-300">
              {item.deadline}
            </td>

            <td className="px-3 py-4">
              <PriorityBadge priority={item.priority} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : (

Leave the existing No action items were identified. part after that unchanged.

9. Important behavior change

There is one intentional distinction:

Newly analyzed meeting

You analyze:

Frontend Project Meeting

The result appears immediately.

Since the meeting has just been saved by the API, it receives a meetingId, so its action items can be checked off immediately.

Previously saved meeting

Click a meeting from Recent Meetings.

Its action items can also be checked off.

Old database records

Your old action items have no completed field.

Our API automatically treats them as:

completed = false

and when you change one, it gets permanently saved with the new status.

10. Test carefully

Restart:

Ctrl+C
npm run dev

Then:

http://localhost:3000

Analyze a meeting that has action items.

You should see:

Done   Task                    Owner
──────────────────────────────────────
☐      Finish login            Priya
☐      Integrate API           Amit
☐      Update documentation    Amit

Click the first checkbox.

It should become:

☑      Finish login            Priya

and the task should become struck through.

Now refresh the browser.

It should still be checked.

That last test is the critical one. It proves that the status was saved to Supabase rather than merely changed in React state.

Current architecture
                    ┌──────────────┐
                    │  Transcript  │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │    Gemini    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │   Supabase   │
                    └──────┬───────┘
                           ↓
              ┌─────────────────────────┐
              │    Meeting History      │
              └────────────┬────────────┘
                           ↓
                 ┌──────────────────┐
                 │  Action Items    │
                 │                  │
                 │ ☐ Pending        │
                 │ ☑ Completed      │
                 └──────────────────┘

The next logical feature after this is meeting deletion + transcript/detail view, followed by authentication.

how to add to git hub

Yes. Since your project is already in:

C:\Users\udayk\meeting-insights-dashboard

you can push it to GitHub from the VS Code terminal.

1. First, make sure .env.local is NOT committed

Your Gemini and Supabase keys are in .env.local. They must never go to GitHub.

Open:

C:\Users\udayk\meeting-insights-dashboard\.gitignore

Make sure it contains:

.env*

A typical Next.js .gitignore already includes environment files, but verify it.

You can also run:

type .gitignore

and look for:

.env*
Important

Your repository should contain:

src/
public/
package.json
package-lock.json
next.config.ts
tsconfig.json
.gitignore

but not:

.env.local
2. Open the project terminal

In VS Code:

Terminal → New Terminal

Run:

cd C:\Users\udayk\meeting-insights-dashboard

Then check:

git --version

You should get something like:

git version 2.x.x

If Git is not installed, install Git for Windows first:

Download Git

3. Initialize Git

Run:

git init

You should see:

Initialized empty Git repository...
4. Check what will be uploaded

Run:

git status

Look carefully.

You should not see:

.env.local

If .env.local appears in red under "Untracked files", STOP.

Add this to .gitignore:

.env.local
.env
.env.*
!.env.example

Then run:

git status

again.

5. Add your files

Run:

git add .

Then:

git status

You should now see your project files under:

Changes to be committed

Again, verify that .env.local is not included.

6. Make your first commit

Run:

git commit -m "Initial commit"

You should get something similar to:

[master ...] Initial commit
7. Create the GitHub repository

Go to:

GitHub

Sign in.

Click:

New repository

Use:

Repository name:
meeting-insights-dashboard

I recommend:

Public

for a college/project portfolio unless you specifically need it private.

Important

When creating the repository, do not select:

Add a README file
Add .gitignore
Choose a license

Leave those unchecked.

We already have the project locally.

Click:

Create repository

8. Connect your local project to GitHub

GitHub will show commands. Use the repository URL it gives you.

It will look like:

git remote add origin https://github.com/YOUR_USERNAME/meeting-insights-dashboard.git

Run it in VS Code.

Then verify:

git remote -v

You should see your GitHub repository URL.

9. Rename your branch to main

Run:

git branch -M main
10. Push the project

Run:

git push -u origin main

GitHub may ask you to authenticate.

Complete the GitHub sign-in/authentication process.

After it finishes, refresh your GitHub repository page.

Your project should now be visible.

11. Verify the most important security point

On GitHub, look through the repository files.

You should not see:

.env.local

You also should not see your actual:

GEMINI_API_KEY
SUPABASE_SECRET_KEY

If either secret has accidentally been pushed, don't merely delete the file in a later commit. The secret should be revoked/rotated, because Git history may retain it.

Your normal workflow from now on

Whenever we add features:

git status
git add .
git commit -m "Add action item tracking"
git push

For example, after our current feature:

git add .
git commit -m "Add action item completion tracking"
git push

Then GitHub becomes your backup/version history.

Your project structure should eventually look roughly like
meeting-insights-dashboard/
│
├── .gitignore
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
│
├── public/
│
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── analyze/
    │   │   │   └── route.ts
    │   │   └── meetings/
    │   │       └── route.ts
    │   │
    │   ├── page.tsx
    │   └── ...
    │
    └── lib/
        └── supabase/
            ├── client.ts
            └── server.ts

One thing to do before pushing: run git status and confirm .env.local is not listed.

create best readme file 

Created a comprehensive README.md covering the current features, architecture, setup, API routes, database schema, security, usage, roadmap, and GitHub workflow.

Download README.md

Copy it into:

C:\Users\udayk\meeting-insights-dashboard\README.md

Then push it:

git add README.md
git commit -m "Add comprehensive README"
git push

One thing to change before committing: replace Your Name in the Author section with your actual project/author name. 

README.md
Document

Library
/
README.md
Meeting Insights Dashboard

AI-powered meeting intelligence platform that transforms meeting transcripts into structured, actionable insights.

Meeting Insights Dashboard is a full-stack web application built with Next.js, TypeScript, Tailwind CSS, Google Gemini, and Supabase. It analyzes meeting transcripts and extracts the information people usually need after a meeting: summaries, discussion points, decisions, action items, topics, and unanswered questions.

The project is designed as an extensible MVP that can later support audio transcription, authentication, analytics, reminders, and team collaboration.

✨ Features
Current
📝 Paste a meeting transcript directly into the dashboard
📄 Upload .txt and .md transcript files
🤖 AI-powered transcript analysis using Google Gemini
📌 Automatic extraction of:
Meeting summary
Key discussion points
Decisions
Action items
Owners
Deadlines
Priorities
Topics
Questions
💾 Save analyzed meetings to Supabase PostgreSQL
🕘 Meeting history with recently analyzed meetings
🔎 Open previously analyzed meetings without calling Gemini again
✅ Mark action items as completed
🔄 Persist action-item completion status in the database
⚠️ Client-side validation and user-friendly error handling
🔐 Server-side handling of Gemini and Supabase secret credentials
🖥️ Tech Stack
Layer	Technology
Frontend	Next.js + React
Language	TypeScript
Styling	Tailwind CSS
AI	Google Gemini API
AI SDK	@google/genai
Database	Supabase PostgreSQL
Database Client	@supabase/supabase-js
API	Next.js Route Handlers
Development	VS Code + Node.js + npm
Deployment	Vercel (planned)
🏗️ Architecture
                         ┌─────────────────────┐
                         │       User          │
                         │ Transcript / File   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Next.js Frontend  │
                         │   React Dashboard   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   /api/analyze      │
                         │  Next.js API Route  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Google Gemini    │
                         │ Transcript Analysis │
                         └──────────┬──────────┘
                                    │
                              Structured JSON
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Supabase      │
                         │  PostgreSQL / JSONB │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Meeting History   │
                         │ Saved AI Insights   │
                         └─────────────────────┘
📁 Project Structure
meeting-insights-dashboard/
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts
│   │   │   │
│   │   │   └── meetings/
│   │   │       └── route.ts
│   │   │
│   │   ├── page.tsx
│   │   └── ...
│   │
│   └── lib/
│       └── supabase/
│           ├── client.ts
│           └── server.ts
│
├── .env.local              # Local secrets - never commit
├── .gitignore
├── package.json
├── package-lock.json
├── next.config.ts
└── README.md
🚀 Getting Started
Prerequisites

Install the following before running the project:

Node.js
npm
Git
A Google AI Studio / Gemini API key
A Supabase project

Check Node.js and npm:

node --version
npm --version
1. Clone the repository
git clone https://github.com/YOUR_USERNAME/meeting-insights-dashboard.git
cd meeting-insights-dashboard
2. Install dependencies
npm install
3. Configure environment variables

Create a file named:

.env.local

Add:

GEMINI_API_KEY=your_gemini_api_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

SUPABASE_SECRET_KEY=your_supabase_secret_key
Security

Never commit .env.local to GitHub.

The following values must remain private:

GEMINI_API_KEY
SUPABASE_SECRET_KEY

The project intentionally keeps server-side secrets out of client-side code.

4. Create the Supabase table

Open the Supabase SQL Editor and run:

create table meetings (
  id uuid primary key default gen_random_uuid(),

  title text not null default 'Untitled Meeting',

  transcript text not null,

  summary text not null,

  key_points jsonb not null default '[]'::jsonb,

  decisions jsonb not null default '[]'::jsonb,

  action_items jsonb not null default '[]'::jsonb,

  topics jsonb not null default '[]'::jsonb,

  questions jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);
5. Run the development server
npm run dev

Open:

http://localhost:3000
🧪 How to Use
Analyze a meeting
Enter a meeting title.
Paste the transcript or upload a .txt / .md file.
Click Analyze Meeting.
Gemini analyzes the transcript.
The dashboard displays the extracted insights.
The meeting is saved to Supabase automatically.
Review previous meetings

Open a meeting from Recent Meetings to load its saved insights from the database.

Manage action items

Action items can be marked:

☐ Pending
☑ Completed

Completion changes are stored in Supabase and remain after refreshing the page.

📊 AI Output

The analysis API produces a structured object similar to:

{
  "summary": "The team agreed on the project timeline and assigned implementation tasks.",
  "keyPoints": [
    "Frontend work must be completed by Friday.",
    "Authentication integration is assigned to the backend developer."
  ],
  "decisions": [
    "Use the existing authentication service instead of building a new one."
  ],
  "actionItems": [
    {
      "task": "Complete login and registration pages",
      "owner": "Priya",
      "deadline": "Thursday",
      "priority": "Medium",
      "completed": false
    }
  ],
  "topics": [
    "Frontend",
    "Authentication",
    "Testing"
  ],
  "questions": []
}

The application validates the structure before returning the result to the frontend.

🔌 API Routes
POST /api/analyze

Analyzes a meeting transcript and saves the resulting insights.

Request
{
  "title": "Frontend Project Meeting",
  "transcript": "Meeting transcript..."
}
Response
{
  "summary": "...",
  "keyPoints": [],
  "decisions": [],
  "actionItems": [],
  "topics": [],
  "questions": [],
  "meetingId": "uuid",
  "createdAt": "timestamp"
}
GET /api/meetings

Returns saved meetings ordered from newest to oldest.

Response
{
  "meetings": []
}
PATCH /api/meetings

Updates completion status for an action item.

Request
{
  "meetingId": "meeting-uuid",
  "actionIndex": 0,
  "completed": true
}
🗄️ Database Design

The MVP uses a single meetings table.

meetings
Column	Type	Purpose
id	UUID	Unique meeting identifier
title	TEXT	Meeting name
transcript	TEXT	Original transcript
summary	TEXT	AI-generated summary
key_points	JSONB	Important discussion points
decisions	JSONB	Decisions made
action_items	JSONB	Tasks, owners, deadlines, priorities, completion status
topics	JSONB	Main topics
questions	JSONB	Important unanswered questions
created_at	TIMESTAMPTZ	Creation timestamp

The JSONB fields keep the initial schema simple while preserving the structured AI output.

🛡️ Security Notes

This project handles API credentials on the server.

Never do this
NEXT_PUBLIC_GEMINI_API_KEY=...
NEXT_PUBLIC_SUPABASE_SECRET_KEY=...

Do not expose secret credentials through NEXT_PUBLIC_* variables.

Before pushing to GitHub

Run:

git status

Confirm that:

.env.local

does not appear in the files being committed.

🧭 Roadmap
Phase 1 — MVP ✅

Transcript input

Text/Markdown upload

Gemini analysis

Structured AI response

Summary

Key points

Decisions

Action items

Topics

Questions

Phase 2 — Persistence ✅

Supabase integration

Save meetings

Meeting history

Meeting titles

Action-item completion tracking

Phase 3 — Product Features

Delete meetings

Dedicated meeting-detail page

Search meetings

Filter and sort meetings

Edit meeting title

Edit action items

Export meeting insights

Phase 4 — Audio Intelligence

Audio upload

Speech-to-text transcription

Speaker identification

Automatic meeting title generation

Timestamped action items

Phase 5 — Accounts & Collaboration

User authentication

User-specific meetings

Team workspaces

Meeting sharing

Role-based permissions

Phase 6 — Advanced Intelligence

Meeting analytics

Recurring-topic detection

Action-item reminders

Search across all meetings

AI follow-up generation

Meeting trend analysis

Phase 7 — Deployment

Production environment variables

Supabase production configuration

Vercel deployment

Production testing

Monitoring and error tracking

💡 Why This Project?

Meetings generate large amounts of unstructured information. Important decisions and tasks are often buried inside long conversations.

This project converts that unstructured transcript into a structured workspace:

Raw Transcript
      ↓
AI Analysis
      ↓
┌───────────────────────────┐
│ Summary                   │
│ Key Points                │
│ Decisions                 │
│ Action Items              │
│ Topics                    │
│ Questions                 │
└───────────────────────────┘
      ↓
Persistent Meeting History
      ↓
Actionable Follow-up

The goal is not merely to summarize meetings, but to turn conversations into trackable outcomes.

🎯 Project Goals

The project is being developed around four principles:

Accuracy — extract information supported by the transcript rather than inventing details.
Actionability — surface tasks, owners, deadlines, and decisions.
Persistence — keep meeting insights available after the current session.
Extensibility — provide a foundation for audio, authentication, analytics, and collaboration.
📌 Current Status

Project: Meeting Insights Dashboard

Stage: Functional MVP

Working pipeline:

Transcript
    ↓
Next.js
    ↓
Gemini
    ↓
Structured Insights
    ↓
Supabase
    ↓
Meeting History
    ↓
Action Tracking
🤝 Contributing

This project is currently being developed as a personal/academic project.

For major changes:

Create a branch.
Make the change.
Test the application.
Commit with a clear message.
Open a pull request.

Example:

git checkout -b feature/audio-upload
git add .
git commit -m "Add audio upload support"
git push -u origin feature/audio-upload
📄 License

This project does not currently specify a license.

Add a license before publishing the project for broader reuse.

👨‍💻 Author

Your Name

Built with:

Next.js
React
TypeScript
Tailwind CSS
Google Gemini
Supabase
