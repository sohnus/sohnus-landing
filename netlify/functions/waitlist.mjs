import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT  = 5               // max submissions per IP per window
const WINDOW_MS   = 60 * 60 * 1000  // 1 hour in milliseconds

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    // Temporary: log env var shape for debugging
    console.log('URL set:', !!process.env.SUPABASE_URL, '| starts with https:', process.env.SUPABASE_URL?.startsWith('https://'), '| ends with supabase.co:', process.env.SUPABASE_URL?.endsWith('.supabase.co'))
    console.log('KEY set:', !!process.env.SUPABASE_ANON_KEY, '| key length:', process.env.SUPABASE_ANON_KEY?.length)

    // Get client IP (Netlify sets x-nf-client-connection-ip; fall back to x-forwarded-for)
    const ip =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0].trim() ||
      'unknown'

    // Check rate limit
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
    const { count } = await supabase
      .from('rate_limit')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('submitted_at', windowStart)

    if (count !== null && count >= RATE_LIMIT) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Too many attempts. Please try again later.' })
      }
    }

    const data = JSON.parse(event.body)

    const { error } = await supabase.from('waitlist').insert([{
      first_name: data.first_name,
      last_name:  data.last_name,
      email:      data.email,
      phone:      data.phone,
      sector:     data.sector,
      trade:      data.trade,
      city:       data.city,
      country:    data.country,
    }])

    if (error) {
      if (error.code === '23505') {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'This email is already on the waitlist.' })
        }
      }
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
      }
    }

    // Log attempt after successful insert
    await supabase.from('rate_limit').insert([{ ip }])

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    }

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    }
  }
}
