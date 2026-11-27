/**
 * Netlify Function: login
 * Vérifie le mot de passe administrateur (hash scrypt en variable d'environnement)
 * et retourne un jeton de session signé (HMAC-SHA256), valable 12 h.
 *
 * Variables d'environnement (Netlify → Site settings → Environment variables) :
 *   ADMIN_PASSWORD_HASH - hash scrypt au format $scrypt$<salt hex>$<clé hex>
 *   JWT_SECRET          - clé aléatoire (64 hex) pour signer les jetons
 *
 * Le mot de passe n'apparaît nulle part dans le code ni dans le dépôt Git.
 */

const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures

// Frappes limitées par instance de fonction (défense supplémentaire :
// le vrai bouclier reste le mot de passe long + scrypt)
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

exports.handler = async (event, context) => {
  // OPTIONS pour le preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  try {
    const now = Date.now();

    // Nettoyage des compteurs expirés
    for (const [k, v] of attempts) {
      if (now - v.last > WINDOW_MS) attempts.delete(k);
    }
    const clientKey = event.headers && (event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'anonymous');
    const rec = attempts.get(clientKey);
    if (rec && now - rec.last < WINDOW_MS && rec.count >= MAX_ATTEMPTS) {
      return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Trop de tentatives, réessayez plus tard' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { password } = body;

    if (!password) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Mot de passe requis' }) };
    }

    const storedHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!storedHash || !jwtSecret) {
      console.error('ADMIN_PASSWORD_HASH ou JWT_SECRET non défini(e)s');
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Configuration serveur manquante' }) };
    }

    if (!verifyPassword(password, storedHash)) {
      const r = attempts.get(clientKey) || { last: now, count: 0 };
      r.count += 1;
      r.last = now;
      attempts.set(clientKey, r);
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Mot de passe incorrect' }) };
    }

    // Réussite : réinitialiser le compteur et émettre le jeton signé
    attempts.delete(clientKey);
    const token = signToken(jwtSecret, SESSION_TTL_MS);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ token, exp: Date.now() + SESSION_TTL_MS })
    };
  } catch (error) {
    console.error('Login error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};

/**
 * Jeton de session : <payload base64url>.<signature HMAC-SHA256 base64url>
 * Le payload { exp, i } est signé avec JWT_SECRET ; seul le serveur peut l'émettre
 * et seul api-content (qui détient la même clé) peut le valider.
 */
function signToken(secret, ttlMs) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs, i: 'admin' })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Vérifie le mot de passe contre le hash scrypt ($scrypt$<salt hex>$<clé hex>).
 */
function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('$scrypt$')) {
    const parts = storedHash.split('$');
    const salt = Buffer.from(parts[2], 'hex');
    const key = Buffer.from(parts[3], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 32);
    return key.length === derivedKey.length && crypto.timingSafeEqual(key, derivedKey);
  }
  // Fallback : comparaison directe (uniquement pour des tests locaux)
  const a = Buffer.from(password);
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
