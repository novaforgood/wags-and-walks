const ASM_BASE_URL = process.env.ASM_BASE_URL
const ASM_ACCOUNT = process.env.ASM_ACCOUNT
const ASM_USERNAME = process.env.ASM_USERNAME
const ASM_PASSWORD = process.env.ASM_PASSWORD

function requireAsmEnv() {
  const missing = [
    ['ASM_BASE_URL', ASM_BASE_URL],
    ['ASM_ACCOUNT', ASM_ACCOUNT],
    ['ASM_USERNAME', ASM_USERNAME],
    ['ASM_PASSWORD', ASM_PASSWORD]
  ].filter(([, value]) => !value)

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.map(([k]) => k).join(', ')}`)
  }
}

function buildAsmUrl(searchParams: Record<string, string>) {
  requireAsmEnv()

  const url = new URL(String(ASM_BASE_URL))
  url.searchParams.set('account', String(ASM_ACCOUNT))
  url.searchParams.set('username', String(ASM_USERNAME))
  url.searchParams.set('password', String(ASM_PASSWORD))

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }

  return url
}

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url)
    const animalId = incoming.searchParams.get('animalId')?.trim()
    const variant = incoming.searchParams.get('variant')?.trim()

    if (!animalId) {
      return new Response('Missing animalId', { status: 400 })
    }

    const method = variant === 'thumbnail' ? 'animal_thumbnail' : 'animal_image'
    const url = buildAsmUrl({
      method,
      animalid: animalId,
      ...(method === 'animal_image' ? { seq: '1' } : {})
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store'
    })

    if (!response.ok) {
      return new Response('Failed to load dog photo', { status: 502 })
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'private, no-store, max-age=0'
      }
    })
  } catch (error) {
    console.error('Dog photo proxy error:', error)
    return new Response('Failed to load dog photo', { status: 500 })
  }
}
