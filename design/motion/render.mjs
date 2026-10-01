// Frame-exact renderer for reel.html: drives headless Chrome over CDP (no deps),
// renders `SUB` sub-frames per frame for true motion blur and streams them, in order,
// straight into ffmpeg (nothing is written to disk but the video).
//
//   CHROME=/path/to/chrome FFMPEG=/path/to/ffmpeg node design/motion/render.mjs [--preview] [--from s --to s]

import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

const CHROME = process.env.CHROME ?? 'google-chrome'
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const FPS = 60
const DURATION = 15
const preview = args.includes('--preview')
const SUB = Number(flag('--sub', preview ? 1 : 10)) // sub-frames per frame
const SHUTTER = 0.5 // 180° shutter
const WORKERS = Number(flag('--workers', 10))
const from = Number(flag('--from', 0))
const to = Number(flag('--to', DURATION))
const W = 1920
const H = 1080

const firstFrame = Math.round(from * FPS)
const lastFrame = Math.min(Math.round(to * FPS), DURATION * FPS) - 1

async function launch(port) {
  const profile = join(tmpdir(), `dispel-reel-chrome-${port}`)
  rmSync(profile, { recursive: true, force: true })
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  const wsUrl = await new Promise((resolve, reject) => {
    let log = ''
    chrome.stderr.on('data', (chunk) => {
      log += chunk
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) resolve(match[1])
    })
    chrome.on('exit', (code) => reject(new Error(`chrome exited ${code}\n${log}`)))
  })

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => send(method, params, sessionId)
  await page('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await page('Page.enable')
  await page('Page.navigate', { url: `file://${join(here, 'reel.html')}` })
  const evaluate = async (expression) => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  for (let tries = 0; tries < 100; tries++) {
    const ready = await evaluate('typeof window.seek === "function" && document.readyState === "complete"').catch(() => false)
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  await evaluate('document.fonts.ready.then(() => true)')
  return {
    async shot(t) {
      await evaluate(`window.seek(${t})`)
      const { data } = await page('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
      return Buffer.from(data, 'base64')
    },
    close() {
      ws.close()
      chrome.kill('SIGKILL')
    },
  }
}

async function main() {
  const jobs = []
  for (let frame = firstFrame; frame <= lastFrame; frame++) {
    for (let k = 0; k < SUB; k++) {
      const offset = SUB === 1 ? 0 : ((k + 0.5) / SUB - 0.5) * (SHUTTER / FPS)
      jobs.push(Math.max(0, frame / FPS + offset))
    }
  }

  const out = flag('--out', join(here, preview ? 'dispel-reel-preview.mp4' : 'dispel-reel-silent.mp4'))
  const blur = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB,` : ''
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
    '-vf', `${blur}format=yuv420p`, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', preview ? '22' : '14',
    '-tune', 'film', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const encoded = new Promise((resolve, reject) => ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))))

  // workers finish out of order; hand ffmpeg the shots strictly in sequence
  const ready = new Map()
  let nextOut = 0
  const drain = async () => {
    while (ready.has(nextOut)) {
      const buffer = ready.get(nextOut)
      ready.delete(nextOut)
      nextOut += 1
      if (!ff.stdin.write(buffer)) await new Promise((resolve) => ff.stdin.once('drain', resolve))
    }
  }
  let draining = Promise.resolve()

  const started = Date.now()
  let nextJob = 0
  const workers = await Promise.all(Array.from({ length: WORKERS }, (_, i) => launch(9400 + i)))
  await Promise.all(
    workers.map(async (worker) => {
      while (nextJob < jobs.length) {
        const index = nextJob++
        // keep the reorder buffer small
        while (index - nextOut > WORKERS * 12) await new Promise((resolve) => setTimeout(resolve, 5))
        ready.set(index, await worker.shot(jobs[index]))
        draining = draining.then(drain)
        if ((index + 1) % 240 === 0) process.stdout.write(`  ${index + 1}/${jobs.length} shots · ${((Date.now() - started) / 1000).toFixed(0)}s\n`)
      }
    }),
  )
  await draining
  workers.forEach((worker) => worker.close())
  ff.stdin.end()
  await encoded
  console.log(`rendered ${jobs.length} shots in ${((Date.now() - started) / 1000).toFixed(1)}s → ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
