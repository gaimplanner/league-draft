# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.2.2 - Frontend React application (`src/` directory)
- Python 3.13 - Django backend (`server/` directory)

**Secondary:**
- JavaScript - Configuration files (Vite, Tailwind, PostCSS, Playwright)
- SQL - PostgreSQL database queries via ORM

## Runtime

**Environment:**
- Node.js - Frontend runtime (specified via `.nvmrc` or inferred from npm scripts)
- Python 3.13 - Backend runtime in Docker container

**Package Manager:**
- npm - Frontend dependency management
- pip - Python dependency management
- Lockfile: `package-lock.json` (implied from `npm` usage)

## Frameworks

**Frontend:**
- React 18.2.0 - UI framework with hooks (functional components)
- Vite 5.0.8 - Frontend build tool and dev server
- TypeScript 5.2.2 - Type safety for React components

**Backend:**
- Django 5.2.7 - Web framework for API
- django-cors-headers 4.4.0 - Cross-origin request handling
- dj-database-url 2.2.0 - Database URL parsing

**Styling:**
- Tailwind CSS 3.3.6 - Utility-first CSS framework (`tailwind.config.js` at project root)
- PostCSS 8.4.32 - CSS transformation (`postcss.config.js`)
- Autoprefixer 10.4.16 - Vendor prefix automation

**Testing:**
- Playwright 1.57.0 - E2E testing framework
  - Config: `playwright.config.ts`
  - Tests in: `e2e/` directory
  - Run with: `npm run test:e2e`

**Linting & Code Quality:**
- ESLint 8.55.0 - JavaScript/TypeScript linting
- @typescript-eslint/parser 6.14.0 - TypeScript parsing for ESLint
- @typescript-eslint/eslint-plugin 6.14.0 - TypeScript ESLint rules
- eslint-plugin-react-hooks 4.6.0 - React hooks best practices
- eslint-plugin-react-refresh 0.4.5 - React refresh compatibility

## Key Dependencies

**Frontend - Critical:**
- react 18.2.0 - Core UI framework
- react-dom 18.2.0 - DOM rendering
- lucide-react 0.294.0 - SVG icon library
- papaparse 5.4.1 - CSV parsing for import flows
- xlsx 0.18.5 - Excel/XLSX file parsing for imports

**Backend - Critical:**
- Django 5.2.7 - Web framework with built-in ORM, auth, sessions
- psycopg[binary] 3.2.3 - PostgreSQL database adapter
- gunicorn 22.0.0 - WSGI application server for production
- pydantic 2.9.2 - Data validation for input validators
- python-dotenv 1.0.1 - Environment variable loading
- django-cors-headers 4.4.0 - CORS middleware
- dj-database-url 2.2.0 - Database URL configuration

## Configuration

**Environment:**
- Frontend: `.env.local` for Vite variables
  - `VITE_USE_API`: Boolean to enable API mode (set to `true` for API-backed mode, `false` for localStorage)
  - `VITE_API_URL`: API base URL (defaults to `http://localhost:3001/api` in dev, `http://localhost:8000/api` in docker)
- Backend: `server/.env` for Django configuration
  - `DATABASE_URL`: PostgreSQL connection string
  - `DEBUG`: Debug mode (true for dev, false for production)
  - `SECRET_KEY`: Django secret key
  - `ALLOWED_HOSTS`: Comma-separated allowed hosts
  - `CORS_ALLOWED_ORIGINS`: Comma-separated CORS origins
  - `FRONTEND_URL`: Frontend URL for password reset links

**Build:**
- `vite.config.ts` - Vite configuration with React plugin
- `tsconfig.json` - TypeScript compiler options (target ES2020, strict mode enabled)
- `playwright.config.ts` - E2E test configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS plugin configuration

## Database

**Primary:**
- PostgreSQL 16-alpine - Relational database
  - Runs in Docker via `postgres:16-alpine` image
  - Connection pooling via `dj-database-url` with `conn_max_age=600`
  - Health checks enabled in docker-compose

**ORM:**
- Django ORM - Built-in Django models
  - Models at: `server/draft/models.py`
  - Migrations: `server/draft/migrations/`
  - Uses UUIDs as primary keys for all models

## Development Tools

**Frontend:**
- Vite - Development server with hot module replacement
  - Run with: `npm run dev` (serves on `http://localhost:5173`)
- TypeScript compiler - Type checking via `npm run build`
- Playwright Test UI - `npm run test:e2e:ui` for interactive test debugging

**Backend:**
- Django development server - `python manage.py runserver 0.0.0.0:8000`
- Django shell - `docker compose exec api python manage.py shell`
- Django management commands - Custom commands like `seed_e2e` for test data

**Containerization:**
- Docker - Multi-stage Dockerfile for development and production builds
- Docker Compose - Orchestrates backend (Django + PostgreSQL)
  - Services: `db` (PostgreSQL) and `api` (Django)
  - Frontend runs locally via `npm run dev` (not containerized)

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- Python 3.13+
- Docker and Docker Compose
- PostgreSQL 16 (via Docker)
- macOS/Linux/Windows with Docker support

**Production:**
- Deployment target: Docker containers
  - Frontend: Static files served via web server (Vite build output)
  - Backend: Gunicorn WSGI server on port 8000
  - Database: PostgreSQL 16
- Requires environment variables configured for production (SECRET_KEY, DEBUG=false, etc.)

---

*Stack analysis: 2026-01-29*
