const fs = require('fs');
const path = require('path');

const CANONICAL_HOST = 'amongdemons.com';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const SITE_NAME = 'Among Demons';
const LASTMOD = '2026-08-13';
const STEAM_APP_ID = '4973450';
const STEAM_STORE_URL = `https://store.steampowered.com/app/${STEAM_APP_ID}/Among_Demons/`;
const STEAM_COMMUNITY_URL = `https://steamcommunity.com/app/${STEAM_APP_ID}`;
const GITHUB_URL = 'https://github.com/amongdemons-com';
const DEFAULT_IMAGE_PATH = '/app/images/assets/background/amongdemons_home.png';
const DEFAULT_IMAGE_PATH_LOGO = '/app/images/assets/background/amongdemons_home_logo.png';
const DUNGEON_IMAGE_PATH = '/app/images/assets/background/amongdemons_dungeon.png';
const DEMONS_IMAGE_PATH = '/app/images/demons/1.png';
const LOGO_PATH = '/app/images/amongdemons_logo_250x250.png';
const PUBLIC_LOGO_PATH = '/app/images/amongdemons_logo_white_text_bottom_1000x1000.png';
const DEMON_IMAGE_WIDTH = 1024;
const DEMON_IMAGE_HEIGHT = 1024;
const BACKGROUND_IMAGE_WIDTH = 1600;
const BACKGROUND_IMAGE_HEIGHT = 900;
const PUBLIC_IMAGE_WIDTH = 1000;
const PUBLIC_IMAGE_HEIGHT = 1000;
const BROWSER_ASSET_MANIFEST_PATH = path.join(__dirname, '..', 'public', 'app', 'dist', 'manifest.json');
const BROWSER_ASSETS = loadBrowserAssets();

const SEO_KEYWORDS = [
  'dark fantasy roguelite',
  'Steam auto battler',
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
const ROLE_COPY_BY_TYPE = {
  1: 'fighter',
  2: 'sniper',
  3: 'poisoner',
  4: 'AoE attacker',
  5: 'bruiser',
  6: 'assassin',
  7: 'striker',
  8: 'counter-tank',
  9: 'juggernaut',
  10: 'healer',
  11: 'chaotic attacker'
};
const PRIMARY_STRENGTH_COPY_BY_TYPE = {
  1: 'reliable front-line pressure',
  2: 'access to any enemy and priority on fragile targets',
  3: 'poison pressure against high-health enemies',
  4: 'team-wide damage that hits every enemy',
  5: 'durable front-line fighting',
  6: 'fast execution against the lowest-health enemy',
  7: 'high front-row pressure',
  8: 'very high health and retaliation against direct attackers',
  9: 'huge single-hit damage and rare row-shove disruption',
  10: 'fast emergency healing',
  11: 'unpredictable targeting and a high damage ceiling'
};

function canonicalUrl(pathname = '/') {
  return `${CANONICAL_ORIGIN}${pathname}`;
}

function steamCampaignUrl(content = 'website') {
  const url = new URL(STEAM_STORE_URL);
  url.searchParams.set('utm_source', CANONICAL_HOST);
  url.searchParams.set('utm_medium', 'website');
  url.searchParams.set('utm_campaign', 'website_conversion');
  url.searchParams.set('utm_content', content);
  return url.toString();
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

function getBossSlug(boss) {
  return slugify(boss?.title || boss?.id || 'world-boss');
}

function getBossLegacySlug(boss) {
  return slugify(boss?.id || boss?.title || 'world-boss');
}

function getBossPagePath(boss) {
  return `/bosses/${getBossSlug(boss)}`;
}

function getBossImagePath(boss) {
  return boss?.keyDemon?.imageUrl || DEMONS_IMAGE_PATH;
}

function findBossBySlug(catalog, slug) {
  const normalizedSlug = slugify(slug);
  return catalog.find((boss) => (
    getBossSlug(boss) === normalizedSlug || getBossLegacySlug(boss) === normalizedSlug
  )) || null;
}

function sortCatalog(catalog) {
  return [...catalog].sort((a, b) => {
    const typeDelta = Number(a.type) - Number(b.type);
    if (typeDelta) return typeDelta;
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });
}

function sortBosses(catalog) {
  return [...catalog].sort((a, b) => Number(a.zoneTypeId) - Number(b.zoneTypeId));
}

function renderHomePage(catalog) {
  const featuredDemons = getFeaturedDemons(catalog);
  const title = 'Among Demons | Dark Fantasy Roguelite Auto Battler on Steam & Web';
  const description = 'Recruit defeated demons, build a team, and risk everything in endless dungeon runs. Play free in your browser or get Among Demons on Steam.';
  const jsonLd = buildBaseJsonLd({
    title,
    description,
    canonicalPath: '/',
    imagePath: DEFAULT_IMAGE_PATH_LOGO,
    imageAlt: 'Among Demons browser roguelike auto-battler artwork'
  });

  return renderDocument({
    title,
    description,
    canonicalPath: '/',
    imagePath: DEFAULT_IMAGE_PATH_LOGO,
    imageAlt: 'Among Demons browser roguelike auto-battler artwork',
    bodyClass: 'seo-page seo-home-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-home-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">Dark fantasy roguelite auto battler</span>
          <h1>Among Demons</h1>
          <p>Recruit defeated enemies, build your team, and extract before one loss ends the run.</p>
          <div class="seo-action-row">
            <a class="btn btn-primary btn-lg" href="${escapeHtml(steamCampaignUrl('home_hero'))}" target="_blank" rel="noopener noreferrer external">Get it on Steam</a>
            <a class="btn btn-glass-muted btn-lg" href="/camp" data-play-instantly data-play-destination="/camp">Play Free in Browser</a>
          </div>
          <p class="seo-hero-note">Steam includes 54 achievements plus <span class="seo-supporter-badge"><span class="player-badge player-badge--the_night_remembers" aria-hidden="true"><span class="player-badge-mark"><i data-lucide="bookmark"></i></span></span><span>The Night Remembers</span></span>, an exclusive supporter badge.</p>
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

function renderPressPage() {
  const title = 'Among Demons Press Kit | Facts, Artwork & Creator Resources';
  const description = 'Official Among Demons press kit with game facts, descriptions, artwork, links, and creator-ready resources for the dark fantasy roguelite auto battler.';
  const imagePath = DEFAULT_IMAGE_PATH_LOGO;
  const jsonLd = buildBaseJsonLd({
    title,
    description,
    canonicalPath: '/press',
    imagePath,
    imageAlt: 'Among Demons official key artwork'
  });
  const steamUrl = steamCampaignUrl('press_kit');

  return renderDocument({
    title,
    description,
    canonicalPath: '/press',
    imagePath,
    imageAlt: 'Among Demons official key artwork',
    bodyClass: 'seo-page seo-press-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-press-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">Press &amp; creator resources</span>
          <h1>Among Demons Press Kit</h1>
          <p>Everything needed to cover, stream, review, or feature the dark fantasy roguelite auto battler.</p>
          <div class="seo-action-row">
            <a class="btn btn-primary" href="${escapeHtml(steamUrl)}" target="_blank" rel="noopener noreferrer external">Steam page &amp; trailer</a>
            <a class="btn btn-glass-muted" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer external">Developer on GitHub</a>
          </div>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <span class="seo-kicker">Quick facts</span>
          <h2>At a glance</h2>
        </div>
        <dl class="seo-fact-grid">
          <div><dt>Game</dt><dd>Among Demons</dd></div>
          <div><dt>Developer / publisher</dt><dd>purecosu</dd></div>
          <div><dt>Released</dt><dd>August 5, 2026</dd></div>
          <div><dt>Platforms</dt><dd>Steam for Windows; web browser</dd></div>
          <div><dt>Genres</dt><dd>Roguelite, auto battler, creature collector, strategy RPG</dd></div>
          <div><dt>Modes</dt><dd>Single-player progression in a shared online world with asynchronous PvP</dd></div>
          <div><dt>Steam App ID</dt><dd>${STEAM_APP_ID}</dd></div>
          <div><dt>Language</dt><dd>English</dd></div>
        </dl>
      </section>

      <section class="seo-section seo-press-copy-section">
        <div class="seo-section-heading">
          <span class="seo-kicker">Copy-ready descriptions</span>
          <h2>About the game</h2>
        </div>
        <article class="seo-copy-card">
          <h3>One sentence</h3>
          <p>Among Demons is a dark fantasy roguelite auto battler where you recruit defeated enemies, build a demon team, and decide when to extract before a lost battle wipes the run.</p>
        </article>
        <article class="seo-copy-card">
          <h3>Short description</h3>
          <p>Enter an endless dungeon with two demons, recruit survivors, arrange your formation, and stack Demonic Pacts into run-defining builds. Push deeper for stronger rewards or extract to preserve Souls, experience, and a captured Echo, then explore a persistent world of hunts, shrines, portals, bosses, and rival hunters.</p>
        </article>
        <article class="seo-copy-card">
          <h3>Feature hooks</h3>
          <ul>
            <li>Collect 66 demons across six rarities and eleven combat roles.</li>
            <li>Recruit defeated enemies and reshape a nine-slot formation during a run.</li>
            <li>Choose stacking Demonic Pacts, then risk deeper floors or extract safely.</li>
            <li>Explore a shared world with passive hunts, events, ambushes, PvP, and twelve world bosses.</li>
            <li>Keep permanent collection, training, skill-tree, quest, and ranking progress.</li>
            <li>Play the same live game free in a browser or support development on Steam.</li>
          </ul>
        </article>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <span class="seo-kicker">Official media</span>
          <h2>Artwork and gameplay</h2>
          <p>Open the original files for editorial use. The Steam page contains the full gameplay trailer and ten 1920&times;1080 screenshots.</p>
        </div>
        <div class="seo-media-grid">
          ${renderPressAsset(PUBLIC_LOGO_PATH, 'Square game logo', '1000 × 1000 PNG')}
          ${renderPressAsset(DEFAULT_IMAGE_PATH_LOGO, 'Among Demons key artwork', '1600 × 900 PNG')}
          ${renderPressAsset(DUNGEON_IMAGE_PATH, 'Dungeon artwork', '1600 × 900 PNG')}
          ${renderPressAsset('/app/images/assets/background/amongdemons_collection.png', 'Collection artwork', '1600 × 900 PNG')}
        </div>
        <div class="seo-action-row">
          <a class="btn btn-primary" href="${escapeHtml(steamUrl)}" target="_blank" rel="noopener noreferrer external">Watch trailer &amp; view screenshots</a>
          <a class="btn btn-glass-muted" href="/camp">Play before covering</a>
        </div>
        <p class="seo-press-usage">Media may be used for editorial coverage, reviews, streams, videos, and posts about Among Demons. Please credit Among Demons / purecosu.</p>
      </section>
    `
  });
}

function renderUpdatesPage(patchNotesMarkdown = '') {
  const patches = parsePatchNotes(patchNotesMarkdown);
  const currentPatch = patches[0];
  const title = 'Among Demons Updates | Patch Notes & New Features';
  const description = currentPatch
    ? `${currentPatch.title}: ${currentPatch.items[0] || 'See the latest Among Demons changes and new features.'}`.slice(0, 155)
    : 'See the latest Among Demons patch notes, new features, balance changes, and fixes.';
  const jsonLd = buildBaseJsonLd({
    title,
    description,
    canonicalPath: '/updates',
    imagePath: DUNGEON_IMAGE_PATH,
    imageAlt: 'Among Demons dungeon update artwork'
  });

  return renderDocument({
    title,
    description,
    canonicalPath: '/updates',
    imagePath: DUNGEON_IMAGE_PATH,
    imageAlt: 'Among Demons dungeon update artwork',
    bodyClass: 'seo-page seo-updates-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-updates-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">Live game updates</span>
          <h1>Patch Notes</h1>
          <p>New systems, balance changes, and fixes from the persistent world of Among Demons.</p>
          <div class="seo-action-row">
            <a class="btn btn-primary" href="/camp">Play the latest version</a>
            <a class="btn btn-primary" href="${escapeHtml(steamCampaignUrl('updates_page'))}" target="_blank" rel="noopener noreferrer external">Get it on Steam</a>
          </div>
        </div>
      </section>
      <section class="seo-section seo-updates-list">
        ${patches.length ? patches.map(renderPatchSection).join('') : '<p>Patch notes are being prepared.</p>'}
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

function renderBossesPage(catalog) {
  const bosses = sortBosses(catalog);
  const title = 'World Bosses | Among Demons Boss Guide';
  const description = 'Browse every Among Demons world boss, including their teams, battle buffs, taunts, difficulty, zone, and victory reward.';
  const imagePath = getBossImagePath(bosses[0]);
  const imageAlt = 'Among Demons world boss catalog';
  const jsonLd = [
    ...buildBaseJsonLd({
      title,
      description,
      canonicalPath: '/bosses',
      imagePath,
      imageAlt
    }),
    ...bosses.map(buildBossImageObject)
  ];

  return renderDocument({
    title,
    description,
    canonicalPath: '/bosses',
    imagePath,
    imageAlt,
    bodyClass: 'seo-page seo-bosses-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-bosses-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">World boss catalog</span>
          <h1>Bosses</h1>
          <p>Study every roaming world boss, the demons guarding them, their battle advantages, and the temporary reward earned for victory.</p>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>All world bosses</h2>
          <p>1 neutral and 11 zone specific boss fights roam the world</p>
        </div>
        <div class="seo-demon-grid seo-boss-grid">
          ${bosses.map((boss) => renderBossCard(boss)).join('')}
        </div>
      </section>
    `
  });
}

const WORLD_EVENTS_GUIDE = [
  {
    icon: 'flame',
    accent: '#e8c76a',
    category: 'Respawn anchor',
    title: 'Forsaken Shrine',
    image: '/app/images/events/marker-shrine.webp',
    imageAlt: 'A Forsaken Shrine marker on the Among Demons world map',
    blurb: 'Bind your soul to a shrine and it becomes your respawn point if you fall in the wilds.',
    chips: ['13 on the map', 'Sets your respawn']
  },
  {
    icon: 'shuffle',
    accent: '#b083c9',
    category: 'Fast travel',
    title: 'Darkness Portal',
    image: '/app/images/events/marker-portal.webp',
    imageAlt: 'A Darkness Portal marker on the Among Demons world map',
    blurb: 'Step through a portal to teleport instantly across the map instead of walking every tile.',
    chips: ['2 Souls / step', '5 portals']
  },
  {
    icon: 'sparkles',
    accent: '#efe8cf',
    category: 'Soul offering',
    title: 'The Whispering Well',
    image: '/app/images/events/marker-whispering-well.webp',
    imageAlt: 'The Whispering Well marker on the Among Demons world map',
    blurb: 'Offer Souls without knowing the outcome and receive a random Whisper that empowers all your demons for four hours.',
    chips: ['Area 14, -8', 'Random 4h buff', 'Costs Souls']
  },
  {
    icon: 'messages-square',
    accent: '#a74fe0',
    category: 'Boss ritual',
    title: 'Altar of Many Voices',
    image: '/app/images/events/marker-anomaly-altar.webp',
    imageAlt: 'The Altar of Many Voices marker on the Among Demons world map',
    blurb: 'Offer Souls at this fixed altar for a nine-floor battle against The Anomaly, which channels all eleven demon types and always retaliates with Thorns. Every defeated Anomaly makes its own 25% Mythic Echo roll, so deeper floors bring more chances.',
    chips: ['Area 4, 0', '5k Souls', '25% per Anomaly']
  },
  {
    icon: 'amphora',
    accent: '#d7b765',
    category: 'Traveling merchant',
    title: 'Crowley the Merchant',
    image: '/app/images/events/marker-merchant.webp',
    imageAlt: 'Crowley the traveling merchant wagon on the Among Demons world map',
    blurb: 'Crowley parks his soul-lantern wagon nearby to sell demons and items for Souls.',
    chips: ['Stays 30 min', '4 offers', 'Bribe 50 to reroll']
  },
  {
    icon: 'crosshair',
    accent: '#9365B8',
    category: 'Hunt',
    title: 'Demon Encounters',
    image: '/app/images/events/marker-encounter.webp',
    imageAlt: 'A roaming demon encounter marker on the Among Demons world map',
    blurb: 'Roaming demon teams hold tiles you can hunt for a steady flow of Souls and account XP.',
    chips: ['Terror-rated', 'Souls + XP']
  },
  {
    icon: 'swords',
    accent: '#6fd6bd',
    category: 'PvP duel',
    title: 'Hunter Duels',
    image: '/app/images/events/marker-pvp.webp',
    imageAlt: 'A rival hunter marker standing on a tile in the Among Demons world map',
    blurb: 'When another hunter stands on your tile, challenge them to a battle of formations.',
    chips: ['Same tile', 'Tracks wins & losses']
  },
  {
    icon: 'shield-alert',
    accent: '#E25041',
    category: 'World boss',
    title: 'Roaming World Bosses',
    image: '/app/images/events/marker-boss.webp',
    imageAlt: 'The Fire Dancer world boss tooltip on the Among Demons world map',
    blurb: 'Named zone bosses roam with fixed teams, beat one for a timed reward buff.',
    chips: ['12 bosses', 'Reward buff'],
    href: '/bosses',
    hrefLabel: 'Full boss guide'
  },
  {
    icon: 'badge-alert',
    accent: '#e0873b',
    category: 'Danger',
    title: 'Ambush',
    image: '/app/images/events/marker-ambush.webp',
    imageAlt: 'A long wilderness travel path where ambushes can strike in Among Demons',
    blurb: 'Wander off the roads and demons can ambush you mid-step, forcing an immediate battle.',
    chips: ['~1-in-7 off-road', 'Safer on roads']
  }
];

function renderEventCard(event) {
  const chips = (event.chips || [])
    .map((chip) => `<span>${escapeHtml(chip)}</span>`)
    .join('');
  const link = event.href
    ? `<a class="seo-event-link" href="${escapeHtml(event.href)}">${escapeHtml(event.hrefLabel || 'Learn more')}<i data-lucide="arrow-right"></i></a>`
    : '';

  return `
    <article class="seo-demon-card seo-event-card" style="--rarity-color: ${escapeHtml(event.accent)}">
      <div class="seo-demon-card-art seo-event-art">
        <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.imageAlt)}" width="480" height="480" loading="lazy" decoding="async">
      </div>
      <div class="seo-demon-card-body">
        <span class="seo-demon-card-rarity seo-event-category"><i data-lucide="${escapeHtml(event.icon)}"></i>${escapeHtml(event.category)}</span>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.blurb)}</p>
        ${link}
        <div class="seo-demon-card-meta seo-event-meta" aria-label="${escapeHtml(event.title)} details">
          ${chips}
        </div>
      </div>
    </article>
  `;
}

function renderEventsPage() {
  const title = 'World Events | Among Demons World Guide';
  const description = 'Every Among Demons world event, from forsaken shrines, darkness portals, the Whispering Well, and the Altar of Many Voices to the traveling merchant, demon hunts, ambushes, PvP duels, and roaming world bosses - shown on the real world map.';
  const imagePath = DUNGEON_IMAGE_PATH;
  const imageAlt = 'Among Demons world event guide';
  const jsonLd = [
    ...buildBaseJsonLd({
      title,
      description,
      canonicalPath: '/events',
      imagePath,
      imageAlt
    }),
    ...WORLD_EVENTS_GUIDE.map((event) => ({
      '@type': 'ImageObject',
      contentUrl: assetUrl(event.image),
      url: assetUrl(event.image),
      name: event.imageAlt,
      caption: event.imageAlt
    }))
  ];

  return renderDocument({
    title,
    description,
    canonicalPath: '/events',
    imagePath,
    imageAlt,
    bodyClass: 'seo-page seo-events-page',
    jsonLd,
    main: `
      <section class="seo-hero seo-events-hero">
        <div class="seo-hero-copy">
          <span class="seo-kicker">World event guide</span>
          <h1>World Events</h1>
          <p>Everything that can happen while you roam the wilds and exactly how each one looks on the world map.</p>
        </div>
      </section>

      <section class="seo-section">
        <div class="seo-section-heading">
          <h2>Everything that roams the wilds</h2>
          <p>${WORLD_EVENTS_GUIDE.length} kinds of world events shape every journey across the map.</p>
        </div>
        <div class="seo-demon-grid seo-event-grid">
          ${WORLD_EVENTS_GUIDE.map(renderEventCard).join('')}
        </div>
        <div class="seo-action-row">
          <a class="btn btn-primary" href="/world">Explore the world</a>
          <a class="btn btn-glass-muted" href="/bosses">World boss guide</a>
        </div>
      </section>
    `
  });
}

function renderBossPage(boss, relatedBosses = []) {
  const titleName = boss.title || formatLabel(boss.id);
  const zoneName = boss.zoneName || `Zone ${boss.zoneTypeId}`;
  const keyDemon = boss.keyDemon;
  const keyDemonName = keyDemon?.species || 'Unknown';
  const title = `${titleName} | Among Demons World Boss Guide`;
  const description = `${titleName} is a difficulty ${boss.difficulty} world boss in ${zoneName}. See its team, battle buffs, taunts, and victory reward.`;
  const canonicalPath = getBossPagePath(boss);
  const imagePath = getBossImagePath(boss);
  const imageAlt = `${titleName}, an Among Demons world boss`;
  const jsonLd = [
    ...buildBaseJsonLd({ title, description, canonicalPath, imagePath, imageAlt }),
    buildBossImageObject(boss)
  ];

  return renderDocument({
    title,
    description,
    canonicalPath,
    imagePath,
    imageAlt,
    bodyClass: 'seo-page seo-boss-page',
    jsonLd,
    extraStyles: ['/app/css/battle.css?v=20260716-replay-skip-v2'],
    main: `
      <section class="seo-boss-priority" style="--rarity-color: ${escapeHtml(getRarityColor(keyDemon?.rarity || 'mythic'))}">
        <header class="seo-boss-priority-heading">
          <div class="seo-boss-summary-art boss-key-demon-art">
            ${renderBossImage(boss, { loading: 'eager', alt: imageAlt })}
          </div>
          <div class="seo-boss-priority-copy">
            <span class="seo-kicker">${escapeHtml(zoneName)} world boss</span>
            <h1>${escapeHtml(titleName)}</h1>
            <p>${escapeHtml(boss.personality || 'A roaming world boss waiting to challenge demon hunters.')}</p>
          </div>
        </header>

        <div class="seo-boss-priority-grid">
          <article class="seo-boss-formation-panel">
            <div class="seo-boss-formation-intro">
              <span class="seo-kicker">Encounter formation</span>
              <h2>Boss team</h2>
              <p>${boss.team?.length || 0} demon${boss.team?.length === 1 ? '' : 's'} occupy these exact battle slots.</p>
              <div class="seo-boss-advantages">
                <span class="seo-kicker">Boss advantages</span>
                ${renderBuffList(boss.enemyBuffs, 'No boss advantages listed.')}
              </div>
            </div>
            <div class="seo-boss-formation-layout">
              ${renderBossFormation(boss.team)}
            </div>
          </article>

          <article class="seo-boss-reward-panel">
            <span class="seo-kicker">Victory reward</span>
            <h2>${escapeHtml(boss.rewardBuff?.name || 'No reward listed')}</h2>
            <p>${escapeHtml(boss.rewardBuff?.description || 'This boss does not currently grant a temporary reward.')}</p>
            ${boss.rewardBuff ? `<strong class="seo-boss-reward-duration">Active for ${escapeHtml(formatDurationHours(boss.rewardDurationHours))}</strong>` : ''}
          </article>

          <aside class="seo-boss-summary-panel">
            <dl class="seo-stat-list">
              ${renderStatRow('Difficulty', boss.difficulty)}
              ${renderStatRow('Zone', zoneName)}
              ${renderStatRow('Key Demon', keyDemonName)}
              ${renderStatRow('Moves Every', formatDurationSeconds(boss.moveIntervalSeconds))}
            </dl>
            <div class="seo-action-row">
              <a class="btn btn-primary" href="/world">Find in the world</a>
              <a class="btn btn-glass-muted" href="/bosses">All bosses</a>
            </div>
          </aside>
        </div>
      </section>

      <section class="seo-section seo-boss-secondary-details">
        <div class="seo-section-heading">
          <h2>Boss taunts</h2>
          <p>What ${escapeHtml(titleName)} may say before or during the encounter.</p>
        </div>
        <div class="seo-feature-grid seo-boss-taunts-grid">
          <article>
            <h3>Encounter dialogue</h3>
            ${renderTextList(boss.taunts)}
          </article>
        </div>
      </section>

      ${relatedBosses.length ? `
        <section class="seo-section">
          <div class="seo-section-heading">
            <h2>Other world bosses</h2>
            <p>Compare nearby zones before choosing your next world encounter.</p>
          </div>
          <div class="seo-demon-grid seo-boss-grid">
            ${relatedBosses.map((relatedBoss) => renderBossCard(relatedBoss)).join('')}
          </div>
        </section>
      ` : ''}
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
            <a class="btn btn-glass-muted" href="/demons">All demons</a>
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

function renderSitemap(catalog, bossCatalog = []) {
  const sortedCatalog = sortCatalog(catalog);
  const bosses = sortBosses(bossCatalog);
  const entries = [
    {
      loc: canonicalUrl('/'),
      priority: '1.0',
      changefreq: 'weekly',
      images: [imageEntry(DEFAULT_IMAGE_PATH_LOGO, 'Among Demons browser roguelike auto-battler artwork')]
    },
    {
      loc: canonicalUrl('/demons'),
      priority: '0.9',
      changefreq: 'weekly',
      images: sortedCatalog.map((demon) => imageEntry(getDemonImagePath(demon), getDemonImageAlt(demon)))
    },
    {
      loc: canonicalUrl('/bosses'),
      priority: '0.85',
      changefreq: 'weekly',
      images: bosses.map((boss) => imageEntry(getBossImagePath(boss), getBossImageAlt(boss)))
    },
    {
      loc: canonicalUrl('/events'),
      priority: '0.8',
      changefreq: 'weekly',
      images: [imageEntry(DUNGEON_IMAGE_PATH, 'Among Demons world event guide artwork')]
    },
    {
      loc: canonicalUrl('/updates'),
      priority: '0.75',
      changefreq: 'weekly',
      images: [imageEntry(DUNGEON_IMAGE_PATH, 'Among Demons update artwork')]
    },
    {
      loc: canonicalUrl('/press'),
      priority: '0.6',
      changefreq: 'monthly',
      images: [imageEntry(DEFAULT_IMAGE_PATH_LOGO, 'Among Demons official key artwork')]
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
      loc: canonicalUrl('/leaderboard'),
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
    })),
    ...bosses.map((boss) => ({
      loc: canonicalUrl(getBossPagePath(boss)),
      priority: '0.7',
      changefreq: 'monthly',
      images: [imageEntry(getBossImagePath(boss), getBossImageAlt(boss))]
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
  extraStyles = [],
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
    <link href="/vendor/bootstrap/css/bootstrap.min.css?v=5.3.2" rel="stylesheet">
    <link href="${escapeHtml(versionAppAsset('/app/css/base.css'))}" rel="stylesheet">
    ${extraStyles.map((href) => `<link href="${escapeHtml(versionAppAsset(href))}" rel="stylesheet">`).join('\n    ')}
  </head>
  <body class="${escapeHtml(bodyClass)}">
    ${renderPublicNav(canonicalPath)}
    <main>
      ${main}
    </main>
    ${renderFooter()}
    <script src="${escapeHtml(BROWSER_ASSETS.runtime)}"></script>
  </body>
</html>
`;
}

function loadBrowserAssets() {
  try {
    return JSON.parse(fs.readFileSync(BROWSER_ASSET_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    return { runtime: '/app/dist/runtime.bundle.js' };
  }
}

function versionAppAsset(assetPath) {
  const normalized = String(assetPath || '').replace(/\?v=.*$/, '');
  if (!normalized.startsWith('/app/')) return assetPath;
  try {
    const filePath = path.join(__dirname, '..', 'public', normalized);
    const hash = require('crypto')
      .createHash('sha256')
      .update(fs.readFileSync(filePath))
      .digest('hex')
      .slice(0, 12);
    return `${normalized}?v=${hash}`;
  } catch (error) {
    return assetPath;
  }
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
      sameAs: [STEAM_STORE_URL, GITHUB_URL],
      logo: {
        '@type': 'ImageObject',
        url: assetUrl(PUBLIC_LOGO_PATH),
        width: PUBLIC_IMAGE_WIDTH,
        height: PUBLIC_IMAGE_HEIGHT
      }
    },
    {
      '@type': 'VideoGame',
      '@id': `${CANONICAL_ORIGIN}/#videogame`,
      name: SITE_NAME,
      url: CANONICAL_ORIGIN,
      sameAs: STEAM_STORE_URL,
      datePublished: '2026-08-05',
      description: 'Among Demons is a dark fantasy roguelite auto battler where players recruit defeated demons, build teams, extract from endless dungeon runs, and explore a shared online world.',
      image,
      genre: ['Roguelite', 'Auto battler', 'Creature collector', 'Strategy RPG', 'Dungeon crawler', 'Dark fantasy'],
      gamePlatform: ['Steam', 'Web browser', 'Windows'],
      operatingSystem: ['Windows 10 or later', 'Modern web browser'],
      playMode: ['SinglePlayer', 'MultiPlayer'],
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

function buildBossImageObject(boss) {
  const imagePath = getBossImagePath(boss);
  return {
    '@type': 'ImageObject',
    '@id': `${assetUrl(imagePath)}#image`,
    contentUrl: assetUrl(imagePath),
    url: assetUrl(imagePath),
    name: getBossImageAlt(boss),
    caption: getBossImageAlt(boss),
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

function renderPublicNav(canonicalPath = '/') {
  const activeSection = canonicalPath.startsWith('/demons')
    ? 'demons'
    : canonicalPath.startsWith('/bosses')
      ? 'bosses'
      : canonicalPath.startsWith('/events')
      ? 'events'
      : canonicalPath.startsWith('/dungeon')
        ? 'dungeon'
        : canonicalPath.startsWith('/collection')
          ? 'collection'
          : canonicalPath.startsWith('/leaderboard')
            ? 'leaderboard'
            : canonicalPath.startsWith('/camp')
              ? 'camp'
              : canonicalPath.startsWith('/world')
                ? 'world'
                : '';
  const navLink = (route, href, icon, label, options = {}) => {
    const isActive = activeSection === route;
    const classes = ['nav-link', 'game-nav-link', isActive ? 'active' : '', options.locked ? 'is-locked' : ''].filter(Boolean).join(' ');
    const disabledAttributes = options.locked ? ' aria-disabled="true" data-disabled-link' : '';
    const currentAttribute = isActive ? ' aria-current="page"' : '';
    return `<li class="nav-item"><a class="${classes}" href="${href}" data-game-route="${route}"${currentAttribute}${disabledAttributes}><span class="game-nav-icon"><i data-lucide="${icon}"></i></span><span>${label}</span></a></li>`;
  };
  const guidesActive = ['demons', 'bosses', 'events'].includes(activeSection);
  const guidesDropdown = `
    <li class="nav-item dropdown game-nav-dropdown">
      <button class="nav-link game-nav-link game-nav-dropdown-toggle${guidesActive ? ' active' : ''}" type="button" data-bs-toggle="dropdown" data-bs-auto-close="true" data-game-sections="demons bosses events" aria-expanded="false" aria-label="Open guides navigation">
        <i data-lucide="scroll-text"></i><span>Guides</span><i data-lucide="chevron-down" class="game-nav-caret" aria-hidden="true"></i>
      </button>
      <ul class="dropdown-menu game-nav-dropdown-menu">
        <li><a class="dropdown-item game-nav-dropdown-item${activeSection === 'demons' ? ' active' : ''}" href="/demons" data-game-route="demons"${activeSection === 'demons' ? ' aria-current="page"' : ''}><i data-lucide="skull"></i><span>Demons</span></a></li>
        <li><a class="dropdown-item game-nav-dropdown-item${activeSection === 'bosses' ? ' active' : ''}" href="/bosses" data-game-route="bosses"${activeSection === 'bosses' ? ' aria-current="page"' : ''}><i data-lucide="shield-alert"></i><span>Bosses</span></a></li>
        <li><a class="dropdown-item game-nav-dropdown-item${activeSection === 'events' ? ' active' : ''}" href="/events" data-game-route="events"${activeSection === 'events' ? ' aria-current="page"' : ''}><i data-lucide="sparkles"></i><span>Events</span></a></li>
      </ul>
    </li>`;

  return `
    <nav class="navbar navbar-expand-xl navbar-dark bg-dark border-bottom game-shell-nav" aria-label="Game navigation">
      <div class="container-fluid">
        <a class="navbar-brand game-shell-brand" href="/" aria-label="Among Demons home">
          <img src="${LOGO_PATH}" alt="Among Demons logo" class="logo-nav" width="40" height="40" loading="eager">
          <span class="game-shell-brand-copy"><span class="game-shell-brand-name">Among Demons</span></span>
        </a>
        <button class="navbar-toggler game-shell-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#publicGameNav" aria-controls="publicGameNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="publicGameNav">
          <ul class="navbar-nav game-shell-tabs me-auto">
            ${navLink('dungeon', '/dungeon', 'swords', 'Dungeon')}
            ${navLink('world', '/world', 'map', 'World')}
            ${navLink('camp', '/camp', 'tent', 'Camp')}
            ${navLink('bag', '/bag', 'amphora', 'Bag')}
            ${navLink('collection', '/collection', 'grid-3x3', 'Collection')}
            ${navLink('leaderboard', '/leaderboard', 'trophy', 'Leaderboard')}
            ${guidesDropdown}
          </ul>
          <div class="nav-auth-actions game-shell-auth-actions" data-nav-auth-actions>
            <a class="btn btn-glass-muted btn-sm" href="/login">Login</a>
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
              <span class="nav-player-avatar" aria-hidden="true"><img src="/app/images/demons/map/1.webp" alt="" width="34" height="34" loading="eager" data-nav-profile-image></span>
              <span class="nav-player-copy"><span id="navPlayerName" data-nav-player-name></span><small data-nav-player-level>Level -</small></span>
            </a>
            <a class="nav-settings-link" href="/settings" title="Settings" aria-label="Settings"><i data-lucide="settings"></i></a>
            <button class="btn nav-logout-btn" id="logoutBtn" type="button" title="Logout" aria-label="Logout"><i data-lucide="log-out"></i></button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function renderFooter() {
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="site-footer-main">
          <div class="site-footer-brand">
            <a class="site-footer-logo" href="/" aria-label="Among Demons home">
              <img src="/app/images/amongdemons_logo_white_text_left_1700x700.png" alt="Among Demons" width="1696" height="708" loading="lazy" decoding="async">
            </a>
            <p class="site-footer-tagline">Collect demons, build your team, and descend into a dark roguelike world where every run writes a new story.</p>
          </div>
          <div class="site-footer-community">
            <p class="site-footer-eyebrow">Play &amp; follow</p>
            <a class="site-footer-github site-footer-steam" href="${escapeHtml(steamCampaignUrl('site_footer'))}" target="_blank" rel="noopener noreferrer external" aria-label="Get Among Demons on Steam">
              <span class="site-footer-github-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="16" r="3"></circle><circle cx="17" cy="7" r="3"></circle><path d="m10.5 14.5 4-5M5.2 13.8l-2.7-1.2M10.8 17.5l3.2 1.3a3 3 0 1 0 2.3-5.5"></path></svg></span>
              <span class="site-footer-github-copy"><strong>Get it on Steam</strong><span>54 achievements + supporter badge</span></span>
              <svg class="site-footer-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg>
            </a>
            <a class="site-footer-github" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer external" aria-label="Visit Among Demons on GitHub">
              <span class="site-footer-github-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.3 3.5 6.5 6.8 6.9A4.8 4.8 0 0 0 8 18v4"></path><path d="M8 19c-3 .9-3-1.5-4.2-2"></path></svg></span>
              <span class="site-footer-github-copy"><strong>Build with us</strong><span>github.com/amongdemons-com</span></span>
              <svg class="site-footer-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg>
            </a>
            <p class="site-footer-community-copy">Play the live game, follow development, or help shape what comes next.</p>
          </div>
        </div>
        <div class="site-footer-bottom">
          <p class="site-footer-copyright">&copy; 2026 Among Demons. Code licensed under MIT.</p>
          <nav class="footer-links" aria-label="Footer links">
            <a href="${escapeHtml(STEAM_COMMUNITY_URL)}" target="_blank" rel="noopener noreferrer external">Steam Community</a>
            <a href="/updates">Updates</a>
            <a href="/press">Press Kit</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer external">GitHub</a>
          </nav>
        </div>
      </div>
    </footer>
  `;
}

function renderPressAsset(pathname, title, meta) {
  return `
    <article class="seo-media-card">
      <a href="${escapeHtml(pathname)}" target="_blank" rel="noopener" aria-label="Open full-size ${escapeHtml(title)}">
        <img src="${escapeHtml(pathname)}" alt="${escapeHtml(title)}" width="640" height="360" loading="lazy" decoding="async">
      </a>
      <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)}</span></div>
    </article>
  `;
}

function parsePatchNotes(markdown = '') {
  const patches = [];
  let current = null;
  let currentItem = '';

  const flushItem = () => {
    if (!current || !currentItem) return;
    current.items.push(currentItem.replace(/\s+/g, ' ').trim());
    currentItem = '';
  };

  String(markdown).split(/\r?\n/).forEach((line) => {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flushItem();
      current = { title: heading[1], items: [] };
      patches.push(current);
      return;
    }
    if (!current || /^\s*<!--/.test(line)) return;
    const bullet = line.match(/^\s*-\s+(.+)/);
    if (bullet) {
      flushItem();
      currentItem = bullet[1].trim();
      return;
    }
    if (currentItem && line.trim()) currentItem += ` ${line.trim()}`;
  });
  flushItem();

  return patches.filter((patch) => patch.items.length);
}

function renderPatchSection(patch, index) {
  return `
    <article class="seo-update-card${index === 0 ? ' is-current' : ''}">
      <header>
        <span class="seo-kicker">${index === 0 ? 'Latest update' : 'Previous update'}</span>
        <h2>${escapeHtml(patch.title)}</h2>
      </header>
      <ul>${patch.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </article>
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

function renderBossCard(boss) {
  const title = boss.title || formatLabel(boss.id);
  const zoneName = boss.zoneName || `Zone ${boss.zoneTypeId}`;
  const rarity = boss.keyDemon?.rarity || 'mythic';
  const teamSize = boss.team?.length || 0;
  return `
    <article class="seo-demon-card seo-boss-card" style="--rarity-color: ${escapeHtml(getRarityColor(rarity))}">
      <a class="seo-demon-card-art boss-key-demon-art" href="${getBossPagePath(boss)}" aria-label="${escapeHtml(title)} world boss guide">
        ${renderBossImage(boss)}
      </a>
      <div class="seo-demon-card-body">
        <span class="seo-demon-card-rarity">${escapeHtml(zoneName)} boss</span>
        <h3><a href="${getBossPagePath(boss)}">${escapeHtml(title)}</a></h3>
        <p>${escapeHtml(boss.personality || 'A roaming world boss encounter.')}</p>
        <div class="seo-demon-card-meta" aria-label="${escapeHtml(title)} encounter details">
          <span>${escapeHtml(teamSize)} Demon${teamSize === 1 ? '' : 's'}</span>
          <span>${escapeHtml(boss.rewardBuff?.name || 'No Reward')}</span>
        </div>
      </div>
    </article>
  `;
}

function renderBossFormation(team = []) {
  const assignments = Array.from({ length: 9 }, () => null);
  const overflow = [];

  (Array.isArray(team) ? team : []).slice(0, 9).forEach((member) => {
    const slot = Number(member.formationSlot);
    if (Number.isInteger(slot) && slot >= 0 && slot < assignments.length && !assignments[slot]) {
      assignments[slot] = member;
    } else {
      overflow.push(member);
    }
  });

  overflow.forEach((member) => {
    const slot = assignments.findIndex((candidate) => !candidate);
    if (slot >= 0) assignments[slot] = member;
  });

  const displayAssignments = Array.from({ length: 9 }, () => null);
  assignments.forEach((member, slot) => {
    const row = Math.floor(slot / 3);
    const column = slot % 3;
    const mirroredSlot = row * 3 + (2 - column);
    if (member) displayAssignments[mirroredSlot] = { member, slot };
  });

  return `
    <div class="seo-boss-formation-axis" aria-hidden="true"><span>Back line</span><span>Front line</span></div>
    <div class="seo-boss-team-board hunter-team-board battle-side battle-side-enemy">
      <div class="battle-formation battle-formation-grid battle-formation-enemy" role="list" aria-label="Boss team formation">
        ${displayAssignments.map((assignment, displaySlot) => {
          const position = displaySlot % 3 === 2 ? 'front' : 'back';
          const originalSlot = Math.floor(displaySlot / 3) * 3 + (2 - (displaySlot % 3));
          const classes = [
            'formation-slot',
            `formation-slot-${position}`,
            assignment ? 'has-demon' : 'is-empty'
          ].join(' ');

          return `
            <div class="${classes}" data-formation-slot="${assignment?.slot ?? originalSlot}" role="listitem" aria-label="Boss team slot ${(assignment?.slot ?? originalSlot) + 1}">
              <div class="formation-slot-cards">
                ${assignment
                  ? renderBossFormationMember(assignment.member)
                  : `<div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${originalSlot + 1}"><img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false"></div>`}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderBossFormationMember(member) {
  const title = `${capitalize(member.rarity)} ${member.species}`;
  const guidePath = member.demon ? getDemonPagePath(member.demon) : '';
  const tag = guidePath ? 'a' : 'article';
  const href = guidePath ? ` href="${guidePath}" aria-label="View ${escapeHtml(title)} demon guide"` : '';

  return `
    <${tag} class="dungeon-demon-card hunter-team-card" style="--rarity-color: ${escapeHtml(getRarityColor(member.rarity))}"${href}>
      <div class="dungeon-demon-card-image" aria-label="${escapeHtml(capitalize(member.rarity))} rarity">
        <img src="${escapeHtml(member.imageUrl || LOGO_PATH)}" alt="${escapeHtml(`${title} in the boss formation`)}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="eager" decoding="async" draggable="false" onerror="this.onerror=null;this.src='${LOGO_PATH}';">
        <span class="dungeon-demon-rarity-gem" aria-hidden="true"></span>
      </div>
      <div class="dungeon-demon-card-body">
        <div class="dungeon-demon-card-title">
          <span class="dungeon-demon-card-rarity">${escapeHtml(capitalize(member.rarity))}</span>
          <span class="text-white">${escapeHtml(member.species)}</span>
        </div>
      </div>
    </${tag}>
  `;
}

function renderDemonImage(demon, options = {}) {
  const title = `${capitalize(demon.rarity)} ${getDemonName(demon)}`;
  const alt = options.alt || `${title}, a ${getTraitLabel(demon).toLowerCase()} demon for the Among Demons browser RPG`;
  return `<img src="${getDemonImagePath(demon)}" alt="${escapeHtml(alt)}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="${options.loading || 'lazy'}" decoding="async" onerror="this.onerror=null;this.src='${LOGO_PATH}';">`;
}

function renderBossImage(boss, options = {}) {
  const title = boss.title || formatLabel(boss.id);
  const alt = options.alt || `${title}, a world boss in Among Demons`;
  return `<img src="${escapeHtml(getBossImagePath(boss))}" alt="${escapeHtml(alt)}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="${options.loading || 'lazy'}" decoding="async" onerror="this.onerror=null;this.src='${LOGO_PATH}';">`;
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

function renderBuffList(buffs, emptyMessage) {
  if (!Array.isArray(buffs) || !buffs.length) return `<p>${escapeHtml(emptyMessage)}</p>`;
  return `<ul>${buffs.map((buff) => (
    `<li><strong>${escapeHtml(buff.name || 'Boss advantage')}:</strong> ${escapeHtml(buff.description || 'No effect description.')}</li>`
  )).join('')}</ul>`;
}

function formatDurationSeconds(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds >= 3600 && seconds % 3600 === 0) return formatDurationHours(seconds / 3600);
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function formatDurationHours(value) {
  const hours = Math.max(0, Number(value) || 0);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
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

function getRelatedBosses(catalog, boss) {
  const bosses = sortBosses(catalog);
  const currentIndex = bosses.findIndex((item) => item.id === boss.id);
  if (currentIndex === -1) return bosses.filter((item) => item.id !== boss.id).slice(0, 3);

  return [1, 2, 3]
    .map((offset) => bosses[(currentIndex + offset) % bosses.length])
    .filter((item) => item && item.id !== boss.id);
}

function getDemonName(demon) {
  return demon?.typeData?.name || `Type ${demon?.type || ''} Demon`;
}

function getDemonImageAlt(demon) {
  return `${capitalize(demon.rarity)} ${getDemonName(demon)} demon artwork from Among Demons`;
}

function getBossImageAlt(boss) {
  const title = boss.title || formatLabel(boss.id);
  const keyDemon = boss.keyDemon?.species ? ` represented by ${boss.keyDemon.species}` : '';
  return `${title} world boss artwork from Among Demons${keyDemon}`;
}

function getDemonCardDescription(demon) {
  const rarity = String(demon.rarity || '').toLowerCase();
  const name = getDemonName(demon);
  const position = getPositionLabel(demon).toLowerCase();
  const role = getRoleCopy(demon);
  const strength = getPrimaryStrength(demon);
  const rarityLead = {
    common: 'Starter-friendly',
    uncommon: 'Upgraded',
    rare: 'Reliable mid-run',
    epic: 'High-impact',
    legendary: 'Run-defining',
    mythic: 'Peak-tier'
  }[rarity] || capitalize(rarity);

  return `${rarityLead} ${name}: ${position} ${role} with ${strength}.`;
}

function getDemonLore(demon) {
  const name = getDemonName(demon);
  const role = getRoleCopy(demon);
  const article = getIndefiniteArticle(role);
  const position = getPositionLabel(demon).toLowerCase();
  const strength = getPrimaryStrength(demon);
  return `${name} is ${article} ${role} demon built for the ${position} line. Bring it into dungeon runs when your team needs ${strength}.`;
}

function getAbilitySummary(demon) {
  const ability = demon.typeData?.ability || {};
  if (Number(demon.type) === 9 || ability.kind === 'slow_crushing_attack') {
    return `${getDemonName(demon)} uses slow crushing attack patterns and front targeting. On about 1% of hits, it can shove the target one row behind, swapping demons if that row is occupied.`;
  }
  const kind = formatLabel(ability.kind || 'combat ability').toLowerCase();
  const targeting = formatLabel(demon.typeData?.targeting || 'enemy').toLowerCase();
  return `${getDemonName(demon)} uses ${kind} patterns and ${targeting} targeting to help your team survive roguelike dungeon battles.`;
}

function getTraitLabel(demon = {}) {
  const typeId = Number(demon.type);
  if (TRAIT_LABELS_BY_TYPE[typeId]) return TRAIT_LABELS_BY_TYPE[typeId];
  return formatLabel(demon.typeData?.role || 'Demon');
}

function getRoleCopy(demon = {}) {
  const typeId = Number(demon.type);
  if (ROLE_COPY_BY_TYPE[typeId]) return ROLE_COPY_BY_TYPE[typeId];
  return getTraitLabel(demon).toLowerCase();
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
  const typeId = Number(demon.type);
  if (PRIMARY_STRENGTH_COPY_BY_TYPE[typeId]) return PRIMARY_STRENGTH_COPY_BY_TYPE[typeId];
  return Array.isArray(demon.typeData?.strengths) && demon.typeData.strengths[0]
    ? lowerFirst(demon.typeData.strengths[0])
    : 'reliable pressure';
}

function getIndefiniteArticle(value) {
  return /^[aeiou]/i.test(String(value || '')) ? 'an' : 'a';
}

function lowerFirst(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : '';
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
  STEAM_APP_ID,
  STEAM_STORE_URL,
  findBossBySlug,
  findDemonBySlug,
  getBossPagePath,
  getDemonImageFilePath,
  getDemonImagePath,
  getDemonPagePath,
  getDemonSlug,
  getRelatedBosses,
  getRelatedDemons,
  renderBossPage,
  renderBossesPage,
  renderDemonPage,
  renderDemonsPage,
  renderEventsPage,
  renderHomePage,
  renderPressPage,
  renderRobotsTxt,
  renderSitemap,
  renderUpdatesPage,
  steamCampaignUrl
};
