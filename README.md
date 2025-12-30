# Chess Atlas

A modern web application to discover and explore chess tournaments across India. Data is sourced from [AICF](https://aicf.in/all-events/).

## Features

- **Live Event Directory**: Browse all AICF-registered chess tournaments
- **Smart Filtering**: Filter by state, time control, date range
- **PDF Parsing**: Automatically extracts prize money, rounds, and other details from brochures using AI
- **Dark/Light Theme**: Professional UI with theme toggle
- **Responsive Design**: Works on desktop, tablet, and mobile

## Project Structure

```
chessatlas/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── db/       # SQLite database layer
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Scraper & PDF parser
│   │   └── types/    # TypeScript types
│   └── data/         # SQLite database file
└── frontend/         # React + Vite + shadcn/ui
    └── src/
        ├── components/
        ├── hooks/
        └── lib/
```

## Setup

### Prerequisites

- Node.js 18+
- npm or pnpm

### Backend

```bash
cd backend
npm install

# Set environment variables
export OPENAI_API_KEY=your_key_here

# Run initial scrape
npm run scrape

# Start the server
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on port 3001.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Get all events (supports filters) |
| GET | `/api/events/:eventCode` | Get single event |
| GET | `/api/events/filters` | Get available filter options |
| GET | `/api/events/stats` | Get event statistics |
| POST | `/api/scrape` | Trigger manual scrape |
| POST | `/api/parse-pdfs` | Trigger PDF parsing |

### Query Parameters for `/api/events`

- `state` - Filter by state
- `city` - Filter by city
- `timeControl` - Filter by time control (Classical/Rapid/Blitz)
- `startDateFrom` - Filter events starting from date
- `startDateTo` - Filter events starting until date
- `search` - Full-text search on name, city, state

## Scheduled Jobs

The backend runs automated jobs:
- **Scraping**: Every 6 hours
- **PDF Parsing**: Every 12 hours

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default: 3001) |
| `OPENAI_API_KEY` | OpenAI API key for PDF parsing |

## Tech Stack

**Backend:**
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- Cheerio (web scraping)
- OpenAI API (PDF parsing)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- shadcn/ui components
- TanStack Query
- Lucide icons
