export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (not public)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL!
  const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY

  async function callAppsScript(body: object) {
    const url = new URL(APPS_SCRIPT_URL)
    if (APPS_SCRIPT_KEY) url.searchParams.set('key', APPS_SCRIPT_KEY)
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { success: false, error: text } }
  }

  // 1. Fetch due emails
  const { emails } = await callAppsScript({ action: 'due_scheduled' })
  if (!emails?.length) return Response.json({ success: true, sent: 0 })

  // 2. Send each one
  let sent = 0
  for (const email of emails) {
    const result = await callAppsScript({
      action: 'send_single_email',
      to: email.to,
      subject: email.subject,
      body: email.body,
    })
    if (result?.success) {
      // Mark as sent
      await callAppsScript({ action: 'update_scheduled', id: email.id, status: 'sent' })
      sent++
    }
  }

  return Response.json({ success: true, sent })
}