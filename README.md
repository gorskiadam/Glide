# Glide

A bilingual (English / Polish) typing trainer that teaches you to type faster and with
more flow. No account, no tracking: everything stays in your browser.

Status: all five phases are done. See [What could come next](#what-could-come-next).

## Run it

```bash
npm install
npm run dev      # http://localhost:5183
npm run preview  # serve the production build on port 5184 (after npm run build)
npm test         # unit tests (engine, Flow Score, key statistics, coach, lessons, daily challenge, backup, palette, progress, content)
npm run build    # type-check and production build into dist/
```

## What it does so far

- **Typing engine:** per-character feedback, a smooth caret, backspace and
  word-delete, Polish diacritics, dead keys, phone keyboards and held-key protection.
- **Modes:** timed (15 / 30 / 60 / 120 s), word count (25 / 50 / 100), passage (one
  whole text: short, medium or long), zen (no timer, press `Esc` to finish) and
  coach (a drill built from the keys and letter pairs you are weakest at).
- **Lessons:** a path from the home row to the top row, bottom row, numbers,
  capitals and symbols, and (for Polish practice) the Polish letters. Each lesson
  warms up the new keys, then uses real words made only of keys taught so far. A
  live keyboard shows the next key and which finger presses it. 90% accuracy
  passes a lesson and opens the next one; 95% and 98% earn the second and third
  star. The first lesson of every unit is always open.
- **Daily challenge:** one medium-length text per day and language, picked from
  the date, so it is the same for everyone. The best run of the day is kept.
- **Message sprint:** five short everyday messages typed one after another, scored
  as one result. The pause between messages is not counted.
- **Share card:** every result can be turned into a 1200 x 630 image with the WPM,
  accuracy, Flow Score and a rank title (Warming up, Steady, Smooth, Swift, Glider,
  Jetstream, Lightspeed) to download, share or copy.
- **Warm-up:** about a minute in three steps (finger groups, short common words,
  easy sentences), sized to your recent speed.
- **Pace caret:** a second caret that moves at your average, your best for the
  current test, or a speed you set.
- **Command palette:** `Ctrl`/`Cmd` + `K` opens a searchable list of every screen,
  mode and common setting. Search ignores Polish accents.
- **Your data:** export everything to a JSON file and import it again. Nothing
  leaves the device otherwise.
- **Offline:** installable, and works without a connection after the first visit.
- **Keyboard replay:** after every run the heatmap card opens on a replay: an
  on-screen keyboard plays back each key and backspace in your own rhythm (long
  pauses shortened), with the text as it looked at that moment. Wrong keys are
  red with the expected key outlined, hesitations are amber. Under it, "What to
  improve" lists the keys you confused, your longest pause, your slowest keys and
  whether mistakes came from rushing, with a button that jumps to that moment.
- **Text types:** all, quick messages, everyday, work, school, stories, practical,
  numbers and symbols. 168 texts per language.
- **Results:** net WPM, raw WPM, accuracy, consistency, errors, time, a
  speed-over-time chart, the Flow Score with its waveform, and a keyboard heatmap
  of the test (speed, accuracy or finger guide). Personal best per test setup.
- **Progress:** daily goal ring, streak, best and average WPM, accuracy, time
  practiced, WPM / accuracy / Flow over time, all-time heatmap per language, weak
  keys and letter pairs, personal bests.
- **Languages:** app language and practice language are set separately (EN / PL),
  detected from the browser on first visit and saved in localStorage.
- **Settings:** theme (light, dark, system), typing font (mono, sans, easy-read
  Lexend), text size, caret style and smoothness, reduce motion, key sounds with
  three synthesised packs, live speed, strict mode, stop on error, punctuation /
  numbers / capital letters on or off, reset all data.
- **Shortcuts:** `Tab` then `Enter` for a new text, `Esc` to start the same text
  over, `Ctrl`/`Cmd` + `K` for the command palette.

Design is based on Tempo: see `DESIGN.md`.

## Project layout

```
content/<lang>/<category>.json   practice texts
scripts/tag-content.mjs          fills in the category and length tags
src/engine/                      typing engine and statistics (no DOM, unit tested)
src/lib/textgen.ts               builds a test from the text library
src/lib/filters.ts               text type and punctuation / numbers / capitals filters
src/lib/sound.ts                 key sounds made with the Web Audio API
src/engine/flow.ts               Flow Score and waveform data
src/lib/keystats.ts              per-key and per-pair statistics, weak-spot ranking
src/lib/coach.ts                 builds a drill from sentences rich in weak spots
src/lib/progress.ts              streak, daily goal and personal-best maths
src/lib/lessons.ts               the lesson path, unlock rules and lesson text generator
src/lib/layout.ts                keyboard layout: which key and finger types each character
src/lib/daily.ts                 picks the daily challenge text from the date
src/lib/rank.ts                  rank titles by speed
src/lib/sharecard.ts             draws the result card on a canvas
src/engine/combine.ts            adds up several runs (the messages of a sprint)
src/lib/replay.ts                replay timeline and the analysis behind "What to improve"
src/lib/warmup.ts                builds the three warm-up steps
src/lib/pace.ts                  speed of the pace caret
src/lib/commands.ts              command palette commands and search
src/lib/backup.ts                export and checked import of saved data
vite.config.ts                   also generates the offline service worker
public/                          web manifest, icons, robots.txt
src/content/                     content types and lazy loader
src/i18n/                        UI strings: en.ts is the source of truth, pl.ts must match it
src/store/                       settings and result history (Zustand, saved to localStorage)
src/components/                  TypingArea, Session, KeyGuide, ShareCard, CommandPalette, Replay, Keyboard, FlowWave, LineChart, Shell, Seg, Switch, Icon
src/screens/                     Practice, Results, Lessons, Lesson, Daily, Sprint, Warmup, Progress, Settings
src/styles/index.css             design tokens and component styles
```

## How the numbers are calculated

| Stat | Rule |
| --- | --- |
| WPM (net) | correct characters on screen / 5 / minutes |
| Raw WPM | all typed characters / 5 / minutes |
| Accuracy | correct keystrokes / all keystrokes (a fixed mistake still counts) |
| Consistency | 100 x (1 - tanh(standard deviation / mean)) of raw WPM per second |
| Flow Score | 100 x (1 - tanh(1.1 x (CV - 0.15))), where CV is the standard deviation / mean of the gaps between keystrokes (pauses capped at 2 s). It measures rhythm, not speed. |
| Weak spot score | 3 x error rate + how much slower than your average the key is (0.5 = 50% slower) |

The coach starts once it has seen 200 key presses in a language. It ranks every
sentence in the library by how many of your weak keys and pairs it contains and
builds a drill of about 40 words from the best ones.

## Add texts

1. Add an entry to `content/<lang>/<category>.json` with `id`, `difficulty`
   (`easy`, `medium`, `hard`) and `text`. Ids look like `en-work-09`. To add many
   at once, put one text per line as `e|text`, `m|text` or `h|text` in a file and
   run `node scripts/add-texts.mjs <lang> <category> < file.txt`.
2. Use only characters people can type: straight quotes (`"` and `'`), a plain
   hyphen, no ellipsis character. Polish letters are fine.
3. Run `npm run tag-content` to fill in `category` and `length`, then `npm test`.

New category: add a new JSON file and add its name to `Category` in
`src/content/types.ts`.

## Add a language

1. Create `content/<code>/` with texts.
2. Add the code to `Lang` and `LANGS` in `src/content/types.ts`, and its letters to
   `TYPEABLE`.
3. Add `src/i18n/<code>.ts` (TypeScript reports any missing string) and register it
   in `src/i18n/index.ts`.
4. Add the option to the language controls in `Practice.tsx` and `Settings.tsx`.

## Offline and installing

`npm run build` also writes `dist/sw.js`, a service worker generated in
`vite.config.ts`. On the first visit it stores the whole app (about 1 MB: code,
both text libraries, the Latin fonts and icons), after which Glide starts and
works with no connection. Each build gets a new cache name, and the old cache is
removed when the new version takes over on the next visit. The service worker is
not used by `npm run dev`.

Glide can be installed from the browser's install button; Settings also shows an
Install row in browsers that support it. Host the `dist` folder on any static
host over HTTPS. Routes live in the URL hash, so no server rewrites are needed.

## Checks made for the last phase

- Lighthouse on the production build (`npm run preview`): performance 100,
  accessibility 100, best practices 100 on both the mobile and desktop presets.
- axe-core (WCAG 2.1 A and AA plus best practices) on every screen, the results
  screen, the share dialog and the command palette, in light and dark themes: no
  violations.
- Offline: loaded once, stopped the server, reloaded and opened other screens.

## What could come next

- Lessons for other keyboard layouts (the lesson path and finger guide assume
  QWERTY and the Polish programmer layout).
- More texts, and more languages (see "Add a language").
- Optional sync between devices; today the only way to move progress is
  export and import.
- A ghost that replays your own best run key by key, instead of a pace caret
  moving at a steady speed.
