# Among Demons Website

A simple Express.js-based website showcasing the **Among Demons** NFT collection. This repository hosts the demo/gallery frontend for displaying founder collection NFTs minted and transacted on Stargaze (Cosmos ecosystem).

---

## 📁 Project Structure

```
amongdemons.com/
├── .gitignore               # Git ignore configuration
├── package.json             # Node.js dependencies and scripts
├── package-lock.json        # Dependency lock file
├── server.js                # Express server backend
├── views/                   # EJS view templates
│   └── index.ejs           # Main gallery template
└── public/                  # Public-facing static assets
    ├── data/
    │   ├── main.css         # Custom stylesheet
    │   ├── images/          # Logo and brand assets
    │   └── js/
    │       └── index.js     # Client-side application logic
```

---

## 🚀 Features

- **Bootstrap 5** dark-themed responsive design
- **Paginated demon gallery** with 3 images per row (6 total per page for types 1-12)
- **Rarity-based categorization**: Mythic, Common, Uncommon, Rare, Epic, Legendary
- **Demon names** for each type (Boof Nitza, Gon G'ah, Ma'Zga, etc.)
- Dynamic navigation with previous/next buttons and page numbers

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|--------|
| Express.js | HTTP server & API |
| Bootstrap 5 | Responsive UI framework |
| EJS (Embedded JavaScript) | View templating engine |
| Vanilla JavaScript | Client-side logic |
| CSS3 | Custom styling |

---

## 🔧 Server Endpoints

### Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Redirects to `/demons/type/1` if no type parameter |
| `/demons/type/:type` | GET | Serves demo gallery for specified demon type (must be a number) |

### Response Logic

- **Root route (`/`)**: Auto-redirects to `/demons/type/1` when accessed without query parameters
- **Valid type parameter**: Serves the main `index.ejs` template
- **Invalid type**: Returns 400 error for non-numeric values

---

## 📸 Asset Organization

### Images Directory Structure

```
public/data/images/
├── amongdemons.ico              # Browser favicon
├── amongdemons_logo_250x250.png       # Navigation logo
├── amongdemons_logo_dark_text_bottom_1000x1000.png   # Dark text logo
├── amongdemons_logo_white_text_bottom_1000x1000.png   # White bottom logo
├── amongdemons_logo_white_text_left_1700x700.png      # Left-aligned logo
├── demons/                     # Demon gallery images (1-66)
│   ├── 1.png - 66.png          # Full-size demon images
│   └── thumbnails/             # Thumbnail versions
```

---

## 🎮 Application Flow

### How It Works

1. **User visits the site** → Redirected to `/demons/type/1` (first page)

2. **Server renders EJS template** with Bootstrap theme and loads custom assets

3. **Template calculates pagination**:
   - Extracts page number from URL path segment
   - Calculates demon type names based on current page
   - Renders 3 demons per row (6 per page for first 12 types)
   - Generates pagination controls

4. **Rarity Assignment Logic** (cyclic):
   | Index Modulo | Rarity |
   |--------------|--------|
   | 0            | Common |
   | 1            | Uncommon |
   | 2            | Rare |
   | 3            | Epic |
   | 4            | Legendary |
   | 5            | Mythic |

---

## 📖 Demon Type Names

The first 11 demon types in the collection:

1. Boof Nitza
2. Gon G'ah
3. Ma'Zga
4. Tor Tza
5. Vi'Zel
6. Goh Loomb
7. Baobaw
8. Ko Pak
9. Chu Perk
10. Ba Be'aga
11. Vee Scol

---

## 🚦 Getting Started

### Prerequisites

- Node.js 16+ installed
- npm package manager

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

### Access the Site

Open your browser to: http://localhost:3000

---

## 📝 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile-friendly responsive design via Bootstrap grid

---

## ⚖️ License & Copyright

© 2026 Among Demons. All rights reserved.

All NFT models displayed are part of the founders collection and minted on Stargaze within the Cosmos ecosystem.

---

## 📞 Support

For questions or contributions, visit the [Among Demons project](https://github.com/amongdemons-com/website).