import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const propertyId = String(body.property_id ?? '').trim();
    const planPath = String(body.plan_path ?? '').trim();
    const configuration = String(body.configuration ?? '').trim();
    if (!name || name.length > 120 || !/^\+?[0-9()\s-]{8,18}$/.test(phone) ||
        !propertyId || !planPath || body.consent !== true) {
      return json({ error: 'Please provide valid contact details and consent.' }, 400);
    }
    if (!planPath.startsWith('floor-plans/') || planPath.startsWith('/') || planPath.includes('..') || planPath.includes('\\')) {
      return json({ error: 'Invalid plan selection.' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Floor-plan access is not configured.' }, 503);
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: property, error: lookupError } = await supabase.from('properties')
      .select('id,project_name,title,location,locality,configurations')
      .eq('id', propertyId).eq('status', 'published').maybeSingle();
    if (lookupError || !property) return json({ error: 'This listing is unavailable.' }, 404);

    const plans = (property.configurations ?? []).flatMap((item: any) =>
      item.label === configuration
        ? (item.floor_plans ?? []).filter((plan: any) => plan.visible !== false)
        : []);
    if (!plans.some((plan: any) => plan.path === planPath)) {
      return json({ error: 'This floor plan is not available for the selected configuration.' }, 404);
    }

    const { error: leadError } = await supabase.from('leads').insert({
      name,
      phone,
      requirement: 'Floor-plan enquiry',
      preferred_location: body.preferred_location || property.locality || property.location || null,
      message: `${String(body.message ?? '').slice(0, 1500)} Floor plan: ${String(body.label ?? '').slice(0, 180)}. Configuration: ${configuration}.`,
      source: 'property_floor_plan',
      consent: true,
      status: 'new',
    });
    if (leadError) return json({ error: 'We could not save your enquiry. Please try again.' }, 500);

    const { data: signed, error: signError } = await supabase.storage
      .from('floor-plan-private').createSignedUrl(planPath, 300, { download: false });
    if (signError || !signed?.signedUrl) {
      return json({ error: 'Your enquiry was saved, but this plan could not be opened. Please contact the project team.' }, 503);
    }
    return json({ signed_url: signed.signedUrl, expires_in: 300 });
  } catch {
    return json({ error: 'We could not process this request.' }, 400);
  }
});
