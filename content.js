// content.js — Affiche sur le site public le contenu enregistré par l'administration.
// Les fichiers content/*.json sont la source de vérité : le CMS (Decap) les modifie,
// ce script les lit puis met à jour la page. En cas d'erreur, le HTML d'origine reste affiché.

(function () {
  'use strict';

  var SECTIONS = {
    accueil: 'panel-accueil',
    pourqui: 'panel-pourqui',
    deroulement: 'panel-deroulement',
    approche: 'panel-approche',
    tarifs: 'panel-tarifs',
    activites: 'panel-activites',
    contact: 'panel-contact'
  };

  function fetchJson(url) {
    // no-store : on veut toujours la dernière version publiée, jamais une vieille copie.
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function imgSrc(value) {
    if (!value) return '';
    if (/^(https?:)?\/\//.test(value) || value.charAt(0) === '/') return value;
    if (value.indexOf('images/') === 0) return value;
    return 'images/' + value;
  }

  function htmlToNodes(html) {
    var box = document.createElement('div');
    box.innerHTML = html || '';
    return Array.prototype.slice.call(box.childNodes);
  }

  function replaceAfterTitle(panel, html) {
    var title = panel.querySelector('h2');
    if (title) {
      // On supprime tout ce qui suit le titre, puis on réinjecte le contenu enregistré.
      while (title.nextSibling) panel.removeChild(title.nextSibling);
    } else {
      while (panel.firstChild) panel.removeChild(panel.firstChild);
    }
    htmlToNodes(html).forEach(function (node) {
      panel.appendChild(node);
    });
  }

  function renderBlocks(panel, blocks) {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    blocks.forEach(function (block) {
      if (block.type === 'title') {
        var h2 = document.createElement('h2');
        h2.textContent = block.value || '';
        panel.appendChild(h2);
      } else if (block.type === 'text') {
        htmlToNodes(block.value).forEach(function (node) {
          panel.appendChild(node);
        });
      } else if (block.type === 'image' && (block.src || block.file)) {
        var wrap = document.createElement('div');
        wrap.className = 'block-image-content';
        var img = document.createElement('img');
        img.src = imgSrc(block.src || block.file);
        img.alt = block.label || '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        wrap.appendChild(img);
        panel.appendChild(wrap);
      }
    });
  }

  function renderAccueil(panel, data) {
    var title = panel.querySelector('.accueil-text h2') || panel.querySelector('h2');
    if (title && data.title) title.textContent = data.title;

    var photo = panel.querySelector('.accueil-photo img');
    if (photo && data.hero_image) {
      photo.src = imgSrc(data.hero_image);
    }

    var intro = panel.querySelector('.accueil-text');
    if (intro && data.hero_intro) {
      var h2 = intro.querySelector('h2');
      var titleNode = h2 ? h2.cloneNode(true) : null;
      intro.innerHTML = '';
      if (titleNode) intro.appendChild(titleNode);
      htmlToNodes(data.hero_intro).forEach(function (node) {
        intro.appendChild(node);
      });
    }

    var details = panel.querySelector('.accueil-details');
    if (details && data.details) details.innerHTML = data.details;
  }

  // Remet les classes de style du site si elles ont été perdues lors d'une édition.
  function decorate(section, panel) {
    if (section === 'deroulement') {
      Array.prototype.forEach.call(panel.querySelectorAll('h3'), function (el) {
        el.classList.add('titre-violet');
        el.classList.add('titre-violet-normal');
      });
      Array.prototype.forEach.call(panel.querySelectorAll('h4'), function (el) {
        el.classList.add('titre-violet');
      });
    }

    if (section === 'pourqui') {
      Array.prototype.forEach.call(panel.querySelectorAll('p'), function (el) {
        if (/^\s*Bonne nouvelle/i.test(el.textContent)) el.classList.add('bonne-nouvelle');
      });
    }

    if (section === 'approche') {
      Array.prototype.forEach.call(panel.querySelectorAll('p'), function (el) {
        if (/^\s*Donc si vous/i.test(el.textContent)) el.classList.add('approche-invitation');
      });
    }

    if (section === 'tarifs') {
      Array.prototype.forEach.call(panel.querySelectorAll('p'), function (el) {
        if (/^\s*Attention/i.test(el.textContent)) el.classList.add('tarif-avertissement');
      });
    }
  }

  function renderSection(section, data) {
    var panel = document.getElementById(SECTIONS[section]);
    if (!panel || !data) return;

    // Ancien format "blocks" : on continue de le gérer par sécurité.
    if (Array.isArray(data.blocks) && data.blocks.length) {
      renderBlocks(panel, data.blocks);
      decorate(section, panel);
      return;
    }

    if (section === 'accueil') {
      renderAccueil(panel, data);
      decorate(section, panel);
      return;
    }

    var title = panel.querySelector('h2');
    if (title && data.title) title.textContent = data.title;

    if (data.content) {
      replaceAfterTitle(panel, data.content);
    }

    // Image d'illustration (page "Mon approche").
    if (section === 'approche' && data.hero_image) {
      var wrap = document.createElement('div');
      wrap.className = 'approche-image';
      var img = document.createElement('img');
      img.src = imgSrc(data.hero_image);
      img.alt = 'Happy-Thérapie-Holistique';
      img.loading = 'lazy';
      wrap.appendChild(img);
      panel.appendChild(wrap);
    }

    decorate(section, panel);
  }

  function loadContent() {
    Object.keys(SECTIONS).forEach(function (section) {
      fetchJson('content/' + section + '.json')
        .then(function (data) {
          renderSection(section, data);
        })
        .catch(function (err) {
          // Fichier absent ou illisible : on garde le HTML d'origine.
          console.warn('Contenu non chargé pour ' + section + ' :', err.message);
        });
    });

    fetchJson('content/meta.json')
      .then(function (meta) {
        if (meta.title) document.title = meta.title;
        var desc = document.querySelector('meta[name="description"]');
        if (desc && meta.description) desc.setAttribute('content', meta.description);
        var keywords = document.querySelector('meta[name="keywords"]');
        if (keywords && meta.keywords) keywords.setAttribute('content', meta.keywords);
      })
      .catch(function () { /* on garde les métadonnées d'origine */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
