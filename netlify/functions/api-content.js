/**
 * Netlify Function: api-content
 * Récupère ou sauvegarde le contenu dynamique du site.
 * Utilise le stockage Bundled Blob gratuit de Netlify (5 Mo, inclus au plan gratuit)
 * via l'API @netlify/blobs v11 : getDeployStore().
 */

const crypto = require('crypto');
const { connectLambda, getDeployStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CONTENT_BLOB_KEY = 'site-content-v1';

// Clé de signature des jetons de session admin (jamais présente dans le code public :
// elle est définie comme variable d'environnement dans le dashboard Netlify)
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event, context) => {
  const httpMethod = event.httpMethod;

  // CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Configure le client Blobs à partir de l'événement (le runtime Netlify
    // injecte le jeton de service dans event.blobs) — nécessaire pour
    // getDeployStore() sur le runtime de fonctions récent.
    try {
      connectLambda(event);
    } catch (e) {
      // Si event.blobs est absent (runtime ancien), le fallback JSON local
      // de getContent() / l'erreur de saveContent() prend le relais.
    }

    const authHeader = event.headers.Authorization || event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    // L'écriture (POST) exige le jeton de session administrateur
    if (httpMethod === 'POST') {
      if (!validateAdminToken(token)) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Authentification requise' })
        };
      }
    }

    if (httpMethod === 'GET') {
      return getContent();
    }

    if (httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return saveContent(body);
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  } catch (error) {
    console.error('API error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Erreur serveur', details: error.message })
    };
  }
};

async function getContent() {
  try {
    const store = await getDeployStore();
    const blob = await store.get(CONTENT_BLOB_KEY);

    if (blob) {
      const stored = JSON.parse(await blob.text());

      // Merge : données stockées + fichiers locaux par défaut
      const localDefaults = {
        accueil: await loadLocalJson('accueil.json'),
        pourqui: await loadLocalJson('pourqui.json'),
        deroulement: await loadLocalJson('deroulement.json'),
        approche: await loadLocalJson('approche.json'),
        tarifs: await loadLocalJson('tarifs.json'),
        activites: await loadLocalJson('activites.json'),
        contact: await loadLocalJson('contact.json')
      };

      // Le contenu stocké prend le dessus sur les valeurs locales
      const merged = { ...localDefaults, ...stored };
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(merged)
      };
    }
  } catch (e) { /* fall through */ }

  // Fallback : charger les fichiers locaux
  return getAllSectionsLocal();
}

async function loadLocalJson(filename) {
  try {
    const fs = require('fs');
    const path = require('path');
    const file_path = path.join(__dirname, '..', '..', 'content', filename);
    if (fs.existsSync(file_path)) {
      return JSON.parse(fs.readFileSync(file_path, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function getAllSectionsLocal() {
  const sections = ['accueil', 'pourqui', 'deroulement', 'approche', 'tarifs', 'activites', 'contact'];
  const result = {};
  for (const s of sections) {
    result[s] = await loadLocalJson(`${s}.json`);
  }
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result)
  };
}

async function saveContent(body) {
  try {
    const store = await getDeployStore();
    await store.set(CONTENT_BLOB_KEY, JSON.stringify({
      ...body,
      updated: new Date().toISOString()
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Contenu sauvegardé',
        updated: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Échec sauvegarde', details: error.message })
    };
  }
}

/**
 * Valide le jeton de session administrateur émis par la fonction /login :
 *   <payload base64url>.<signature HMAC-SHA256 base64url>
 * Le payload est signé avec JWT_SECRET (variable d'environnement, jamais dans le code)
 * et doit être non expiré. Seuls les jetons signés par le serveur sont acceptés.
 */
function validateAdminToken(token) {
  if (!token || !JWT_SECRET) return false;

  const parts = String(token).split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sig] = parts;

  // Vérification de la signature (le seul service en possession de JWT_SECRET peut signer)
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  // Vérification de la date d'expiration
  try {
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
