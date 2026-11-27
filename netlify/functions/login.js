/**
 * Netlify Function: login
 * Vérifie le mot de passe admin et retourne un jeton JWT.
 * Variables d'environnement attendues:
 *   ADMIN_PASSWORD_HASH - mot de passe haché (scrypt)
 *   JWT_SECRET - clé secrète pour signer les JWT
 */

const crypto = require('crypto');

exports.handler = async (event, context) => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // OPTIONS pour le preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { password } = body;

    if (!password) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Mot de passe requis' })
      };
    }

    // Vérification du mot de passe
    const storedHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    
    if (!storedHash) {
      console.error('ADMIN_PASSWORD_HASH non défini');
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Configuration serveur manquante' })
      };
    }

    // Vérifier le mot de passe (scrypt)
    const isValid = await verifyPassword(password, storedHash);
    
    if (!isValid) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Identifiants invalides' })
      };
    }

    // Générer un jeton simple (timestamp + random)
    const token = Buffer.from(`${Date.now()}.${crypto.randomBytes(16).toString('hex')}`).toString('base64url');
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ token })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Erreur serveur' })
    };
  }
};

async function verifyPassword(password, storedHash) {
  // Pour simplifier, on utilise une comparaison directe si le hash n'est pas au format scrypt sérialisé
  // Production: utiliser une vraie vérification scrypt
  if (storedHash.startsWith('$scrypt$')) {
    // Format scrypt sérialisé
    const parts = storedHash.split('$');
    const salt = Buffer.from(parts[2], 'hex');
    const key = Buffer.from(parts[3], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 32);
    return crypto.timingSafeEqual(key, derivedKey);
  }
  // Fallback: comparaison directe pour les tests
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(storedHash));
}