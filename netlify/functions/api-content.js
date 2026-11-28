/**
 * Netlify Function: api-content
 * Récupère ou sauvegarde le contenu dynamique du site via Netlify Blobs.
 */

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CONTENT_BLOB_KEY = 'site-content-v1';
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event, context) => {
  const httpMethod = event.httpMethod;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const authHeader = event.headers.Authorization || event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    // L'écriture (POST) exige le jeton admin
    if (httpMethod === 'POST') {
      if (!validateAdminToken(token)) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Authentification requise' })
        };
      }
    }

    const store = getStore({ name: 'site-content' });

    if (httpMethod === 'GET') {
      try {
        const stored = await store.get(CONTENT_BLOB_KEY, { type: 'json' });
        if (stored) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(stored)
          };
        }
      } catch (e) {
        // Fallback fichiers locaux si le store est vide
      }
      return getAllSectionsLocal();
    }

    if (httpMethod === 'POST') {
      const { page, content } = JSON.parse(event.body || '{}');
      
      // Récupérer le contenu actuel ou initialiser un objet vide
      let allContent = {};
      try {
        const existing = await store.get(CONTENT_BLOB_KEY, { type: 'json' });
        if (existing) allContent = existing;
      } catch (e) {}

      // Mettre à jour la page modifiée
      allContent[page] = content;

      // Sauvegarder dans Netlify Blobs
      await store.setJSON(CONTENT_BLOB_KEY, allContent);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Contenu sauvegardé dans le cloud !',
          updated: new Date().toISOString()
        })
      };
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

function validateAdminToken(token) {
  if (!token || !JWT_SECRET) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
