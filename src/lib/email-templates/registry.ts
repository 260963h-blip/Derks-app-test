import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as offerteVerzonden } from './offerte-verzonden'
import { template as afspraakBevestiging } from './afspraak-bevestiging'
import { template as factuurVerzonden } from './factuur-verzonden'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'offerte-verzonden': offerteVerzonden,
  'afspraak-bevestiging': afspraakBevestiging,
  'factuur-verzonden': factuurVerzonden,
}
