const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  const { data, error } = await supabase.rpc('debug_whoami');

  if (error) {
    res.status(500).json({ ok: false, error: error.message, code: error.code });
    return;
  }

  res.status(200).json({ ok: true, result: data });
};
