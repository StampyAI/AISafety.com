import { NextRequest, NextResponse } from 'next/server'

const SUBSTACK_HOST = 'https://aisafetyeventsandtraining.substack.com'

export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = await request.json()
    email = body?.email
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    )
  }

  const params = new URLSearchParams({
    email,
    first_url: `${SUBSTACK_HOST}/`,
    first_referrer: '',
    current_url: `${SUBSTACK_HOST}/`,
    current_referrer: '',
    referral_code: '',
    source: 'aisafety.com/events',
  })

  const response = await fetch(`${SUBSTACK_HOST}/api/v1/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Could not subscribe right now. Please try again later.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
