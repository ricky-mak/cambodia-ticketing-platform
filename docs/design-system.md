# Design System — "Techo × Rumduol"

The visual language for the buyer-facing site and check-in scanner. A modern
indigo foundation on a clean near-white base, warmed by lotus rose, jade and
gold — drawn from Morodok Techo National Stadium (the twin sail-prow masts that
allude to the *sampeah* gesture) and the Rumduol, Cambodia's national flower.

Admin screens intentionally inherit the same tokens but are not the focus of
this pass — they're restyled during the multi-tenant work (see
`docs/multi-tenant-plan.md`).

## Colour tokens

Defined as HSL channels in `src/app/globals.css` and consumed via
`hsl(var(--token))`; mapped to Tailwind utilities in `tailwind.config.ts`.

| Token / utility        | Hex       | Role                                        |
| ---------------------- | --------- | ------------------------------------------- |
| `--background`         | `~#FBFAF6` | clean near-white page background (barely warm) |
| `--foreground`         | `#23202B` | primary ink text                            |
| `--primary` / `brand`  | `#143A82` | indigo — primary actions, links             |
| `--brand-deep`         | `#0E2A5E` | deep indigo — heroes, headings, ticket band |
| `rose`                 | `#B83A6E` | lotus rose — prices, accents, totals        |
| `success`              | `#157A5B` | jade — availability, valid ticket, check-in |
| `gold`                 | `#C9A227` | gold — motif lines, small premium accents   |
| `--destructive`        | `#D92D20` | red — errors, invalid ticket                |
| amber-500/700 (Tailwind)| —        | "already checked in" warning state          |

Usage rules: **gold is sparing** (thin lines, the motif — never fills or body
text). **Rose** carries money/accents; **jade** carries "good/available/valid".
Errors use `destructive`; the "already checked in" warning uses amber so it's
distinct from both success and error.

A `.dark` palette (indigo-charcoal) is defined for completeness; the buyer site
runs light.

## Typography

Wired via `next/font` in `src/app/layout.tsx`, exposed as CSS variables and
Tailwind families:

- **Display / titles** — Fraunces (elegant serif). `font-serif`, e.g. event
  names, page titles, ticket header.
- **UI / body** — Sora (modern sans). `font-sans` (the default on `body`).
- **Khmer** — Kantumruy Pro (`khmer` + `latin` subsets). `font-khmer` for
  bilingual text; verify against real Khmer strings before launch.

## Components & motifs

- `src/components/brand/sail-motif.tsx` — gold line-drawing of the stadium's
  sail-prow masts; used as a subtle hero/ticket accent (`text-gold/40`).
- Buttons (`src/components/ui/button.tsx`) gained `success` and `gold` variants
  alongside the stock shadcn set.
- Availability/status use pill badges: jade (available/valid), amber (already
  checked in), muted (sold out), destructive (invalid).
- The scanner keeps full-bleed colour overlays for gate glanceability, now on
  the brand palette (jade / amber / red).

## Radius

`--radius: 0.75rem` (slightly softer than stock shadcn) for a modern feel.
