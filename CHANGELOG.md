# Changelog

Internal version notes for Picksy / PickForMe. The full per-release dev notes
that used to live in separate `CHANGES_*.md` / `FIXES_*.md` files at the repo
root are preserved in the git history.

## v83 — AI Search Race + Quality Gate
- AI search race condition fixed; quality gate added.
- Service worker bumped to v173.

## v81 — Daily Pick + FAB
- Daily Pick improvements; floating action button alignment.

## v80 — Кіно-Wordle
- Ukrainian movie titles for the Wordle mini-game; refreshed design.

## v79 — Picksy mascot
- Mascot rolled out site-wide, contextual reactions, sharing hooks.

## v77 — SEO
- Removed keyword stuffing, cleaned `alternateName` list, dropped fake
  `aggregateRating`, fixed `noindex` on blog. Improved indexing for
  "picksy ai" / "picksy my".

## v76 — Movie DNA
- Movie DNA share cards, OG images, public `/dna/<user>` pages, polish.

## v75 — Collections
- Collections fixes (visibility, sharing, member management).

## v74 — Premium gating
- Premium feature gating + new upgrade modal.

## v73 — Gifts & translations
- Gift flow fixes, translation pass, subscription method tweaks.

## v72 — UA + premium collections
- Ukrainian badge; collections gated behind premium.

## v71 — Collections sync
- Fixed films not appearing on `/c/<slug>` after being added.

## v64 — Telegram bot rewrite
- Telegram bot fully rewritten — modular handlers, scheduler, archetypes.

## Earlier
- v64.x patches, plus the initial Picksy fixes pack (`CHANGES.md`).
- See `git log` for finer-grained commit history.
