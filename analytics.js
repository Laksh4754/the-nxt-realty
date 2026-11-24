(() => {
  const cfg = window.NXT_CONFIG || {};
  const consentKey = 'nxt_analytics_consent_v1';
  const choice = () => { try { return localStorage.getItem(consentKey); } catch (_) { return null; } };
  const existing = choice();
  const style = document.createElement('style');
  style.textContent = '.nxt-consent{position:fixed;z-index:1000;left:18px;right:18px;bottom:18px;max-width:680px;margin:auto;background:#101d36;color:#fff;padding:18px 20px;box-shadow:0 12px 40px #07132955;display:flex;gap:18px;align-items:center;justify-content:space-between;font:12px/1.6 Arial,sans-serif}.nxt-consent p{margin:0;color:#e1e6ed}.nxt-consent a{color:#e4c78e;text-decoration:underline}.nxt-consent-actions{display:flex;gap:8px;flex-shrink:0}.nxt-consent button{border:1px solid #d7bd89;padding:9px 12px;background:transparent;color:#fff;cursor:pointer;font:600 11px Arial}.nxt-consent button.primary{background:#d7bd89;color:#101d36}@media(max-width:600px){.nxt-consent{left:10px;right:10px;bottom:10px;display:block}.nxt-consent-actions{margin-top:12px}.nxt-consent button{flex:1}}';
  document.head.append(style);
  function banner() {
    if (choice() !== null) return;
    const el = document.createElement('aside');
    el.className = 'nxt-consent';
    el.innerHTML = '<p><strong>Your privacy matters.</strong> We use optional, anonymous analytics to understand which properties are useful. We do not collect your name, phone, email or exact location through analytics. <a href="privacy-policy.html">Privacy policy</a></p><div class="nxt-consent-actions"><button type="button" data-choice="no">Reject</button><button type="button" class="primary" data-choice="yes">Accept</button></div>';
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-choice]');
      if (!btn) return;
      try { localStorage.setItem(consentKey, btn.dataset.choice === 'yes' ? 'yes' : 'no'); } catch (_) {}
      el.remove();
      if (btn.dataset.choice === 'yes') start();
    });
    document.body.append(el);
  }
  function deviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }
  function browserFamily() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return 'Other';
  }
  let sessionId;
  function getSession() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem('nxt_analytics_session');
      if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('nxt_analytics_session', sessionId); }
    } catch (_) { sessionId = crypto.randomUUID(); }
    return sessionId;
  }
  async function send(eventType, propertyId) {
    if (choice() !== 'yes' || !window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    try {
      const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const params = new URLSearchParams(location.search);
      const referrer = document.referrer ? new URL(document.referrer).hostname : null;
      const row = {
        event_type: eventType,
        page_path: (location.pathname + location.hash).slice(0,500),
        property_id: propertyId || null,
        referrer_host: referrer && referrer !== location.hostname ? referrer.slice(0,253) : null,
        utm_source: (params.get('utm_source') || '').slice(0,200) || null,
        utm_medium: (params.get('utm_medium') || '').slice(0,200) || null,
        utm_campaign: (params.get('utm_campaign') || '').slice(0,200) || null,
        device_type: deviceType(),
        browser_family: browserFamily(),
        session_id: getSession()
      };
      await db.from('site_events').insert(row);
    } catch (_) { /* Analytics must never interrupt the property website. */ }
  }
  function start() {
    const id = new URLSearchParams(location.search).get('id');
    send(id ? 'property_view' : 'page_view', id && /^[0-9a-f-]{36}$/i.test(id) ? id : null);
    document.addEventListener('click', e => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.href || '';
      if (/wa\.me\//i.test(href) || /#contact|index\.html#contact/i.test(href) || link.matches('[data-analytics-cta]')) {
        send('cta_click', id && /^[0-9a-f-]{36}$/i.test(id) ? id : null);
      }
    }, {passive:true});
  }
  if (existing === 'yes') start();
  else if (existing === null) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner, {once:true});
    else banner();
  }
})();