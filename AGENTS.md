# AGENTS.md — KHEM Engineering System & Operational Handbook

> **Single Source of Truth** for Claude Code, GitHub Copilot, Cursor, and all human / AI software engineers operating on **KHEM** (`https://khemperfumes.com`).
> **Brand Mission:** KHEM is a digital flagship boutique for a luxury Egyptian fragrance house ("Essence of Heritage").
> **Engineering Paradigm:** Production-grade Next.js App Router, Strict TypeScript, Tailwind CSS v4, Motion, Prisma, Supabase, Clerk, Stripe, Vercel AI SDK.

---

## 1. CORE OPERATIONAL RULES FOR AI AGENTS

As an AI coding agent operating on KHEM, you are acting as a **Principal Software Architect and Staff Full-Stack Engineer**. You MUST strictly follow these execution protocols for every task:

1. **Read & Absorb First**: ALWAYS inspect `AGENTS.md` and related context before modifying code. Understand existing Server/Client component boundaries, schemas, and design constraints.
2. **Inspect Before Modifying**: Never write code blindly. Read adjacent files, types, utility libraries, and active routes to maintain consistency.
3. **Think Before Coding & Plan**: Provide a concise architectural plan identifying affected files, schema mutations, route impacts, and UI/UX changes before executing large modifications.
4. **Never Invent APIs or Database Fields**: Only work with verified Prisma models, Clerk methods, Stripe APIs, or explicit requirements. Do NOT invent fictional API contracts.
5. **Preserve Architectural Boundaries**: Strictly isolate Server Components (`'use server'`), Client Components (`'use client'`), Route Handlers (`app/api/...`), and Server Actions (`actions/...`). Never cross boundaries improperly.
6. **Luxury UI/UX Supremacy**: Every interface element MUST strictly align with KHEM’s luxury design philosophy (Obsidian, Black Marble, Gold, Champagne, Cinzel typography, motion with zero bounce). Never output generic Bootstrap, Material UI, or plain SaaS aesthetic code.
7. **Production Verification Protocol**: Before concluding a task, ensure code compiles without TypeScript errors, passes ESLint rules, conforms to Zod schemas, and handles empty/error/loading states gracefully.

---

# 2. Workflow

For every implementation request:

1. Read `AGENTS.md`.
2. Read the skills explicitly mentioned by the user.
3. Read clearly needed supporting skills from the approved skill list.
4. Inspect relevant code.
5. Ask a focused question only if the task has meaningful ambiguity.
6. Create a detailed prompt file in `prompts/`.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. On approval, re-read the approved prompt file in prompts/ and implement it strictly. Implement only after user approval.
9. Run available checks.
10. Share exact steps to test or run the completed feature.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

---

## 2. PRODUCT IDENTITY & DESIGN PHILOSOPHY

### 2.1 Brand Identity
KHEM is not an ordinary ecommerce platform—it is a **digital museum and flagship boutique** celebrating five millennia of Egyptian perfumery traditions merged with modern high-craftsmanship. Visual benchmarks include **Xerjoff, Louis Vuitton, Tom Ford Beauty, Dior, and Apple**.

### 2.2 Visual & Spatial Language
* **Atmosphere:** Editorial, cinematic, dark-mode biased, museum-quality presentation, dramatic lighting highlights on glass/obsidian textures.
* **Layouts:** Expansive margins, generous vertical whitespace (`py-24`, `py-32`), editorial asymmetrical grids, full-width high-resolution video/imagery heroes.
* **Colors:** Warm Obsidian (`#0A0A0B`), Deep Onyx (`#121215`), Soft Pale Gold (`#D4AF37`), Antique Champagne (`#F3E5AB`), Creamy Ivory (`#FDFBF7`), Pale Slate Muted Text (`#A1A1AA`).
* **Typography:** 
  * Primary Serif (Headings, Display): **Cinzel** or **Cinzel Decorative** (`font-serif`, tracking wide/widest).
  * Secondary Sans (Body, Micro-copy, UI): **Inter** or **Geist Sans** (`font-sans`, tracking-normal or wide for caps).
* **Motion:** Subtle, expensive, linear or ease-out transitions (`cubic-bezier(0.16, 1, 0.3, 1)`). **Zero spring, zero bounce, zero cartoonish keyframes.**

---

## 3. DESIGN SYSTEM & TYPOGRAPHY SPECIFICATIONS

### 3.1 Color Palette Tokens (Tailwind CSS v4)
```css
@theme {
  /* Colors */
  --color-background: #0d0d0d;
  --color-surface: #1a1a1a;
  --color-card: #242424;
  --color-black: #000000;

  --color-gold: #c8a96a;
  --color-gold-dark: #a67c2d;
  --color-champagne: #e6d6a8;
  --color-ivory: #f7f4ec;

  --color-success: #4caf50;
  --color-warning: #e8a317;
  --color-danger: #c0392b;
  --color-info: #3498db;

  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-gold: color-mix(in srgb, var(--color-gold) 35%, transparent);

  /* Fonts */
  --font-heading: var(--font-heading);
  --font-body: var(--font-body);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-luxury: 0 10px 40px rgba(0, 0, 0, 0.45);
  --shadow-gold: 0 0 30px color-mix(in srgb, var(--color-gold) 25%, transparent);

  /* Ease */
  --ease-luxury: ease-in-out;
  --ease-luxury-bezier: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 3.2 Standard UI Component Aesthetics
* **Buttons (`<LuxuryButton />`):** Sharp or minimal radius (`rounded-none` or `rounded-sm`). High contrast dark backdrop with subtle gold border glow, tracking wider (`tracking-[0.2em]`), uppercase text, smooth hover sweep effect.
* **Inputs (`<LuxuryInput />`):** Dark transparent fills, thin gold bottom border or subtle outline, floating labels in uppercase gold typography, smooth glow focus state without default webkit blue rings.
* **Cards (`<ProductCard />`, `<JournalCard />`):** Minimalist frames, image zoom on hover (`scale-105` duration 700ms ease-out), typography overlaid or elegantly bottom-padded with gold price tags.
* **Modals & Drawers:** High blur backdrops (`backdrop-blur-md bg-obsidian/80`), subtle slide-in from right (Cart Drawer) or fade-in overlay with gold cross accents.

---

## 4. Skills

Use only these skills:

- `.agents/skills/clerk`
- `.agents/skills/supabase`
- `.agents/skills/ai-sdk`

Use them for:

- `node_modules/next/dist/docs/`: Next.js, routing, server/client boundaries, API routes, UI patterns
- `clerk`: authentication and protected routes
- `supabase`: schema, migrations, queries, service role usage, dedupe, logs, pgvector
- `ai-sdk`: Vercel AI SDK and OpenAI provider usage, model calls, AI analysis output handling

Do not invent new skills.

For Cheerio, Zod, Tailwind, and shadcn/ui, use existing project patterns, package docs, and `node_modules/next/dist/docs/`.

---

# 5. Prompt files

Prompt files live in the `prompts/` directory. Use names like:

- `prompts/ai-analysis.md`
- `prompts/perfumes-details-page-ui.md`

Each prompt must include:

- goal
- skills read
- existing code inspected
- decisions or assumptions
- files likely to change
- implementation requirements
- security requirements
- acceptance criteria
- checks to run
- exact manual test steps expected after implementation

For UI tasks, also include visual interpretation, layout, typography, spacing, colors, responsiveness, and pixel-perfect expectations.
---

## 6. ARCHITECTURE & TECH STACK

Keep these layers separate:

| Layer | Technology | Usage Standard |
| :--- | :--- | :--- |
| **Framework** | Next.js 16+ (App Router) | React Server Components by default, explicit `'use client'` |
| **Language** | TypeScript 5+ | Strict Mode, zero `any`, strict type inferences |
| **Website** | pages, cards, details UI, auth UI
| **Styling** | Tailwind CSS v4, PostCSS | CSS Variables, `@theme` directives, low specificity |
| **Component Primitives**| shadcn/ui + Radix UI | Dark custom tokens applied, accessible base primitives |
| **Animations** | Motion (Framer Motion) | High-end ease curves, parallax scroll, stagger fades |
| **API** | thin route handlers only
| **Auth** | Clerk | App Router middleware, JWT claims, role metadata (Admin/Customer) |
| **Database & ORM** | PostgreSQL + Prisma ORM | Multi-file schema setup, strict relations, explicit transactions |
| **Database Hosting** | Supabase | Postgres instance, Realtime subscriptions for stock/order state |
| **Payments** | Stripe | Webhook triggers, Checkout Sessions, Payment Intents, Refunds |
| **Media Storage** | Cloudinary | Auto-format (WebP/AVIF), responsive dynamic transformations |
| **Transactional Email**| Resend + React Email | Custom branded dark gold HTML email templates |
| **AI Experience** | OpenAI + Vercel AI SDK | Scent Recommendation Engine, Fragrance Matcher |
| **Forms & Rules** | React Hook Form + Zod | Schema validation on Client & Server Actions |
| **Icons** | Lucide React | Minimal weight stroke icons (`strokeWidth={1.25}`) |
| **Hosting** | Vercel | Edge Middleware, ISR caching, Dynamic Server Functions |
| **Vector** | pgvector similarity queries and article embedding storage


UI must display stored data only.
---

## 7. REPOSITORY DIRECTORY STRUCTURE

```
khem/
├── .github/
│   └── workflows/          # CI/CD pipelines (Lint, Typecheck, Test, Vercel Build)
├── app/                    # Next.js App Router root
│   ├── (auth)/             # Auth group (sign-in, sign-up, sso-callback)
│   ├── (marketing)/        # Editorial pages (heritage, journal, craftsmanship, about)
│   ├── (shop)/             # E-commerce core (perfumes, collections, discovery-set)
│   ├── (user)/             # Customer portal (account, orders, wishlist)
│   ├── admin/              # Admin Flagship Management Dashboard
│   ├── api/                # Route Handlers (stripe-webhooks, cloudinary, ai)
│   ├── layout.tsx          # Root Layout (Fonts, Metadata, Analytics, Providers)
│   ├── page.tsx            # Digital Flagship Home Page
│   ├── global.css          # Tailwind CSS v4 entry & theme rules
│   ├── icon.svg            # Favicon
│   └── sitemap.ts          # Dynamic XML Sitemap generator
├── actions/                # Server Actions (Orders, Cart, User, Admin)
├── components/
│   ├── ui/                 # Atomic design primitives (Button, Input, Modal, Drawer)
│   ├── luxury/             # KHEM specific components (GoldDivider, FragranceNotes)
│   ├── layout/             # Navbar, Footer, MegaMenu, MobileNav
│   ├── ecommerce/          # ProductCard, CartDrawer, AddToCart, CheckoutForm
│   ├── admin/              # Charts, OrderTable, InventoryManager
│   └── animation/          # Motion Wrappers (FadeIn, RevealText, Parallax)
├── features/               # Feature-based domain modules
│   ├── fragrance-matcher/  # AI Quiz component & logic
│   ├── checkout/           # Stripe payment workflow modules
│   └── journal/            # Editorial article modules
├── hooks/                  # Custom React hooks (useCart, useWishlist, useScrollThreshold)
├── lib/                    # Shared core infrastructure
│   ├── prisma.ts           # Global Prisma Client singleton
│   ├── supabase.ts         # Supabase client & server instances
│   ├── stripe.ts           # Stripe API initializers
│   ├── cloudinary.ts       # Cloudinary client & helper transforms
│   ├── ai.ts               # Vercel AI SDK & OpenAI setup
│   ├── resend.ts           # Email engine instance
│   └── utils.ts            # Classnames merger (cn), formatters
├── schemas/                # Zod validation schemas (Product, Order, User, Auth)
├── services/               # DB query layer & complex business logic
├── types/                  # Global TypeScript definitions & interfaces
├── constants/              # System constants (Fragrance notes, Navigation links)
├── providers/              # React Context Providers (Theme, Cart, Query, Auth)
├── emails/                 # React Email templates (OrderConfirmation, ShippingUpdate)
├── styles/                 # Custom CSS / Font definitions
├── public/                 # Static assets (3D GLTF models, video loops, brand marks)
├── prisma/
│   ├── schema.prisma       # Prisma DB Schema
│   └── seed.ts             # Database seeding script for initial luxury catalog
├── supabase/               # Migrations, SQL policies, functions
├── tests/                  # Playwright E2E and Vitest unit tests
├── middleware.ts           # Clerk Auth & Route protection middleware
├── next.config.ts          # Next.js configuration (Images, Headers)
├── package.json
├── tsconfig.json
└── AGENTS.md               # Single Source of Truth Manual
```

---

## 8. ROUTING & PAGE ARCHITECTURE MATRIX

All routes must follow strict dynamic parameters, metadata definitions, and layout inheritance:

| Route Path | Type | Caching | Purpose & UX Requirements |
| :--- | :--- | :--- | :--- |
| `/` | SSR / ISR (1h) | Revalidate | Home: Cinematic Video Hero, Fragrance Wheel, Bestsellers, Editorial Callouts |
| `/collections` | Static | ISR | Overview of Fragrance Collections (Signature, Egyptica, Gemstone, Noir, Royal Heritage) |
| `/collection/[slug]` | Dynamic | ISR (10m) | Targeted Collection Page with luxury filtering and video backgrounds |
| `/perfumes` | Dynamic | Dynamic | Full Catalog with facet filters (Scent Notes, Accord, Concentration, Season) |
| `/perfume/[slug]` | Dynamic | ISR (5m) | Product Detail Page (PDP): 360 viewer, pyramid accords, reviews, add-to-cart |
| `/discovery-set` | Static | Static | Bespoke Sample Box builder with dynamic interactive slot selector |
| `/heritage` | Static | Static | Brand Origin, Egyptian Perfumery History, Museum-style horizontal scroll |
| `/journal` | Dynamic | ISR (1h) | Editorial Fragrance Articles & Olfactory Essays |
| `/journal/[slug]` | Dynamic | ISR (1h) | Article detail view with rich text typography and embedded product tags |
| `/craftsmanship` | Static | Static | Sourcing, Rare Botanical Ingredients, Glass Blowing & Gold Leaf gilding |
| `/stockists` | Static | Static | Store Locator for Boutique locations worldwide (Interactive Map) |
| `/cart` | Client | Force Dynamic | Shopping Bag overview, GWP (Gift with Purchase) progress bar |
| `/checkout` | Client | Force Dynamic | Embedded Stripe Elements checkout with auto address auto-complete |
| `/account` | Protected | Dynamic | Customer Portal: Order History, Fragrance Profile, Saved Addresses |
| `/wishlist` | Protected | Dynamic | Saved Perfumes & Custom Discovery Sets |
| `/admin/*` | Protected | Dynamic | Admin Flagship Suite (RBAC: `admin` role required) |

---

## 9. DATABASE SCHEMA SPECIFICATIONS (PRISMA ORM)

All schema changes MUST be executed via `npx prisma migrate dev`. Never mutate the Postgres database directly.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  VIP_MEMBER
  ADMIN
  SUPER_ADMIN
}

enum Concentration {
  PARFUM
  EXTRAIT_DE_PARFUM
  EAU_DE_PARFUM
  ATTAR_OIL
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  UNPAID
  PAID
  FAILED
  REFUNDED
}

model User {
  id            String      @id @default(uuid())
  clerkId       String      @unique
  email         String      @unique
  firstName     String?
  lastName      String?
  phone         String?
  role          Role        @default(CUSTOMER)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?   // Soft delete
  
  addresses     Address[]
  orders        Order[]
  wishlist      Wishlist?
  reviews       Review[]

  @@index([clerkId])
  @@index([email])
}

model Address {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  isDefault     Boolean  @default(false)
  line1         String
  line2         String?
  city          String
  state         String
  postalCode    String
  country       String
  
  orders        Order[]
}

model Collection {
  id          String    @id @default(uuid())
  name        String    @unique
  slug        String    @unique
  description String
  bannerUrl   String
  isFeatured  Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  products    Product[]
}

model Product {
  id              String        @id @default(uuid())
  name            String
  slug            String        @unique
  subtitle        String?
  description     String
  story           String?       // Editorial background story
  concentration   Concentration @default(EXTRAIT_DE_PARFUM)
  topNotes        String[]
  heartNotes      String[]
  baseNotes       String[]
  volumeMl        Int           // e.g. 100
  priceInCents    Int           // Stored in smallest unit e.g. 35000 = $350.00
  sku             String        @unique
  inventory       Int           @default(0)
  isBestseller    Boolean       @default(false)
  isArchived      Boolean       @default(false)
  collectionId    String
  collection      Collection    @relation(fields: [collectionId], references: [id])
  images          ProductImage[]
  orderItems      OrderItem[]
  wishlistItems   WishlistItem[]
  reviews         Review[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  @@index([slug])
  @@index([collectionId])
}

model ProductImage {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String
  isPrimary Boolean  @default(false)
  sortOrder Int      @default(0)
}

model Order {
  id            String        @id @default(uuid())
  orderNumber   String        @unique // e.g. KHEM-2026-8921
  userId        String?
  user          User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  addressId     String?
  address       Address?      @relation(fields: [addressId], references: [id])
  status        OrderStatus   @default(PENDING)
  paymentStatus PaymentStatus @default(UNPAID)
  totalInCents  Int
  taxInCents    Int           @default(0)
  shipInCents   Int           @default(0)
  stripeIntentId String?      @unique
  trackingCode  String?
  items         OrderItem[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([orderNumber])
  @@index([userId])
}

model OrderItem {
  id           String   @id @default(uuid())
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId    String
  product      Product  @relation(fields: [productId], references: [id])
  quantity     Int
  priceInCents Int
}

model Wishlist {
  id        String         @id @default(uuid())
  userId    String         @unique
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     WishlistItem[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model WishlistItem {
  id         String   @id @default(uuid())
  wishlistId String
  wishlist   Wishlist @relation(fields: [wishlistId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([wishlistId, productId])
}

model Review {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int      // 1 to 5
  title     String?
  comment   String
  isVerified Boolean @default(true)
  createdAt DateTime @default(now())
}
```

---

## 10. AUTHENTICATION & ACCESS CONTROL

### 10.1 Middleware Setup (`middleware.ts`)
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/perfumes(.*)',
  '/collection(.*)',
  '/heritage',
  '/journal(.*)',
  '/craftsmanship',
  '/stockists',
  '/api/webhooks(.*)',
  '/api/ai(.*)'
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const session = await auth();
    if (session.sessionClaims?.metadata?.role !== 'ADMIN') {
      return Response.redirect(new URL('/', req.url));
    }
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\.(?:html?|css|js(?!on)|json|png|jpg|webp|svg|ttf|woff2?|ico|csv)).*)'],
};
```

---

## 11. REUSABLE COMPONENT CODE STANDARDS

### 11.1 Exemplar Component: `<LuxuryButton />`
```tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";

export interface LuxuryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "obsidian" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

export const LuxuryButton = React.forwardRef<HTMLButtonElement, LuxuryButtonProps>(
  ({ className, variant = "gold", size = "md", asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const baseStyles = "relative inline-flex items-center justify-center uppercase tracking-[0.2em] font-serif font-medium transition-all duration-500 ease-out focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      gold: "bg-gold-base text-obsidian border border-gold-light hover:bg-gold-light hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]",
      obsidian: "bg-obsidian text-ivory border border-gold-base/30 hover:border-gold-base hover:bg-obsidian-light",
      ghost: "bg-transparent text-ivory border border-transparent hover:border-gold-base/40 hover:text-gold-base",
    };

    const sizes = {
      sm: "px-4 py-2 text-xs",
      md: "px-8 py-4 text-sm",
      lg: "px-12 py-5 text-base",
    };

    return (
      <Comp
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        <span className="relative z-10">{children}</span>
      </Comp>
    );
  }
);
LuxuryButton.displayName = "LuxuryButton";
```

---

## 12. CLAUDE CODE EXECUTION CHECKLIST

When executing any engineering task for KHEM, AI Agents MUST verify against this list:

- [ ] Does this file strictly adhere to TypeScript strict rules (0 `any` types)?
- [ ] Are dynamic component inputs validated using Zod schemas?
- [ ] Is Server Action state returned cleanly with error handlers?
- [ ] Are database operations wrapped in try-catch with specific error boundaries?
- [ ] Is visual formatting matching the Cinzel/Inter typography + Gold/Obsidian color tokens?
- [ ] Are animations executed smoothly without layout shifts or spring physics?
- [ ] Does the page achieve Lighthouse metrics target (95+ Performance, 100 SEO)?

---
*End of AGENTS.md — KHEM Digital Flagships Handbook*
