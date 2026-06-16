const path = require('path');

const CANONICAL_HOST = 'amongdemons.com';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const SITE_NAME = 'Among Demons';
const LASTMOD = '2026-06-16';
const DEFAULT_IMAGE_PATH = '/app/images/assets/background/amongdemons_home.png';
const DUNGEON_IMAGE_PATH = '/app/images/assets/background/amongdemons_dungeon.png';
const DEMONS_IMAGE_PATH = '/app/images/demons/1.png';
const LOGO_PATH = '/app/images/amongdemons_logo_250x250.png';
const DEMON_IMAGE_WIDTH = 1024;
const DEMON_IMAGE_HEIGHT = 1024;
const BACKGROUND_IMAGE_WIDTH = 1600;
const BACKGROUND_IMAGE_HEIGHT = 900;
const PUBLIC_IMAGE_WIDTH = 1000;
const PUBLIC_IMAGE_HEIGHT = 1000;

const SEO_KEYWORDS = [
  'demon collection game',
  'browser RPG',
  'roguelike dungeon game',
  'auto-battler',
  'collect demons',
  'build your team',
  'survive dungeon runs'
].join(', ');

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_COLORS = {
  common: '#D1D5D8',
  uncommon: '#41A85F',
  rare: '#2C82C9',
  epic: '#9365B8',
  legendary: '#FAC51C',
  mythic: '#E25041'
};
const TRAIT_LABELS_BY_TYPE = {
  1: 'Fighter',
  2: 'Sniper',
  3: 'Poison',
  4: 'AoE',
  5: 'Bruiser',
  6: 'Assassin',
  7: 'Striker',
  8: 'Thorns',
  9: 'Juggernaut',
  10: 'Healer',
  11: 'Chaotic'
};

function canonicalUrl(pathname = '/') {
  return `${CANONICAL_ORIGIN}${pathname}`;
}

function assetUrl(pathname) {
  return pathname.startsWith('http') ? pathname : canonicalUrl(pathname);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDemonSlug(demon) {
  const name = demon?.typeData?.name || `type-${demon?.type || demon?.id || 'demon'}`;
  return slugify(`${name}-${demon?.rarity || 'common'}`);
}

function getDemonPagePath(demon) {
  return `/demons/${getDemonSlug(demon)}`;
}

function getDemonImagePath(demon) {
  return `/app/images/demons/${getDemonSlug(demon)}.png`;
}

function getDemonImageFilePath(demon) {
  return path.join(__dirname, '..', 'public', 'app', 'images', 'demons', `${demon.id}.png`);
}

function findDemonBySlug(catalog, slug) {
  return catalog.find((demon) => getDemonSlug(demon) === slug) || null;
}

function sortCatalog(catalog) {
  return [...catalog].sort((a, b) => {
    const typeDelta = Number(a.type) - Number(b.type);
    if (typeDelta) return typeDelta;
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });
}

function renderHomePage(catalog) {
  const featuredDemons = getFeaturedDemons(catalog);
  const title = 'Among Demons | Browser Demon Collection Roguelike Auto-Battler';
  const description = 'Collect demons, build your team, and survive dungeon runs in Among Demons, a browser-based roguelike auto-battler RPG.';
  const jsonLd = buildBaseJsonLd({
    title,
    description,
    canonicalPath: '/',
    imagePath: DEFAULT_IMAGE_PATH,
    imageAlt: 'Among Demons browser roguelike auto-battler artwork'
  });

  return renderDocument({
    title,
    description,
    canonicalPath: '/',
    imagePath: DEFAULT_IMAGE_PATH,
    imageAlt: 'Among Demons browser roguelike auto-battler artwork',
    bodyClass: 'seo-page seo-home-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-home-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">Browser RPG auto-battler</span>
          <h1>Among Demons</h1>
          <p>Collect demons, build your team, and survive roguelike dungeon runs in a browser-based demon collection game.</p>
          <div class="seo-action-row">
            <a class="btn btn-primary btn-lg" href="/dungeon">Enter Dungeon</a>
            <a class="btn btn-outline-light btn-lg" href="/demons">Browse Demons</a>
          </div>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>Collect demons and shape your run</h2>
          <p>Each demon has a role, rarity, position, and combat profile. Draft starters, recruit defeated enemies, and turn the best survivors into a permanent collection.</p>
        </div>
        <div class="seo-feature-grid">
          <article>
            <h3>Demon collection game</h3>
            <p>Find common, uncommon, rare, epic, legendary, and mythic demons with different strengths and weaknesses.</p>
          </article>
          <article>
            <h3>Roguelike dungeon game</h3>
            <p>Push floor by floor, choose when to recruit, and extract rewards before a run collapses.</p>
          </article>
          <article>
            <h3>Auto-battler team building</h3>
            <p>Set your formation, balance front-line and back-line demons, then let combat resolve server-side.</p>
          </article>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>Featured demons</h2>
          <p>Start with the catalog, then build a team around roles like fighter, striker, healer, poison, and chaotic damage.</p>
        </div>
        <div class="seo-demon-grid">
          ${featuredDemons.map((demon) => renderDemonCard(demon)).join('')}
        </div>
      </section>
    `
  });
}

function renderDemonsPage(catalog) {
  const sortedCatalog = sortCatalog(catalog);
  const title = 'Demons | Among Demons Demon Collection Game';
  const description = 'Browse every Among Demons creature by rarity, role, position, and stats for the browser RPG roguelike auto-battler.';
  const imageObjects = sortedCatalog.map(buildDemonImageObject);
  const jsonLd = [
    ...buildBaseJsonLd({
      title,
      description,
      canonicalPath: '/demons',
      imagePath: DEMONS_IMAGE_PATH,
      imageAlt: 'Among Demons demon collection catalog'
    }),
    ...imageObjects
  ];

  return renderDocument({
    title,
    description,
    canonicalPath: '/demons',
    imagePath: DEMONS_IMAGE_PATH,
    imageAlt: 'Among Demons demon collection catalog',
    bodyClass: 'seo-page seo-demons-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-demons-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">Demon catalog</span>
          <h1>Demons</h1>
          <p>Browse the demons available in Among Demons, then collect demons, build your team, and survive dungeon runs.</p>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>All demon variants</h2>
          <p>${sortedCatalog.length} rarity variants across ${new Set(sortedCatalog.map((demon) => demon.type)).size} demon types.</p>
        </div>
        <div class="seo-demon-grid">
          ${sortedCatalog.map((demon) => renderDemonCard(demon)).join('')}
        </div>
      </section>
    `
  });
}

function renderDemonPage(demon, relatedDemons = []) {
  const name = getDemonName(demon);
  const rarity = capitalize(demon.rarity);
  const titleName = `${rarity} ${name}`;
  const role = getTraitLabel(demon);
  const position = getPositionLabel(demon);
  const stats = getScaledStats(demon);
  const title = `${titleName} | Among Demons Demon Guide`;
  const description = `${titleName} is a ${role.toLowerCase()} demon for ${position.toLowerCase()} teams in Among Demons, a browser RPG roguelike auto-battler.`;
  const imageAlt = `${titleName}, a ${role.toLowerCase()} demon in Among Demons`;
  const canonicalPath = getDemonPagePath(demon);
  const imageObject = buildDemonImageObject(demon);
  const jsonLd = [
    ...buildBaseJsonLd({
      title,
      description,
      canonicalPath,
      imagePath: getDemonImagePath(demon),
      imageAlt
    }),
    imageObject
  ];

  return renderDocument({
    title,
    description,
    canonicalPath,
    imagePath: getDemonImagePath(demon),
    imageAlt,
    bodyClass: 'seo-page seo-demon-page',
    jsonLd,
    main: `
      <section class="seo-demon-detail seo-rarity-${escapeHtml(demon.rarity)}" style="--rarity-color: ${escapeHtml(getRarityColor(demon.rarity))}">
        <div class="seo-demon-detail-art">
          ${renderDemonImage(demon, { loading: 'eager', alt: imageAlt })}
        </div>
        <div class="seo-demon-detail-copy">
          <span class="seo-kicker">${rarity} ${role}</span>
          <h1>${escapeHtml(titleName)}</h1>
          <p>${escapeHtml(getDemonLore(demon))}</p>

          <dl class="seo-stat-list">
            ${renderStatRow('Role', role)}
            ${renderStatRow('Type', `Type ${demon.type}`)}
            ${renderStatRow('Rarity', rarity)}
            ${renderStatRow('Position', position)}
            ${renderStatRow('Health', stats.hp)}
            ${renderStatRow('Attack', stats.atk)}
            ${renderStatRow('Speed', stats.speed)}
          </dl>

          <div class="seo-action-row">
            <a class="btn btn-primary" href="/dungeon">Use demons in dungeon</a>
            <a class="btn btn-outline-light" href="/demons">All demons</a>
          </div>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>How ${escapeHtml(name)} plays</h2>
          <p>${escapeHtml(titleName)} fits ${position.toLowerCase()} teams that need ${role.toLowerCase()} pressure while you build your team and survive dungeon runs.</p>
        </div>
        <div class="seo-feature-grid">
          <article>
            <h3>Strengths</h3>
            ${renderTextList(demon.typeData?.strengths)}
          </article>
          <article>
            <h3>Weaknesses</h3>
            ${renderTextList(demon.typeData?.weaknesses)}
          </article>
          <article>
            <h3>Dungeon role</h3>
            <p>${escapeHtml(getAbilitySummary(demon))}</p>
          </article>
        </div>
      </section>

      ${relatedDemons.length ? `
        <section class="seo-section">
          <div class="seo-section-heading">
            <h2>Related demons</h2>
            <p>Compare nearby rarity variants before you start your next dungeon run.</p>
          </div>
          <div class="seo-demon-grid">
            ${relatedDemons.map((item) => renderDemonCard(item)).join('')}
          </div>
        </section>
      ` : ''}
    `
  });
}

function renderSitemap(catalog) {
  const sortedCatalog = sortCatalog(catalog);
  const entries = [
    {
      loc: canonicalUrl('/'),
      priority: '1.0',
      changefreq: 'weekly',
      images: [imageEntry(DEFAULT_IMAGE_PATH, 'Among Demons browser roguelike auto-battler artwork')]
    },
    {
      loc: canonicalUrl('/demons'),
      priority: '0.9',
      changefreq: 'weekly',
      images: sortedCatalog.map((demon) => imageEntry(getDemonImagePath(demon), getDemonImageAlt(demon)))
    },
    {
      loc: canonicalUrl('/collection'),
      priority: '0.85',
      changefreq: 'weekly',
      images: [imageEntry('/app/images/assets/background/amongdemons_collection.png', 'Among Demons demon collection checklist artwork')]
    },
    {
      loc: canonicalUrl('/dungeon'),
      priority: '0.8',
      changefreq: 'weekly',
      images: [imageEntry(DUNGEON_IMAGE_PATH, 'Among Demons roguelike dungeon gameplay artwork')]
    },
    {
      loc: canonicalUrl('/rankings'),
      priority: '0.5',
      changefreq: 'daily',
      images: [imageEntry('/app/images/assets/background/amongdemons_rankings.png', 'Among Demons dungeon rankings artwork')]
    },
    {
      loc: canonicalUrl('/privacy'),
      priority: '0.2',
      changefreq: 'yearly',
      images: [imageEntry(LOGO_PATH, 'Among Demons logo')]
    },
    {
      loc: canonicalUrl('/terms'),
      priority: '0.2',
      changefreq: 'yearly',
      images: [imageEntry(LOGO_PATH, 'Among Demons logo')]
    },
    ...sortedCatalog.map((demon) => ({
      loc: canonicalUrl(getDemonPagePath(demon)),
      priority: '0.7',
      changefreq: 'monthly',
      images: [imageEntry(getDemonImagePath(demon), getDemonImageAlt(demon))]
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.map(renderSitemapEntry).join('\n') +
    `\n</urlset>\n`;
}

function renderRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /app/api-test.html',
    '',
    `Sitemap: ${canonicalUrl('/sitemap.xml')}`,
    ''
  ].join('\n');
}

function renderDocument({
  title,
  description,
  canonicalPath,
  imagePath,
  imageAlt,
  bodyClass,
  jsonLd,
  main,
  ogType = 'website',
  robots = 'index, follow'
}) {
  const canonical = canonicalUrl(canonicalPath);
  const image = assetUrl(imagePath);

  return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="${escapeHtml(robots)}">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(SEO_KEYWORDS)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <link rel="icon" href="/app/images/amongdemons.ico" type="image/x-icon">
    <title>${escapeHtml(title)}</title>
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="${getImageWidth(imagePath)}">
    <meta property="og:image:height" content="${getImageHeight(imagePath)}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
    ${renderJsonLd(jsonLd)}
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="/app/css/main.css" rel="stylesheet">
  </head>
  <body class="${escapeHtml(bodyClass)}">
    ${renderPublicNav()}
    <main>
      ${main}
    </main>
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/lucide/lucide.min.js"></script>
    <script src="/app/js/icons.js"></script>
    <script src="/app/js/api-config.js"></script>
    <script src="/app/js/session.js"></script>
    <script src="/app/js/navigation.js"></script>
  </body>
</html>
`;
}

function buildBaseJsonLd({ title, description, canonicalPath, imagePath, imageAlt }) {
  const canonical = canonicalUrl(canonicalPath);
  const image = assetUrl(imagePath);

  return [
    {
      '@type': 'WebSite',
      '@id': `${CANONICAL_ORIGIN}/#website`,
      url: CANONICAL_ORIGIN,
      name: SITE_NAME,
      description: 'A browser-based demon collection roguelike auto-battler game.',
      inLanguage: 'en'
    },
    {
      '@type': 'Organization',
      '@id': `${CANONICAL_ORIGIN}/#organization`,
      name: SITE_NAME,
      url: CANONICAL_ORIGIN,
      logo: {
        '@type': 'ImageObject',
        url: assetUrl(LOGO_PATH),
        width: PUBLIC_IMAGE_WIDTH,
        height: PUBLIC_IMAGE_HEIGHT
      }
    },
    {
      '@type': 'VideoGame',
      '@id': `${CANONICAL_ORIGIN}/#videogame`,
      name: SITE_NAME,
      url: CANONICAL_ORIGIN,
      description: 'Among Demons is a browser-based demon collection roguelike auto-battler game where players collect demons, build teams, and survive dungeon runs.',
      image,
      genre: ['Roguelike', 'Auto-battler', 'Browser RPG', 'Dungeon crawler', 'Demon collection game'],
      gamePlatform: 'Web browser',
      operatingSystem: 'Any',
      playMode: 'SinglePlayer',
      applicationCategory: 'Game',
      publisher: { '@id': `${CANONICAL_ORIGIN}/#organization` }
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${CANONICAL_ORIGIN}/#website` },
      about: { '@id': `${CANONICAL_ORIGIN}/#videogame` },
      primaryImageOfPage: imagePath.includes('/demons/')
        ? { '@id': `${image}#image` }
        : {
        '@type': 'ImageObject',
        url: image,
        caption: imageAlt
      }
    }
  ];
}

function buildDemonImageObject(demon) {
  const imagePath = getDemonImagePath(demon);
  return {
    '@type': 'ImageObject',
    '@id': `${assetUrl(imagePath)}#image`,
    contentUrl: assetUrl(imagePath),
    url: assetUrl(imagePath),
    name: getDemonImageAlt(demon),
    caption: getDemonImageAlt(demon),
    width: DEMON_IMAGE_WIDTH,
    height: DEMON_IMAGE_HEIGHT
  };
}

function renderJsonLd(items = []) {
  const graph = Array.isArray(items) ? items.filter(Boolean) : [items];
  if (!graph.length) return '';

  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  }).replace(/</g, '\\u003c')}</script>`;
}

function renderPublicNav() {
  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom">
      <div class="container-fluid">
        <a class="navbar-brand" href="/">
          <img src="${LOGO_PATH}" alt="Among Demons logo" class="d-inline-block align-middle me-2 logo-nav" width="48" height="48" loading="eager">
          Among Demons
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item"><a class="nav-link" href="/demons">Demons</a></li>
            <li class="nav-item"><a class="nav-link" href="/dungeon">Dungeon</a></li>
            <li class="nav-item"><a class="nav-link" href="/collection">Collection</a></li>
            <li class="nav-item"><a class="nav-link" href="/rankings">Rankings</a></li>
          </ul>
          <div class="nav-auth-actions" data-nav-auth-actions>
            <a class="btn btn-outline-light btn-sm" href="/login">Login</a>
            <a class="btn btn-primary btn-sm" href="/register">Register</a>
          </div>
          <div class="nav-account d-none" data-nav-account>
            <span class="nav-balance" id="navSoulBalance" data-nav-souls role="status" aria-live="polite" aria-atomic="true" title="Soul balance">
              <span class="soul-amount nav-soul-amount" aria-label="Souls loading">
                <img src="/app/images/assets/soul.svg" class="ad-icon soul-icon" alt="" width="16" height="16" loading="lazy" aria-hidden="true">
                <span class="soul-amount-value">-</span>
                <span class="soul-amount-label">Souls</span>
              </span>
            </span>
            <a class="nav-player" href="/camp" title="Go to camp">
              <i data-lucide="user"></i>
              <span id="navPlayerName" data-nav-player-name></span>
            </a>
            <button class="btn nav-logout-btn btn-icon-only" id="logoutBtn" type="button" title="Logout" aria-label="Logout">
              <i data-lucide="log-out"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function renderFooter() {
  return `
    <footer class="site-footer py-4 border-top">
      <div class="container text-center text-body-secondary">
        <p class="mb-0">&copy; 2026 Among Demons. Code licensed under MIT.</p>
        <nav class="footer-links" aria-label="Legal links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </nav>
      </div>
    </footer>
  `;
}

function renderDemonCard(demon) {
  const name = getDemonName(demon);
  const rarity = capitalize(demon.rarity);
  const title = `${rarity} ${name}`;
  const stats = getScaledStats(demon);
  return `
    <article class="seo-demon-card seo-rarity-${escapeHtml(demon.rarity)}" style="--rarity-color: ${escapeHtml(getRarityColor(demon.rarity))}">
      <a class="seo-demon-card-art" href="${getDemonPagePath(demon)}" aria-label="${escapeHtml(title)} demon guide">
        ${renderDemonImage(demon)}
      </a>
      <div class="seo-demon-card-body">
        <span class="seo-demon-card-rarity">${escapeHtml(rarity)} ${escapeHtml(getTraitLabel(demon))}</span>
        <h3><a href="${getDemonPagePath(demon)}">${escapeHtml(title)}</a></h3>
        <p>${escapeHtml(getDemonCardDescription(demon))}</p>
        <div class="seo-demon-card-meta" aria-label="${escapeHtml(title)} stats">
          <span>HP ${escapeHtml(stats.hp)}</span>
          <span>ATK ${escapeHtml(stats.atk)}</span>
          <span>SPD ${escapeHtml(stats.speed)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderDemonImage(demon, options = {}) {
  const title = `${capitalize(demon.rarity)} ${getDemonName(demon)}`;
  const alt = options.alt || `${title}, a ${getTraitLabel(demon).toLowerCase()} demon for the Among Demons browser RPG`;
  return `<img src="${getDemonImagePath(demon)}" alt="${escapeHtml(alt)}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="${options.loading || 'lazy'}" decoding="async" onerror="this.onerror=null;this.src='${LOGO_PATH}';">`;
}

function renderStatRow(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderTextList(items) {
  if (!Array.isArray(items) || !items.length) return '<p>No details listed yet.</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderSitemapEntry(entry) {
  return [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${LASTMOD}</lastmod>`,
    `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`,
    `    <priority>${escapeXml(entry.priority)}</priority>`,
    ...(entry.images || []).map(renderSitemapImage),
    '  </url>'
  ].join('\n');
}

function renderSitemapImage(image) {
  return [
    '    <image:image>',
    `      <image:loc>${escapeXml(assetUrl(image.path))}</image:loc>`,
    `      <image:title>${escapeXml(image.title)}</image:title>`,
    `      <image:caption>${escapeXml(image.title)}</image:caption>`,
    '    </image:image>'
  ].join('\n');
}

function imageEntry(pathname, title) {
  return { path: pathname, title };
}

function getFeaturedDemons(catalog) {
  const slugs = ['boof-nitza-common', 'baobaw-legendary', 'ba-beaga-rare', 'vee-scol-mythic'];
  return slugs
    .map((slug) => findDemonBySlug(catalog, slug))
    .filter(Boolean);
}

function getRelatedDemons(catalog, demon) {
  return sortCatalog(catalog)
    .filter((item) => Number(item.type) === Number(demon.type) && item.id !== demon.id)
    .slice(0, 3);
}

function getDemonName(demon) {
  return demon?.typeData?.name || `Type ${demon?.type || ''} Demon`;
}

function getDemonImageAlt(demon) {
  return `${capitalize(demon.rarity)} ${getDemonName(demon)} demon artwork from Among Demons`;
}

function getDemonCardDescription(demon) {
  const rarity = String(demon.rarity || '').toLowerCase();
  const name = getDemonName(demon);
  const position = getPositionLabel(demon).toLowerCase();
  const role = getTraitLabel(demon).toLowerCase();
  const strength = getPrimaryStrength(demon).toLowerCase();
  const rarityLead = {
    common: 'Starter-friendly',
    uncommon: 'Upgraded',
    rare: 'Reliable mid-run',
    epic: 'High-impact',
    legendary: 'Run-defining',
    mythic: 'Peak-power'
  }[rarity] || capitalize(rarity);

  return `${rarityLead} ${name}: ${position} ${role} built for ${strength}.`;
}

function getDemonLore(demon) {
  const name = getDemonName(demon);
  const role = getTraitLabel(demon).toLowerCase();
  const position = getPositionLabel(demon).toLowerCase();
  const strength = getPrimaryStrength(demon).toLowerCase();
  return `${name} is a ${role} demon built for the ${position} line. Bring it into dungeon runs when your team needs ${strength} and a stronger path through the next fight.`;
}

function getAbilitySummary(demon) {
  const ability = demon.typeData?.ability || {};
  const kind = formatLabel(ability.kind || 'combat ability').toLowerCase();
  const targeting = formatLabel(demon.typeData?.targeting || 'enemy').toLowerCase();
  return `${getDemonName(demon)} uses ${kind} patterns and ${targeting} targeting to help your team survive roguelike dungeon battles.`;
}

function getTraitLabel(demon = {}) {
  const typeId = Number(demon.type);
  if (TRAIT_LABELS_BY_TYPE[typeId]) return TRAIT_LABELS_BY_TYPE[typeId];
  return formatLabel(demon.typeData?.role || 'Demon');
}

function getPositionLabel(demon = {}) {
  const position = String(demon.preferredPosition || demon.typeData?.preferredPosition || '').toLowerCase();
  if (position === 'front') return 'Front-line';
  if (position === 'back') return 'Back-line';
  return position ? formatLabel(position) : 'Flexible';
}

function getScaledStats(demon) {
  const typeData = demon.typeData || {};
  const multiplier = Number(typeData.rarityMultiplier?.[demon.rarity]) || 1;
  return {
    hp: scaleRange(typeData.baseStats?.hp, multiplier),
    atk: scaleRange(typeData.baseStats?.atk, multiplier),
    speed: scaleRange(typeData.baseStats?.speed, multiplier)
  };
}

function getPrimaryStrength(demon) {
  return Array.isArray(demon.typeData?.strengths) && demon.typeData.strengths[0]
    ? demon.typeData.strengths[0]
    : 'reliable pressure';
}

function getRarityColor(rarity) {
  return RARITY_COLORS[rarity] || RARITY_COLORS.common;
}

function scaleRange(range, multiplier) {
  if (!Array.isArray(range) || range.length < 2) return 'Unknown';
  return `${Math.round(Number(range[0]) * multiplier)}-${Math.round(Number(range[1]) * multiplier)}`;
}

function getImageWidth(imagePath) {
  return imagePath.includes('/demons/') ? DEMON_IMAGE_WIDTH : BACKGROUND_IMAGE_WIDTH;
}

function getImageHeight(imagePath) {
  return imagePath.includes('/demons/') ? DEMON_IMAGE_HEIGHT : BACKGROUND_IMAGE_HEIGHT;
}

function formatLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

module.exports = {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  findDemonBySlug,
  getDemonImageFilePath,
  getDemonImagePath,
  getDemonPagePath,
  getDemonSlug,
  getRelatedDemons,
  renderDemonPage,
  renderDemonsPage,
  renderHomePage,
  renderRobotsTxt,
  renderSitemap
};
