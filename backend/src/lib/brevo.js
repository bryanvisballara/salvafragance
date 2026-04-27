export async function sendBrevoEmail({ to, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'orders@savalfragance.com'
  const senderName = process.env.BREVO_SENDER_NAME || 'Saval Fragance'

  if (!apiKey) {
    console.warn('BREVO_API_KEY is missing. Email skipped.')
    return {
      skipped: true,
      reason: 'BREVO_API_KEY is missing',
    }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [to],
      subject,
      htmlContent,
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`Brevo email failed: ${payload}`)
  }

  return response.json()
}