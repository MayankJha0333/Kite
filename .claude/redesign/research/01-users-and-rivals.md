# 01 - Users and rivals: what makes people love (and leave) Arc-style browsers

Research date: 2026-11-25. Scope: Arc love and complaints, rival browsers, first-run, honest delight. AI and sync deliberately excluded.

## How to read this

- Every claim has its source URL beside it.
- Pages were read through a fetch tool that summarises; quoted words are as that tool returned them. Spot-check any quote before publishing it.
- Reddit could not be fetched directly (mirror hosts failed). Reddit quotes here are second-hand and marked so.
- "Unverified" means one weak source, a vendor source, or my own prior knowledge not confirmed in this pass.
- Counts ("~6") are rough tallies from the visible part of a thread, not a survey.

## 0. The situation right now (most important context)

- Arc stops working on Mac and Windows on 22 December 2026. Announced 22 October 2026. Accounts are deactivated and personal data deleted within 30 days. https://techcrunch.com/2026/10/22/arc-browser-sunsets-december-22-as-the-browser-company-doubles-down-on-dia/ and https://9to5mac.com/2026/10/22/arc-browser-gets-a-sunset-date-and-users-have-two-months-to-move-on/
- New Arc accounts were blocked on announcement day. The latest Arc build can export passwords, bookmarks, extensions, history, Spaces, Folders and Tab Groups. https://www.androidauthority.com/arc-browser-shutting-down-december-2026-3726900/
- Arc had been in maintenance mode since May 2025; the company was acquired by Atlassian in September 2025. https://www.theregister.com/2025/05/27/arc_browser_development_ends/ and https://news.ycombinator.com/item?id=45127232
- Reaction was "largely disappointed", with renewed calls to open-source Arc. https://techcrunch.com/2026/10/22/arc-browser-sunsets-december-22-as-the-browser-company-doubles-down-on-dia/
- The replacement field is crowded. One roundup ranks 20 Arc alternatives and names about 55 more; many are small Chromium or WebKit clones with Arc import. https://piunikaweb.com/2026/11/18/roundup-of-every-arc-browser-alternative-we-know/ (individual product names as returned by the fetch tool; unverified one by one)
- Zen 1.24b (29 October 2026) added direct import of Arc Spaces and profiles. https://www.linuxcompatible.org/story/zen-browser-124b-adds-arc-migration-shareable-boosts-and-firefox-159/
- Consequence for Kite: a feature checklist will not win. The stated unmet needs are longevity, trust, polish and the few interactions nobody has copied well (section 2 and 3).

## 1. What users love about Arc, ranked by how often it comes up

Ranking basis: three HN threads (2022, 2023, 2026), two TidBITS pieces and thread, Tildes, four personal blogs, The Browser Company's own letter.

### 1. The sidebar as a calm, permanent home (most mentioned)

- Tabs, address bar and pinned items live in one left column; the page gets the rest. Auto-hiding sidebar named first in an HN list of what made it the "favorite desktop browser UX". https://news.ycombinator.com/item?id=50197601
- Second-hand Reddit: "I miss Arc's sidebar the most. Everything else I can live without". https://supasidebar.com/blog/switching-from-arc-browser (vendor blog quoting r/ArcBrowser; unverified)
- The Browser Company itself named "sidebar mode" as the first "greatest hit" to port to Dia. https://techcrunch.com/2025/11/03/dias-ai-browser-starts-adding-arcs-greatest-hits-to-its-feature-set
- The same tab list appears in every window. https://news.ycombinator.com/item?id=36862546
- The sidebar tint changes with the Space, called "vital" for knowing where you are. https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/

### 2. Pinned tabs replace bookmarks; everything else cleans itself up

- Arc "conceptually merges bookmarks and pinned tabs", and unpinned tabs "are cleared automatically". https://news.ycombinator.com/item?id=50197601
- Pinned tabs work "vastly better than bookmarks" because each opens in its own tab. https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Auto-archive "removes a lot of tab anxiety". https://news.ycombinator.com/item?id=36862546
- "I love that it deletes all the tabs I've opened and not interacted with recently." https://news.ycombinator.com/item?id=33539549
- A "daily reset button for your brain". https://dev.to/thecheapaudiophile/a-year-with-the-arc-browser-398m
- Favourites (top row, icon only) are kept warm so they appear to load instantly. https://chriscoyier.net/?p=7746
- Tabs and Spaces can be renamed and given an emoji or icon, so the sidebar matches how the user thinks. https://chriscoyier.net/?p=7746

### 3. Cmd+T is one bar for everything

- Opens mid-window, large; one reviewer's "aging eyes appreciate the larger presentation". https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Typing finds an already-open tab, runs an extension or reopens a closed page instead of always making a new tab. https://chriscoyier.net/?p=7746
- You reach any tab "without having to remember 'where did I put that'?". https://news.ycombinator.com/item?id=33539549

### 4. Spaces you swipe between

- "Arc just lets you swipe left or right" versus clicking through Safari tab groups. https://digitaltrends.com/computing/arc-browser-is-shutting-down-in-december-long-live-ya-trailblazer
- "Being able to easily swipe between sandboxed profiles is great." https://news.ycombinator.com/item?id=36862546
- Ctrl+1, Ctrl+2 jump straight to a Space. https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Caveat that matters: only 5.52% of daily users used more than one Space regularly. https://browsercompany.substack.com/p/letter-to-arc-members-2025

### 5. Little Arc and Peek: look at a link without losing your place

- Links from other apps open in a small floating window you can dismiss or promote (Cmd+O). It stops people "getting sucked into the Web". https://news.ycombinator.com/item?id=36862546 and https://chriscoyier.net/?p=7746
- Peek: after dismissing, "you're right back where you left off". https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- A September 2026 author still on Arc says Peek "remains unavailable on all of the Arc alternatives I've tried so far". https://piunikaweb.com/2026/09/03/why-i-still-use-arc-browser/
- "Oh man I'm going to miss peek". https://news.ycombinator.com/item?id=50197601

### 6. Split View that is easy to find

- Option-click a link or a second tab to split; up to four panes. "Far more discoverable and memorable than the macOS approach." https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/ and https://chriscoyier.net/?p=7746
- Switching a split between vertical and horizontal was called out. https://news.ycombinator.com/item?id=50197601

### 7. Air Traffic Control (link routing) - loved more than its fame suggests

- It "kept me on Arc"; listed with Peek and nested folders as what one user still misses in Dia. https://news.ycombinator.com/item?id=50197601
- Typical use: send every Notion link to the work Space. https://remotesynthesis.com/posts/migrating-from-arc-to-zen

### 8. Small utilities people name unprompted

- Cmd+Shift+C copies the URL and strips tracking junk. https://chriscoyier.net/?p=7746
- Ctrl+Tab flips to the last tab; holding it shows a switcher with previews. https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Automatic picture-in-picture when you leave a playing tab. https://news.ycombinator.com/item?id=36862546
- Boosts and "Zap" to hide page elements for good. https://piunikaweb.com/2026/09/03/why-i-still-use-arc-browser/
- Element-cropped screenshots. https://chriscoyier.net/?p=7746
- Hover a pinned mail, calendar or GitHub tab to see unread mail, next meeting or PRs waiting. https://remotesynthesis.com/posts/migrating-from-arc-to-zen (used by only 0.4% of DAUs: https://browsercompany.substack.com/p/letter-to-arc-members-2025)

### 9. Polish and feeling

- "Visual design, animations, and general impression of polish"; felt more native than other browsers. https://tildes.net/~tech/1jz8/the_browser_company_announces_arc_browser_will_no_longer_be_their_flagship_product
- Theme controls where "you essentially can't screw up". https://chriscoyier.net/?p=7746
- Hiding all UI "had a really positive impact on my concentration". https://news.ycombinator.com/item?id=33539549
- Those "who stuck around after a few days were fanatics". https://browsercompany.substack.com/p/letter-to-arc-members-2025

## 2. Complaints and reasons people left (Kite's openings)

### Abandonment and trust (dominant theme 2025-2026)

- Pivot to Dia: "insanely bad optics". https://news.ycombinator.com/item?id=50197601
- "Don't you love it when your browser has a remote kill switch?" https://news.ycombinator.com/item?id=50197601
- Users ask of every replacement whether it will shut down too; one wants "a good chance it'll be here in 5 years". https://supasidebar.com/blog/arc-alternatives-that-wont-shut-down-2026 (vendor analysis of 126 Reddit threads; unverified)
- "Too many nice UIs and Arc imports and not enough security and long-term development." Same source, same caveat.
- Bug reports and feature ideas went unanswered. https://news.ycombinator.com/item?id=50197601
- Release notes "essentially became marketing releases"; bugs unfixed for months. https://tildes.net/~tech/1jz8/the_browser_company_announces_arc_browser_will_no_longer_be_their_flagship_product

### Forced account (most persistent product complaint)

- "A browser that requires an account to use? No thanks." https://news.ycombinator.com/item?id=36862546
- Still raised in 2026: "I downloaded it and it wanted me to sign up for an account." https://news.ycombinator.com/item?id=50197601
- First-run also had a password-import step that could not be skipped directly. https://deceptive.design/articles/arc-browsers-pushy-account-requirements (user submission, 24 Aug 2024; unverified)
- The Boosts flaw (CVE-2024-45489) existed because Boosts were stored server-side in Firebase; Arc also sent the current site while the Boosts editor was open. Top Arc story on HN, 1,469 points. https://news.ycombinator.com/item?id=41597250

### Too much to learn ("novelty tax")

- "For most people, Arc was simply too different, with too many new things to learn, for too little reward." https://browsercompany.substack.com/p/letter-to-arc-members-2025
- Feature use: 5.52% multiple Spaces, 4.17% Live Folders, 0.4% Calendar Preview on Hover. Same source.
- "I found the onboarding to be very weak"; "it has a lot of 'stuff' to learn". https://news.ycombinator.com/item?id=36862546
- UX "is hidden and complex and as a result lacks a natural discovery flow". https://news.ycombinator.com/item?id=33539549
- New users hunted for a horizontal tab strip and closed tabs by accident. https://jtbdux-protocol.pages.dev/discovery-and-research/choosing-to-switch/arc-browser-and-the-progress-timeline-from-first-thought-to-abandonment (secondary analysis)

### Specific interaction friction

- Auto-archive "impossible to turn off"; tab hoarders get frustrated. https://news.ycombinator.com/item?id=36862546 and https://news.ycombinator.com/item?id=33539549
- Multiple windows felt "weird"; each has a full sidebar. https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Find Next did not persist: Cmd+G would not repeat a search. Same source.
- Downloads had no shortcut or multi-select and "feels slightly unfinished"; Notes too. Same source.
- Peek opened for same-site links such as Google Docs. Same source.
- Sidebar-only layout fights tiling window managers. https://news.ycombinator.com/item?id=36862546
- Bookmarks behave "very differently"; weak bookmark handling is a recurring gripe. https://news.ycombinator.com/item?id=36862546

### Performance, weight, stability

- Became "slower, slower, slower, and buggier, buggier, buggier". https://dev.to/thecheapaudiophile/a-year-with-the-arc-browser-398m
- "Kept crashing on me. So I switched to Safari". https://supasidebar.com/blog/switching-from-arc-browser (second-hand Reddit; unverified)
- 300 MB download criticised. https://news.ycombinator.com/item?id=36862546
- Unverified (source page 404 on fetch, figures from a search snippet): 2-3x Safari's memory; about 8.5 h battery versus 11 h in Safari on an M1 Air. https://dev.to/pickuma/arc-browser-review-18-months-with-a-browser-that-thinks-differently-26o1

## 3. What people praise in the alternatives (and what is stealable)

### Zen (most-named destination; ~12 mentions in the 2026 HN thread)

- "Near drop-in replacement for Arc"; Arc's UX "without all the AI garbage". https://news.ycombinator.com/item?id=50197601
- Steal: compact mode hides everything; touch a screen edge and the chrome appears briefly. https://www.omgubuntu.co.uk/2025/08/zen-browser-is-what-mozilla-firefox-should-be
- Steal: Glance preview offers close, expand or send-to-split in one place. Same source.
- Steal: record any shortcut in settings. https://remotesynthesis.com/posts/migrating-from-arc-to-zen
- Steal: hold a modifier over the new-tab button to paste-and-go. https://www.linuxcompatible.org/story/zen-browser-124b-adds-arc-migration-shareable-boosts-and-firefox-159/
- Gaps Kite can beat: links from other apps open as full tabs, no Little Arc. https://remotesynthesis.com/posts/migrating-from-arc-to-zen and https://piunikaweb.com/2026/09/03/why-i-still-use-arc-browser/
- Glance controls sit over the parent tab and are hard to notice. https://remotesynthesis.com/posts/migrating-from-arc-to-zen
- Essentials are forced to be shared across all workspaces. Same source.
- Developers oppose auto-closing tabs. https://news.ycombinator.com/item?id=50197601
- Command palette cannot run actions such as DevTools or screenshot; dragging a tab to another space does not work; no DRM video. https://jermspeaks.github.io/blog/2025-08-25-migration-to-zen-browser (August 2025; may have changed)
- Still has Mozilla's "clunk factor". https://tildes.net/~tech/1jz8/the_browser_company_announces_arc_browser_will_no_longer_be_their_flagship_product

### Dia

- Some say "turn off / ignore the AI" and it is fine; has "that 'Arc feel'" on macOS. https://news.ycombinator.com/item?id=50197601
- Steal: Meet turns into picture-in-picture automatically when you switch tabs. https://techcrunch.com/2025/11/03/dias-ai-browser-starts-adding-arcs-greatest-hits-to-its-feature-set
- Gaps: "Profiles aren't as good to use as spaces" (favourites cannot be shared across them); no Boosts; Peek and Little Arc incomplete; a permanent AI button. https://news.ycombinator.com/item?id=50197601 and https://piunikaweb.com/2026/11/18/roundup-of-every-arc-browser-alternative-we-know/
- A commenter cites a "$100 per month plan". https://news.ycombinator.com/item?id=50197601 (commenter claim; unverified)

### Helium (closest to Kite's stance: no account, no AI, ad blocking built in)

- Praised for "doing all the right things out of the box" and for "no unprovoked tabs about updates or sponsors". https://www.thurrott.com/cloud/web-browsers/335205/helium-may-just-be-the-browser-youve-been-looking-for
- Steal: silence. Never open a what's-new tab; never nag.
- Steal: bang shortcuts to search a site directly from the bar. Same source.
- Gap: no Spaces, no command bar model. https://supasidebar.com/blog/helium-vs-arc (vendor; unverified)

### Safari (macOS 26 Tahoe)

- People go back for system integration and because it "will actually be improved over time". https://tildes.net/~tech/1jz8/the_browser_company_announces_arc_browser_will_no_longer_be_their_flagship_product
- Steal: toolbar picks up the page's colour. https://appleinsider.com/articles/25/06/18/how-safari-in-ios-26-macos-26-puts-content-first-with-liquid-glass-ui-changes (from search snippet)
- Steal: picture-in-picture with 10-second skip buttons. https://www.macstories.net/stories/macos-26-tahoe-the-macstories-review/6
- Lesson: Apple removed compact tabs in Tahoe; users refused to upgrade; it returned in 26.4 beta. People defend vertical pixels fiercely. https://www.macrumors.com/2026/02/16/macos-tahoe-26-4-compact-tab-bar/
- Gap: Safari's sidebar does not hide the horizontal tab bar. Same source (comment).

### Orion

- Praised for native feel, zero telemetry, a business model users trust, and running Chrome and Firefox extensions on WebKit. https://news.ycombinator.com/item?id=50197601 and https://blog.kagi.com/orion
- Steal: say plainly how the browser is paid for.
- Gaps: site crashes, ad blocking behind uBlock Origin. https://news.ycombinator.com/item?id=50197601

### Chrome vertical tabs (stable April 2026)

- Right-click the tab strip, "Show Tabs Vertically"; collapses to favicons. https://techcrunch.com/2026/04/07/chrome-is-finally-getting-vertical-tabs/ and https://blog.google/products-and-platforms/products/chrome/new-chrome-productivity-features/
- Lesson: vertical tabs alone are now free everywhere. Kite's edge must be the model (pinned versus temporary, Spaces, bar) and the feel.

### Brave and Edge

- Collapsed icon rail that expands on hover. https://brave.com/blog/vertical-tabs/
- Complaint to avoid: hover-expand only works after the window is clicked into focus. https://community.brave.com/t/even-when-the-target-browser-window-is-not-focused-expand-vertical-tab-bar-on-mouseover/596080
- Design note: hover-expand should float over the page so the page does not reflow. https://connect.mozilla.org/t5/discussions/firefox-sidebar-and-vertical-tabs-try-them-out-in-nightly/m-p/64965

### Vivaldi

- Workspaces plus tab stacks plus tiling suit heavy users, but "a learning curve most users quit". https://www.superchargebrowser.com/library/vivaldi-review-chrome-power-users-2026/ (competing vendor; unverified)
- Lesson: power without restraint reads as clutter.

### SigmaOS, Deta Surf

- SigmaOS: no public release after February 2025; cited as a quiet-shutdown risk. https://supasidebar.com/blog/arc-alternatives-that-wont-shut-down-2026 (vendor; unverified)
- Deta Surf: screenshot-to-bookmark and full-text search of saved pages are liked; reviewer finds the feature set overloaded. https://www.fastcompany.com/91340629/deta-surf-browser-could-change-everything-you-know-about-bookmarks
- Horse: nothing found.

### Gaps shared by most Arc clones

- DRM streaming, passkeys and iCloud Keychain, and a mobile companion recur as missing. https://piunikaweb.com/2026/11/18/roundup-of-every-arc-browser-alternative-we-know/
- Kite should test Netflix, passkeys and 1Password in its Electron build and state the result honestly (unverified for Kite).

## 4. First run: what the best-loved apps do in the first 60 seconds

### Arc

- Replaced a setup dialog with an "unboxing": a burst of colour, pick a gradient for an instant visible result, a short tour of the unfamiliar controls, then a personal "membership card". Borrowed "early wins" from games. https://www.inverse.com/input/design/the-browser-company-arc-design-interview
- It was designed last, by asking "which parts of the browser are logical and which are not". Same source.
- What went wrong: account wall before any value, and still too much to learn. https://news.ycombinator.com/item?id=36862546

### Linear

- Order: light or dark first, then a one-action Cmd+K tutorial with large key visuals, then team. Calm short copy, no confetti. Early theme choice gives a sense of control. https://growth-dives.kit.com/posts/growth-dives-inside-linear-s-onboarding-3-things-i-didn-t-expect

### Superhuman (measured results)

- Teach by doing in a safe sandbox: "do > show > tell".
- Teaching the payoff action (archive, remind) instead of navigation keys raised activation from 40% to 50%.
- Full-screen setup with smart defaults: completion from 30% to over 98%.
- Checklists and tooltips had no measurable effect.
- Teach a feature at the moment it applies (Undo Send right after sending).
- All from https://review.firstround.com/superhuman-onboarding-playbook/

### Raycast

- Default hotkey is Option+Space; the manual pushes replacing Spotlight so there is one shortcut to remember. https://manual.raycast.com/v1/hotkey
- Exact first-launch screens: not found (unverified).

### Things 3

- First launch gives a real tutorial project, "Meet Things", made of ordinary to-dos you complete or delete; it can be recreated from Help. https://culturedcode.com/things/support/articles/2803553

### Notion Calendar

- Nothing reliable found.

### What a browser's first minute should be (synthesis)

- 0-5 s: window opens ready to browse. No account, no permission prompts.
- 5-20 s: one screen offering import from Arc, Chrome or Safari, with a visible preview of what will arrive; Skip is as prominent as Import.
- 20-35 s: pick a colour; the real sidebar retints live behind the picker.
- 35-50 s: learn one thing by doing it: press Cmd+T, type, land on a page.
- 50-60 s: the user is browsing with their own pinned tabs. Default-browser request waits until the second session or the first external link.
- Everything else is taught at the moment it applies (first auto-archive, first external link, first Option-click).

## 5. Honest habit and delight mechanics

### Speed is the feeling

- Keep UI motion under 300 ms with ease-out; a 180 ms dropdown feels more responsive than a 400 ms one. https://emilkowal.ski/ui/great-animations and https://emilkowal.ski/ui/you-dont-need-animations
- "Never animate keyboard initiated actions." Same sources.
- Command menus and the macOS app switcher skip animation; the same animation becomes "cognitive burden after seeing the same animation for the hundredth time". https://rauno.me/craft/interaction-design
- Animate transform and opacity only; honour reduced motion. https://emilkowal.ski/ui/great-animations
- Adjacent tooltips open instantly once one is showing. https://emilkowal.ski/ui/you-dont-need-animations

### Motion that behaves like an object

- Respond instantly; "allow for constant redirection and interruption"; keep spatial consistency; track gestures one to one. https://developer.apple.com/videos/play/wwdc2018/803/
- Start springs with no overshoot; reward a flick's momentum with a little; "bounciness needs to be purposeful". Same source.
- Let people peek without committing: act on release, not mid-gesture, for anything destructive. https://rauno.me/craft/interaction-design
- Fitts's law: screen edges and corners are infinitely large targets. Same source.

### Rituals instead of hooks

- Arc loyalty came from routines (morning pinned tabs, a default split, Space switching), described as "habits fade, but rituals stick". https://jtbdux-protocol.pages.dev/discovery-and-research/choosing-to-switch/arc-browser-and-the-progress-timeline-from-first-thought-to-abandonment (secondary analysis)
- The honest loop: a clean sidebar every morning, favourites that are already loaded, your place kept. No streaks, badges or notifications needed.

### Ownership

- Picking a colour, renaming a tab and choosing an icon make the tool feel like the user's. https://chriscoyier.net/?p=7746 and https://www.inverse.com/input/design/the-browser-company-arc-design-interview
- A lit frame around the page: "the room matters, too". https://www.inverse.com/input/design/the-browser-company-arc-design-interview

### Craft as practice

- "The simplest way to increase quality is to reduce scope"; "the best design is opinionated". https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/
- Linear runs a recurring "Quality Wednesdays" pass on small details. https://www.ai.engineer/talks/wjk0ulMAkbc-taste-craft-conversation-tuomas-artman-cto-linear (from search snippet; unverified)
- Quiet is a feature: no unprompted tabs. https://www.thurrott.com/cloud/web-browsers/335205/helium-may-just-be-the-browser-youve-been-looking-for

## Implications for Kite

Ordered by expected impact on "people prefer this to Arc".

1. Ship one-click Arc import in first run now (Spaces, folders, pinned tabs, favourites, plus Chrome and Safari), with a preview before committing. Arc stops working on 22 December 2026.
2. Make permanence the headline: no account, no server, no kill switch, plain local files, one-click export. Say how Kite is funded. Fear of another shutdown is the top stated worry.
3. Perfect the single-Space default before anything else: sidebar, pinned tabs, temporary tabs. Only 5.5% of Arc users used several Spaces; the sidebar is what people miss.
4. Make Cmd+T instant and unanimated, rank open tabs first ("switch to tab"), then history, then actions. Every command reachable there, including DevTools and screenshot.
5. Open links from other apps in the little window by default, with obvious Open-in-Kite, Split and Close controls and Esc to dismiss. No rival does this well.
6. Add tab hover previews, a private window, and multiple windows that share one sidebar state. Decide the multi-window model deliberately; Arc's felt "weird".
7. Keep auto-archive but explain it at the first archive with Undo, and offer intervals including Never. Arc's was resented as impossible to turn off; Zen refuses to build it.
8. Rebuild first run as four full-screen steps without sign-up: import, pick a colour (live retint), press Cmd+T once, browse. Teach everything else in context; skip checklists and tooltips.
9. Auto-hide sidebar must float over the page (no reflow), open from the screen edge even when the window is unfocused, and never flicker. Offer a compact, chrome-free mode.
10. Make Space switching a one-to-one, interruptible two-finger swipe with a per-Space sidebar tint, plus Ctrl+1-9. Let favourites be global or per Space, the user's choice.
11. Surface link routing from the tab menu ("Always open notion.so in Work"). It is a quietly loved Arc feature that Dia and Zen lack.
12. Adopt motion rules: under 300 ms, ease-out, transform and opacity only, interruptible, none on keyboard actions, springs only for gestures, reduced-motion respected.
13. Polish the small utilities people name: Cmd+Shift+C clean-URL copy with a brief confirmation, Ctrl+Tab recency switcher with previews, automatic picture-in-picture, Zap an element, persistent Cmd+G.
14. Test and publish compatibility: Netflix and other DRM video, passkeys, 1Password, Chrome extensions. These are the gaps that sink most Arc clones.
15. Stay quiet and light: no what's-new tabs, no nags, suspend background tabs, small download. Hold a recurring quality pass and cut scope rather than ship rough features.
