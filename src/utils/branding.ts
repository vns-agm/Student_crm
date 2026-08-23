import type { TenantBranding } from '../types'

export function applyBranding(branding: TenantBranding | null | undefined) {
  const root = document.documentElement
  if (!branding) return

  root.style.setProperty('--brand', branding.primaryColor)
  root.style.setProperty('--brand-mid', branding.primaryColor)
  root.style.setProperty('--accent', branding.accentColor)
  root.style.setProperty('--accent-soft', `${branding.accentColor}33`)
  root.style.setProperty('--brand-soft', `${branding.primaryColor}22`)
  document.title = `${branding.displayName} | Student CRM`
}
