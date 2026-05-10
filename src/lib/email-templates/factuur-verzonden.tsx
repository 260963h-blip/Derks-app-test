import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface FactuurVerzondenProps {
  contactName?: string
  invoiceNumber?: string
  companyName?: string
  bodyText?: string
  downloadUrl?: string
  attachments?: { name: string; url: string }[]
  dueDate?: string
}

const FactuurVerzondenEmail = ({
  contactName = 'klant',
  invoiceNumber = '',
  companyName = '',
  bodyText,
  downloadUrl = '#',
  attachments = [],
  dueDate,
}: FactuurVerzondenProps) => {
  const paragraphs = (bodyText ?? '').split(/\n{2,}/).filter(Boolean)
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>Factuur {invoiceNumber} van {companyName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Factuur {invoiceNumber}</Heading>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <Text key={i} style={text}>{p}</Text>
            ))
          ) : (
            <Text style={text}>
              Beste {contactName}, hierbij ontvangt u factuur {invoiceNumber}.
            </Text>
          )}
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={downloadUrl} style={button}>
              Factuur downloaden (PDF)
            </Button>
          </Section>
          {attachments.length > 0 ? (
            <>
              <Text style={text}><strong>Bijgevoegde documenten:</strong></Text>
              {attachments.map((a, i) => (
                <Text key={i} style={small}>
                  • <a href={a.url} style={link}>{a.name}</a>
                </Text>
              ))}
            </>
          ) : null}
          {dueDate ? (
            <Text style={small}>Wij verzoeken u het bedrag te voldoen voor {dueDate}.</Text>
          ) : null}
          <Text style={footer}>{companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: FactuurVerzondenEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `Factuur ${data?.invoiceNumber ?? ''}`.trim(),
  displayName: 'Factuur verzonden',
  previewData: {
    contactName: 'Jan Jansen',
    invoiceNumber: 'F2026-0001',
    companyName: 'Stucadoorsbedrijf Derks',
    bodyText: 'Beste Jan,\n\nHierbij ontvangt u onze factuur voor de naar tevredenheid uitgevoerde werkzaamheden.\n\nMet vriendelijke groet,\nStucadoorsbedrijf Derks',
    downloadUrl: 'https://example.com/factuur.pdf',
    attachments: [{ name: 'Werkorder.pdf', url: 'https://example.com/werkorder.pdf' }],
    dueDate: '31-12-2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a2463', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 14px', whiteSpace: 'pre-line' as const }
const small = { fontSize: '12px', color: '#555', margin: '4px 0' }
const link = { color: '#0a2463', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
const button = {
  backgroundColor: '#0a2463', color: '#ffffff', padding: '12px 24px',
  borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold',
}
