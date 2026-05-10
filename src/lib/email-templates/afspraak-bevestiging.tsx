import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface AfspraakBevestigingProps {
  subject?: string
  bodyText?: string
  companyName?: string
}

const AfspraakBevestigingEmail = ({
  subject = 'Bevestiging afspraak',
  bodyText = '',
  companyName = 'Stucadoorsbedrijf Derks',
}: AfspraakBevestigingProps) => {
  const paragraphs = (bodyText ?? '').split(/\n{2,}/).filter(Boolean)
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Bevestiging afspraak</Heading>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <Text key={i} style={text}>{p}</Text>
            ))
          ) : (
            <Text style={text}>Hierbij bevestigen wij de afspraak.</Text>
          )}
          <Text style={footer}>{companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AfspraakBevestigingEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || 'Bevestiging afspraak uitvoering werkzaamheden',
  displayName: 'Afspraakbevestiging',
  previewData: {
    subject: 'Bevestiging afspraak uitvoering werkzaamheden – offerte 2026-001',
    bodyText: 'Geachte heer Jansen,\n\nZoals telefonisch met u besproken, bevestigen wij hierbij de afspraak voor de uitvoering van de werkzaamheden behorend bij offerte 2026-001.\n\nMet vriendelijke groet,\nNick Derks\nStucadoorsbedrijf Derks',
    companyName: 'Stucadoorsbedrijf Derks',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a2463', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 14px', whiteSpace: 'pre-line' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }