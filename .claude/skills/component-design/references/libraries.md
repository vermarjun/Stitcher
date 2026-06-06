# Library Catalog

Per-source detail for the `component-design` skill. Install commands assume you
have already detected the package manager and Tailwind version (see SKILL.md
step 1). Replace `npx` with `pnpm dlx` / `bunx` / `yarn dlx` as appropriate.

Legend: **Framework** · **Get code** · **Style** · **Best for** · **Deps/gotchas**

---

## Registry code libs (`npx shadcn add <url>`)

### shadcn/ui — https://ui.shadcn.com/
- **Framework**: React. The canonical base layer; everything else extends it.
- **Get code**: `npx shadcn@latest init` (once), then `npx shadcn@latest add <component>` (e.g. `button`, `dialog`, `data-table`) or `add "<registry-url>"`. Code is copied into your repo — you own it.
- **Style**: Accessible, neutral, customizable primitives (Radix under the hood). Not flashy — the foundation.
- **Best for**: App fundamentals — buttons, dialogs, forms, dropdowns, selects, tables, charts, command palettes, tabs, toasts.
- **Deps/gotchas**: Radix + Tailwind + `cn`. New projects default to **Tailwind v4 + React 19**; `tailwindcss-animate` → `tw-animate-css` on v4. Install this first if a project has no shadcn base.

### Animate UI — https://animate-ui.com/
- **Framework**: React only.
- **Get code**: shadcn-style registry — `npx shadcn@latest add @animate-ui/<component>` (verify exact namespace on its install page). Copy-paste also available.
- **Style**: Animated versions of base primitives + **animated Lucide icons**. "shadcn with motion baked in."
- **Best for**: Animated micro-interactions on standard UI — tabs, accordions, buttons, animated icons; drop-in upgrades to static shadcn pieces.
- **Deps/gotchas**: Built on **`motion`** (framer-motion successor) + Tailwind. Modern shadcn/Tailwind-v4 era.

### Magic UI — https://magicui.design/
- **Framework**: React. Markets itself as the companion to shadcn/ui.
- **Get code**: `npx shadcn@latest add "https://magicui.design/r/<component>"` (e.g. `.../r/bento-grid`), or `npx magicui-cli add [component]`. Copy-paste too. **Often pre-wired** as `@magicui` registry in `components.json` → then use `@magicui/<component>`.
- **Style**: 150+ animated effects — animated beams, border beam, particles, marquee, number ticker, morphing/aurora text, confetti, device mockups (Safari/iPhone/Android).
- **Best for**: Landing-page polish — beams/particles, animated text, marquees, bento grids, device mocks, fancy buttons (shimmer/rainbow/ripple), backgrounds.
- **Deps/gotchas**: **`motion`** + Tailwind. Supports **Tailwind v4 + React 19**; legacy v3 docs at `v3.magicui.design`. Sits on top of a shadcn base.

### 21st.dev — https://21st.dev/home
- **Framework**: React + shadcn/ui + Tailwind.
- **Get code**: `npx shadcn@latest add "https://21st.dev/r/<author>/<component>"`. Also a **Magic MCP** server (AI generates/inserts from a prompt) and copy-paste.
- **Style**: "npm for design engineers" — the largest **community marketplace** of shadcn components, blocks, hooks. Many variants per component.
- **Best for**: Browsing options when you want choices; AI-assisted scaffolding; modern shadcn-style blocks/hooks.
- **Deps/gotchas**: **Marketplace, not one cohesive library** — quality/deps vary per author. May pull Radix + arbitrary npm deps. Sanity-check each component. Tailwind version varies per submission.

### efferd — https://efferd.com/
- **Framework**: React; framework-agnostic within React (Next.js, TanStack…).
- **Get code**: `npx shadcn@latest add @efferd/<block-name>` (e.g. `@efferd/auth-1`). Registry-based; code lives in your project.
- **Style**: Clean, modern, professional, production-ready marketing/app blocks.
- **Best for**: Assembling full pages from polished blocks — Auth, Hero, Features, Dashboard, App Shell, Header, Footer, CTA, Integrations, Logo Cloud, FAQs, Contact.
- **Deps/gotchas**: Supports **both Radix UI and Base UI** + multiple icon libs (flexible). Confirm its animation lib + Tailwind version in your project before adding (not clearly documented). Standard shadcn peer deps.

### cult-ui — https://www.cult-ui.com/
- **Framework**: React, built for shadcn/ui projects (~4.5k★, 78+ components).
- **Get code**: **`npx shadcn@beta add @cult-ui/<name>`** (e.g. `@cult-ui/text-gif`). Registry: `"@cult-ui": "https://cult-ui.com/r/{name}.json"`. Copy-paste too.
- **Style**: Animated components & effects — glassmorphism, shader effects, particle/animated backgrounds, text-gif. Premium flair.
- **Best for**: Eye-catching landing pages, marketing sites, SaaS dashboards where animation polish is the point.
- **Deps/gotchas**: **Tailwind v4** (`@tailwindcss/postcss`). Animation dep is **`motion`** (NOT old `framer-motion`, NOT three.js/GSAP). Peer deps: `tailwindcss@latest`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `motion`. Note the **`@beta`** install channel.

---

## Own-CLI / copy-paste code libs

### Aceternity UI — https://ui.aceternity.com/
- **Framework**: React / Next.js.
- **Get code**: `npx aceternity-ui init` then `npx aceternity-ui add [component]` (`--all`, `-e` for demos). Copy-paste too. shadcn-compatible.
- **Style**: **Flashy, premium marketing/landing animations** — the most "wow" source. 3D cards, parallax, glare/spotlight/hover effects, animated text reveals, globes.
- **Best for**: Hero sections, bento grids, feature sections, pricing, testimonials, CTAs, 3D/parallax cards, animated backgrounds — landing pages, not app chrome.
- **Deps/gotchas**: **Framer Motion** primary; **Three.js** for 3D pieces (Globe, 3D card) → watch bundle size. ⚠️ Its `init` scaffolds a **v3-style `tailwind.config.js`** — on a Tailwind v4 project, skip `init`, pull individual components, and port config extensions into the `@theme` block.

### React Bits — https://www.reactbits.dev/
- **Framework**: React only ("Animated UI Components For React").
- **Get code**: `npx jsrepo add https://reactbits.dev/<variant>/<Category>/<Component>` or `npx shadcn@latest add @react-bits/<Component>-TS-TW`. Copy-paste too. **4 variants** per component: JS-CSS, JS-Tailwind, TS-CSS, TS-Tailwind — pick the one matching the stack (usually TS-TW).
- **Style**: Flashy animated/interactive — text animations, animated/WebGL backgrounds, hero eye-candy.
- **Best for**: Hero sections, animated text, decorative/3D backgrounds, landing wow factor.
- **Deps/gotchas**: Heavy components pull **GSAP**, **Framer Motion**, **three.js / OGL** — CLI prompts to install. Per-component footprint varies a lot; a 3D background is heavy. Verify Tailwind v4 per component.

### UI Layouts — https://www.ui-layouts.com/
- **Framework**: React + TS + Tailwind.
- **Get code**: **`npx uilayouts@latest add <component>`** (its own CLI namespace, NOT the shadcn URL pattern). Copy-paste too. Premium blocks behind `pro.ui-layouts.com/blocks`.
- **Style**: Clean, modern, motion-heavy effects — polish + speed.
- **Best for**: Marketing sections (hero, features, team, stats, testimonials) plus distinctive effects: mouse trails, clip-path reveals, scroll/marquee text, image masking/reveal, globes, timelines, carousels.
- **Deps/gotchas**: Motion components imply **framer-motion/motion**; globes need **cobe** or **three.js**. Verify Tailwind version per component. Separate CLI to learn (won't conflict with shadcn registry).

### MVPBlocks — https://blocks.mvp-subha.me/
- **Framework**: React / Next.js.
- **Get code**: Primarily **copy-paste** ("zero installations"); also CLI + manual, v0-compatible. For copy-paste, `WebFetch` the block and write it in.
- **Style**: Motion-first, animated-out-of-the-box marketing blocks; pixel-perfect, ship-fast.
- **Best for**: Full page sections — hero, pricing, dashboards, carousels, testimonials. MVP-fast.
- **Deps/gotchas**: **Framer Motion baked in** + Tailwind. TS supported. Check Tailwind version before dropping into v4.

### coss.com/ui — https://coss.com/ui
- **Framework**: React (Cal.com's design system; formerly Origin UI).
- **Get code**: **Copy-paste / own-the-source** (shadcn philosophy, no npm install). Layers: Primitives, Particles (484+), Atoms. `WebFetch` the component, write it in.
- **Style**: Clean, accessible, composable — Cal.com's look.
- **Best for**: Functional app/product UI — forms, dialogs, tables, menus, selects, calendars, OTP fields, toasts. Real app chrome, not decorative effects.
- **Deps/gotchas**: ⚠️ Built on **Base UI** (NOT Radix), itself in **beta** → early-development, expect breaking changes; props differ from Radix. Won't share primitives with most shadcn-ecosystem libs.

---

## Inspiration only — no code

> You can't truly "see" these at build time. Use them for the *human's* visual
> direction, or `WebFetch` a page for structural/layout cues — then implement
> the result with a code lib above. Never try to install from these.

### dark.design — https://www.dark.design/
- Curated gallery of shipped **dark-themed websites**, by industry (AI, Agency, Software, Web3…). Moody, high-contrast. Use for early dark-theme look-and-feel direction.

### supahero.io — https://supahero.io/
- Curated **landing-page hero sections** from real products (Stripe, Wise, Tesla, Apple…). Use when designing the above-the-fold: value-prop layouts, headline/CTA patterns. (Now folded into "screensdesign".)

### calltoinspiration.com — https://calltoinspiration.com/
- Element-level **micro-interaction** reference — buttons, cards, modals, dropdowns, logins, pricing tables, cookie banners + animations. Freemium. Treat as inspiration, not a code library.

---

## ⚠️ Wrong framework — skip in React

### Inspira UI — https://inspira-ui.com/docs/en
- **Vue & Nuxt only.** Essentially the Aceternity/Magic UI aesthetic ported to Vue (`motion-v`, GSAP, three.js). Looks great but is the "wrong framework" trap in a React app. Only relevant if the target project is Vue/Nuxt.
