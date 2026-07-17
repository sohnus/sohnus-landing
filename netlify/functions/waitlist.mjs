import { createClient } from '@supabase/supabase-js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

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
      console.error('Supabase error:', JSON.stringify(error))
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    }

  } catch (err) {
    console.error('Function error:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    }
  }
}
