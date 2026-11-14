# Glide design notes

Glide is a sibling of **Tempo** (https://jaguar.workdocs.online). These notes record what
Tempo does, read from its live CSS, and how Glide adapts it.

## What Tempo does

| Area | Finding |
| --- | --- |
| Stack | React 18 + htm from a CDN, one hand-written stylesheet driven by CSS variables. |
| Layout | Single column, max 720-760px. Fixed bottom nav on mobile (5 items, icon over 11px label). From 980px the nav becomes a 220px left sidebar with a brand block. |
| Type | Display: **Plus Jakarta Sans** 700/800, tight tracking (-0.02em). Body: **Instrument Sans** 15px. Labels: 11px, 700, uppercase, 0.08em tracking. |
| Colour (light) | bg `#FAFAFA`, card `#FFFFFF`, surface `#F4F4F5`, text `#171717` / `#404040`, muted `#737373`, lines `#ECECEE` / `#DEDEE2`. |
| Colour (dark) | bg `#09090B`, card `#18181B`, surface `#27272A`, text `#FAFAFA`, muted `#A1A1AA`. |
| Accent | Violet `#7C3AED` (deep `#6D28D9`, soft `#EDE9FE`, softer `#F5F3FF`, dark-mode `#8B5CF6` / `#A78BFA`). |
| Status | good `#15803D` on `#DCFCE7`, warn `#B45309` on `#FEF3C7`, bad `#B91C1C` on `#FEE2E2`. |
| Radius | cards 20px, icon tiles 16px (11px small), controls 12px (10px small), pills 999px. |
| Shadow | Nearly flat: `0 1px 2px rgba(23,23,23,.04)`. Pop-overs: `0 14px 44px rgba(23,23,23,.16)`. |
| Glass | Only the mobile nav: 90% card colour + `blur(14px)`. |
| Cards | 22px 24px padding, 1px line border. Head = 34px violet icon tile + bold 17-19px title + status pill on the right. Bold lead sentence, muted secondary text, 1px dividers between rows. "Hero" cards get a violet-tinted top gradient and a violet border. |
| Icons | Outline icons (1.75-2px stroke) inside coloured rounded squares. Each category has a pastel background and a saturated foreground (blue, green, teal, amber, pink, violet...). |
| Controls | Buttons: primary (violet), soft (violet tint), ghost (outlined). Segmented control: surface track, white active thumb with small shadow, violet active text. Pills for status. |
| Motion | 120-150ms transitions, hover lifts 1px, press scales to 0.97. Entrances rise 8px with `cubic-bezier(.2,.8,.2,1)`; playful overshoot pops for icons. Honors reduced motion. |
| Themes | `data-theme` on `<html>`, plus `prefers-color-scheme` for the system default. |

## How Glide adapts it

- **Same bones:** fonts, violet accent, neutral scale, radii, pills, segmented controls,
  icon tiles, sidebar/bottom-nav shell and motion timings are taken from Tempo.
- **Liquid glass:** Tempo's cards are flat white. Glide's cards are translucent
  (`--glass`), blurred and saturated (`blur(22px) saturate(1.6)`), with a bright top
  inner edge, floating over a soft violet/sky/pink colour wash. This is Glide's identity.
- **Second accent:** a sky blue (`#38BDF8`) pairs with violet in the logo, the caret
  glow and charts, suggesting motion.
- **Typing text:** JetBrains Mono, large, so every character and the caret are clear.
- **Calm focus:** while typing, the nav and controls fade out and return on finish.
- Tokens live in `src/styles/index.css` as CSS variables and are exposed to Tailwind
  through `@theme inline`.
