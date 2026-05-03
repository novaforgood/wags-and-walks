export async function GET() {
  const params = new URLSearchParams({
    account: 'dm1440',
    method: 'json_shelter_animals',
    username: 'integration_api',
    password: 'n0va!321',
    sensitive: '1',
  })

  const url = `https://service.sheltermanager.com/asmservice?${params}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return Response.json({ error: 'API error' }, { status: 500 })
    }

    const data = await res.json()

    // same logic as your Apps Script
    const fosterDogs = data.filter((animal: any) => {
      const speciesName = (animal.SPECIESNAME || '').toLowerCase()
      const speciesId = Number(animal.SPECIESID || 0)
      const movementType = (animal.ACTIVEMOVEMENTTYPENAME || '').toLowerCase()
      const currentOwnerName = animal.CURRENTOWNERNAME || ''

      const isDog = speciesName === 'dog' || speciesId === 1
      const isFosterMovement = ['foster', 'permanent foster', 'fostered'].includes(movementType)
      const hasCurrentFoster = currentOwnerName !== ''

      return isDog && isFosterMovement && hasCurrentFoster
    })

    return Response.json({
      count: fosterDogs.length,
    })
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}