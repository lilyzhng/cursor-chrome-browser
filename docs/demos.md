# Demo ideas — Cursor Chrome Browser

Backlog of demos that show Composer 2.5 driving the real, logged-in browser.

## The lens: when is browser-use *necessary* (not just cute)?

A demo is strongest when all three hold:

1. **No usable API** — you can't do it cleanly any other way.
2. **Value is behind your login** — it needs your existing authenticated session.
3. **Multi-step and tedious** — genuinely annoying for a human to do by hand.

Hit all three and browser-use is *required*, not a gimmick. The weakest demos are ones a skeptic
can wave away with "why not just use the API / the native app?"

## Candidate demos

### LinkedIn (strong — and on-brand)
LinkedIn aggressively blocks its API and kills scrapers, so anything useful — read the feed, see who
viewed your profile, send a connection note, reply to DMs/comments — basically *requires* driving the
logged-in browser. Non-substitutable, tedious, and it lands with a career-focused audience.
Example: "open my LinkedIn, find the latest post from <person>, and draft a thoughtful comment
(stop before posting)."

### DoorDash food order (highest wow, highest risk)
No public ordering API, so it's genuinely browser-use-only, and the payoff is visceral (real food
shows up). Risk: spends real money, irreversible, outward-facing. For a recorded demo, either stop
before the final "Place Order" or accept a real order for the wow factor.

### Receipts / invoices from SaaS billing portals (most "agent earns its keep")
Download the latest invoices from several SaaS billing portals (no API, behind login, tediously
repetitive). Hits all three axes hard; very relatable "this actually saved me time" story.

### Other strong candidates (no API, behind login)
- Airline check-in / seat selection; visa-appointment slot checking.
- Reply to / triage LinkedIn connection requests and DMs.
- Fill a long multi-step form behind login (job application autofill, insurance).

## Rejected / weak

- **Spotify "play Dua Lipa"** — Spotify has a solid API and a native app; browser automation is a
  *worse* way to play music. Demonstrates control but not necessity, and invites the "why not the
  API?" rebuttal. Skip for the necessity thesis.

## Already done (see testing.md)

- ✅ Twitter: read @srush_nlp's latest post + type a reply (stopped before Post).
- ✅ LinkedIn: read the feed + draft a comment (stopped before posting).
- ✅ DoorDash: found an item, checked out, placed a real order.
- ✅ Spotify: played Dua Lipa's "Training Season," switched to video + full screen.
