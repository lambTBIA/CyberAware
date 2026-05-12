# 🛡️ CyberAware

**A human-friendly cybersecurity threat intelligence dashboard** that transforms raw government vulnerability data into actionable security insights for small business owners, junior IT admins, and anyone who wants to stay informed about digital threats.

🔗 **Live Demo:** [cyber-aware-xi.vercel.app](https://cyber-aware-xi.vercel.app/)

📖 **[Jump to Developer Manual](#developer-manual)**

> ⚠️ **Note:** The watchlist feature uses a shared Supabase database. Any CVE you save to the watchlist is visible to all users of the deployed application.

---

## Table of Contents

- [Description](#description)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Target Browsers](#target-browsers)
- [Developer Manual](#developer-manual)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
  - [Running Tests](#running-tests)
  - [API Endpoints](#api-endpoints)
    - [GET /cves](#get-cves)
    - [GET /watchlist](#get-watchlist)
    - [POST /watchlist](#post-watchlist)
    - [DELETE /watchlist/:cveId](#delete-watchlistcveid)
    - [GET /breach/:email](#get-breachemail)
  - [Known Bugs & Limitations](#known-bugs--limitations)
  - [Roadmap / Future Development](#roadmap--future-development)
- [Authors](#authors)

---

## Description

CyberAware acts as a filter and translation layer between the [National Vulnerability Database (NVD)](https://nvd.nist.gov) and end users. Instead of parsing deeply nested JSON from government APIs, users get a clean dashboard where they can:

- Search for CVEs by vendor or software name (e.g. *Windows*, *Apache*, *Cisco*)
- Filter results by severity: Critical, High, Medium, or Low
- View full CVE details including CVSS scores and official references
- Save vulnerabilities to a shared watchlist (persisted in Supabase)
- Check any email address for exposure in known public data breaches

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
├── index.js                 # Express server — all API routes & Supabase logic
├── package.json             # Project metadata & npm dependencies
├── package-lock.json        # Locked dependency versions
├── nodemon.json             # Nodemon config (watches js, html, css, json)
├── vercel.json              # Vercel deployment config
└── .env                     # Environment variables (not committed — see below)
```

> **Note:** The `.env` file is not included in the repository. You must create it manually. See [Installation](#installation) for the required variables.

---

## Tech Stack

### Frontend
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Anime.js](https://img.shields.io/badge/Anime.js-FF6B9D?style=for-the-badge&logo=javascript&logoColor=white)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)

### Database & APIs
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![NIST NVD](https://img.shields.io/badge/NIST%20NVD%20API-003087?style=for-the-badge&logo=databricks&logoColor=white)
![XposedOrNot](https://img.shields.io/badge/XposedOrNot%20API-FF3B3B?style=for-the-badge&logo=security&logoColor=white)

### Deployment & Tooling
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Nodemon](https://img.shields.io/badge/Nodemon-76D04B?style=for-the-badge&logo=nodemon&logoColor=white)
![dotenv](https://img.shields.io/badge/dotenv-ECD53F?style=for-the-badge&logo=dotenv&logoColor=black)

---

## Target Browsers

CyberAware is designed and tested for modern **desktop browsers**:

| Browser | Minimum Version |
|---------|----------------|
| Google Chrome | 112+ |
| Mozilla Firefox | 113+ |
| Microsoft Edge | 112+ |
| Safari (macOS) | 16+ |

**Mobile browsers** are supported via a responsive layout, but the experience is optimized for desktop viewports:

| Browser | Platform | Minimum Version |
|---------|----------|----------------|
| Safari | iOS 16+ (iPhone, iPad) | iOS 16 |
| Chrome | Android 10+ | Chrome 112+ |
| Firefox | Android | Firefox 113+ |

> The application is **not** designed as a mobile-first experience. Some dashboard features (chart layouts, CVE grid) are best viewed on a screen width of 768px or wider.

---

## Developer Manual

> **Audience:** This manual is written for future developers taking over the CyberAware codebase. It assumes familiarity with JavaScript, Node.js, and general web application concepts, but no prior knowledge of this system's design or architecture. All documentation is also saved in the [`docs/`](./docs) folder of the repository.

### Installation

**Prerequisites:**
- [Node.js](https://nodejs.org/) v18 or higher
- npm (bundled with Node.js)
- A [Supabase](https://supabase.com/) account with a project and a `watchlist` table

**Clone and install dependencies:**

```bash
git clone https://github.com/lambTBIA/CyberAware.git
cd CyberAware
npm install
```

**Environment variables:**

Create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

**Supabase table schema:**

Run the following SQL in your Supabase SQL editor to create the required table:

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

### Running the Application

Start the development server with auto-reload:

```bash
npm start
```

The server will be available at [http://localhost:3000](http://localhost:3000).

To run without nodemon (production-style):

```bash
node index.js
```

---

### Running Tests

No automated test suite is currently implemented.

```bash
npm test
# → "Error: no test specified"
```

Manual testing is recommended by running the server locally and exercising each endpoint via browser or a tool like Postman. See the API section below for endpoint details.

---

### API Endpoints

All endpoints are served by the Express backend (`index.js`).

#### `GET /cves`

Fetches CVEs from the NVD API 2.0 and returns a simplified JSON array.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `keyword` | string | — | Vendor or software name to search (e.g. `windows`, `apache`) |
| `severity` | string | — | Filter by severity: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| `limit` | number | `20` | Max results to return (only applies when `recent=false`) |
| `recent` | string | `"true"` | When `"true"`, restricts results to the past 14 days |

**Example:**
```
GET /cves?keyword=chrome&severity=CRITICAL
```

**Response:**
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

---

#### `GET /watchlist`

Returns all CVEs saved to the watchlist, sorted newest first.

**Response:**
```json
[
  {
    "id": "uuid",
    "cve_id": "CVE-2025-1234",
    "description": "...",
    "score": 9.8,
    "severity": "CRITICAL",
    "saved_at": "2025-05-09T10:00:00.000Z"
  }
]
```

---

#### `POST /watchlist`

Saves a CVE to the watchlist. Uses upsert — re-saving an existing CVE updates it rather than creating a duplicate.

**Request Body:**
```json
{
  "cve_id": "CVE-2025-1234",
  "description": "A use-after-free vulnerability...",
  "score": 9.8,
  "severity": "CRITICAL"
}
```

**Response:** The inserted/updated row as JSON.

---

#### `DELETE /watchlist/:cveId`

Removes a CVE from the watchlist by its CVE ID (case-insensitive).

**Example:**
```
DELETE /watchlist/CVE-2025-1234
```

**Response:**
```json
{ "message": "CVE-2025-1234 removed from watchlist" }
```

---

#### `GET /breach/:email`

Proxies a breach check request to the [XposedOrNot API](https://xposedornot.com) for the given email address. The email is not stored or logged.

**Example:**
```
GET /breach/user%40example.com
```

**Response (not breached):**
```json
{ "breached": false, "breaches": [] }
```

**Response (breached):**
```json
{
  "breached": true,
  "breaches": ["Adobe", "LinkedIn", "Twitter"]
}
```

---

### Known Bugs & Limitations

- **Shared watchlist:** The deployed Supabase database is shared across all users. There is no authentication — anyone using the live site can see and delete watchlist entries added by others.
- **NVD rate limiting:** The NVD API enforces rate limits on unauthenticated requests. Under heavy use, requests may return a `502` error. Adding an NVD API key via the `apiKey` header would increase the limit.
- **CVSS v2 severity mapping:** Older CVEs that only have CVSS v2 scores use a derived severity label based on v3 thresholds. These labels may differ from the official v2 severity classification.
- **Breach chart is illustrative:** Because the XposedOrNot API does not return breach dates, the "Breach Timeline" bar chart on the Breach Check page groups breaches by the first letter of the service name rather than actual breach year.
- **No pagination:** The dashboard loads up to 100 CVEs per search. Very broad keyword searches may be capped at the NVD's results limit.

---

### Roadmap / Future Development

- **User authentication** — Add Supabase Auth so each user has a private watchlist
- **NVD API key support** — Reduce rate limit errors under load
- **Email notifications** — Alert users when new CVEs match their watchlist keywords
- **Trending threats** — Aggregate search data to surface the most-searched vendors
- **Pagination** — Support browsing beyond the first 100 results
- **PWA support** — Enable offline access and home screen installation on mobile
- **Export** — Allow watchlist export to CSV or PDF

---

## Authors

- **David Lamboni** — INST377, Spring 2026
- **Ashley Taupyen** — INST377, Spring 2026

University of Maryland — College of Information Studies

<br/>

<p align="center">
  <a href="https://ischool.umd.edu">
    <img src="https://ischool.umd.edu/wp-content/uploads/ischool_logo.png" alt="UMD College of Information" width="340"/>
  </a>
</p>
