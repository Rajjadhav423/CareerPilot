# CareerPilot

A personal AI-powered job search and application manager.

CareerPilot helps you find relevant job openings, understand job descriptions, tailor your resume truthfully for each role, and keep track of applications and follow-ups, all in one place.

> **Status:** Early development. The frontend and backend have been set up. Features are being built in phases (see [Roadmap](#roadmap)).

## Why

Job hunting means juggling dozens of postings, resume versions, emails and follow-up dates. CareerPilot brings that into one workflow:

1. Paste a job link or enter the job details manually.
2. Review the extracted company, title, location, requirements and application link.
3. Compare the job against your verified skills, experience and base resume.
4. Get an explainable match summary covering strong matches, gaps, and reasons to apply or skip.
5. Generate a tailored resume and application email draft.
6. Edit and approve before anything is sent.
7. Track status, outcomes and follow-up dates.

## Principles

- **Human-in-the-loop:** the system prepares materials, and you review and approve every email or submission.
- **Truthful output:** never invents experience, qualifications, employers, metrics or education.
- **Responsible automation:** uses only permitted job sources and APIs, with no unrestricted scraping and no blind mass-applying.
- **Privacy first:** runs on localhost, keeps secrets out of source control, and requests minimal permissions from Google and other integrations.

## Tech stack

| Layer    | Technology                                      | Folder    |
|----------|-------------------------------------------------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS  | `client/` |
| Backend  | Java 21, Spring Boot, Gradle                    | `server/` |
| Database | PostgreSQL *(planned)*                          | —         |

**Architecture:** Next.js UI → Spring Boot REST API (`/api/v1`) → services → repositories → PostgreSQL.
The backend isolates AI, Gmail, job-source and notification integrations behind dedicated components.

## Project structure

```
JobAIAgent/
├── client/   # Next.js frontend
└── server/   # Spring Boot backend
```

## Getting started

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/)
- JDK 21

### Run the frontend

```bash
cd client
pnpm install
pnpm dev
```

The app runs at http://localhost:3000.

### Run the backend

```bash
cd server
./gradlew bootRun      # on Windows: gradlew.bat bootRun
```

The API runs at http://localhost:8080.
