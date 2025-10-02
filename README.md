# Hypertrophy Workout Tracker

A lightweight hypertrophy-focused workout tracker built for a Raspberry Pi deployment. It features a small MySQL schema, an Express API, and a React front end for quickly logging hypertrophy sessions for two local users.

## Tech Stack

- **Backend:** Node.js (Express) + mysql2
- **Frontend:** React (Vite) + Chart.js via `react-chartjs-2`
- **Database:** MySQL 8.x with simple inline SQL (no ORM)

## Project Structure

```
app/
  client/   # React + Vite frontend
  server/   # Express API server
```

## Requirements

- Node.js 20+
- MySQL 8.x

Optional (for development): Docker with docker-compose.

## Setup

### Backend

```bash
cd app/server
cp .env.example .env
# update credentials to match your MySQL instance
npm install
npm run start
```

On startup the server ensures the `hypertrophy` database exists, creates the schema, and seeds the two default profiles plus the weekly plan.

### Frontend

```bash
cd app/client
npm install
npm run dev
```

During development the client expects the API at `http://localhost:3001`. Override by defining `VITE_API_URL` in a `.env` file inside `app/client`.

### Database

The server seeds the schema automatically. If you prefer manual control, use the SQL found in `app/server/src/initDb.js` to recreate the tables and seed data.

## Key Features

- Two default profiles (Male/Female) with hypertrophy-focused 4-day split
- Week plan view showing all 7 days (Mon–Sun) with rest days highlighted
- Stats dashboard with weekly training volume and estimated 1RM trends (Epley formula)
- Today’s workout flow with per-set logging, exercise skip, session notes, and ability to complete or skip the day
- Inline SQL queries for clarity and easy debugging

## Production Notes

- Designed for a Raspberry Pi: no heavy dependencies, no external services
- CORS is restricted to the configured `CLIENT_ORIGIN`
- Uses a single MySQL database schema `hypertrophy`
- Sessions enforce one-per-day per profile via a unique index and server-side checks

Enjoy the training!
