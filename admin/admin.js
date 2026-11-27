// Admin Interface Script — connexion par mot de passe (fonction Netlify /login)
// Le mot de passe n'est jamais présent dans ce fichier : il est vérifié côté
// serveur contre une variable d'environnement (hash scrypt) et un jeton de
// session signé (HMAC, 12 h) est renvoyé.

const PAGES = ['accueil', 'pourqui', 'deroulement', 'approche', 'tarifs', 'activites', 'contact'];

const TOKEN_KEY = 'adminToken';
const API_LOGIN = '/.netlify/functions/login';
const API_CONTENT = '/.netlify/functions/api-content';

let current = 'accueil';
let data = { blocks: [] };
let dirty = 0;

const admin = {
  init() {
    this.buildNav();
    this.checkAuth();
  },

  // ---- Authentification (jeton de session stocké en localStorage) ----

  checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && tokenAlive(token)) {
      this.onLogin();
    } else {
      if (token) localStorage.removeItem(TOKEN_KEY);
      this.showLogin();
    }
  },

  onLogin() {
    document.getElementById('view-login').hidden = true;
    document.getElementById('view-admin').hidden = false;
    const info = document.getElementById('userInfo');
    if (info) info.textContent = 'Connecté en tant qu\'administrateur';
    this.showPage('accueil');
  },

  onLogout() {
    document.getElementById('view-admin').hidden = true;
    document.getElementById('view-login').hidden = false;
  },

  showLogin() {
    const pwd = document.getElementById('login-pwd');
    if (pwd) pwd.value = '';
  },

  login() {
    const pwd = document.getElementById('login-pwd').value;

    if (!pwd) {
      admin.toast('Entrez le mot de passe administrateur');
      return;
    }

    fetch(API_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    })
      .then(r => r.json().catch(() => ({})).then(j => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (ok && j.token) {
          localStorage.setItem(TOKEN_KEY, j.token);
          admin.toast('Connexion réussie');
          admin.onLogin();
        } else if (status === 429) {
          admin.toast('Trop de tentatives : réessayez plus tard');
        } else if (status === 500) {
          admin.toast('Serveur non configuré (variables d\'environnement manquantes)');
        } else {
          admin.toast('Mot de passe incorrect');
        }
      })
      .catch(() => admin.toast('Erreur réseau'));
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    admin.onLogout();
    admin.showLogin();
    admin.toast('Déconnecté');
  },

  // ---- Interface ----

  buildNav() {
    document.getElementById('navList').innerHTML = PAGES.map(p => {
      const label = p.charAt(0).toUpperCase() + p.slice(1);
      const icon = {'accueil':'🏠','pourqui':'👥','deroulement':'🧭','approche':'🌱','tarifs':'💶','activites':'📰','contact':'✉️'}[p] || '📄';
      return `<li><button data-p="${p}" onclick="admin.showPage('${p}')">${icon} ${label}</button></li>`;
    }).join('');
  },

  async showPage(id) {
    if (!PAGES.includes(id)) return;
    current = id; dirty = 0; admin.updateSaveInfo();
    document.querySelectorAll('#navList button').forEach(b => b.classList.remove('active'));
    document.querySelector(`#navList button[data-p="${id}"]`).classList.add('active');

    admin.loadContent(id).then(content => {
      data = content;
      admin.renderBlocks();
    });
  },

  async loadContent(page) {
    try {
      const r = await fetch(`../content/${page}.json`);
      if (r.ok) return await r.json();
    } catch {}
    // Fallback default
    return { blocks: [
      { type: 'title', label: 'Titre', value: page.charAt(0).toUpperCase() + page.slice(1) },
      { type: 'text', label: 'Texte', value: 'Contenu à éditer...' },
      { type: 'image', label: 'Image', src: '', file: '' }
    ]};
  },

  renderBlocks() {
    const c = document.getElementById('content');
    c.innerHTML = `
      <h2>Page : ${current}</h2>
      <p class="page-sub">Cliquez sur un bloc pour le modifier. Les changements sont enregistrés immédiatement.</p>
      ${data.blocks.map((b, i) => admin.renderBlock(b, i)).join('')}
      <div class="add-blocks">
        <button onclick="admin.addBlock('text')">＋ Texte</button>
        <button onclick="admin.addBlock('image')">＋ Image</button>
      </div>`;
    admin.initBlocks();
  },

  renderBlock(b, i) {
    if (b.type === 'title') return `
      <div class="block" data-i="${i}">
        <div class="block-head"><span class="block-label">Titre</span><button class="block-del" onclick="admin.delBlock(${i})">✕</button></div>
        <input type="text" value="${admin.escapeHtml(b.value || '')}" oninput="admin.updateBlock(${i}, this.value)">
      </div>`;
    if (b.type === 'image') return `
      <div class="block" data-i="${i}">
        <div class="block-head"><span class="block-label">Image</span><button class="block-del" onclick="admin.delBlock(${i})">✕</button></div>
        <div class="img-preview">${b.src ? `<img src="${b.src}" alt="${b.label}">` : '<span style="padding:40px;display:block;text-align:center;color:var(--muted)">Pas d\'image</span>'}</div>
        <div class="img-actions">
          <button class="btn-ghost" onclick="admin.pickImage(${i})">📁 Changer</button>
          <span class="file-note">${b.file || ''}</span>
          <input type="file" accept="image/*" id="file-${i}" style="display:none" onchange="admin.handleImage(${i}, this)">
        </div>
      </div>`;
    return `
      <div class="block" data-i="${i}">
        <div class="block-head"><span class="block-label">${admin.escapeHtml(b.label || 'Texte')}</span><button class="block-del" onclick="admin.delBlock(${i})">✕</button></div>
        <div class="toolbar">
          <button onclick="document.execCommand('bold')">B</button>
          <button onclick="document.execCommand('italic')">I</button>
          <button onclick="document.execCommand('underline')">U</button>
          <button onclick="document.execCommand('insertUnorderedList')">•</button>
        </div>
        <div class="rich trumbowyg" data-i="${i}" contenteditable="true" oninput="admin.markDirty()">${b.value || ''}</div>
      </div>`;
  },

  escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },

  initBlocks() {
    document.querySelectorAll('.rich').forEach(el => {
      if (!el.hasAttribute('data-trumbowyg')) {
        if (typeof $ !== 'undefined' && $.fn.trumbowyg) {
          $(el).trumbowyg({ autoparse: false });
          el.setAttribute('data-trumbowyg', 'true');
        }
        el.addEventListener('input', () => admin.markDirty());
      }
    });
  },

  updateBlock(i, val) { data.blocks[i].value = val; admin.markDirty(); },

  addBlock(type) {
    const i = data.blocks.length;
    data.blocks.push(type === 'image'
      ? { type: 'image', label: 'Nouvelle image', src: '', file: '' }
      : { type: 'text', label: 'Nouveau texte', value: '', blocks: [] });
    admin.renderBlocks();
    admin.toast('Bloc ajouté');
  },

  delBlock(i) {
    data.blocks.splice(i, 1);
    admin.renderBlocks();
    admin.toast('Bloc supprimé');
  },

  pickImage(i) {
    document.getElementById(`file-${i}`).click();
  },

  handleImage(i, input) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      data.blocks[i].src = e.target.result;
      data.blocks[i].file = file.name;
      admin.renderBlocks();
      admin.markDirty();
      admin.toast(`Image: ${file.name}`);
    };
    reader.readAsDataURL(file);
  },

  markDirty() { dirty++; admin.updateSaveInfo(); },
  updateSaveInfo() {
    const el = document.getElementById('saveInfo');
    el.textContent = dirty ? `${dirty} modification${dirty>1?'s':''}` : 'Aucune modification';
    el.className = 'saveInfo ' + (dirty ? 'dirty' : 'clean');
  },
  reset() { data = { blocks: [] }; dirty = 0; admin.renderBlocks(); admin.toast('Réinitialisé'); },

  async save() {
    if (!dirty) { admin.toast('Rien à sauvegarder'); return; }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !tokenAlive(token)) {
      admin.toast('Session expirée : reconnectez-vous');
      admin.logout();
      return;
    }

    try {
      const r = await fetch(API_CONTENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ page: current, content: data })
      });

      if (r.ok) {
        const res = await r.json();
        admin.toast('✓ Sauvegardé');
        dirty = 0; admin.updateSaveInfo();
      } else if (r.status === 401 || r.status === 403) {
        // Jeton invalide ou expiré → reconnexion
        localStorage.removeItem(TOKEN_KEY);
        admin.toast('Session expirée ou non autorisée : reconnectez-vous');
        admin.logout();
      } else {
        const err = await r.json().catch(() => ({}));
        admin.toast('Erreur: ' + (err.error || 'serveur'));
      }
    } catch (e) {
      admin.toast('Erreur réseau');
    }
  },

  toast(msg, cls=''){
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show ' + (cls || '');
    setTimeout(() => { t.className = 'toast'; }, 2600);
  }
};

// Le jeton de session (émis par /login, signé côté serveur) contient
// son d'expiration dans le payload — vérification locale, simple et sûre :
// seule l'API (qui possède la clé HMAC) peut décider de l'écriture.
function tokenAlive(token) {
  try {
    const payloadB64 = String(token).split('.')[0];
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  admin.init();
});
