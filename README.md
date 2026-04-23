# Designora

**AI-powered interior design tool** — upload a photo of any room, choose a style and budget, and get two photorealistic redesigned variants in seconds.

Designora uses a two-stage AI pipeline:
1. **flux-depth-pro** — extracts the room's depth map and generates a photorealistic redesign with correct perspective and real materials.
2. **flux-kontext-pro** — reviews the output, adds any missing room-appropriate furniture, and removes anything that doesn't belong.

---

## Features

- 📸 **Room Redesign** — Upload a room photo and generate two style variants (A & B) side-by-side
- 🎨 **Style Selection** — Choose from styles like Modern, Scandinavian, Industrial, Bohemian, and more
- 💰 **Budget-Aware Design** — Set a budget; the AI tailors materials and furniture to your price range
- 🛋️ **Product Scanner** — Identifies furniture and décor in generated designs with store links and price ranges
- 🖌️ **Inpainting Canvas** — Mask and re-generate specific areas of a design
- 💬 **Design Chatbot** — Chat with an AI assistant (Llama 3 70B) for interior design advice
- 🕘 **History Page** — Browse and re-open all past designs
- ⭐ **Star Ratings** — Rate each generated design
- 📄 **PDF Export** — Export designs with budget breakdown as a PDF
- 🌙 **Dark Mode** — Full dark/light theme support
- 💳 **Credits System** — Pay-per-generation model with Razorpay integration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js (vanilla HTTP server, no Express) |
| Database | sql.js (pure-JS SQLite — no native build tools needed) |
| AI Models | Replicate API (`flux-depth-pro`, `flux-kontext-pro`, `llama-3-70b`) |
| Auth | JWT (HS256, bcryptjs password hashing) |
| Payments | Razorpay |

---

## Project Structure

```
Designora/
├── App.tsx                     # Root component, routing, auth state
├── index.html
├── index.tsx
├── types.ts                    # Shared TypeScript types
├── vite.config.ts
├── package.json
│
├── components/
│   ├── Dashboard.tsx           # Main design generation UI
│   ├── LandingPage.tsx         # Marketing / hero page
│   ├── Navbar.tsx
│   ├── AuthModal.tsx           # Login / register modal
│   ├── Pricing.tsx             # Pricing & credits page
│   ├── HistoryPage.tsx         # Past designs gallery
│   ├── DesignChatbot.tsx       # AI chat assistant
│   ├── InpaintingCanvas.tsx    # Mask-based area re-generation
│   ├── BeforeAfterSlider.tsx   # Side-by-side comparison slider
│   └── StarRating.tsx
│
├── services/
│   └── replicateService.ts     # Two-stage AI pipeline logic
│
├── utils/
│   └── imageUtils.ts
│
└── backend/
    ├── server.js               # All API routes (Node HTTP)
    ├── package.json
    ├── .env.local.template     # Environment variable template
    └── test_sql.js
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Replicate](https://replicate.com) account and API token
- *(Optional)* A [Razorpay](https://razorpay.com) account for payment integration

### 1. Clone the repository

```bash
git clone https://github.com/your-username/designora.git
cd designora
```

### 2. Configure environment variables

```bash
cd backend
cp .env.local.template .env.local
```

Edit `backend/.env.local`:

```env
REPLICATE_API_TOKEN=your_replicate_token_here
JWT_SECRET=your_secret_key_here
RAZORPAY_KEY_ID=your_razorpay_key_id        # optional
RAZORPAY_KEY_SECRET=your_razorpay_secret    # optional
```

### 3. Start the backend (Terminal 1)

```bash
cd backend
npm install
node server.js
```

Wait for `✅ Tables ready` before proceeding.

### 4. Start the frontend (Terminal 2)

```bash
# from the project root
npm install
npm run dev
```

### 5. Open in browser

```
http://localhost:3000
```

> ⚠️ Always start the **backend first**, then the frontend.  
> Backend runs on port **3001** (API only). Frontend runs on port **3000**.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register` | Create a new user account |
| POST | `/api/login` | Authenticate and receive a JWT |
| GET | `/api/me` | Get current user info |
| PUT | `/api/me/credits` | Update user credits |
| POST | `/api/history` | Save a design to history |
| GET | `/api/history` | Retrieve design history |
| DELETE | `/api/history/:id` | Delete a design |
| POST | `/api/replicate/predictions` | Proxy a model call to Replicate |
| GET | `/api/replicate/predictions/:id` | Poll prediction status |
| POST | `/api/chat` | Chat with Llama 3 70B |
| POST | `/api/create-order` | Create a Razorpay payment order |
| POST | `/api/verify-payment` | Verify payment and credit account |
| GET | `/api/images/:filename` | Serve locally cached images |
| GET | `/api/health` | Health check |

---

## AI Pipeline Details

Each design request runs two model calls in sequence:

```
User Photo
    │
    ▼
[flux-depth-pro]
  • Extracts depth map from photo
  • Generates photorealistic room (guidance=25, steps=50)
  • Output: high-quality base image
    │
    ▼
[flux-kontext-pro]
  • Reads base image + edit instructions
  • Adds missing mandatory furniture for room type
  • Removes furniture that doesn't belong
  • Preserves photorealistic quality
    │
    ▼
Final Design (Variant A or B)
```

**Cost:** ~$0.09 per variant (~$0.05 depth-pro + ~$0.04 kontext-pro)  
**Time:** ~20–30 seconds per variant

---

## Credits System

New users receive **10 free credits** on sign-up. Each design generation costs credits. Additional credits can be purchased via Razorpay (if configured).

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `REPLICATE_API_TOKEN` | ✅ | Your Replicate API key |
| `JWT_SECRET` | ✅ | Secret for signing JWTs |
| `RAZORPAY_KEY_ID` | ❌ | Razorpay key ID (payments) |
| `RAZORPAY_KEY_SECRET` | ❌ | Razorpay key secret (payments) |

---

## License

MIT
