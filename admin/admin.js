// Admin Interface Script with Netlify Identity

const PAGES = ['accueil', 'pourqui', 'deroulement', 'approche', 'tarifs', 'activites', 'contact'];

let current = 'accueil';
let data = { blocks: [] };
let dirty = 0;

const admin = {
  init() {
    this.buildNav();
    this.checkAuth();
  },

  checkAuth() {
    // Netlify Identity check
    if (typeof netlifyIdentity !== 'undefined') {
      netlifyIdentity.on('login', (user) => {
        this.onLogin(user);
      });
      netlifyIdentity.on('logout', () => {
        this.onLogout();
      });
      
      const currentUser = netlifyIdentity.currentUser();
      if (currentUser && currentUser.loggedIn) {
        this.onLogin(currentUser);
      } else {
        this.showLogin();
      }
    } else {
      console.error('Netlify Identity not loaded');
      this.toast('Erreur: Identity non chargé');
    }
  },

  onLogin(user) {
    document.getElementById('view-login').hidden = true;
    document.getElementById('view-admin').hidden = false;
    document.getElementById('userInfo').textContent = `Connecté en tant que ${user.email}`;
    this.showPage('accueil');
  },

  onLogout() {
    document.getElementById('view-admin').hidden = true;
    document.getElementById('view-login').hidden = false;
  },

  showLogin() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-pwd').value = '';
  },

  login() {
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-pwd').value;
    
    if (!email) {
      admin.toast('Entrez votre email');
      return;
    }
    
    if (!pwd) {
      admin.toast('Entrez votre mot de passe');
      return;
    }
    
    // ⚠️ NOUVEAU : Vérification email administrateur
    const ADMIN_EMAIL = 'fbaranes@gmail.com';
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      admin.toast('Accès administrateur réservé à fbaranes@gmail.com');
      return;
    }

    // Netlify Identity login
    netlifyIdentity.login({ email, password: pwd })
      .then(user => {
        // Vérification double - email doit correspondre exactement
        if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          admin.toast('Connexion admin réussie');
          admin.onLogin(user);
        } else {
          admin.toast('Accès administrateur refusé');
          netlifyIdentity.logout();
        }
      })
      .catch(err => {
        admin.toast(err.message || 'Échec connexion');
      });
  },

  logout() {
    netlifyIdentity.logout();
  },

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

  escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); },

  initBlocks() {
    document.querySelectorAll('.rich').forEach(el => {
      if (!el.hasAttribute('data-trumbowyg')) {
        $(el).trumbowyg({ autoparse: false });
        el.setAttribute('data-trumbowyg', 'true');
      }
      el.addEventListener('input', () => admin.markDirty());
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
    
    const user = netlifyIdentity.currentUser();
    const token = user ? user.token : null;
    
    try {
      const r = await fetch('/.netlify/functions/api-content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ page: current, content: data })
      });
      
      if (r.ok) {
        const res = await r.json();
        if (res.token) localStorage.setItem('adminToken', res.token);
        admin.toast('✓ Sauvegardé');
        dirty = 0; admin.updateSaveInfo();
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

document.addEventListener('DOMContentLoaded', () => {
  admin.init();
});