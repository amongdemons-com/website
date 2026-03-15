# Among Demons 🐉

A modern NFT collection website showcasing the founders collection on **Stargaze** (Cosmos ecosystem). Browse and discover unique demon characters organized by type, rarity, and visual attributes.

---

## 🚀 Features

- **11 Demon Types**: Explore unique character classes (Boof Nitza, Gon G'ah, Ma'Zga, Tor Tza, Vi'Zel, Goh Loomb, Baobaw, Ko Pak, Chu Perk, Ba Be'aga, Vee Scol)
- **6 Rarity Tiers**: Each demon type features 6 rarity levels - Common, Uncommon, Rare, Epic, Legendary, Mythic
- **66 Unique Demons**: Complete collection visualization with image assets and thumbnails
- **Pagination Support**: Navigate through collections with responsive page controls
- **Hunt Mode**: Special preview page showcasing huntable demons (1-6)
- **Responsive Design**: Mobile-friendly Bootstrap 5 UI with dark theme

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js |
| **Web Framework** | Express.js v4.18+ |
| **Template Engine** | EJS v4 |
| **Styling** | Bootstrap 5.3, Custom CSS |
| **Icons** | Bootstrap Icons |

---

## 📁 Project Structure

```
amongdemons.com/
├── public/
│   ├── data/
│   │   ├── demons.json          # Main collection data (66 demons)
│   │   ├── demon-types.json     # Demon type names mapping
│   │   ├── main.css             # Custom styles & theme
│   │   ├── images/             # Logos, icons, sprite assets
│   │   └── js/                 # Client-side scripts
│   └── data/images/demons/     # Character sprite sheets + thumbnails
├── views/
│   ├── index.ejs              # Main demo collection view
│   ├── hunt.ejs               # Hunt preview page
│   ├── components/
│   │   └── navigation.ejs    # Shared navigation component
├── server.js                  # Express app entry point
├── package.json               # Dependencies & scripts
└── README.md
```

---

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/amongdemons-com/website.git
   cd amongdemons.com
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to: `http://localhost:3000`

---

## 🌐 Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to first demo collection page |
| `/demons/type/:page` | Paginated demon collection view (pages 1-11) |
| `/hunt/` | Hunt preview page with demons 1-6 |

---

## 🎨 Demon Types Reference

| ID | Name | Examples |
|----|------|----------|
| 1 | Boof Nitza | Common → Mythic (demons 1-6) |
| 2 | Gon G'ah | Common → Mythic (demons 7-12) |
| 3 | Ma'Zga | Common → Mythic (demons 13-18) |
| 4 | Tor Tza | Common → Mythic (demons 19-24) |
| 5 | Vi'Zel | Common → Mythic (demons 25-30) |
| 6 | Goh Loomb | Common → Mythic (demons 31-36) |
| 7 | Baobaw | Common → Mythic (demons 37-42) |
| 8 | Ko Pak | Common → Mythic (demons 43-48) |
| 9 | Chu Perk | Common → Mythic (demons 49-54) |
| 10 | Ba Be'aga | Common → Mythic (demons 55-60) |
| 11 | Vee Scol | Common → Mythic (demons 61-66) |

---

## 🎨 Rarity Colors

The CSS defines color schemes for each rarity level:

- **Common**: Neutral gray (`#D1D5D8`)
- **Uncommon**: Green (`#41A85F`)
- **Rare**: Blue (`#2C82C9`)
- **Epic**: Purple (`#9365B8`)
- **Legendary**: Gold (`#FAC51C`)
- **Mythic**: Red-Orange (`#E25041`)

---

## 🌐 Deployment

This is a simple Express.js application that can be deployed to any Node.js hosting platform:

- Railway.app
- Render.com
- Heroku
- DigitalOcean App Platform
- AWS Elastic Beanstalk

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | Processed from env or 3000 |

---

## 📝 License

All rights reserved © 2026 Among Demons.

---

## 🔗 Resources

- **GitHub Repository**: https://github.com/amongdemons-com/website
- **NFT Platform**: Stargaze (Cosmos Ecosystem)

---

## 💡 Development Tips

- Use `npm run dev` for hot-reloading with nodemon
- Static assets are served from the `/public` directory
- EJS templates must have `.ejs` extension in the `views` folder
- Image paths should be absolute (e.g., `/data/images/demons/1.png`)