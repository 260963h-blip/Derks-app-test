import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface OfferteVerzondenProps {
  contactName?: string
  quoteNumber?: string
  companyName?: string
  bodyText?: string
  downloadUrl?: string
  validUntil?: string
}

const OfferteVerzondenEmail = ({
  contactName = 'klant',
  quoteNumber = '',
  companyName = '',
  bodyText,
  downloadUrl = '#',
  validUntil,
}: OfferteVerzondenProps) => {
  const paragraphs = (bodyText ?? '').split(/\n{2,}/).filter(Boolean)
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>Offerte {quoteNumber} van {companyName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Offerte {quoteNumber}</Heading>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <Text key={i} style={text}>{p}</Text>
            ))
          ) : (
            <Text style={text}>
              Beste {contactName}, hierbij ontvangt u onze offerte {quoteNumber}.
            </Text>
          )}
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={downloadUrl} style={button}>
              Offerte downloaden (PDF)
            </Button>
          </Section>
          {validUntil ? (
            <Text style={small}>Deze offerte is geldig tot {validUntil}.</Text>
          ) : null}
          <Text style={footer}>{companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OfferteVerzondenEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `Offerte ${data?.quoteNumber ?? ''}`.trim(),
  displayName: 'Offerte verzonden',
  previewData: {
    contactName: 'Jan Jansen',
    quoteNumber: '2026-001',
    companyName: 'Stucadoorsbedrijf Derks',
    bodyText: 'Beste Jan,\n\nHierbij ontvangt u onze offerte.\n\nMet vriendelijke groet,\nStucadoorsbedrijf Derks',
    downloadUrl: 'https://example.com/offerte.pdf',
    validUntil: '31-12-2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a2463', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 14px', whiteSpace: 'pre-line' as const }
const small = { fontSize: '12px', color: '#777', margin: '8px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
const button = {
  backgroundColor: '#0a2463', color: '#ffffff', padding: '12px 24px',
  borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold',
}