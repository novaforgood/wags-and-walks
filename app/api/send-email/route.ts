const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY

function buildAppsScriptUrl(requestUrl: string) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Missing APPS_SCRIPT_URL')
  }

  const url = new URL(APPS_SCRIPT_URL)
  const incoming = new URL(requestUrl)
  incoming.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  if (APPS_SCRIPT_KEY) {
    url.searchParams.set('key', APPS_SCRIPT_KEY)
  }
  return url
}

function debugEnv() {
  const key = APPS_SCRIPT_KEY || ''
  const keyPreview =
    key.length <= 8 ? key : `${key.slice(0, 4)}...${key.slice(-4)}`
  return {
    hasUrl: Boolean(APPS_SCRIPT_URL),
    hasKey: Boolean(APPS_SCRIPT_KEY),
    keyLength: key.length,
    keyPreview
  }
}

async function readJsonOrText(response: Response) {
  const text = await response.text()
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: null, text }
  }
}

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url)
    if (incoming.searchParams.get('debug') === '1') {
      return Response.json({
        success: true,
        debug: debugEnv(),
        requestUrl: request.url
      })
    }

    const url = buildAppsScriptUrl(request.url)
    const response = await fetch(url.toString(), { method: 'GET' })
    const { json, text } = await readJsonOrText(response)
    if (!response.ok) {
      return Response.json(
        { success: false, status: response.status, error: json || text },
        { status: response.status }
      )
    }
    return Response.json(json ?? { success: false, error: text })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json(
      { success: false, error: 'Failed to connect to Google Sheets' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url = buildAppsScriptUrl(request.url)

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const { json, text } = await readJsonOrText(response)
    if (!response.ok) {
      return Response.json(
        { success: false, status: response.status, error: json || text },
        { status: response.status }
      )
    }
    return Response.json(json ?? { success: false, error: text })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json(
      { success: false, error: 'Failed to connect to Google Sheets' },
      { status: 500 }
    )
  }
}
