# Project Camp

A production-minded project management app with an Express/MongoDB backend and a dependency-free frontend served from `public/`.

## Features

- JWT auth with access and refresh tokens
- Email verification and password reset flows
- Project CRUD with role-based membership
- Task, subtask, note, and attachment management
- Centralized validation and error responses
- Basic security headers, CORS, rate limiting, and graceful shutdown
- Static frontend for auth, projects, members, tasks, subtasks, and notes

## Getting Started

1. Copy `.env.example` to `.env`.
2. Fill in MongoDB, JWT, and optional Mailtrap values.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev      # start with nodemon
npm start        # start production server
npm run check    # verify the app imports
npm test         # run Node test suite
npm run lint     # check formatting
npm run format   # format the project
```

On Windows PowerShell, use `npm.cmd run dev` if script execution policy blocks `npm`.

## API Base

All API routes live under `/api/v1`.

- `/auth`: register, login, logout, current user, refresh token, email verification, password reset
- `/projects`: project CRUD and member management
- `/tasks`: project tasks, subtasks, assignment, statuses, attachments
- `/notes`: project notes
- `/healthcheck`: service health

## Learning Path

Study the project in this order:

1. Models in `src/models`
2. Validation in `src/validators`
3. Auth and permission middleware in `src/middlewares`
4. Controllers in `src/controllers`
5. Routes in `src/routes`
6. Frontend API calls in `public/app.js`

That order mirrors how a request moves through the app.
