# Calendar-Task Sync

A Next.js background orchestrator that automatically syncs tasks from [Tududi](https://github.com/chrisvel/tududi) (self-hosted task manager) to Google Calendar. Tasks are intelligently ranked by priority, type (Focus/Noise), and project, then scheduled into calendar gaps with Pomodoro-style break events.

## Features

### Core Functionality
- **Automatic Task Scheduling**: Fetches tasks from Tududi and schedules them into Google Calendar gaps
- **Smart Task Ranking**: Weighted scoring algorithm considers:
  - Priority (35%): High/medium/low priority weighting
  - Task Type (20%): Focus vs Noise tasks
  - Project Importance (20%): Per-project weighting
  - Urgency (15%): Based on due dates
  - Energy Level (10%): Focus tasks get higher energy scores
- **Energy-Aware Scheduling**: Focus tasks are prioritized for peak hours (configurable), Noise tasks fill remaining gaps
- **Pomodoro Break Events**: Automatic break insertion:
  - 15-minute breaks after tasks < 1 hour
  - 30-minute breaks after tasks ≥ 1 hour
- **Emoji Status Tracking**: Visual indicators in task names:
  - 📅 Task scheduled to calendar
  - ⚠️ Problem detected (event deleted or overdue)
  - ❌ Past due date
- **Automatic Re-scheduling**: Incomplete tasks are automatically re-scheduled with priority boost after configurable timeout (default: 12 hours)

### Configuration Options
- **Per-Project Calendar Mapping**: Different projects can sync to different Google Calendars
- **Customizable Scheduling Windows**: Set different hours for each day of the week
- **Peak Hours**: Define your most productive hours for Focus tasks
- **Duration Matrix**: Configure estimated task duration by type and priority
- **Ranking Weights**: Adjust the algorithm to match your workflow
- **Sync Interval**: Configure how often the sync runs (default: 15 minutes)

### Technical Features
- **SQLite Database**: Local storage for sync state and configuration
- **Background Sync**: node-cron scheduler runs automatically
- **Mutex Protection**: Prevents concurrent sync cycles
- **Idempotent Operations**: Safe to retry without duplicates
- **Health Monitoring**: Built-in health check endpoint
- **Docker Ready**: Production deployment with Docker Compose

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: SQLite with Drizzle ORM
- **Scheduler**: node-cron
- **Authentication**: Google OAuth2
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **Deployment**: Docker Compose

## Prerequisites

- Docker and Docker Compose
- Google Cloud Console account (for OAuth credentials)
- Tududi instance (self-hosted)

## Quick Start

### 1. Clone and Configure

```bash
git clone <repository-url>
cd calendar-task-sync

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Configure Environment Variables

Edit `.env` with your settings:

```env
# Database (default is fine for Docker)
DATABASE_URL=/app/data/app.db

# Google OAuth - Required
# Get these from Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Tududi API - Optional (can configure in UI)
TUDUDI_API_KEY=your_tududi_api_key
TUDUDI_API_URL=https://your-tududi-instance.com/api/v1

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=production
```

### 3. Start with Docker Compose

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Check health
curl http://localhost:3000/api/health
```

### 4. Initial Setup

1. Open http://localhost:3000 in your browser
2. Go to **Settings**
3. Configure Tududi connection (API URL and key)
4. Connect Google Calendar account
5. Set up calendar mappings and scheduling preferences
6. Click **"Sync Now"** or wait for automatic sync

## Project Structure

```
calendar-task-sync/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # Dashboard UI
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── settings/       # Configuration page
│   │   │   └── layout.tsx      # Dashboard layout
│   │   ├── api/                # API routes
│   │   │   ├── auth/google/    # OAuth endpoints
│   │   │   ├── dashboard/      # Dashboard data API
│   │   │   ├── health/         # Health check
│   │   │   └── sync/           # Manual sync trigger
│   │   └── actions/            # Server actions
│   ├── db/                     # Database schema & client
│   │   ├── schema.ts           # Drizzle ORM schema
│   │   └── index.ts            # Database client
│   ├── lib/                    # Core libraries
│   │   ├── engine/             # Scheduling engine (pure functions)
│   │   │   ├── ranker.ts       # Task ranking algorithm
│   │   │   ├── gap-finder.ts   # Calendar gap detection
│   │   │   ├── scheduler.ts    # Task placement
│   │   │   ├── emoji.ts        # Emoji prefix management
│   │   │   └── types.ts        # Type definitions
│   │   ├── tududi/             # Tududi API client
│   │   ├── google/             # Google OAuth & Calendar
│   │   └── sync/               # Sync orchestrator
│   │       ├── orchestrator.ts # Main sync loop
│   │       ├── mutex.ts        # Concurrency protection
│   │       └── db-operations.ts # Database operations
│   └── __tests__/              # Unit tests
├── instrumentation.ts          # Cron initialization
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Docker Compose config
└── .env.example                # Environment template
```

## Configuration Guide

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Configure consent screen (External type for personal use)
6. Add scopes: `https://www.googleapis.com/auth/calendar` and `https://www.googleapis.com/auth/calendar.events`
7. Create OAuth client ID (Web application type)
8. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
9. Copy Client ID and Client Secret to `.env`

### Tududi Setup

1. Ensure your Tududi instance is accessible
2. Generate an API key from Tududi settings
3. Note your Tududi API base URL (e.g., `https://tududi.example.com/api/v1`)
4. Configure in the app Settings page

### Scheduling Configuration

In the **Settings** page, you can configure:

- **Calendar Mappings**: Map each Tududi project to a Google Calendar
- **Scheduling Windows**: Set available hours per day
- **Peak Hours**: Your most productive time for Focus tasks
- **Duration Matrix**: Estimated time for tasks by type/priority
- **Break Rules**: Configure break durations
- **Ranking Weights**: Adjust task scoring algorithm
- **Sync Settings**: Interval, timezone, and re-schedule timeout

## How It Works

1. **Background Sync**: node-cron runs the sync cycle at configured intervals
2. **Fetch Tasks**: Retrieves tasks from Tududi API (filtered by due date and status)
3. **Rank Tasks**: Applies weighted scoring to prioritize tasks
4. **Find Gaps**: Queries Google Calendar free/busy to find available slots
5. **Schedule**: Places tasks in calendar gaps, respecting peak hours and breaks
6. **Update Tududi**: Adds 📅 emoji prefix to scheduled task names
7. **Monitor**: On next sync, checks for completions and overdue tasks
8. **Re-schedule**: Automatically re-schedules incomplete tasks after timeout

## API Endpoints

- `GET /api/health` - Health check with sync status
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/sync/trigger` - Manual sync trigger
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/scheduled` - Scheduled tasks list
- `GET /api/dashboard/activity` - Recent activity

## Development

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Set up database
npx drizzle-kit push

# Seed default config
npm run db:seed

# Run dev server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Database Management

```bash
# Open Drizzle Studio
npm run db:studio

# Push schema changes
npm run db:push
```

## Testing

The project includes comprehensive unit tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/__tests__/engine/ranker.test.ts
```

**Test Coverage**:
- Engine: 90.59% (ranker, gap-finder, scheduler, emoji)
- Google: 85.67% (OAuth, Calendar API)
- Total: 87 tests passing

## Deployment

### Docker Compose (Recommended)

```bash
# Production deployment
docker compose up -d

# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down
```

### Manual Deployment

1. Build the application: `npm run build`
2. Set environment variables
3. Start with: `node .next/standalone/server.js`

## Troubleshooting

### Sync not running
- Check health endpoint: `curl http://localhost:3000/api/health`
- Verify cron is initialized in logs
- Check Google OAuth connection in Settings

### Tasks not scheduling
- Verify Tududi API credentials
- Check Google Calendar has available slots
- Review duration matrix settings
- Check sync logs for errors

### Database issues
- Ensure `./data` directory exists and is writable
- Check SQLite WAL mode is enabled
- Verify DATABASE_URL path

## Architecture Decisions

- **Pure Scheduling Engine**: Core algorithm has no side effects, making it fully testable
- **SQLite**: Lightweight, zero-config database perfect for single-user deployment
- **No Provider Abstraction**: Direct Google Calendar integration keeps code simple
- **Single-User**: No authentication layer needed for personal use
- **instrumentation.ts**: Canonical Next.js pattern for background jobs in standalone mode

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please ensure:
- TypeScript compiles without errors (`npx tsc --noEmit`)
- All tests pass (`npm test`)
- Follow existing code patterns
- Add tests for new features

## Support

For issues and feature requests, please use the GitHub issue tracker.
