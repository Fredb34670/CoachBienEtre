/**
 * Netlify Function: api-content
 * Met à jour directement les fichiers JSON du site sur le dépôt GitHub.
 * Déclenche automatiquement un redéploiement Netlify à chaque enregistrement.
 */

const https = require('https');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GITHUB_REPO = 'Fredb34670/CoachBienEtre';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: "API GitHub active" }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  try {
    const authHeader = event.headers.Authorization || event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!validateAdminToken(token)) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Authentification requise' }) };
    }

    if (!GITHUB_TOKEN) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Variable GITHUB_TOKEN manquante dans Netlify' }) };
    }

    const { page, content } = JSON.parse(event.body || '{}');
    const path = `content/${page}.json`;

    // 1. Récupérer le SHA du fichier existant
    const fileInfo = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${path}`);
    const sha = fileInfo.sha;

    // 2. Mettre à jour le fichier sur GitHub
    const updateRes = await githubRequest('PUT', `/repos/${GITHUB_REPO}/contents/${path}`, {
      message: `Admin Update: ${page}.json`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      sha: sha
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Modifications publiées sur GitHub !' })
    };
  } catch (error) {
    console.error('Erreur API GitHub:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Erreur lors de la sauvegarde sur GitHub', details: error.message })
    };
  }
};

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Netlify-Admin-Panel',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Erreur GitHub ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function validateAdminToken(token) {
  if (!token || !JWT_SECRET) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  return sig === expected;
}
