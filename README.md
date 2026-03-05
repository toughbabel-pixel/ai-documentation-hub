# AI Documentation Hub

A full-stack web application for managing AI-focused documentation assets.

## Features
- Prompt library
- Workflow documentation
- Tool directory
- Experiment logs
- AI Assistant powered by OpenAI API:
  - Improve prompts
  - Generate workflows
  - Generate documentation summaries

## Tech Stack
- Frontend: HTML, Tailwind CSS, JavaScript
- Backend: Node.js + Express
- Database: SQLite

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Then set `OPENAI_API_KEY`.
3. Start the app:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`.

## API Endpoints
### Core data
- `GET /api/prompts`
- `POST /api/prompts`
- `GET /api/workflows`
- `POST /api/workflows`
- `GET /api/tools`
- `POST /api/tools`
- `GET /api/experiments`
- `POST /api/experiments`

### AI capabilities
- `POST /api/ai/improve-prompt`
- `POST /api/ai/generate-workflow`
- `POST /api/ai/summarize-docs`

## Notes
- SQLite database file `hub.db` is auto-created at runtime.
- Seed data is inserted on first startup.
- AI endpoints return an error if `OPENAI_API_KEY` is missing.
