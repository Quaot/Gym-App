const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconHome = () => (
  <svg viewBox="0 0 24 24" {...stroke}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const IconDumbbell = () => (
  <svg viewBox="0 0 24 24" {...stroke}><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" /></svg>
)
export const IconClock = () => (
  <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconChart = () => (
  <svg viewBox="0 0 24 24" {...stroke}><path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /></svg>
)
export const IconCog = () => (
  <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
)
export const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><path d="m5 13 4.5 4.5L19 7" /></svg>
)
export const IconChevron = () => (
  <svg viewBox="0 0 8 13" className="chevron" fill="none" aria-hidden>
    <path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const IconBack = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
)
export const IconMoon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M21 13.5A8.5 8.5 0 0 1 10.5 3 8.5 8.5 0 1 0 21 13.5z" /></svg>
)
export const IconFlame = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M12 21c4 0 6.5-2.6 6.5-6 0-4.5-4-6.5-4.5-10-2.5 2-3 4.5-3 6.5C9.5 9 8 7.5 8 5.5 6 7.5 5.5 10.6 5.5 15c0 3.4 2.5 6 6.5 6z" /></svg>
)
