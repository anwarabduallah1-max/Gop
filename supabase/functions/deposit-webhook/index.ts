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
    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Simulate blockchain confirmation delay (the "payment network" confirming the USDT deposit).
    // In production this would be a real webhook from the payment provider.
    await new Promise((r) => setTimeout(r, 1200))

    // Atomically mark order confirmed + credit Stars (SECURITY DEFINER RPC).
    const { error } = await supabase.rpc('confirm_deposit', { p_order_id: order_id })
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the updated order so we can return the tx hash + credited amount.
    const { data: order } = await supabase
      .from('payment_orders')
      .select('id, stars_amount, tx_hash, status')
      .eq('id', order_id)
      .maybeSingle()

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        status: order?.status ?? 'confirmed',
        stars_amount: order?.stars_amount ?? 0,
        tx_hash: order?.tx_hash ?? null,
        message: `Deposit confirmed. ${order?.stars_amount ?? 0} Stars credited.`,
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
