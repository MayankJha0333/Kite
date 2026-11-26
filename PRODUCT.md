# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Kite is a desktop app whose interface is HTML and CSS inside Electron. macOS is the first
platform; Windows and Linux builds exist and must keep working.

## Users

Any Mac user who wants a calmer browser, most of them coming from Safari or Chrome. They have
not used a sidebar browser before, so the first minutes must teach the sidebar from zero
without a tutorial wall. People moving from Arc are welcome and can bring their setup across,
but Arc import is a side door, not the front door. (Confirmed by the owner, 25 November 2026.)

They use it all day, for everything: reading, work tools, video, quick lookups from other
apps. The job is always the same: get to a page and keep the pages that matter within reach,
without managing a tab bar.

## Product Purpose

A web browser that keeps tabs in a sidebar and tidies up after you. Pinned tabs replace
bookmarks, everything else clears itself, and one command bar (⌘T) finds any open tab, page
or action. Success is a person making Kite their default browser and still using it weeks
later because it feels effortless.

## Positioning

Everything lives on your computer. There is no account, no server and no AI service, so
nothing can be switched off remotely and nothing about your browsing leaves the machine.
Ad and tracker blocking, fast downloads and floating video are built in rather than added.

## Operating Context

- Daily, long-session desktop use next to Finder, Safari, Mail and the rest of macOS; people
  judge it against first-party Mac apps.
- Keyboard-heavy: ⌘T, ⌘W, ⌘1–9, ⌘L and ⌘F are used hundreds of times a day.
- Links arrive from other apps (mail, chat, documents) and open in a little window or a Space.
- Light and dark rooms, laptop screens and large displays, windows from about 720px wide.

## Capabilities and Constraints

- Built: sidebar tabs, Favorites, pinned tabs, folders, Spaces with their own colors, auto-archive
  and Archive, command bar, Split View, Peek, little window, Boosts, link routing, notes,
  Shields (ad/tracker blocking), accelerated downloads, floating video, History, a home page
  with widgets, Chrome extensions (partial), import from Arc.
- Not built: private windows, several main windows, tab hover previews, passwords and
  autofill, DRM video, translate, import from Chrome or Safari.
- Left out on purpose: accounts, sync, AI features.
- Auto-update is allowed for signed security updates (owner decision, 25 November 2026).
  It needs a signed build; today's builds are unsigned.
- Stack: Electron, React 18, TypeScript, zustand, plain CSS. State is one local JSON file.
- Terms that stay: Spaces, Favorites, Pinned, Today, Peek, Split View, Boosts, Shields,
  Little window, Archive.

## Brand Commitments

- The name Kite and the kite icon stay.
- Everything else about the look may change: colors, default theme, typography, layout
  details. (Owner decision, 25 November 2026.)
- No code, text, icons or name from Arc.
- The owner's brief for the experience: "a more professional, polished experience, similar
  to macOS … simple, intuitive, consistent, and so enjoyable to use that people naturally get
  attached to them and build habits around them … premium, thoughtfully designed, and
  effortless to use … its own identity … focus on the actual user experience, not just
  making the UI look attractive."

## Evidence on Hand

- Screenshots and a short film in `docs/images/`; a landing page in `site/`.
- 335 logic tests, about 258 UI tests and 48 real-app tests.
- No user testimonials, usage numbers or press. Do not invent any.

## Product Principles

1. The page is the point; the browser stays out of its way.
2. Yours and local: no account, nothing leaves the computer, nothing can be turned off remotely.
3. Tidy by default: the browser clears up after you, and always lets you undo.
4. One way to do each thing, reachable from the keyboard.
5. Familiar to a Mac user in the first minute; rewarding in the hundredth hour.

## Accessibility & Inclusion

Text contrast of at least 4.5:1 and accent contrast of at least 3:1 in every theme, full
keyboard access with a visible focus ring, Reduce Motion honored (system setting and Kite's
own switch). These are already enforced by tests and must stay enforced.
