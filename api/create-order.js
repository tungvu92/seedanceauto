const { createClient } = require('@supabase/supabase-js');

const PLAN_PRICES = {
  free: 0,
  yearly: 1999000,
  monthly: 199000,
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function generateOrderCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SDA-${ts}${rand}`;
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

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const orderCode = generateOrderCode();
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_code: orderCode,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        plan,
        amount,
        status: plan === 'free' ? 'fulfilled' : 'pending',
      })
      .select('order_code, plan, amount, status')
      .single();

    if (!error) {
      res.status(200).json({ ok: true, order: data });
      return;
    }

    lastError = error;
    if (error.code !== '23505') break; // not a unique-violation, don't retry
  }

  console.error('create-order failed:', lastError);
  res.status(500).json({ ok: false, error: 'Không thể tạo đơn hàng, vui lòng thử lại.' });
};
