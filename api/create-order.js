const { createClient } = require('@supabase/supabase-js');

const PLAN_PRICES = {
  free: 0,
  yearly: 1999000,
  monthly: 199000,
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function generateOrderCode() {
  // No hyphen: this code is embedded verbatim in the bank transfer content
  // (SEVQR + code) and matched back out of it by api/sepay-webhook.js, so it
  // stays plain alphanumeric to survive bank content field normalization.
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SDA${ts}${rand}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const plan = String(body.plan || '').trim();

  if (!name || !phone) {
    res.status(400).json({ ok: false, error: 'Vui lòng nhập đầy đủ họ tên và số điện thoại.' });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)) {
    res.status(400).json({ ok: false, error: 'Gói không hợp lệ.' });
    return;
  }

  const amount = PLAN_PRICES[plan];

  const status = plan === 'free' ? 'fulfilled' : 'pending';

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const orderCode = generateOrderCode();
    // No .select() here: the anon key is insert-only on `orders` (it cannot
    // read rows back), so the response is built from values already known
    // server-side instead of asking Postgres to return the inserted row.
    const { error } = await supabase.from('orders').insert({
      order_code: orderCode,
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,
      plan,
      amount,
      status,
    });

    if (!error) {
      res.status(200).json({ ok: true, order: { order_code: orderCode, plan, amount, status } });
      return;
    }

    lastError = error;
    if (error.code !== '23505') break; // not a unique-violation, don't retry
  }

  console.error('create-order failed:', lastError);
  res.status(500).json({ ok: false, error: 'Không thể tạo đơn hàng, vui lòng thử lại.' });
};
