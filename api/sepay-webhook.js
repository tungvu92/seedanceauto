const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function signatureMatches(rawBody, signature, secret) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-sepay-signature'];

  if (!signatureMatches(rawBody, signature, process.env.SEPAY_WEBHOOK_SECRET)) {
    console.error('sepay-webhook: invalid or missing signature');
    res.status(401).json({ ok: false, error: 'invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'invalid json' });
    return;
  }

  if (payload.transferType !== 'in') {
    res.status(200).json({ ok: true, skipped: 'not an incoming transfer' });
    return;
  }

  const content = String(payload.content || '').toUpperCase();
  const match = content.match(/SDA[A-Z0-9]{6,}/);
  if (!match) {
    res.status(200).json({ ok: true, skipped: 'no order code in content' });
    return;
  }
  const orderCode = match[0];

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: findError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (findError) {
    console.error('sepay-webhook: lookup failed', findError);
    res.status(500).json({ ok: false });
    return;
  }
  if (!order) {
    res.status(200).json({ ok: true, skipped: 'order not found: ' + orderCode });
    return;
  }
  if (order.status !== 'pending') {
    res.status(200).json({ ok: true, skipped: 'order already ' + order.status });
    return;
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      sepay_transaction_id: String(payload.id || payload.referenceCode || ''),
      paid_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (updateError) {
    console.error('sepay-webhook: update failed', updateError);
    res.status(500).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true, order_code: orderCode });
};
