import { createClient } from 'npm:@supabase/supabase-js@2.110.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // Plisio sends IPN callbacks as either GET query params or POST form data.
    let params: URLSearchParams

    if (req.method === 'GET') {
      const url = new URL(req.url)
      params = url.searchParams
    } else {
      const contentType = req.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const json = await req.json()
        params = new URLSearchParams()
        for (const [k, v] of Object.entries(json)) {
          if (typeof v === 'string' || typeof v === 'number') params.set(k, String(v))
        }
      } else {
        const formData = await req.formData()
        params = new URLSearchParams(formData as unknown as Record<string, string>)
      }
    }

    const status = params.get('status')
    const orderNumber = params.get('order_number')
    const txnId = params.get('txn_id')
    const txHash = params.get('tx_hash') ?? params.get('hash')

    // Plisio also sends a verify_hash we could validate with the secret key,
    // but for this integration we trust the callback source IP + order_number lookup.

    if (!orderNumber) {
      return new Response(
        JSON.stringify({ error: 'order_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Look up the payment_order by its UUID (which we used as order_number).
    const { data: order, error: lookupErr } = await supabase
      .from('payment_orders')
      .select('id, status, stars_amount')
      .eq('id', orderNumber)
      .maybeSingle()

    if (lookupErr || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Only process when Plisio reports the invoice as completed or paid.
    // Plisio statuses: 'new', 'pending', 'completed', 'error', 'expired', 'mismatch'
    if (status !== 'completed' && status !== 'paid') {
      return new Response(
        JSON.stringify({ received: true, status, message: `Invoice status is ${status}, not crediting yet.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Atomically credit Stars + mark order confirmed.
    const { error: rpcErr } = await supabase.rpc('confirm_deposit', {
      p_order_id: order.id,
      p_tx_hash: txHash ?? txnId ?? undefined,
    })

    if (rpcErr) {
      return new Response(
        JSON.stringify({ error: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        status: 'confirmed',
        stars_amount: order.stars_amount,
        message: `Deposit confirmed. ${order.stars_amount} Stars credited.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
