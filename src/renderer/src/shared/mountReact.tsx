import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Boot a React app into the page's #root element under StrictMode.
 * Each renderer entry (mini / settings / transcript) calls this with
 * its top-level <App /> — keeps every entry to a single line.
 */
export function mountReact(node: ReactElement): void {
  const root = document.getElementById('root')
  if (!root) throw new Error('root element not found')
  createRoot(root).render(<StrictMode>{node}</StrictMode>)
}
