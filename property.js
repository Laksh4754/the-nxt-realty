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
  const waLink = p => `https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I am interested in ${p.project_name || p.title || 'this project'} in ${p.locality || p.location || ''}. Please share details and arrange a site visit.`)}`;
  const heroSummary = value => {
    const description = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!description) return 'Discover this property.';
    const firstSentence = description.match(/^.*?[.!?](?=\s|$)/)?.[0] || description;
    if (firstSentence.length <= 180) return firstSentence;
    return `${firstSentence.slice(0, 177).replace(/\s+\S*$/, '')}…`;
  };
  const resourceAction = (url, label) => url
    ? `<button class="btn btn-outline resource-access-btn" type="button" data-resource-url="${esc(url)}" data-resource-label="${esc(label)}">${esc(label)} ↗</button>`
    : '';
  const responsiveImage = (url, alt, assets=[]) => {
    const asset=assets.find(x=>x?.source_url===url), variants=(asset?.variants||[]).filter(x=>x?.url&&Number(x.width)>0);
    const candidates=[...variants.map(x=>({url:x.url,width:Number(x.width)})),...(asset?.width? [{url,width:Number(asset.width)}]:[])].sort((a,b)=>a.width-b.width);
    const srcset=candidates.length>1?` srcset="${candidates.map(x=>`${esc(x.url)} ${x.width}w`).join(', ')}" sizes="(max-width: 720px) 100vw, 1200px"`:'';
    return `<img data-media-fallback src="${esc(url)}"${srcset} alt="${esc(alt)}" loading="lazy">`;
  };
  const floorPlanCards = (items, configuration, assets=[]) => (Array.isArray(items) ? items : []).map((item, index) => {
    const record = typeof item === 'string' ? {url:item} : item || {};
    const url = safeUrl(record.url);
    if (!url) return '';
    const name = record.name || `Floor plan ${index + 1}`;
    const isPdf = record.type === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(url);
    const isImage = !isPdf && (/^image\//.test(record.type || '') || /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url));
    const preview = isImage
      ? responsiveImage(url, `${configuration} · ${name}`, assets)
      : isPdf
        ? `<iframe src="${esc(url)}#view=FitH" title="${esc(configuration)} · ${esc(name)}" loading="lazy"></iframe>`
        : `<div class="floor-plan-file-placeholder">${esc(record.type || 'Project file')}</div>`;
    return `<figure class="floor-plan-item"><div class="floor-plan-preview ${isPdf ? 'is-document' : ''}">${preview}</div><figcaption><div><strong>${esc(configuration)}</strong><span>${esc(name)}</span></div><a href="${esc(url)}" target="_blank" rel="noopener">Open full plan ↗</a></figcaption></figure>`;
  }).join('');


  function render(p) {
    const images = [...new Set([...(Array.isArray(p.gallery_urls) ? p.gallery_urls : []), p.image_url].map(safeUrl).filter(Boolean))].slice(0, 8);
    const mediaAssets = Array.isArray(p.media_assets) ? p.media_assets : [];
    const configs = Array.isArray(p.configurations) ? p.configurations : [];
    const amenities = Array.isArray(p.amenities) ? p.amenities : [];
    const highlights = Array.isArray(p.project_highlights) ? p.project_highlights : [];
    const plans = Array.isArray(p.floor_plans) ? p.floor_plans : [];
    const map = safeUrl(p.map_url) || (p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) ? `https://www.google.com/maps?q=${encodeURIComponent(p.latitude)},${encodeURIComponent(p.longitude)}` : null);
    const brochure = safeUrl(p.brochure_url), video = safeUrl(p.video_url), tour = safeUrl(p.virtual_tour_url);
    const developerLogo = safeUrl(p.developer_logo_url), projectLogo = safeUrl(p.project_logo_url);
    const propertyName = p.project_name || p.title || 'Property';
    const propertyLocation = p.locality || p.location || 'Mumbai Metropolitan Region';
    const listingBrand = document.querySelector('#propertyListingBrand');
    if (listingBrand) listingBrand.innerHTML = `<div class="project-logo-lockup">${projectLogo ? responsiveImage(projectLogo, `${propertyName} logo`, mediaAssets) : `<span>${esc(propertyName)}</span>`}${developerLogo ? responsiveImage(developerLogo, `${p.developer_name || 'Developer'} logo`, mediaAssets) : p.developer_name ? `<span>${esc(p.developer_name)}</span>` : ''}</div>`;
    document.title = `${propertyName} in ${propertyLocation}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      const summary = heroSummary(p.description);
      meta.content = `${propertyName} in ${propertyLocation}. ${summary} Request current availability and a site visit.`.slice(0, 320);
    }

    root.innerHTML = `
      <section class="project-hero"><div class="project-hero-copy"><p class="eyebrow">${esc(p.locality || p.location)} · ${esc(p.listing_type || 'Property')}</p><h1>${esc(p.project_name || p.title || 'Property')}</h1><p>${esc(heroSummary(p.description))}</p><div class="project-hero-meta"><span>${esc(p.developer_name || '')}</span><span>${esc(p.possession_status || '')}</span><span>${esc(p.rera_id || '')}</span></div><a class="btn btn-gold" href="${waLink(p)}" target="_blank" rel="noopener">Enquire / book a site visit ↗</a></div><div class="project-hero-image">${images[0] ? `${responsiveImage(images[0], p.project_name, mediaAssets).replace('loading="lazy"','loading="eager"')}` : '<div class="gallery-placeholder">Project images coming soon</div>'}</div></section>
      ${images.length > 1 ? `<section class="project-gallery">${images.slice(1).map((u, i) => responsiveImage(u, `${p.project_name} image ${i + 2}`, mediaAssets)).join('')}</section>` : ''}
      <section class="project-content-grid"><div class="project-main"><h2>About the project</h2><p>${esc(p.description || 'Contact our team for complete project information.')}</p>
      ${Array.isArray(p.lifestyle_highlights) && p.lifestyle_highlights.some(x=>safeUrl(x.image_url)) ? `<h2>Life at the project</h2><div class="lifestyle-highlight-grid">${p.lifestyle_highlights.filter(x => safeUrl(x.image_url)).map(x => `<article class="lifestyle-highlight-card">${responsiveImage(safeUrl(x.image_url), x.title || 'Project lifestyle', mediaAssets)}<div><h3>${esc(x.title || 'Project highlight')}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ''}</div></article>`).join('')}</div>` : ''}${highlights.length ? `<h2>Project highlights</h2><div class="project-highlight-grid">${highlights.map(x => `<div>${esc(x)}</div>`).join('')}</div>` : ''}
      ${configs.length ? `<h2>Configurations & pricing</h2><div class="configuration-cards">${configs.map(c => `<article class="configuration-card"><div class="configuration-summary"><span>${esc(c.label || 'Configuration')}</span><strong>${c.price ? money(c.price) : 'Price on request'}</strong><small>${esc(c.area || 'Area on request')}${c.bedrooms ? ` · ${esc(c.bedrooms)} bedrooms` : ''}</small></div>${floorPlanCards(c.floor_plans, c.label || 'Configuration', mediaAssets) ? `<div class="configuration-floor-plans">${floorPlanCards(c.floor_plans, c.label || 'Configuration', mediaAssets)}</div>` : ''}</article>`).join('')}</div>` : `<h2>Property details</h2><div class="detail-spec-grid"><div><small>Configuration</small><strong>${esc(p.property_type || 'Contact for details')}</strong></div><div><small>Carpet area</small><strong>${esc(p.carpet_area ? `${p.carpet_area} ${p.area_unit || 'sq.ft.'}` : 'On request')}</strong></div><div><small>Asking price</small><strong>${money(p.price)}</strong></div></div>`}
      ${amenities.length ? `<h2>Amenities & lifestyle</h2><div class="amenity-list">${amenities.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
      ${p.payment_plan ? `<h2>Payment plan</h2><p>${esc(p.payment_plan)}</p>` : ''}
      ${plans.some(x => safeUrl(typeof x === 'string' ? x : x.url)) ? `<h2>Additional floor plans</h2><div class="project-floor-plan-list">${floorPlanCards(plans, p.project_name || p.title || 'Project', mediaAssets)}</div>` : ''}
      ${video || tour ? `<h2>Explore the project</h2><div class="project-link-list">${resourceAction(video, 'Watch project video')}${resourceAction(tour, 'Open virtual tour')}</div>` : ''}
      ${brochure ? `<h2>Project brochure</h2><div class="project-link-list">${resourceAction(brochure, 'Download brochure')}</div>` : ''}
      ${map ? `<h2>Location & connectivity</h2><div class="property-map-card"><div class="property-map-surface" role="img" aria-label="Stylized map preview for ${esc(propertyLocation)}"><svg viewBox="0 0 720 260" aria-hidden="true"><path d="M-20 190 C110 120 210 255 330 160 S540 62 750 150 M45 275 L610 -20 M-20 70 L740 230 M210 -20 L460 290"/><circle cx="370" cy="132" r="22"/><circle cx="370" cy="132" r="6"/><text x="405" y="126">${esc(propertyName)}</text><text x="62" y="218">${esc(propertyLocation)}</text></svg><span>LOCATION PREVIEW</span></div></div><div class="project-link-list">${resourceAction(map, 'Open in Google Maps')}</div>` : ''}
      <p class="detail-disclaimer">Prices, availability, carpet areas, amenities, possession dates, approvals and RERA details are subject to verification and change. Please independently verify all information before making a decision.</p></div>
      <aside class="detail-enquire"><h3>Interested in this project?</h3><p>Speak with our team or request a site visit.</p><a class="btn btn-gold" target="_blank" rel="noopener" href="${waLink(p)}">Enquire on WhatsApp ↗</a><a class="btn btn-navy" href="index.html#contact">Request a callback</a>${p.rera_id ? `<small class="rera-note">RERA: ${esc(p.rera_id)}</small>` : ''}</aside></section>
      <dialog class="resource-gate-dialog" id="resourceGateDialog" aria-labelledby="resourceGateTitle"><form id="resourceGateForm" class="resource-gate-form"><button class="resource-gate-close" type="button" aria-label="Close dialog">×</button><p class="eyebrow">PROJECT INFORMATION</p><h2 id="resourceGateTitle">Access project details</h2><p class="resource-gate-copy">Please share your details and consent to be contacted by the project team to access <strong id="resourceGateLabel">this resource</strong>.</p><input type="hidden" name="configuration"><label>Your name <input name="name" autocomplete="name" required maxlength="120" placeholder="Enter your name"></label><label>Phone number <input name="phone" type="tel" inputmode="tel" autocomplete="tel" required pattern="[+0-9()\\s-]{8,18}" maxlength="18" placeholder="+91 98765 43210"></label><label class="resource-gate-consent"><input name="consent" type="checkbox" required> I agree that the project team may use my details to respond to this request.</label><p class="resource-gate-note" id="resourceGateNote" role="status" aria-live="polite"></p><button class="btn btn-gold resource-gate-submit" type="submit">Submit & access resource ↗</button></form></dialog>`;

    const heroEnquire=root.querySelector('.project-hero-copy > a.btn-gold');
    if(heroEnquire){const button=document.createElement('button');button.type='button';button.className=heroEnquire.className;button.textContent='Enquire Now';heroEnquire.replaceWith(button);button.addEventListener('click',()=>openContextualEnquiry('this project','',{requirement:'Property enquiry',source:'property_hero'}));}
    root.querySelectorAll('.resource-access-btn').forEach(button=>{if(/Google Maps/i.test(button.dataset.resourceLabel||''))return;const link=document.createElement('a');link.className=button.className.replace('resource-access-btn','resource-direct-link');link.href=button.dataset.resourceUrl;link.target='_blank';link.rel='noopener';link.textContent=button.textContent;button.replaceWith(link);});
    const imageFailure = image => { if(!image.isConnected)return; const fallback=document.createElement('span'); fallback.className='image-unavailable'; fallback.setAttribute('role','img'); fallback.setAttribute('aria-label',image.alt||'Image unavailable'); fallback.textContent='Image temporarily unavailable'; image.replaceWith(fallback); };
    document.querySelectorAll('#propertyListingBrand img, #propertyDetail img[data-media-fallback], #propertyDetail .floor-plan-preview img').forEach(img=>img.addEventListener('error',()=>imageFailure(img),{once:true}));
    const gate = root.querySelector('#resourceGateDialog');
    const gateForm = root.querySelector('#resourceGateForm');
    const gateNote = root.querySelector('#resourceGateNote');
    const gateLabel = root.querySelector('#resourceGateLabel');
    let pendingResource = null;
    const gateTitle=root.querySelector('#resourceGateTitle'), gateCopy=root.querySelector('.resource-gate-copy'), gateSubmit=gateForm.querySelector('.resource-gate-submit');
    const touchInput=matchMedia('(hover: none), (pointer: coarse)');
    function openContextualEnquiry(label, configuration, context={}) {
      pendingResource={url:context.url||null,label,configuration,requirement:context.requirement||'Property enquiry',source:context.source||'property_enquiry'}; gateForm.reset();
      gateTitle.textContent='Enquire about '+label; gateCopy.replaceChildren(document.createTextNode('Share your details and the project team will follow up about '),gateLabel,document.createTextNode('.')); gateLabel.textContent=label; gateSubmit.textContent='Send enquiry'; gateNote.textContent=''; gateForm.elements.configuration.value=configuration||''; gate.showModal();
    }
    function addSectionEnquiry(after, label, text, requirement, source) { const button=document.createElement('button');button.type='button';button.className='section-enquire';button.textContent=text;button.setAttribute('aria-label',text);button.addEventListener('click',()=>openContextualEnquiry(label,'',{requirement,source}));after.insertAdjacentElement('afterend',button);return button; }
    const gallery=root.querySelector('.project-gallery');
    if(gallery){const heading=document.createElement('div');heading.className='project-gallery-heading';const title=document.createElement('h2');title.textContent='Project gallery';heading.append(title);const button=document.createElement('button');button.type='button';button.className='section-enquire';button.textContent='See All Pictures';button.addEventListener('click',()=>openContextualEnquiry('the project gallery','',{requirement:'Gallery enquiry',source:'property_gallery'}));heading.append(button);gallery.parentNode.insertBefore(heading,gallery);}
    const pricing=root.querySelector('.configuration-cards, .detail-spec-grid');if(pricing)addSectionEnquiry(pricing,'pricing and availability','Enquire about pricing','Pricing enquiry','property_pricing');
    const amenitiesSection=root.querySelector('.amenity-list');if(amenitiesSection)addSectionEnquiry(amenitiesSection,'project amenities','Enquire about amenities','Amenities enquiry','property_amenities');
    function attachCardAction(area, label, configuration, type) {
      area.classList.add('enquiry-card'); const button=document.createElement('button'); button.type='button'; button.className='listing-card-enquire'; button.textContent='ENQUIRE NOW'; button.setAttribute('aria-label','Enquire now about '+label);button.setAttribute('aria-expanded','false'); area.append(button);
      const context=type==='map'?{requirement:'Location enquiry',source:'property_maps'}:type==='floor-plan'?{requirement:'Floor-plan enquiry',source:'property_floor_plan'}:{requirement:'Configuration enquiry',source:'property_configuration'};
      button.addEventListener('click',event=>{event.stopPropagation();openContextualEnquiry(label,configuration,context);});
      area.addEventListener('click',event=>{if(touchInput.matches&&!event.target.closest('a,button,input,select,textarea')){const revealed=area.classList.toggle('is-revealed');button.setAttribute('aria-expanded',String(revealed));}});
    }
    root.querySelectorAll('.configuration-summary').forEach(summary=>{const configuration=summary.querySelector(':scope > span')?.textContent.trim()||'Configuration';attachCardAction(summary,configuration+' configuration',configuration,'configuration');});
    root.querySelectorAll('.property-map-card').forEach(card=>attachCardAction(card,'the project location','', 'map'));
    root.querySelectorAll('.floor-plan-item').forEach(card=>{const configuration=card.querySelector('figcaption strong')?.textContent.trim()||'Configuration';const name=card.querySelector('figcaption span')?.textContent.trim()||'floor plan';attachCardAction(card,configuration+' · '+name,configuration,'floor-plan');});

    root.querySelectorAll('.resource-access-btn').forEach(button => button.addEventListener('click', () => {
      openContextualEnquiry('the project location','',{url:button.dataset.resourceUrl,requirement:'Google Maps directions',source:'property_maps'});
    }));
    root.querySelector('.resource-gate-close')?.addEventListener('click', () => gate.close());
    gate?.addEventListener('click', event => { if (event.target === gate) gate.close(); });
    gate?.addEventListener('close',()=>{if(pendingResource){pendingResource.cancelled=true;pendingResource.popup?.close();pendingResource=null;}});
    gateForm?.addEventListener('submit', async event => {
      event.preventDefault(); const intent=pendingResource;
      if (!intent || !gateForm.reportValidity()) return;
      const fd=new FormData(gateForm); if(fd.get('consent')!=='on'){gateNote.textContent='Please provide consent to continue.';return;}
      if(!db){gateNote.textContent='We cannot verify your request right now. Please try again later.';return;}
      const name=String(fd.get('name')||'').trim(),phone=String(fd.get('phone')||'').trim(),configuration=String(fd.get('configuration')||'').trim(); if(!name||!phone)return;
      const popup=intent.url?window.open('about:blank','_blank'):null; intent.popup=popup; const submit=gateSubmit; submit.disabled=true; gateNote.textContent='Saving your request securely…';
      try {
        const requirement=intent.requirement||'Property enquiry'; const context=[intent.label?`Requested ${intent.label}.`:'',configuration?`Configuration: ${configuration}.`:'',intent.requirement==='Google Maps directions'?`Location: ${p.locality||p.location||'project location'}.`:''].filter(Boolean).join(' ');
        const {error}=await db.from('leads').insert({name,phone,requirement,preferred_location:p.locality||p.location||null,message:`${context} Project: ${p.project_name||p.title||'this project'}.`,source:intent.source||'property_enquiry',consent:true,status:'new'}); if(error)throw error;
        if(intent.cancelled||pendingResource!==intent||!gate.open){popup?.close();return;}
        if(intent.url){gateNote.textContent='Your request has been saved. Opening the requested location…'; if(popup){popup.opener=null;popup.location.href=intent.url;pendingResource=null;gate.close();}else{pendingResource=null;const link=document.createElement('a');link.href=intent.url;link.target='_blank';link.rel='noopener';link.className='resource-gate-fallback';link.textContent=`Tap here to open ${intent.label}`;gateNote.append(' ',link);}}
        else {gateNote.textContent='Your enquiry has been saved. The project team will follow up.';gateForm.reset();gateSubmit.textContent='Enquiry saved';pendingResource=null;}
      } catch(error) {popup?.close();if(!intent.cancelled&&pendingResource===intent&&gate.open){console.error('Project enquiry save failed',error);gateNote.textContent='We could not save your request. Please try again; no redirect was made.';}}
      finally {submit.disabled=false;}
    });
  }

  async function load() {
    if (!id) { root.textContent = 'No property was selected.'; return; }
    if (!db) { root.textContent = 'Project details are temporarily unavailable. Please contact the project sales team.'; return; }
    try {
      const { data: p, error } = await db.from('properties').select('*').eq('id', id).eq('status', 'published').single();
      if (error || !p) { root.textContent = 'This project is unavailable or has been removed.'; return; }
      render(p);
    } catch (e) { console.error('Project load failed', e); root.textContent = 'We could not load this project. Please try again later.'; }
  }
  load();
})();
