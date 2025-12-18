import { useMemo, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export function App() {
  const [filePath, setFilePath] = useState(null)
  const [status, setStatus] = useState('Choose an image to generate a heatmap.')
  const [busy, setBusy] = useState(false)
  const [outB64, setOutB64] = useState(null)

  const outSrc = useMemo(() => {
    if (!outB64) return null
    return `data:image/png;base64,${outB64}`
  }, [outB64])

  async function chooseFile() {
    try {
      const picked = await open({
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'],
          },
        ],
      })
      if (!picked) return
      setFilePath(picked)
      setOutB64(null)
      setStatus(`Selected: ${picked}`)
    } catch (e) {
      setStatus(`Pick file failed: ${String(e)}`)
    }
  }

  async function run() {
    if (!filePath) return
    setBusy(true)
    setStatus('Generating heatmap…')
    try {
      const b64 = await invoke('generate_heatmap_base64_png', { inputPath: filePath })
      setOutB64(b64)
      setStatus('Done.')
    } catch (e) {
      setStatus(`Failed: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="min-h-full">
      <div class="mx-auto max-w-5xl px-4 py-8">
        <div class="flex items-end justify-between gap-4">
          <div>
            <div class="text-xl font-semibold tracking-tight">Contrast Heatmap</div>
            <div class="mt-1 text-sm text-zinc-400">
              Choose an image → generate heatmap → preview below
            </div>
          </div>
          <div class="text-xs text-zinc-500">localhost server: 127.0.0.1:59212</div>
        </div>

        <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-medium">Upload</div>
              <div class="mt-1 text-xs text-zinc-400">
                {filePath ? filePath : 'No file selected.'}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                onClick={chooseFile}
                disabled={busy}
              >
                Choose file
              </button>
              <button
                class="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-50"
                onClick={run}
                disabled={busy || !filePath}
              >
                {busy ? 'Generating…' : 'Generate heatmap'}
              </button>
            </div>
          </div>

          <div class="mt-3 text-sm text-zinc-400">{status}</div>

          {outSrc ? (
            <div class="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div class="border-b border-white/10 px-3 py-2 text-xs text-zinc-400">Result</div>
              <img src={outSrc} alt="Heatmap result" class="block w-full" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
