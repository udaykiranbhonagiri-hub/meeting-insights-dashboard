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

Layer

Technology

Frontend

Next.js + React

Language

TypeScript

Styling

Tailwind CSS

AI

Google Gemini API

AI SDK

@google/genai

Database

Supabase PostgreSQL

Database Client

@supabase/supabase-js

API

Next.js Route Handlers

Development

VS Code + Node.js + npm

Deployment

Vercel (planned)

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

Column

Type

Purpose

id

UUID

Unique meeting identifier

title

TEXT

Meeting name

transcript

TEXT

Original transcript

summary

TEXT

AI-generated summary

key_points

JSONB

Important discussion points

decisions

JSONB

Decisions made

action_items

JSONB

Tasks, owners, deadlines, priorities, completion status

topics

JSONB

Main topics

questions

JSONB

Important unanswered questions

created_at

TIMESTAMPTZ

Creation timestamp

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
