import { createClient } from 'npm:@supabase/supabase-js@2.110.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const PLISIO_API_BASE = 'https://api.plisio.net/api/v1'

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

    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'plisio_secret_key')
      .maybeSingle()

    const apiKey = configRow?.value
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Plisio API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the payout request to get the wallet address and net amount.
    const { data: payout, error: fetchErr } = await supabase
      .from('payout_requests')
      .select('id, net_usdt, wallet_address, request_id, status')
      .eq('id', payout_id)
      .maybeSingle()

    if (fetchErr || !payout) {
      return new Response(
        JSON.stringify({ error: 'Payout request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (payout.status !== 'processing') {
      return new Response(
        JSON.stringify({ error: `Payout already ${payout.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Call Plisio Withdrawal API (GET with query params).
    const params = new URLSearchParams({
      api_key: apiKey,
      currency: 'USDT_TRX',
      type: 'cash_out',
      to: payout.wallet_address,
      amount: String(payout.net_usdt),
    })

    const apiUrl = `${PLISIO_API_BASE}/operations/withdraw?${params.toString()}`
    const plisioRes = await fetch(apiUrl, { method: 'GET' })
    const plisioData = await plisioRes.json()

    if (plisioData.status !== 'success' || !plisioData.data) {
      const errMsg = plisioData?.data?.message ?? 'Plisio withdrawal failed'
      // Mark the payout as failed so the user can retry.
      await supabase
        .from('payout_requests')
        .update({ status: 'failed' })
        .eq('id', payout_id)

      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const opData = plisioData.data
    const plisioOpId = opData.id as string
    const txUrl = opData.tx_url as string
    const txHash = opData.tx_url ? opData.tx_url.split('query=').pop() ?? null : null

    // Atomically mark payout completed + request as 'paid_out'.
    const { error: rpcErr } = await supabase.rpc('process_payout', {
      p_payout_id: payout_id,
      p_tx_hash: txHash,
      p_plisio_op_id: plisioOpId,
      p_tx_url: txUrl,
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
        payout_id,
        status: 'completed',
        net_usdt: payout.net_usdt,
        wallet_address: payout.wallet_address,
        tx_hash: txHash,
        tx_url: txUrl,
        plisio_operation_id: plisioOpId,
        message: `Payout completed. ${payout.net_usdt} USDT sent to creator wallet.`,
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
