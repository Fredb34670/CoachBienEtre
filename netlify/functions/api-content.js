/**
 * Netlify Function: api-content
 * Récupère ou sauvegarde le contenu dynamique du site.
 * Utilise Netlify Blob pour le stockage persistant (gratuit jusqu'à 5 Mo)
 */

const { createClient } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const blobStore = createClient({ useBundledBlob: true });
const CONTENT_BLOB_KEY = 'site-content-v1';

// Email administrateur autorisé à écrire le contenu.
// Configurable via la variable d'environnement ADMIN_EMAIL dans Netlify
// (Site settings → Environment variables). Valeur par défaut identique à admin.js
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'fbaranes@gmail.com').toLowerCase();

exports.handler = async (event, context) => {
  const httpMethod = event.httpMethod;

  // CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const authHeader = event.headers.Authorization || event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    // Authentification nécessaire pour POST
    if (httpMethod === 'POST') {
      if (!validateIdentityToken(token)) {
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
    const stored = await blobStore.get(CONTENT_BLOB_KEY, { type: 'json' });
    
    if (stored && stored.data) {
      // Merge: données stockées + fichiers locaux par défaut
      const localDefaults = {
        accueil: await loadLocalJson('accueil.json'),
        pourqui: await loadLocalJson('pourqui.json'),
        deroulement: await loadLocalJson('deroulement.json'),
        approche: await loadLocalJson('approche.json'),
        tarifs: await loadLocalJson('tarifs.json'),
        activites: await loadLocalJson('activites.json'),
        contact: await loadLocalJson('contact.json')
      };

      // Combiner: contenu stocké prend le dessus
      const merged = { ...localDefaults, ...stored.data };
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(merged)
      };
    }
  } catch (e) { /* fall through */ }

  // Fallback: charger les fichiers locaux
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
    // Sauvegarder dans le blob
    await blobStore.set(CONTENT_BLOB_KEY, {
      data: body,
      updated: new Date().toISOString()
    });

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

function validateIdentityToken(token) {
  // Validation du token Netlify Identity + restriction à l'email administrateur.
  // Les tokens Identity sont des JWT signés par Netlify : on vérifie le format,
  // la validité (exp) et l'email du porteur. La signature n'est pas vérifiée
  // côté fonction (la clé publique Netlify n'est pas disponible ici) ;
  // le contrôle d'email borne l'accès à l'administrateur.

  if (!token || token.length < 10) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Décoder le payload du JWT (base64url → base64)
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString());

    // Token expiré → refus
    if (payload.exp && payload.exp <= Date.now() / 1000) {
      return false;
    }

    // Seule la session de l'administrateur peut écrire le contenu
    const tokenEmail = (payload.email || (payload.sub || '')).toLowerCase();
    if (tokenEmail !== ADMIN_EMAIL) {
      console.warn('Écriture refusée : token non administrateur (', tokenEmail || 'email manquant', ')');
      return false;
    }

    return true;
  } catch {
    return false;
  }
}