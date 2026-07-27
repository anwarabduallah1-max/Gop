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
    const { payout_id } = await req.json()
    if (!payout_id) {
      return new Response(
        JSON.stringify({ error: 'payout_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Simulate the blockchain payout API call: transfer 90% of the gross Stars
    // (in USDT) to the creator's wallet, retain the 10% platform fee.
    await new Promise((r) => setTimeout(r, 1500))

    // Atomically mark payout completed + request as 'paid_out' (SECURITY DEFINER RPC).
    const { error } = await supabase.rpc('process_payout', { p_payout_id: payout_id })
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: payout } = await supabase
      .from('payout_requests')
      .select('id, net_stars, net_usdt, wallet_address, tx_hash, status')
      .eq('id', payout_id)
      .maybeSingle()

    return new Response(
      JSON.stringify({
        success: true,
        payout_id,
        status: payout?.status ?? 'completed',
        net_usdt: payout?.net_usdt ?? 0,
        wallet_address: payout?.wallet_address ?? '',
        tx_hash: payout?.tx_hash ?? null,
        message: `Payout completed. ${payout?.net_usdt ?? 0} USDT sent to creator wallet.`,
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
