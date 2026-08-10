const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { error } = await supabase.from('_keepalive').update({ pinged_at: new Date().toISOString() }).eq('id', 1);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, pinged_at: new Date().toISOString() });
};
