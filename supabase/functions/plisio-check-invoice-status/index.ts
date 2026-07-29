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
    const { order_id, simulate_success } = await req.json()

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

    // Fetch the payment_order to get the Plisio invoice ID and current status.
    const { data: order, error: orderErr } = await supabase
      .from('payment_orders')
      .select('id, status, stars_amount, plisio_invoice_id, plisio_order_number')
      .eq('id', order_id)
      .maybeSingle()

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // If already confirmed, return immediately.
    if (order.status === 'confirmed') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'confirmed',
          already_confirmed: true,
          stars_amount: order.stars_amount,
          message: 'Already confirmed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Test bypass: simulate a successful payment without calling Plisio.
    if (simulate_success === true) {
      const { error: rpcErr } = await supabase.rpc('confirm_deposit', {
        p_order_id: order.id,
        p_tx_hash: '0x_simulated_' + order.id.slice(0, 8),
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
          status: 'confirmed',
          simulated: true,
          stars_amount: order.stars_amount,
          message: 'Payment simulated and Stars credited.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Real Plisio API status check.
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

    // Query Plisio operations endpoint for this invoice.
    // Search by order_number (which is our payment_order UUID).
    const searchParam = order.plisio_order_number ?? order_id
    const params = new URLSearchParams({
      api_key: apiKey,
      type: 'invoice',
      search: searchParam,
    })

    const apiUrl = `${PLISIO_API_BASE}/operations?${params.toString()}`
    const plisioRes = await fetch(apiUrl, { method: 'GET' })
    const plisioData = await plisioRes.json()

    if (plisioData.status !== 'success' || !plisioData.data) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'pending',
          message: 'Invoice not found or still pending on Plisio',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Find the matching operation in the operations array.
    const operations = plisioData.data.operations ?? []
    const invoice = Array.isArray(operations)
      ? operations.find((op: Record<string, unknown>) =>
          op.order_number === searchParam || op.txn_id === order.plisio_invoice_id
        )
      : null

    if (!invoice) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'pending',
          message: 'Invoice not yet found in Plisio operations',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const plisioStatus = (invoice.status as string) ?? 'pending'

    // Plisio "completed" or "mismatch" (overpaid) both mean the user paid.
    if (plisioStatus === 'completed' || plisioStatus === 'mismatch') {
      const txHash = (invoice.tx_hash as string) ?? (invoice.txn_id as string) ?? null

      const { error: rpcErr } = await supabase.rpc('confirm_deposit', {
        p_order_id: order.id,
        p_tx_hash: txHash ?? undefined,
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
          status: 'confirmed',
          plisio_status: plisioStatus,
          stars_amount: order.stars_amount,
          tx_hash: txHash,
          message: `Payment confirmed via Plisio (${plisioStatus}). ${order.stars_amount} Stars credited.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Still pending — return current status for the client to display.
    return new Response(
      JSON.stringify({
        success: false,
        status: 'pending',
        plisio_status: plisioStatus,
        message: `Plisio invoice status: ${plisioStatus}`,
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
