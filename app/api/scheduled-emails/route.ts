const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL!
const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY

function appsScriptUrl() {
  const url = new URL(APPS_SCRIPT_URL)
  if (APPS_SCRIPT_KEY) url.searchParams.set('key', APPS_SCRIPT_KEY)
  return url.toString()
}

async function callAppsScript(body: object) {
  const res = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { success: false, error: text } }
}

// GET /api/scheduled-emails?fosterId=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fosterId = searchParams.get('fosterId')
  const data = await callAppsScript({ action: 'list_scheduled' })
  if (!data.success) return Response.json(data, { status: 500 })
  const emails = fosterId
    ? data.emails.filter((e: any) => e.fosterId === fosterId)
    : data.emails
  return Response.json({ success: true, emails })
}

// POST /api/scheduled-emails  — create
export async function POST(request: Request) {
  const body = await request.json()
  const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const data = await callAppsScript({ action: 'schedule_email', id, ...body })
  return Response.json(data)
}

// PATCH /api/scheduled-emails  — update (edit or snooze)
export async function PATCH(request: Request) {
  const body = await request.json()
  const data = await callAppsScript({ action: 'update_scheduled', ...body })
  return Response.json(data)
}

// DELETE /api/scheduled-emails
export async function DELETE(request: Request) {
  const body = await request.json()
  const data = await callAppsScript({ action: 'delete_scheduled', ...body })
  return Response.json(data)
}