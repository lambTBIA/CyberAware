const express = require('express');
const bodyParser = require('body-parser');
const supabaseClient = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY must be set in your .env file');
  process.exit(1);
}

const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey);

// CVE Score Extraction Helper
// NVD nests scores differently depending on CVE age and analysis status.
// This tries every known location in order of preference.
function extractScoreAndSeverity(cveMetrics) {
  if (!cveMetrics) return { score: null, severity: 'UNKNOWN' };

  // Try CVSS v3.1 first (most current)
  const v31 = cveMetrics.cvssMetricV31?.[0];
  if (v31) {
    const score = v31.cvssData?.baseScore ?? null;
    const severity = (v31.cvssData?.baseSeverity || v31.baseSeverity || '').toUpperCase();
    // Derive severity from score if the field is missing or wrong
    return { score, severity: severity || deriveSevertiy(score) };
  }

  // Try CVSS v3.0
  const v30 = cveMetrics.cvssMetricV30?.[0];
  if (v30) {
    const score = v30.cvssData?.baseScore ?? null;
    const severity = (v30.cvssData?.baseSeverity || v30.baseSeverity || '').toUpperCase();
    return { score, severity: severity || deriveSevertiy(score) };
  }

  // Try CVSS v2 (older CVEs)
  // so scores of 9.0+ correctly display as CRITICAL, not HIGH
  const v2 = cveMetrics.cvssMetricV2?.[0];
  if (v2) {
    const score = v2.cvssData?.baseScore ?? null;
    return { score, severity: deriveSevertiy(score) };
  }

  return { score: null, severity: 'UNKNOWN' };
}

// Derives a severity label from a numeric CVSS score using v3 thresholds.
// Used as a fallback when the severity string is missing or empty.
function deriveSevertiy(score) {
  if (score === null || score === undefined) return 'UNKNOWN';
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score > 0)    return 'LOW';
  return 'UNKNOWN';
}

// CVE Routes (NVD API) 
/**
 * GET /cves
 * Fetches CVEs from NVD API and returns simplified JSON.
 * Query params: keyword, severity (CRITICAL|HIGH|MEDIUM|LOW), limit (default 20)
 */
app.get('/cves', async (req, res) => {

  const {
    keyword,
    severity,
    limit = 20,
    recent = 'true'
  } = req.query;

  const params = new URLSearchParams();

  params.set('startIndex', 0);

  // Add keyword/vendor search if provided
  if (keyword) {
    params.set('keywordSearch', keyword);
  }

  // Apply severity filtering if provided
  if (severity) {
    params.set(
      'cvssV3Severity',
      severity.toUpperCase()
    );
  }

  // Default behavior:
  // ALWAYS show only vulnerabilities published
  // within the past 14 days unless recent=false.
  // This prevents extremely old CVEs from appearing
  // in searches like "windows" or "apache".
  if (recent !== 'false') {

    const now = new Date();

    const twoWeeksAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    params.set(
      'pubStartDate',
      twoWeeksAgo.toISOString()
    );

    params.set(
      'pubEndDate',
      now.toISOString()
    );

    // Pull enough records for dashboard/searches
    params.set('resultsPerPage', 100);

  } else {

    // Optional fallback if user explicitly disables recent filter
    params.set(
      'resultsPerPage',
      Math.min(parseInt(limit) || 20, 100)
    );

  }

  const nvdUrl =
    `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`;

  console.log(`Fetching NVD: ${nvdUrl}`);

  try {

    const response = await fetch(nvdUrl);

    if (!response.ok) {

      return res.status(502).json({
        message: 'NVD API error',
        status: response.status
      });

    }

    const raw = await response.json();

    const vulnerabilities =
      raw.vulnerabilities || [];

    // Simplify deeply nested NVD response
    const simplified = vulnerabilities.map(({ cve }) => {

      const {
        score: baseScore,
        severity: baseSeverity
      } = extractScoreAndSeverity(cve.metrics);

      const descriptionEn =
        cve.descriptions?.find(
          (d) => d.lang === 'en'
        )?.value ||
        'No description available.';

      // Extract vendor name from CPE string
      const vendorData =
        cve.configurations?.[0]
          ?.nodes?.[0]
          ?.cpeMatch?.[0]
          ?.criteria || '';

      const vendorMatch =
        vendorData.match(
          /cpe:2\.3:[ao]:([^:]+):/
        );

      const vendor = vendorMatch
        ? vendorMatch[1].replace(/_/g, ' ')
        : 'Unknown';

      const references =
        (cve.references || [])
          .slice(0, 3)
          .map((r) => r.url);

      return {
        id: cve.id,
        published: cve.published,
        lastModified: cve.lastModified,
        description: descriptionEn,
        score: baseScore,
        severity: baseSeverity,
        vendor,
        references,
      };

    });

    // Sort newest published CVEs first
    const results = simplified.sort(
      (a, b) =>
        new Date(b.published) -
        new Date(a.published)
    );

    console.log(`CVEs returned: ${results.length}`);

    res.json({
      total: raw.totalResults,
      count: results.length,
      results
    });

  } catch (err) {
    console.error('NVD fetch error:', err);
    res.status(500).json({
      message: 'Internal server error fetching CVEs'
    });
  }
});

// Watchlist Routes (Supabase)
/**
 * GET /watchlist
 * Returns all saved CVEs from Supabase, newest first.
 */
app.get('/watchlist', async (req, res) => {
  const { data, error } = await supabase
    .from('watchlist')
    .select()
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('Watchlist fetch error:', error.message);
    return res.status(500).json({ message: error.message });
  }
  res.json(data);
});

/**
 * POST /watchlist
 * Saves a CVE to the watchlist. Uses upsert so re-saving the same CVE
 * updates it rather than creating a duplicate.
 * Body: { cve_id, description, score, severity }
 */
app.post('/watchlist', async (req, res) => {
  const { cve_id, description, score, severity } = req.body;
  if (!cve_id) return res.status(400).json({ message: 'cve_id is required' });

  const { data, error } = await supabase
    .from('watchlist')
    .upsert(
      { cve_id, description, score, severity, saved_at: new Date().toISOString() },
      { onConflict: 'cve_id' }
    )
    .select();

  if (error) {
    console.error('Watchlist insert error:', error.message);
    return res.status(500).json({ message: error.message });
  }
  res.json(data);
});

/**
 * Removes a CVE from the watchlist by CVE ID.
 */
app.delete('/watchlist/:cveId', async (req, res) => {
  const cveId = req.params.cveId.toUpperCase();
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('cve_id', cveId);

  if (error) {
    console.error('Watchlist delete error:', error.message);
    return res.status(500).json({ message: error.message });
  }
  res.json({ message: `${cveId} removed from watchlist` });
});

// Breach Check Route (XposedOrNot API)
/**
 * this will proxy XposedOrNot API to check if an email was compromised in a breach.
 */
app.get('/breach/:email', async (req, res) => {
  const email = req.params.email;
  console.log(`Checking breach for: ${email}`);

  try {
    const response = await fetch(
      `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`
    );

    if (response.status === 404) return res.json({ breached: false, breaches: [] });
    if (!response.ok) return res.status(502).json({ message: 'XposedOrNot API error' });

    const raw = await response.json();
    const breaches = Array.isArray(raw.breaches) ? raw.breaches : [];
    res.json({ breached: breaches.length > 0, breaches });
  } catch (err) {
    console.error('Breach check error:', err);
    res.status(500).json({ message: 'Internal server error checking breach' });
  }
});

// Start
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
