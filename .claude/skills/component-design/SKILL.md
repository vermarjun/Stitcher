---
name: component-design
description: >-
  Use whenever the user asks to build, create, design, redesign, or "make
  prettier" any frontend UI — a page, screen, section, landing page, hero,
  pricing table, dashboard, card, navbar, modal, or any React component. Routes
  the work to the best-fit component library (shadcn, Aceternity, Magic UI,
  React Bits, cult-ui, 21st.dev, efferd, Animate UI, UI Layouts, MVPBlocks,
  coss.com/ui) instead of hand-writing generic components, installs/pulls the
  code, and assembles a polished result that matches the project's existing
  design system. Encodes a curated multi-library design workflow.
---

# Component Design Router

You are the user's design partner. Instead of hand-rolling generic components,
you pull from a curated set of best-in-class React component libraries, pick the
right one for each piece, and assemble a polished page/section that matches the
project's existing look. **Operate fully autonomously**: detect the stack, pick
libraries, install/fetch code, build, verify, then report what you used.

## The 15 sources (mental model)

These split into three buckets. The full per-library catalog (exact install
commands, signature styles, "best for", peer deps, gotchas) is in
`references/libraries.md` — **read that file before installing or assembling.**

1. **Registry code libs** — install via `npx shadcn add <url>`, code lands in
   the repo: **shadcn/ui** (base), **Animate UI**, **Magic UI**, **21st.dev**,
   **efferd**, **cult-ui** (`@beta`).
2. **Own-CLI / copy-paste code libs**: **Aceternity** (`npx aceternity-ui add`),
   **React Bits** (`jsrepo`), **UI Layouts** (`npx uilayouts add`),
   **MVPBlocks** (copy-paste), **coss.com/ui** (copy-paste — ⚠️ Base UI, not Radix).
3. **Inspiration only — no code**: **dark.design** (dark moodboards),
   **supahero.io** (hero sections), **calltoinspiration.com** (micro-interactions).
4. **⚠️ SKIP — wrong framework**: **Inspira UI** is Vue/Nuxt. Never use it in a
   React project. (If a future project is Vue, it becomes the go-to.)

## Decision table — what to reach for

Match the *need* to the *source*. When two fit, prefer the one already wired
into the project (check `components.json` registries) or already installed.

| You're building… | Reach for | Why |
|---|---|---|
| Buttons, inputs, dialogs, dropdowns, forms, tables, tabs, command palette, toasts — **app chrome** | **shadcn/ui** first; **coss.com/ui** for richer app primitives | accessible, neutral base everything else extends |
| Same app chrome but with **motion baked in** (animated tabs/accordion/icons) | **Animate UI** | drop-in animated replacements for shadcn pieces |
| **Flashy marketing hero**, 3D cards, parallax, glare, spotlight, animated backgrounds | **Aceternity UI** | the "wow" library; expect framer-motion + sometimes three.js |
| Landing **effects**: animated/gradient text, beams, particles, marquee, number ticker, device mockups, bento grid | **Magic UI** | 150+ effect components, shadcn companion |
| Animated **text** & decorative/WebGL **backgrounds** for heroes | **React Bits** | text animations + 3D/OGL backgrounds (heavy deps) |
| Eye-candy animated marketing blocks (glassmorphism, shaders, text-gif) | **cult-ui** | premium animated effects on shadcn (`@beta`, Tailwind v4 + `motion`) |
| Whole **marketing pages / app shells** assembled from polished blocks | **efferd** (clean/pro) or **MVPBlocks** (motion-first, fast) | full sections: auth, hero, features, dashboard, footer, CTA |
| Distinctive layout effects: scroll/clip-path reveals, mouse trails, image masking, timelines | **UI Layouts** | motion-heavy layout components |
| "Just give me options" / browse the biggest catalog | **21st.dev** | community marketplace of shadcn components |
| **Visual direction** before coding (dark theme look, hero patterns, micro-interaction ideas) | **dark.design** / **supahero.io** / **calltoinspiration.com** | inspiration only — study, then implement with a code lib |

When picking, infer the **vibe** from the request: "marketing/landing/hero" →
Aceternity + Magic UI + React Bits + cult-ui. "Dashboard/app/settings" → shadcn +
coss.com/ui + Animate UI. "Build the whole page fast" → efferd / MVPBlocks for
section scaffolding, then accent with effect libs.

## Autonomous workflow

Run these steps end-to-end without stopping to ask, unless something is
genuinely ambiguous or destructive.

### 1. Detect the stack (once per session, then remember)
Read `package.json` and `components.json` (or `app.config`/Tailwind config):
- **Framework**: confirm React. If Vue → only Inspira UI applies; if neither → stop and tell the user.
- **Tailwind version**: v4 (CSS-first `@theme` in the css file, `@tailwindcss/vite`/`@tailwindcss/postcss`) vs v3 (`tailwind.config.js` with `content`/`theme`). This changes how you install — see gotchas below.
- **Animation lib present**: `motion` (new) and/or `framer-motion`. Reuse what's there; don't add a duplicate.
- **3D deps present**: `three`, `ogl`, `cobe`, `postprocessing` — if present, WebGL/3D components are cheap to add; if absent, prefer non-3D variants or flag the added weight.
- **shadcn config**: `style` (new-york/default), `baseColor`, `aliases` (cn at `aliases.utils`, ui at `aliases.ui`), and any `registries` already wired (e.g. `@magicui`).
- **Primitive base**: Radix (most libs) vs Base UI. ⚠️ **coss.com/ui uses Base UI** — mixing it with Radix-based libs is fine but they don't share primitives; note it.
- **Package manager**: detect from lockfile (`pnpm-lock.yaml`→pnpm, `bun.lockb`→bun, `yarn.lock`→yarn, else npm) and use it for `dlx`/`add`.
- **Existing design tokens**: skim the css file for CSS variables (`--background`, `--primary`, custom fonts) and existing components in `aliases.ui` so new work matches.

### 2. Plan the composition
Decompose the requested page/section into pieces (hero, nav, feature grid,
pricing, testimonials, footer, CTA…). For each piece, choose a source from the
decision table. Prefer **fewer libraries** when one covers several pieces — but
don't force a clean app-UI lib to do a flashy hero or vice-versa.

### 3. Pull the code
- **Registry libs** → `npx shadcn@latest add "<component-url-or-@registry/name>"` (cult-ui: `shadcn@beta`). If a `registries` entry already exists in `components.json`, use the short `@name/component` form.
- **Own-CLI libs** → run the library's CLI (`npx aceternity-ui add ...`, `npx uilayouts@latest add ...`, `npx jsrepo add ...`) using the detected package manager's `dlx` equivalent.
- **Copy-paste libs (MVPBlocks, coss.com/ui, and any component without a working CLI)** → `WebFetch` the component's page or its registry `.json` to get the source, then write the file into `aliases.ui`/`components`, fixing imports to the project's `cn` path and tokens.
- **Inspiration sites** → you cannot meaningfully "see" them at build time. Optionally `WebFetch` the page for layout/structure cues, but implement the actual result with a code lib. Don't try to install from them.

### 4. Assemble & adapt
- Wire pieces together into the page/route following the project's existing routing and file conventions.
- **Reuse existing design tokens** (colors, radius, fonts, dark-mode variables) — recolor library defaults to match. The result must look like it belongs in *this* app, not a demo.
- Honor responsiveness, dark mode, and accessibility (keyboard, aria, reduced-motion). Respect `prefers-reduced-motion` for heavy animations.
- Match the surrounding code's style (naming, TS, component patterns).

### 5. Verify & report
- Run the project's build/typecheck (e.g. `npm run build` / `tsc -b`, or `npm run lint`) to confirm it compiles. Fix what you introduced.
- Briefly report: which libraries/components you pulled, any new deps added, and any gotcha you hit (e.g. "cult-ui needed `@beta`", "adapted an Aceternity v3 config component to v4").

## Gotchas (read before installing)

- **Tailwind v4 projects** (CSS-first `@theme`, no `tailwind.config.js`): do **not** run a library `init` that scaffolds a v3 `tailwind.config.js` (Aceternity's init does this). Instead pull individual components and port any `tailwind.config` color/animation extensions into the `@theme` block of the css file. shadcn, Magic UI, and cult-ui already support v4; `tailwindcss-animate` is replaced by `tw-animate-css` on v4.
- **`framer-motion` vs `motion`**: they're the same project, different package name. Use whichever the repo already has; if a pulled component imports `framer-motion` but the repo has `motion`, switch the import (`from "motion/react"`).
- **cult-ui** installs via `npx shadcn@beta` (not `@latest`) and assumes Tailwind v4 + `motion`.
- **coss.com/ui** is built on **Base UI**, currently beta — expect breaking changes and don't assume Radix-compatible props.
- **React Bits / Aceternity 3D** components can pull `three`/`ogl`/`gsap`. If those aren't installed and the user wants light bundles, pick a non-WebGL variant.
- **21st.dev** is a marketplace, not one library — component quality and deps vary per author; sanity-check each pulled component.

## Relationship to other skills

This skill is the **router** for *which library to source from*. If a
`frontend-design` or `vercel:shadcn` skill is also present, defer to them for
deep shadcn CLI mechanics and general design-quality polish — but this skill
owns the cross-library routing decision. Don't duplicate their work; chain into
them when their specialty is needed.
