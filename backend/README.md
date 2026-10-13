# Stomatologija Krsmanovic — Backend

Express + Neon PostgreSQL + Socket.IO + Google Gemini.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL and GEMINI_API_KEY
npm run db:init        # applies src/db/schema.sql to your Neon database
npm run dev            # starts API + Socket.IO with --watch
```

> The dev server defaults to **port 5050** (macOS AirPlay tends to occupy 5000).

## Environment

| Var | Description |
| --- | --- |
| `PORT` | HTTP/Socket port (default 5050) |
| `CLIENT_URL` | Frontend origin for CORS + Socket (default `http://localhost:5173`) |
| `DATABASE_URL` | Neon pooled connection string (`?sslmode=require`) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing secret / lifetime |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini key / model (default `gemini-2.0-flash`) |

## REST API

All routes are prefixed with `/api`. Authenticated routes need `Authorization: Bearer <token>`.

### Auth
- `POST /auth/register` `{ name, email, password }` → `{ user, token }`
- `POST /auth/login` `{ email, password }` → `{ user, token }`
- `GET  /auth/me` → `{ user }`

### Users
- `GET /users/search?q=` → `{ users }` (for assignees / invites)

### Boards
- `GET    /boards` → boards owned by or shared with you
- `POST   /boards` `{ title, description?, color? }` (auto-creates Todo / In Progress / Review / Done)
- `GET    /boards/:boardId` → `{ board, columns, tasks, members, role }`
- `PATCH  /boards/:boardId` `{ title?, description?, color? }`
- `DELETE /boards/:boardId` (owner only)
- `GET    /boards/:boardId/activity?limit=`
- `POST   /boards/:boardId/members` `{ email, role? }`
- `DELETE /boards/:boardId/members/:userId`

### Columns
- `POST   /boards/:boardId/columns` `{ title }`
- `PATCH  /boards/:boardId/columns/:columnId` `{ title?, position? }`
- `DELETE /boards/:boardId/columns/:columnId`

### Tasks
- `GET    /boards/:boardId/tasks?priority=&assignee=&column=&q=`
- `POST   /boards/:boardId/tasks` `{ column_id, title, description?, priority?, due_date?, assignee_id? }`
- `PATCH  /boards/:boardId/tasks/:taskId` (any task field)
- `PATCH  /boards/:boardId/tasks/:taskId/move` `{ column_id, position }`
- `DELETE /boards/:boardId/tasks/:taskId`

### AI (Gemini)
- `POST /boards/:boardId/ai/generate-tasks` `{ goal, count?, column_id? }` — returns suggestions; if `column_id` given, persists them
- `POST /boards/:boardId/ai/breakdown` `{ taskId } | { title, description?, count? }` → `{ subtasks }`
- `POST /boards/:boardId/ai/summary` → `{ summary: { headline, completed, inProgress, risks, recommendations } }`

## Socket.IO

Connect with `auth: { token }`. Events:

- **Client → server:** `board:join(boardId, ack)`, `board:leave(boardId)`, `presence:cursor({ boardId, x, y })`
- **Server → client:** `task:created` · `task:updated` · `task:moved` · `task:deleted` · `column:created/updated/deleted` · `board:updated/deleted` · `activity:new` · `presence:join/leave/cursor`

All board mutations broadcast to the room `board:<boardId>`.
