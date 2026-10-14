# wedding-invitation

https://kharshit.github.io/wedding/

Harshit & Deeksha's wedding invitation site. Static HTML/CSS/JS, hosted on GitHub Pages.

## The 3D world

On devices that can run it, the whole invitation is one continuous three.js
world behind the page: a floral wedding gate whose doors open on the first
tap, swipe or key; the Ganesha shrine at dawn; the two family homes; the
countdown on a terrace at golden hour; Our Story; Haldi, the Baraat and the
reception, each at its own hour; the venue as a night map; the RSVP by a
midnight pool; and dawn over the estate at the end. Scrolling moves the camera
and the time of day.

- Code: [`js/world/`](js/world/) (`main.js` is the entry point, one module per
  place in `js/world/places/`), with three.js loaded from jsDelivr through
  [`js/immersive/kit.js`](js/immersive/kit.js). Styles for the world are in
  [`css/world.css`](css/world.css).
- The music starts with the site: on load where the browser allows sound,
  otherwise on the first tap, swipe or key.
- Previous / Next buttons at the bottom right ([`js/sections.js`](js/sections.js))
  glide the page to the previous or next moment (the shloka, each family, the
  countdown, each story chapter, each event, the venue, the RSVP, the footer)
  like a camera move. Guests can still scroll freely; any touch or scroll ends
  a glide. With `prefers-reduced-motion` they jump instead of gliding.

### When the original (cream) site shows instead

The original design (door video, corner flowers, butterflies, cream cards)
is the fallback. It shows when:

1. the browser can't run WebGL, or the guest has asked sites to save data
   (`prefers-reduced-data`), checked before anything 3D downloads;
2. the browser is too old for JavaScript modules;
3. the 3D files fail to load or start, even after retries (below);
4. the guest taps before the 3D doors are ready and they still aren't ready
   8 seconds later (the door video plays instead; the music still starts);
5. the phone drops the 3D view later (e.g. low on graphics memory): the page
   switches to the cream design where the guest is, without a reload.

Files are fetched with up to three retries before the site gives up on 3D,
so a patchy phone connection that drops one file doesn't send the guest to
the fallback.

### Quality levels

There are three levels: **high**, **medium** and **low**.

| | high | medium | low |
|---|---|---|---|
| Sharpness (pixel ratio cap) | 1.5× | 1.25× | 1× |
| Real light sources | 6 | 4 | 3 |
| Flowers, trees, petals | all | ~60% | ~33% |
| Sun rays | on | on | off |
| Extra glow halos | on | on | off |
| Far buildings switch to simple versions at | 260 m | 200 m | 150 m |

**How the level is chosen**

- Every device, phone or computer, starts on **high**.
- A clearly weak device starts on **medium**: an older graphics chip (older
  Mali, Adreno 300–600, PowerVR, old Intel HD), 2 GB of memory or less, or
  2 processor cores or fewer.
- About 2 s after the doors open the site measures its frame rate; below
  45 fps it drops one level. It keeps checking every ~3 s, and two checks in
  a row below 30 fps drop it again. That is the only way to reach **low**.
- It never steps back up during a visit, and a drop is applied quietly
  during a camera move.
- To force a level for testing, add `?tier=high`, `?tier=medium` or
  `?tier=low` to the URL, e.g. `https://kharshit.github.io/wedding/?tier=low`.

**What looks different on medium** (compared with high)

- Slightly softer edges (1.25× instead of 1.5× screen detail).
- Marigold field and gardens: about 60% as many bushes and blooms, a little
  further apart; flowers are simpler shapes with fewer facets.
- Trees: rounder crowns with fewer leaf clumps.
- Ganesha temple tower: 10 carved tiers instead of 12, simpler niches, no
  small ribbed cushions on the corners; the smaller towers have fewer tiers.
- Floral gate: fewer individual flowers on the arch and garlands (the painted
  flower texture underneath fills in); simpler bells.
- Diyas and garland balls: slightly simpler shapes.
- 4 light sources instead of 6: a few corners get a little less warm light.
- Far buildings switch to simpler versions a bit sooner.
- Sun rays, haze and petals are the same as high.

**What looks different on low** (compared with medium)

- Softer again (1×, exactly screen detail): the most visible change on a
  high-resolution phone.
- Marigold field: about a third as many bushes as high, larger and spaced
  wider, so it still looks full, just chunkier; blooms are the simplest shape.
- Trees: fewer leaf clumps still.
- Sun rays off: the sunrise flight out of the story and the dawn footer lose
  the fanning light beams (the sky and sun stay).
- Extra glow halos hidden: around the dawn court's lamps and floating diyas,
  the hall's warm bokeh, the RSVP pavilion's lanterns and the night map's
  village lights (the lamps themselves still glow).
- 3 light sources; slightly coarser terrain; far buildings switch to simple
  versions sooner still.

Every place, every story beat, and all the text and colours are the same on
all three levels.

### Accessibility

- With **Reduce Motion** turned on, the scene is still and camera moves
  become short fades.
- The 3D canvas is hidden from screen readers; all text stays in the page.
- Before the doors open, a scroll, swipe or scroll key opens them like a tap,
  and the page stays at the top so no section is skipped.

### Previewing locally

The site loads about 20 small module files at once, which
`python3 -m http.server` (listen backlog of 5) sometimes drops. Use a
threaded server with a larger backlog, or any static server, e.g.

```python
# serve.py: python3 serve.py 4020 .
import functools, http.server, sys
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True
port, root = int(sys.argv[1]), sys.argv[2]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
Server(('0.0.0.0', port), handler).serve_forever()
```

## RSVP setup

RSVPs from the form are saved to a Google Sheet you own.

1. Create a Google Sheet (e.g. "Wedding RSVPs").
2. In the sheet, open **Extensions → Apps Script**, replace the code with [`apps-script/rsvp.gs`](apps-script/rsvp.gs), and save.
3. Click **Deploy → New deployment**, choose type **Web app**, set
   - **Execute as:** Me
   - **Who has access:** Anyone

   then **Deploy** and approve the permissions prompt.
4. Copy the **Web app URL** (ends in `/exec`) into `RSVP_ENDPOINT` at the top of [`js/rsvp.js`](js/rsvp.js).

Responses appear in a tab named **RSVPs** with the time, name, attending (Yes/No) and number of guests.
If you change `rsvp.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
