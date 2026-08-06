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
    const { withdrawal_id } = await req.json()
    if (!withdrawal_id) {
      return new Response(
        JSON.stringify({ error: 'withdrawal_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Resolve the Plisio API key. Prefer the environment variable, then fall
    // back to app_config (so it can be rotated without a redeploy).
    const apiKey =
      Deno.env.get('PLISIO_API_KEY') ??
      (await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'plisio_secret_key')
        .maybeSingle()
      ).data?.value

    if (!apiKey) {
      // Refund the withdrawal so the user can retry later.
      await supabase.rpc('fail_withdrawal', { p_withdrawal_id: withdrawal_id })
      return new Response(
        JSON.stringify({ error: 'Plisio API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the withdrawal row.
    const { data: withdrawal, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('id, usdt_amount, wallet_address, status')
      .eq('id', withdrawal_id)
      .maybeSingle()

    if (fetchErr || !withdrawal) {
      return new Response(
        JSON.stringify({ error: 'Withdrawal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (withdrawal.status !== 'processing') {
      return new Response(
        JSON.stringify({ error: `Withdrawal already ${withdrawal.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Call Plisio Withdrawal API (GET with query params).
    const params = new URLSearchParams({
      api_key: apiKey,
      currency: 'USDT_TRX',
      type: 'cash_out',
      to: withdrawal.wallet_address,
      amount: String(withdrawal.usdt_amount),
    })

    const apiUrl = `${PLISIO_API_BASE}/operations/withdraw?${params.toString()}`
    const plisioRes = await fetch(apiUrl, { method: 'GET' })
    const plisioData = await plisioRes.json()

    if (plisioData.status !== 'success' || !plisioData.data) {
      const errMsg = plisioData?.data?.message ?? 'Plisio withdrawal failed'
      // Refund the Stars and mark the withdrawal failed.
      await supabase.rpc('fail_withdrawal', { p_withdrawal_id: withdrawal_id })
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const opData = plisioData.data
    const plisioTxnId = String(opData.id ?? '')

    // Mark the withdrawal completed with the Plisio txn id.
    const { error: rpcErr } = await supabase.rpc('complete_withdrawal', {
      p_withdrawal_id: withdrawal_id,
      p_plisio_txn_id: plisioTxnId,
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
        withdrawal_id,
        status: 'completed',
        usdt_amount: withdrawal.usdt_amount,
        wallet_address: withdrawal.wallet_address,
        plisio_txn_id: plisioTxnId,
        message: `Instant payout completed. ${withdrawal.usdt_amount} USDT sent to your wallet.`,
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
