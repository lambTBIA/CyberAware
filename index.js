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

// CVE Routes (NVD API)

/**
 * GET /cves
 * Fetches CVEs from NVD API and returns simplified JSON.
 * Query params: keyword, severity (CRITICAL|HIGH|MEDIUM|LOW), limit (default 20)
 */
app.get('/cves', async (req, res) => {
  const { keyword, severity, limit = 20 } = req.query;

  const params = new URLSearchParams();
  params.set('resultsPerPage', Math.min(parseInt(limit) || 20, 50));
  params.set('startIndex', 0);

  if (keyword) params.set('keywordSearch', keyword);
  if (severity) params.set('cvssV3Severity', severity.toUpperCase());

  const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`;
  console.log(`Fetching NVD: ${nvdUrl}`);

  try {
    const response = await fetch(nvdUrl);
    if (!response.ok) {
      return res.status(502).json({ message: 'NVD API error', status: response.status });
    }

    const raw = await response.json();
    const vulnerabilities = raw.vulnerabilities || [];

    const simplified = vulnerabilities.map(({ cve }) => {
      const metrics =
        cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
        cve.metrics?.cvssMetricV30?.[0]?.cvssData ||
        cve.metrics?.cvssMetricV2?.[0]?.cvssData ||
        null;

      const baseScore = metrics?.baseScore ?? null;
      const baseSeverity =
        metrics?.baseSeverity ||
        cve.metrics?.cvssMetricV31?.[0]?.baseSeverity ||
        cve.metrics?.cvssMetricV30?.[0]?.baseSeverity ||
        cve.metrics?.cvssMetricV2?.[0]?.baseSeverity ||
        'UNKNOWN';

      const descriptionEn =
        cve.descriptions?.find((d) => d.lang === 'en')?.value || 'No description available.';

      const vendorData = cve.configurations?.[0]?.nodes?.[0]?.cpeMatch?.[0]?.criteria || '';
      const vendorMatch = vendorData.match(/cpe:2\.3:[ao]:([^:]+):/);
      const vendor = vendorMatch ? vendorMatch[1].replace(/_/g, ' ') : 'Unknown';

      const references = (cve.references || []).slice(0, 3).map((r) => r.url);

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

    res.json({ total: raw.totalResults, count: simplified.length, results: simplified });
  } catch (err) {
    console.error('NVD fetch error:', err);
    res.status(500).json({ message: 'Internal server error fetching CVEs' });
  }
});

/**
 * GET /cves/:id
 * Returns full details for a single CVE by ID.
 */
app.get('/cves/:id', async (req, res) => {
  const cveId = req.params.id.toUpperCase();
  const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`;
  console.log(`Fetching single CVE: ${nvdUrl}`);

  try {
    const response = await fetch(nvdUrl);
    if (!response.ok) {
      return res.status(502).json({ message: 'NVD API error' });
    }
    const raw = await response.json();
    const cve = raw.vulnerabilities?.[0]?.cve;
    if (!cve) return res.status(404).json({ message: `${cveId} not found` });

    const metrics =
      cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
      cve.metrics?.cvssMetricV30?.[0]?.cvssData ||
      cve.metrics?.cvssMetricV2?.[0]?.cvssData ||
      null;

    const baseScore = metrics?.baseScore ?? null;
    const baseSeverity =
      metrics?.baseSeverity ||
      cve.metrics?.cvssMetricV31?.[0]?.baseSeverity ||
      cve.metrics?.cvssMetricV30?.[0]?.baseSeverity ||
      'UNKNOWN';

    const descriptionEn =
      cve.descriptions?.find((d) => d.lang === 'en')?.value || 'No description available.';

    res.json({
      id: cve.id,
      published: cve.published,
      lastModified: cve.lastModified,
      description: descriptionEn,
      score: baseScore,
      severity: baseSeverity,
      references: (cve.references || []).map((r) => r.url),
      weaknesses: (cve.weaknesses || []).map((w) => w.description?.[0]?.value).filter(Boolean),
    });
  } catch (err) {
    console.error('CVE detail fetch error:', err);
    res.status(500).json({ message: 'Internal server error' });
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

  if (!cve_id) {
    return res.status(400).json({ message: 'cve_id is required' });
  }

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

    if (response.status === 404) {
      return res.json({ breached: false, breaches: [] });
    }
    if (!response.ok) {
      return res.status(502).json({ message: 'XposedOrNot API error', status: response.status });
    }

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
