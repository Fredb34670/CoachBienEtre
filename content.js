// content.js - Chargement dynamique du contenu depuis les fichiers JSON

const SECTION_IDS = {
  accueil: 'panel-accueil',
  pourqui: 'panel-pourqui',
  deroulement: 'panel-deroulement',
  approche: 'panel-approche',
  tarifs: 'panel-tarifs',
  activites: 'panel-activites',
  contact: 'panel-contact'
};

async function loadSection(section) {
  try {
    // Charger depuis l'API (Blob ou fallback local)
    const response = await fetch('/.netlify/functions/api-content');
    if (response.ok) {
      const allContent = await response.json();
      const data = allContent[section];
      if (data) {
        renderSection(section, data);
        return;
      }
    }
    throw new Error('Section not found in API');
  } catch (error) {
    console.warn(`Contenu par défaut pour ${section}`);
    // Fallback: garder le HTML statique tel quel
  }
}

function renderSection(section, data) {
  const panel = document.getElementById(SECTION_IDS[section]);
  if (!panel) return;

  // Gestion spéciale pour la section accueil (structure héro + details)
  if (section === 'accueil') {
    // Mettre à jour le titre de la section (h2)
    const h2 = panel.querySelector('h2');
    if (h2 && data.title) h2.textContent = data.title;

    // Mettre à jour la photo du thérapeute (image dans .accueil-photo)
    const img = panel.querySelector('.accueil-photo img');
    if (img && data.hero_image) {
      img.src = `images/${data.hero_image}`;
      img.alt = `Photo du thérapeute`;
    }

    // Mettre à jour le contenu du héros (ul + p dans .accueil-text)
    // Le HTML de hero_intro contient déjà les listes
    const introContainer = panel.querySelector('.accueil-text');
    if (introContainer && data.hero_intro) {
      // Conserver le titre s'il existe, remplacer le reste
      const existingTitle = introContainer.querySelector('h2');
      introContainer.innerHTML = existingTitle ?
        `<h2>${existingTitle.textContent}</h2>${data.hero_intro}` :
        data.hero_intro;
    }

    // Mettre à jour le contenu détaillé (.accueil-details)
    const details = panel.querySelector('.accueil-details');
    if (details && data.details) details.innerHTML = data.details;
  } else {
    // Pour les autres sections : utiliser data.content si disponible
    const content = data.content || data.intro || data.body || '';
    
    if (content) {
      // Vider le contenu existant (garder le titre)
      const children = Array.from(panel.children);
      const title = panel.querySelector('h2');
      
      // Sauvegarder le titre
      const titleText = title ? title.textContent : data.title;
      
      // Vider le panneau
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      
      // Réinjecter le titre et le contenu
      if (titleText) {
        const newTitle = document.createElement('h2');
        newTitle.textContent = titleText;
        panel.appendChild(newTitle);
      }
      
      // Parser et injecter le contenu HTML
      const temp = document.createElement('div');
      temp.innerHTML = content;
      while (temp.firstChild) {
        panel.appendChild(temp.firstChild);
      }
    } else if (data.title && data.content) {
      // Fallback pour tout autre format
      const title = panel.querySelector('h2');
      if (title) title.textContent = data.title;
      
      const contentEl = panel.querySelector('p, .accueil-details, .approche-image');
      if (contentEl && data.content) {
        contentEl.outerHTML = data.content;
      }
    }
  }
}

// Charger le SEO
function loadSEO(meta) {
  document.title = meta.title;
  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement('meta');
    desc.name = 'description';
    document.head.appendChild(desc);
  }
  desc.content = meta.description;
  
  let keywords = document.querySelector('meta[name="keywords"]');
  if (!keywords) {
    keywords = document.createElement('meta');
    keywords.name = 'keywords';
    document.head.appendChild(keywords);
  }
  keywords.content = meta.keywords;
}

// Chargement au démarrage
document.addEventListener('DOMContentLoaded', async () => {
  const sections = Object.keys(SECTION_IDS);
  for (const section of sections) {
    await loadSection(section);
  }
  
  try {
    const response = await fetch('content/meta.json');
    if (response.ok) {
      const meta = await response.json();
      loadSEO(meta);
    }
  } catch (error) {
    console.warn('SEO par défaut chargé');
  }
});