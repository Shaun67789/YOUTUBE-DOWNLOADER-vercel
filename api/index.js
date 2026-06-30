const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const serverless = require('serverless-http');

const app = express();
const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('API_BASE_URL environment variable is not set');
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());

const owner = { owner: 'Shawon', telegram: '@ShawonXnone' };

function sanitize(obj) {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k, v]) => {
          const key = k.toLowerCase();
          if (key === 'creator' || key.includes('creator') || key.includes('prexzy')) return false;
          if (typeof v === 'string' && v.toLowerCase().includes('prexzy')) return false;
          return true;
        })
        .map(([k, v]) => [k, sanitize(v)])
    );
  }
  return obj;
}

app.get('/api/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url', ...owner });

    const apiUrl = `${API_BASE_URL}/download/youtube-video`;
    const response = await axios.get(apiUrl, {
      params: { url },
      timeout: 25000,
      responseType: 'stream'
    });

    res.set(response.headers);
    response.data.pipe(res);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ error: 'Upstream API error', status: error.response.status, message: error.response.statusText, ...owner });
    } else if (error.request) {
      res.status(502).json({ error: 'No response from upstream API', ...owner });
    } else {
      res.status(500).json({ error: 'Internal server error', ...owner });
    }
  }
});

app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url', ...owner });

    const apiUrl = `${API_BASE_URL}/download/youtube-video`;
    const upstream = await axios.get(apiUrl, { params: { url }, timeout: 15000 });

    const protocol = req.get('X-Forwarded-Proto') || req.protocol;
    const host = req.get('host');
    const downloadUrl = `${protocol}://${host}/api/download?url=${encodeURIComponent(url)}`;

    res.json({ ...owner, download_url: downloadUrl, video: sanitize(upstream.data) });
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ error: 'Upstream API error', status: error.response.status, message: error.response.statusText, ...owner });
    } else if (error.request) {
      res.status(502).json({ error: 'No response from upstream API', ...owner });
    } else {
      res.status(500).json({ error: 'Internal server error', ...owner });
    }
  }
});

app.get('/api', (req, res) => {
  const protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('host');
  res.json({
    ...owner,
    name: 'YouTube Downloader API',
    version: '1.0.0',
    endpoints: {
      download: {
        path: '/api/download', method: 'GET',
        params: { url: 'YouTube video URL (required)' },
        description: 'Download a YouTube video/audio stream',
        example: `${protocol}://${host}/api/download?url=https://youtu.be/D8YEkMjNumE`
      },
      info: {
        path: '/api/info', method: 'GET',
        params: { url: 'YouTube video URL (required)' },
        description: 'Get video information without downloading',
        example: `${protocol}://${host}/api/info?url=https://youtu.be/D8YEkMjNumE`
      }
    }
  });
});

module.exports = serverless(app);
