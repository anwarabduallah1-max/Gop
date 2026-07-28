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
    const { amount, order_id } = await req.json()
    if (!amount || !order_id) {
      return new Response(
        JSON.stringify({ error: 'amount and order_id are required' }),
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

    // Build Plisio invoice API query params.
    // Plisio uses a GET request with query parameters.
    const orderNumber = order_id as string
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/plisio-deposit-webhook`

    const params = new URLSearchParams({
      api_key: apiKey,
      source_currency: 'USD',
      source_amount: String(amount),
      currency: 'USDT_TRX',
      order_name: `Stars ${amount}`,
      order_number: orderNumber,
      callback_url: callbackUrl,
      description: `StarLift Stars purchase - ${amount} Stars`,
    })

    const apiUrl = `${PLISIO_API_BASE}/invoices/new?${params.toString()}`
    const plisioRes = await fetch(apiUrl, { method: 'GET' })
    const plisioData = await plisioRes.json()

    if (plisioData.status !== 'success' || !plisioData.data) {
      return new Response(
        JSON.stringify({ error: plisioData?.data?.message ?? 'Plisio invoice creation failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const invoice = plisioData.data
    const invoiceId = invoice.txn_id as string
    const invoiceUrl = invoice.invoice_url as string
    const qrCode = invoice.qr_code as string

    // Update the payment_order with Plisio invoice details.
    await supabase
      .from('payment_orders')
      .update({
        plisio_invoice_id: invoiceId,
        plisio_invoice_url: invoiceUrl,
        plisio_invoice_qr: qrCode,
        plisio_order_number: orderNumber,
      })
      .eq('id', order_id)

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
        qr_code: qrCode,
        amount: amount,
        currency: 'USDT_TRX',
        order_id: order_id,
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
