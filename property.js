(() => {
  const cfg = window.NXT_CONFIG || {};
  const ready = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY;
  const db = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const id = new URLSearchParams(location.search).get('id');
  const root = document.querySelector('#propertyDetail');
  const wa = (cfg.WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.querySelector('#propertyMenuToggle');
  const mainNav = document.querySelector('#propertyMainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    }));
  }

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Never turn null/blank optional database values into a relative URL such as /null.
  const safeUrl = value => {
    if (typeof value !== 'string' || !value.trim() || /^(null|undefined)$/i.test(value.trim())) return null;
    try { const u = new URL(value.trim(), location.href); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  };
  const money = n => {
    if (n === null || n === undefined || n === '') return 'Price on request';
    n = Number(n); if (!Number.isFinite(n)) return 'Price on request';
    return n >= 1e7 ? `₹${(n / 1e7).toFixed(2).replace(/\.00$/, '')} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2).replace(/0$/, '').replace(/\.$/, '')} L` : `₹${n.toLocaleString('en-IN')}`;
  };
  const waLink = p => `https://wa.me/${wa}?text=${encodeURIComponent(`Hello The NXT Realty, I am interested in ${p.project_name || p.title || 'this project'} in ${p.locality || p.location || ''}. Please share details and arrange a site visit.`)}`;
  const heroSummary = value => {
    const description = String(value ?? '').trim().replace(/\\s+/g, ' ');
    if (!description) return 'Discover this property with The NXT Realty.';
    const firstSentence = description.match(/^.*?[.!?](?=\\s|$)/)?.[0] || description;
    if (firstSentence.length <= 180) return firstSentence;
    return `${firstSentence.slice(0, 177).replace(/\\s+\\S*$/, '')}…`;
  };
  const resourceAction = (url, label) => url
    ? `<button class="btn btn-outline resource-access-btn" type="button" data-resource-url="${esc(url)}" data-resource-label="${esc(label)}">${esc(label)} ↗</button>`
    : '';

  function render(p) {
    const images = [...new Set([...(Array.isArray(p.gallery_urls) ? p.gallery_urls : []), p.image_url].map(safeUrl).filter(Boolean))].slice(0, 8);
    const configs = Array.isArray(p.configurations) ? p.configurations : [];
    const amenities = Array.isArray(p.amenities) ? p.amenities : [];
    const highlights = Array.isArray(p.project_highlights) ? p.project_highlights : [];
    const plans = Array.isArray(p.floor_plans) ? p.floor_plans : [];
    const map = safeUrl(p.map_url) || (p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) ? `https://www.google.com/maps?q=${encodeURIComponent(p.latitude)},${encodeURIComponent(p.longitude)}` : null);
    const brochure = safeUrl(p.brochure_url), video = safeUrl(p.video_url), tour = safeUrl(p.virtual_tour_url);
    document.title = `${p.project_name || p.title || 'Property'} | The NXT Realty`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = `${p.project_name || p.title || 'Property'} in ${p.locality || p.location}. Explore configurations, amenities and request a site visit with The NXT Realty.`;

    root.innerHTML = `
      <section class="project-hero"><div class="project-hero-copy"><p class="eyebrow">${esc(p.locality || p.location)} · ${esc(p.listing_type || 'Property')}</p><h1>${esc(p.project_name || p.title || 'Property')}</h1><p>${esc(heroSummary(p.description))}</p><div class="project-hero-meta"><span>${esc(p.developer_name || '')}</span><span>${esc(p.possession_status || '')}</span><span>${esc(p.rera_id || '')}</span></div><a class="btn btn-gold" href="${waLink(p)}" target="_blank" rel="noopener">Enquire / book a site visit ↗</a></div><div class="project-hero-image">${images[0] ? `<img src="${esc(images[0])}" alt="${esc(p.project_name)}" loading="eager">` : '<div class="gallery-placeholder">Project images coming soon</div>'}</div></section>
      ${images.length > 1 ? `<section class="project-gallery">${images.slice(1).map((u, i) => `<img src="${esc(u)}" alt="${esc(p.project_name)} image ${i + 2}" loading="lazy">`).join('')}</section>` : ''}
      <section class="project-content-grid"><div class="project-main"><h2>About the project</h2><p>${esc(p.description || 'Contact our team for complete project information.')}</p>
      ${highlights.length ? `<h2>Project highlights</h2><div class="project-highlight-grid">${highlights.map(x => `<div>${esc(x)}</div>`).join('')}</div>` : ''}
      ${configs.length ? `<h2>Configurations & pricing</h2><div class="configuration-cards">${configs.map(c => `<article class="configuration-card"><span>${esc(c.label || 'Configuration')}</span><strong>${c.price ? money(c.price) : 'Price on request'}</strong><small>${esc(c.area || 'Area on request')}${c.bedrooms ? ` · ${esc(c.bedrooms)} bedrooms` : ''}</small><a href="${waLink({ ...p, project_name: `${p.project_name || p.title} ${c.label || ''}` })}" target="_blank" rel="noopener">Enquire for this configuration ↗</a></article>`).join('')}</div>` : `<h2>Property details</h2><div class="detail-spec-grid"><div><small>Configuration</small><strong>${esc(p.property_type || 'Contact for details')}</strong></div><div><small>Carpet area</small><strong>${esc(p.carpet_area ? `${p.carpet_area} ${p.area_unit || 'sq.ft.'}` : 'On request')}</strong></div><div><small>Asking price</small><strong>${money(p.price)}</strong></div></div>`}
      ${amenities.length ? `<h2>Amenities & lifestyle</h2><div class="amenity-list">${amenities.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
      ${p.payment_plan ? `<h2>Payment plan</h2><p>${esc(p.payment_plan)}</p>` : ''}
      ${plans.some(x => safeUrl(typeof x === 'string' ? x : x.url)) ? `<h2>Floor plans</h2><div class="project-link-list">${plans.map((x, i) => resourceAction(safeUrl(typeof x === 'string' ? x : x.url), `View floor plan ${i + 1}`)).join('')}</div>` : ''}
      ${video || tour ? `<h2>Explore the project</h2><div class="project-link-list">${resourceAction(video, 'Watch project video')}${resourceAction(tour, 'Open virtual tour')}</div>` : ''}
      ${brochure ? `<h2>Project brochure</h2><div class="project-link-list">${resourceAction(brochure, 'Download brochure')}</div>` : ''}
      ${map ? `<h2>Location & connectivity</h2><div class="project-link-list">${resourceAction(map, 'View project location on Google Maps')}</div>` : ''}
      <p class="detail-disclaimer">Prices, availability, carpet areas, amenities, possession dates, approvals and RERA details are subject to verification and change. Please independently verify all information before making a decision.</p></div>
      <aside class="detail-enquire"><h3>Interested in this project?</h3><p>Speak with our team or request a site visit.</p><a class="btn btn-gold" target="_blank" rel="noopener" href="${waLink(p)}">Enquire on WhatsApp ↗</a><a class="btn btn-navy" href="index.html#contact">Request a callback</a>${p.rera_id ? `<small class="rera-note">RERA: ${esc(p.rera_id)}</small>` : ''}</aside></section>
      <dialog class="resource-gate-dialog" id="resourceGateDialog" aria-labelledby="resourceGateTitle"><form id="resourceGateForm" class="resource-gate-form"><button class="resource-gate-close" type="button" aria-label="Close dialog">×</button><p class="eyebrow">PROJECT INFORMATION</p><h2 id="resourceGateTitle">Access project details</h2><p class="resource-gate-copy">Please share your details and agree to be contacted by The NXT Realty to access <strong id="resourceGateLabel">this resource</strong>.</p><label>Your name <input name="name" autocomplete="name" required maxlength="120" placeholder="Enter your name"></label><label>Phone number <input name="phone" type="tel" inputmode="tel" autocomplete="tel" required pattern="[+0-9()\\s-]{8,18}" maxlength="18" placeholder="+91 98765 43210"></label><label class="resource-gate-consent"><input name="consent" type="checkbox" required> I agree that The NXT Realty may use my details to respond to this request.</label><p class="resource-gate-note" id="resourceGateNote" role="status" aria-live="polite"></p><button class="btn btn-gold resource-gate-submit" type="submit">Submit & access resource ↗</button></form></dialog>`;

    const gate = root.querySelector('#resourceGateDialog');
    const gateForm = root.querySelector('#resourceGateForm');
    const gateNote = root.querySelector('#resourceGateNote');
    const gateLabel = root.querySelector('#resourceGateLabel');
    let pendingResource = null;
    root.querySelectorAll('.resource-access-btn').forEach(button => button.addEventListener('click', () => {
      pendingResource = { url: button.dataset.resourceUrl, label: button.dataset.resourceLabel || 'this resource' };
      gateLabel.textContent = pendingResource.label;
      gateNote.textContent = '';
      gateForm.reset();
      gate.showModal();
    }));
    root.querySelector('.resource-gate-close')?.addEventListener('click', () => gate.close());
    gate?.addEventListener('click', event => { if (event.target === gate) gate.close(); });
    gateForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!pendingResource || !gateForm.reportValidity()) return;
      const fd = new FormData(gateForm);
      if (fd.get('consent') !== 'on') { gateNote.textContent = 'Please provide consent to continue.'; return; }
      if (!db) { gateNote.textContent = 'We cannot verify your request right now. Please try again later.'; return; }
      const name = String(fd.get('name') || '').trim(), phone = String(fd.get('phone') || '').trim();
      if (!name || !phone) return;
      const popup = window.open('about:blank', '_blank');
      const submit = gateForm.querySelector('[type="submit"]');
      submit.disabled = true;
      gateNote.textContent = 'Saving your request securely…';
      try {
        const { error } = await db.from('leads').insert({
          name, phone, requirement: 'Project information',
          preferred_location: p.locality || p.location || null,
          message: `Requested ${pendingResource.label} for ${p.project_name || p.title || 'this project'}.`,
          source: 'property_resource', consent: true, status: 'new'
        });
        if (error) throw error;
        gateNote.textContent = 'Thank you. Your details are saved. Opening the requested resource…';
        if (popup) { popup.location.href = pendingResource.url; gate.close(); }
        else {
          const link = document.createElement('a');
          link.href = pendingResource.url; link.target = '_blank'; link.rel = 'noopener';
          link.className = 'resource-gate-fallback'; link.textContent = `Tap here to open ${pendingResource.label}`;
          gateNote.append(' ', link);
        }
      } catch (error) {
        if (popup) popup.close();
        console.error('Resource access lead failed', error);
        gateNote.textContent = 'We could not save your details. Please try again; the resource has not been opened.';
      } finally { submit.disabled = false; }
    });
  }

  async function load() {
    if (!id) { root.textContent = 'No property was selected.'; return; }
    if (!db) { root.textContent = 'Project details are temporarily unavailable. Please contact The NXT Realty.'; return; }
    try {
      const { data: p, error } = await db.from('properties').select('*').eq('id', id).eq('status', 'published').single();
      if (error || !p) { root.textContent = 'This project is unavailable or has been removed.'; return; }
      render(p);
    } catch (e) { console.error('Project load failed', e); root.textContent = 'We could not load this project. Please try again later.'; }
  }
  load();
})();
