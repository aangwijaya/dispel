// Cue sheet shared by reel.html (picture) and score.mjs (sound). Seconds.
// Beats sit on a 100 BPM grid (one beat = 0.6s), so every cut and click lands on the music.
//
// Story: illusion → Dispel clears it → you see the market clearly → you trade it in the app → brand.
globalThis.DISPEL_TL = {
  fps: 60,
  duration: 15,
  bpm: 100,

  // 01 · Illusion
  // hype pops in, one ping each; x/y are screen positions (they also pan the pings and place the fizz)
  bubbles: [
    { at: 0.42, x: 1390, y: 300, text: '100x soon', tone: 'up', who: 'M' },
    { at: 0.66, x: 1610, y: 470, text: 'Whales are buying', tone: 'up', who: 'K' },
    { at: 0.9, x: 1010, y: 386, text: 'Breakout confirmed?', tone: 'caution', who: 'J' },
    { at: 1.14, x: 1270, y: 640, text: 'Crash incoming', tone: 'down', who: 'R' },
    { at: 1.38, x: 1660, y: 772, text: 'Last chance to buy', tone: 'caution', who: 'T' },
    { at: 1.62, x: 930, y: 566, text: "Can't go down", tone: 'up', who: 'A' },
    { at: 1.8, x: 1480, y: 868, text: 'Sell everything', tone: 'down', who: 'D' },
    { at: 1.98, x: 1130, y: 226, text: 'Next moonshot', tone: 'up', who: 'L' },
    { at: 2.16, x: 1770, y: 300, text: 'Insider tip', tone: 'caution', who: 'S' },
    { at: 2.34, x: 1040, y: 812, text: 'Guaranteed profit', tone: 'up', who: 'N' },
  ],

  // 02 · Dispel
  spark: 3.0, // the spell ignites on the sigil's tip
  lens: [3.04, 3.5], // a lens of clarity opens around it
  line: [3.22, 3.86], // the one clean price line climbs into the tip
  arc: 4.2, // the arc lights
  expand: [4.8, 5.85], // the lens clears the whole frame

  // 03 · Clarity
  clarity: 6.0,
  verdict: 6.12,
  setups: 7.2,
  cursor: 7.8,
  openChart: 8.4, // the cursor opens the SOL setup
  nav: [8.46, 9.0], // Home slides to Trade inside the same window

  // 04 · Trade
  trade: 9.0,
  push: [9.55, 10.05], // the camera moves to the order ticket
  click1: 10.2, // 50%
  click2: 11.1, // Buy SOL
  filled: 11.26, // "Buy SOL filled at market."

  // 05 · Brand
  brand: 12.6,
  logo: 13.2,
  endIgnite: 13.8,
  tagline: 13.75,
  meta: 14.1,

  captions: [0.24, 3.12, 6.1, 9.08],
}
