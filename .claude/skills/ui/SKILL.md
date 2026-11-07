---
name: ui
description: Build or change any UI in apps/web — pages, components, layout, styling, empty/loading/error states. Use before writing JSX or Tailwind classes in this repo, and when a screen "looks basic" or needs polish. Covers the design tokens, the local component set in src/components/ui, icon and state rules, and the accessibility floor.
---

# RepoSage UI

A dev tool. Dense, calm, keyboard-friendly. Dark-first — `<html>` is hardcoded `dark`.
Never ship a screen that only looks right when the data is perfect.

## Before writing anything

1. **Reuse before inventing.** Check `src/components/ui/` (button, card, badge, input, skeleton, separator) and `src/components/` (status-badge, empty-state, page-shell, repo-back-link). Extend an existing component rather than hand-rolling a one-off div.
2. **No new UI dependencies.** `class-variance-authority`, `clsx`, `tailwind-merge` and `lucide-react` are installed and sufficient. Radix is deliberately absent — do not add shadcn via CLI, it assumes Tailwind v4 and this repo is on v3.4.
3. Compose classes with `cn()` from `@/lib/utils` so callers can override.

## Tokens, not raw colours

Only semantic tokens: `background` `foreground` `card` `popover` `primary` `secondary` `muted` `accent` `border` `input` `ring` `success` `warning` `danger`.

Never write `bg-zinc-900`, `text-gray-400`, `#3b82f6`. If a shade is missing, add a token in `globals.css` for both `:root` and `.dark`.

- `card` is deliberately lighter than `background` in dark mode. That separation is what stops the UI reading as flat — do not "fix" it by making them equal.
- Tint with the token: `bg-primary/15`, `border-danger/30`.
- `primary` is the one accent. Use it for the main action, active state and focus ring — not for decoration on every surface.

## Every async view needs three states

A list or panel that loads data is not done until all three exist:

| State | What to render |
|---|---|
| Loading | `<Skeleton>` shaped like the real content, so nothing jumps |
| Empty | `<EmptyState>` — say what happened **and** what to do next |
| Error | `danger`-tinted row with `AlertCircle` and the actual message |

A bare `return null` is a bug: it produces a blank screen with no way out.
Every sub-page must render a back link **in all three states** — the route resolves owner/name → id asynchronously, so a page that only shows navigation after data arrives is a dead end while loading.

## Icons

`lucide-react` only. Never text glyphs (`←` `▸` `▾`) or emoji as UI.
Size with Tailwind: `size-3.5` inline, `size-4` in buttons, `size-5` in empty states. Decorative icons get `aria-hidden`.

## Interaction and accessibility — the floor

- Anything clickable is a `<button>` or `<Link>`. Never an `onClick` on a `div`.
- Keep the focus ring. `focus-visible:ring-2 focus-visible:ring-ring` is already in `buttonVariants` and `Input`.
- Inputs without a visible label get `aria-label`. Toggles get `aria-expanded`. Progress bars get `role="progressbar"` with `aria-valuenow/min/max`.
- Disabled is not an explanation — add `title` saying why.
- Animate `opacity`, `transform`, and explicit properties. Never `transition-all`.

## Layout

- Wrap pages in `<PageShell>` (`width="wide"` for grids and dashboards) and lead with `<PageHeading>`.
- Spacing comes from a 4px scale: gaps `2/3/4`, section rhythm `space-y-6` or `space-y-8`, card padding `p-4`/`p-5`.
- Type scale: page title `text-2xl font-semibold tracking-tight`, section `text-sm font-semibold`, body `text-sm`, meta `text-xs text-muted-foreground`. Do not introduce new sizes.
- File paths, line numbers, scores, ids → `font-mono text-xs`. Numbers that update in place → add `tabular-nums`.
- Long text needs a clamp: `truncate`, `line-clamp-2`, or `min-w-0` on a flex child.
- Check one narrow viewport. Grids collapse (`grid-cols-2 md:grid-cols-5`), header rows get `flex-wrap`.

## Verify before claiming it works

`tsc --noEmit` passing is not evidence the UI renders. Run `npx next build` — it catches what the type-checker does not.

**Do not run `next build` while `next dev` is running.** They share `.next` and the build corrupts the dev server's chunk cache (`Cannot find module './vendor-chunks/...'`), which then needs a full dev restart. Build against a stopped dev server, or serve the build on another port with `next start -p 3100`.
