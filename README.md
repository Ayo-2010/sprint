# The Sprint Room — Timed Writing Desk

A timed writing sprint on a clean sheet of typing paper, with an analog timer, prompts, live word count and a filing drawer of past sessions.

## Live Demo
https://ayo-2010.github.io/sprint/

## Features
- Analog timer dial with animated hand and progress ring
- Session lengths: 5 / 10 / 15 / 25 minutes
- Writing prompt generator (25 prompts, shuffleable)
- Live word count and words-per-minute calculation
- Typewriter sound on keystrokes (toggleable)
- Bell sound at completion
- Filing drawer stores past sessions with date, duration, word count, wpm
- Data persists in localStorage
- Responsive down to 390px
- Respects `prefers-reduced-motion`

## Controls
- **Duration keys** — set session length before starting
- **Start / Reset** — begin or abort a sprint
- **Shuffle prompt** — pick a new writing prompt
- **File early** — end the sprint before time runs out
- **Clear drawer** — remove all filed sessions
- **Sound toggle** — typewriter clicks + bell
- **Keyboard** — type directly in the textarea once started

## Design Notes
- Palette: warm paper `#f8f0dd`, dark ink `#0f231b`, rust accent `#a53b30`, brass `#e7dcc2`, aged green `#7f8f79`
- Fonts: Courier Prime (monospace, drafting), Roboto Slab (display)
- Timer: SVG dial with stroke-dasharray progress ring, rotating hand
- Reduced motion: disables hand rotation, ring animation, sound

## Local Storage Keys
- `sprint.history.v1` — array of session objects
- `sprint.duration.v1` — selected minutes (number)
- `sprint.muted.v1` — boolean

## Session Object Schema
```json
{
  "id": "sprint-1708451200000",
  "date": "20 OCT 2026",
  "duration": 15,
  "prompt": "A letter arrives forty years late.",
  "words": 342,
  "wpm": 22,
  "completed": true
}
```

## Browser Support
Modern browsers with CSS Custom Properties, SVG, Web Audio API.

## License
MIT