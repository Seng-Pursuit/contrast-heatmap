import { useMemo, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import './app.css'

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
    <div class="app">
      <div class="container">
        <div class="header">
          <div>
            <div class="title">Contrast Heatmap</div>
            <div class="subtitle">Choose an image → generate heatmap → preview below</div>
          </div>
          <div class="meta">localhost server: 127.0.0.1:59212</div>
        </div>

        <div class="card">
          <div class="cardTop">
            <div>
              <div class="label">Upload</div>
              <div class="path">{filePath ? filePath : 'No file selected.'}</div>
            </div>
            <div class="actions">
              <button
                class="btn"
                onClick={chooseFile}
                disabled={busy}
              >
                Choose file
              </button>
              <button
                class="btn primary"
                onClick={run}
                disabled={busy || !filePath}
              >
                {busy ? 'Generating…' : 'Generate heatmap'}
              </button>
            </div>
          </div>

          <div class="status">{status}</div>

          {outSrc ? (
            <div class="result">
              <div class="resultTitle">Result</div>
              <img src={outSrc} alt="Heatmap result" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
