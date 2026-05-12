# CyberAware — Developer Manual

> **Audience:** This document is written for future developers taking over the CyberAware codebase. It assumes familiarity with JavaScript, Node.js, and general web application concepts, but no prior knowledge of this system's specific design or architecture. Follow this guide to set up the application locally and continue development.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Deploying to Vercel](#deploying-to-vercel)
- [Running Tests](#running-tests)
- [API Endpoints](#api-endpoints)
  - [GET /cves](#get-cves)
  - [GET /watchlist](#get-watchlist)
  - [POST /watchlist](#post-watchlist)
  - [DELETE /watchlist/:cveId](#delete-watchlistcveid)
  - [GET /breach/:email](#get-breachemail)
- [Known Bugs & Limitations](#known-bugs--limitations)
- [Roadmap / Future Development](#roadmap--future-development)

---

## Project Overview

CyberAware is a full-stack web application that acts as a filter and translation layer between the [National Vulnerability Database (NVD)](https://nvd.nist.gov) and end users. The backend is a Node.js/Express server that fetches data from external APIs, simplifies it, and exposes clean endpoints to the frontend. The frontend is plain HTML/CSS/JavaScript served as static files.

**External services this app depends on:**

| Service | Purpose | Auth Required |
|---------|---------|--------------|
| [NVD API 2.0](https://nvd.nist.gov/developers/vulnerabilities) | CVE vulnerability data | No |
| [XposedOrNot API](https://xposedornot.com/api_doc) | Email breach checking | No |
| [Supabase](https://supabase.com) | Watchlist database (PostgreSQL) | Yes — anon key |

---

## Repository Structure

```
CyberAware/
├── public/                  # Static frontend files served by Express
│   ├── index.html           # Dashboard — CVE search, filters, watchlist
│   ├── breach.html          # Breach Check page (XposedOrNot API)
│   ├── about.html           # About page — project overview & tech stack
│   ├── help.html            # Help page — user guide & FAQ
│   └── style.css            # Global stylesheet (CSS variables, components)
│
├── docs/
│   └── README.md            # This file — developer manual
│
├── index.js                 # Express server — all API routes & Supabase logic
├── package.json             # Project metadata & npm dependencies
├── package-lock.json        # Locked dependency versions
├── nodemon.json             # Nodemon config (watches js, html, css, json)
├── vercel.json              # Vercel deployment config
├── .env                     # Environment variables (not committed — create manually)
└── README.md                # Project README — overview, tech stack, target browsers
```

---

## Installation

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes bundled with Node.js)
- A [Supabase](https://supabase.com/) account with a project set up

### Step 1 — Clone the Repository

```bash
git clone https://github.com/lambTBIA/CyberAware.git
cd CyberAware
```

### Step 2 — Install Dependencies

```bash
npm install
```

This installs all packages listed in `package.json`, including:

| Package | Purpose |
|---------|---------|
| `express` | Web server framework |
| `@supabase/supabase-js` | Supabase database client |
| `dotenv` | Loads environment variables from `.env` |
| `body-parser` | Parses incoming JSON request bodies |
| `nodemon` | Auto-restarts server on file changes (dev only) |

### Step 3 — Set Up Environment Variables

Create a `.env` file in the **project root** (same level as `index.js`):

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

To find these values:
1. Log in to [supabase.com](https://supabase.com)
2. Open your project → **Settings** → **API**
3. Copy the **Project URL** and the **anon / public** key

> ⚠️ Never commit your `.env` file to GitHub. It is already listed in `.gitignore`.

### Step 4 — Set Up the Supabase Database

In your Supabase project, go to the **SQL Editor** and run the following to create the watchlist table:

```sql
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  cve_id text unique not null,
  description text,
  score numeric,
  severity text,
  saved_at timestamptz default now()
);
```

---

## Running the Application

### Development (with auto-reload)

```bash
npm start
```

This runs `nodemon` which watches all `.js`, `.html`, `.css`, and `.json` files and automatically restarts the server when any of them change.

The server will be available at: [http://localhost:3000](http://localhost:3000)

### Production (without nodemon)

```bash
node index.js
```

### Verifying It Works

Once running, open your browser and check the following:

| URL | Expected Result |
|-----|----------------|
| `http://localhost:3000` | Dashboard loads |
| `http://localhost:3000/cves?keyword=apache` | Returns JSON CVE data |
| `http://localhost:3000/watchlist` | Returns JSON array (empty or with saved CVEs) |
| `http://localhost:3000/breach/test@example.com` | Returns breach check result |

---

## Deploying to Vercel

The project is configured for Vercel deployment via `vercel.json`.

### Steps

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**
3. Import the `CyberAware` repository
4. Under **Environment Variables**, add:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_KEY` — your Supabase anon key
5. Click **Deploy**

> Vercel will automatically redeploy whenever you push to the `main` branch.

---

## Running Tests

No automated test suite is currently implemented. The `npm test` command will return an error by design:

```bash
npm test
# → "Error: no test specified"
```

### Manual Testing Guide

Use a browser or a tool like [Postman](https://www.postman.com/) to test each endpoint manually:

| Endpoint | Method | Test |
|----------|--------|------|
| `/cves?keyword=windows` | GET | Should return a list of CVE objects |
| `/cves?keyword=apache&severity=CRITICAL` | GET | Should return only CRITICAL CVEs |
| `/watchlist` | GET | Should return an array (empty if nothing saved) |
| `/watchlist` | POST | Send `{ "cve_id": "CVE-2025-0001", "description": "test", "score": 9.8, "severity": "CRITICAL" }` — should return the inserted row |
| `/watchlist/CVE-2025-0001` | DELETE | Should return `{ "message": "CVE-2025-0001 removed from watchlist" }` |
| `/breach/test@example.com` | GET | Should return `{ "breached": false, "breaches": [] }` or a list of breach names |

---

## API Endpoints

All endpoints are defined in `index.js` and served by the Express server.

---

### `GET /cves`

Fetches CVEs from the NVD API 2.0, simplifies the response, and returns a JSON array sorted by newest published date.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `keyword` | string | — | Vendor or software name to search (e.g. `windows`, `apache`) |
| `severity` | string | — | Filter by CVSS severity: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| `limit` | number | `20` | Max results (only applies when `recent=false`) |
| `recent` | string | `"true"` | When `"true"`, restricts to CVEs published in the past 14 days |

**Example Request:**
```
GET /cves?keyword=chrome&severity=CRITICAL
```

**Example Response:**
```json
{
  "total": 3,
  "count": 3,
  "results": [
    {
      "id": "CVE-2025-1234",
      "published": "2025-05-08T12:00:00.000",
      "lastModified": "2025-05-09T08:00:00.000",
      "description": "A use-after-free vulnerability in...",
      "score": 9.8,
      "severity": "CRITICAL",
      "vendor": "google",
      "references": ["https://chromereleases.googleblog.com/..."]
    }
  ]
}
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| `502` | NVD API returned an error (often rate limiting) |
| `500` | Internal server error fetching from NVD |

---

### `GET /watchlist`

Returns all CVEs saved to the Supabase watchlist, sorted newest first.

**Example Request:**
```
GET /watchlist
```

**Example Response:**
```json
[
  {
    "id": "a1b2c3d4-...",
    "cve_id": "CVE-2025-1234",
    "description": "A use-after-free vulnerability...",
    "score": 9.8,
    "severity": "CRITICAL",
    "saved_at": "2025-05-09T10:00:00.000Z"
  }
]
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| `500` | Supabase query failed |

---

### `POST /watchlist`

Saves a CVE to the watchlist. Uses upsert — if the same `cve_id` already exists, it updates the record instead of creating a duplicate.

**Request Body:**
```json
{
  "cve_id": "CVE-2025-1234",
  "description": "A use-after-free vulnerability...",
  "score": 9.8,
  "severity": "CRITICAL"
}
```

**Example Response:** The inserted or updated row as JSON.

**Error Responses:**

| Status | Meaning |
|--------|---------|
| `400` | `cve_id` was not included in the request body |
| `500` | Supabase insert/upsert failed |

---

### `DELETE /watchlist/:cveId`

Removes a CVE from the watchlist by its CVE ID. The ID is case-insensitive.

**Example Request:**
```
DELETE /watchlist/CVE-2025-1234
```

**Example Response:**
```json
{ "message": "CVE-2025-1234 removed from watchlist" }
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| `500` | Supabase delete failed |

---

### `GET /breach/:email`

Proxies a breach lookup to the [XposedOrNot API](https://xposedornot.com) for a given email address. The email is not stored or logged by the server.

**Example Request:**
```
GET /breach/user%40example.com
```

**Example Response (not breached):**
```json
{ "breached": false, "breaches": [] }
```

**Example Response (breached):**
```json
{
  "breached": true,
  "breaches": ["Adobe", "LinkedIn", "Twitter"]
}
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| `502` | XposedOrNot API returned an error |
| `500` | Internal server error during breach check |

---

## Known Bugs & Limitations

| Bug / Limitation | Details |
|-----------------|---------|
| **Shared watchlist** | The deployed Supabase database has no authentication. All users of the live site share the same watchlist — anyone can see or delete entries added by others. |
| **NVD rate limiting** | The NVD API rate-limits unauthenticated requests (5 requests per 30 seconds). Under heavy use, `/cves` may return a `502`. Adding an NVD API key via the `apiKey` query param would raise this limit. |
| **CVSS v2 severity mapping** | Older CVEs only carry CVSS v2 scores. The server derives a severity label using v3 thresholds, which may differ from the official v2 classification. |
| **Breach chart is illustrative** | XposedOrNot does not return breach dates, so the "Breach Timeline" chart groups breaches by the first letter of the service name rather than actual year. |
| **No pagination** | `/cves` returns up to 100 results per search. Very broad queries may be silently capped by the NVD API's own result limit. |

---

## Roadmap / Future Development

| Feature | Description |
|---------|-------------|
| **User authentication** | Add Supabase Auth so each user has a private, isolated watchlist |
| **NVD API key support** | Pass an API key with NVD requests to avoid rate limiting under load |
| **Email notifications** | Alert users when new CVEs match keywords they have saved |
| **Trending threats** | Aggregate search data to surface the most-queried vendors on the dashboard |
| **Pagination** | Support browsing beyond the first 100 NVD results with next/prev controls |
| **Automated tests** | Add a test suite (e.g. Jest + Supertest) covering all API endpoints |
| **PWA support** | Enable offline access and home screen installation on mobile devices |
| **CSV / PDF export** | Allow users to download their watchlist as a file |
