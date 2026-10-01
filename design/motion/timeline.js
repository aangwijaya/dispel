// Cue sheet shared by reel.html (picture) and score.mjs (sound). Seconds.
// Hits sit on a 100 BPM grid (one beat = 0.6s) so every cut lands on the music.
globalThis.DISPEL_TL = {
  fps: 60,
  duration: 15,
  bpm: 100,
  slash: 2.4, // the spell enters and wipes the noise
  land: 3.0, // it lands on the tip
  ticks: [3.2, 4.0],
  nodes: 3.5,
  line: [4.7, 5.36],
  ignite: 5.4,
  callouts: 5.45,
  moods: [6.6, 7.2, 7.8, 8.4], // unclear → reduce risk → wait → look for setups
  zoom: 8.85,
  cut: 9.3,
  type: 9.95,
  buy: 10.5,
  whip: 11.35,
  dial: 11.5,
  resolve: 12.62,
  logo: 13.2,
  endIgnite: 13.8,
  tagline: 14.0,
  meta: 14.2,
}
