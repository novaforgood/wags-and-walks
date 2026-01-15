export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-YGfRO-lZ9fk--uUt1mBkGNkIuM4nCI0S8cEC4qA_WchEHv3R-ah9VPZqsMeee2Tu/exec'
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    
    return Response.json(data)
  } catch (error) {
    console.error('API Error:', error)
    return Response.json(
      { success: false, error: 'Failed to connect to Google Sheets' },
      { status: 500 }
    )
  }
}
