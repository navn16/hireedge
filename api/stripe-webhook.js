const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Disable body parsing so Stripe can verify the raw signature
module.exports.config = {
  api: { bodyParser: false }
};

const getRawBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => resolve(data));
  req.on('error', reject);
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const email = session.customer_email || session.customer_details?.email;

    let plan = 'pack';
    const successUrl = session.success_url || '';
    if (successUrl.includes('plan=single')) plan = 'single';
    else if (successUrl.includes('plan=lifetime')) plan = 'lifetime';
    else if (successUrl.includes('plan=pack')) plan = 'pack';

    console.log(`Payment: ${email} → ${plan}`);

    if (email) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

      const { data: users } = await supabase
        .from('users')
        .select('id, single_credits')
        .eq('email', email);

      if (users && users.length > 0) {
        const userId = users[0].id;

        const stripeCustomerId = session.customer || null;

        if (plan === 'single') {
          const currentCredits = users[0].single_credits || 0;
          await supabase.from('users').update({
            single_credits: currentCredits + 1,
            stripe_customer_id: stripeCustomerId
          }).eq('id', userId);
        } else if (plan === 'pack') {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          await supabase.from('users').update({
            plan: 'pack',
            plan_expires_at: expires.toISOString(),
            stripe_customer_id: stripeCustomerId
          }).eq('id', userId);
        } else if (plan === 'lifetime') {
          await supabase.from('users').update({
            plan: 'lifetime',
            stripe_customer_id: stripeCustomerId
          }).eq('id', userId);
        }
      }
    }
  }

  return res.status(200).json({ received: true });
};
