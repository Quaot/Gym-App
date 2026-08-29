/** Triggers a file download in a way Safari doesn't abort: the anchor joins
 *  the DOM and the object URL outlives the click by a wide margin. */
export const downloadFile = (
  filename: string,
  content: string,
  mime = 'application/json',
): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 30_000)
  window.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true })
}
