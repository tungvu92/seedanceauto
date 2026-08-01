const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false });
    return;
  }

  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ ok: false, error: 'missing code' });
    return;
  }

  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('order_code', code)
    .maybeSingle();

  if (error || !data) {
    res.status(404).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true, status: data.status });
};
