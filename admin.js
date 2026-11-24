(() => {
  const cfg = window.NXT_CONFIG || {};
  const ready = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY;
  const db = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = s => document.querySelector(s);
  const loginPanel = $('#loginPanel'), dashboard = $('#dashboard'), form = $('#propertyForm');
  let editing = null, authCheck = false;
  const say = (sel, msg) => { const el = $(sel); if (el) el.textContent = msg || ''; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatPrice = v => v === null || v === undefined || v === '' ? 'Price on request' : `₹${Number(v).toLocaleString('en-IN')}`;
  const bucket = cfg.PROPERTY_IMAGE_BUCKET || 'property-images';

  function configRow(c = {}) {
    const row = document.createElement('div'); row.className = 'configuration-row';
    row.innerHTML = `<label>Configuration<input data-k="label" value="${esc(c.label || '')}" placeholder="e.g. 2 BHK" required></label><label>Carpet area range<input data-k="area" value="${esc(c.area || '')}" placeholder="e.g. 609–733 sq.ft."></label><label>Starting price (INR)<input data-k="price" type="number" min="0" step="1" value="${esc(c.price ?? '')}" placeholder="e.g. 7768000"></label><label>Bedrooms<input data-k="bedrooms" type="number" min="0" step="1" value="${esc(c.bedrooms ?? '')}"></label><button type="button" class="secondary remove-config" aria-label="Remove configuration">Remove</button>`;
    row.querySelector('.remove-config').addEventListener('click', () => row.remove());
    $('#configurationRows').append(row);
  }
  function readConfigurations() {
    return [...$('#configurationRows').querySelectorAll('.configuration-row')].map(row => {
      const v = key => row.querySelector(`[data-k="${key}"]`).value.trim();
      return { label:v('label'), area:v('area') || null, price:v('price') ? Number(v('price')) : null, bedrooms:v('bedrooms') ? Number(v('bedrooms')) : null };
    }).filter(c => c.label);
  }
  function setConfigurations(items, legacy = {}) { $('#configurationRows').innerHTML = ''; const rows = Array.isArray(items) && items.length ? items : (legacy.property_type ? [{label:legacy.property_type, area:legacy.carpet_area ? `${legacy.carpet_area} ${legacy.area_unit || 'sq.ft.'}` : '', price:legacy.price, bedrooms:legacy.bedrooms}] : [{}]); rows.forEach(configRow); }

  async function requireAdmin() {
    if (!db) { say('#loginMessage', 'Supabase configuration is missing. Check config.js.'); return false; }
    const { data:{session}, error } = await db.auth.getSession();
    if (error || !session) { loginPanel.classList.remove('hidden'); dashboard.classList.add('hidden'); return false; }
    return showDashboard(session.user);
  }
  async function showDashboard(user) {
    if (authCheck) return false; authCheck = true;
    try {
      const { data:isAdmin, error } = await db.rpc('is_nxt_admin');
      if (error || isAdmin !== true) {
        await db.auth.signOut(); loginPanel.classList.remove('hidden'); dashboard.classList.add('hidden');
        say('#loginMessage', 'This account is not authorised for the NXT Realty admin workspace.'); return false;
      }
      loginPanel.classList.add('hidden'); dashboard.classList.remove('hidden'); say('#userEmail', user.email || 'Signed in'); await loadList(); return true;
    } finally { authCheck = false; }
  }
  async function loadList() {
    const { data, error } = await db.from('properties').select('*').order('created_at', {ascending:false});
    if (error) { say('#adminMessage', `Could not load listings: ${error.message}`); return; }
    $('#adminList').innerHTML = (data || []).map(p => `<article class="admin-row"><div><strong>${esc(p.project_name || p.title)}</strong><small>${esc(p.location)} · ${esc(p.locality || '')} · ${esc(p.status)} · ${formatPrice(p.price)}</small><small>${(p.configurations || []).map(c => esc(c.label)).join(' · ') || esc(p.property_type || 'Configuration not set')}</small></div><div><button class="secondary" data-edit="${esc(p.id)}">Edit</button><button class="secondary" data-delete="${esc(p.id)}">Delete</button></div></article>`).join('') || '<p>No listings yet. Add your first project.</p>';
    await loadLeads();
    await loadAnalytics();
  }
  async function loadAnalytics() {
    const host = $('#analyticsSummary');
    if (!host) return;
    host.innerHTML = '<p class="hint">Loading visitor insights…</p>';
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: events, error } = await db.from('site_events').select('event_type,page_path,property_id,utm_source,referrer_host,device_type,session_id,created_at').gte('created_at', since).order('created_at', {ascending:false}).limit(5000);
    if (error) { host.innerHTML = `<p class="analytics-empty">Visitor insights are unavailable: ${esc(error.message)}</p>`; return; }
    const rows = events || [];
    const views = rows.filter(e => e.event_type === 'page_view');
    const propertyViews = rows.filter(e => e.event_type === 'property_view');
    const visitors = new Set(rows.filter(e => e.event_type === 'page_view' || e.event_type === 'property_view').map(e => e.session_id)).size;
    host.innerHTML = `<div class="analytics-stat"><strong>${visitors.toLocaleString('en-IN')}</strong><span>Unique browsing sessions</span></div><div class="analytics-stat"><strong>${views.length.toLocaleString('en-IN')}</strong><span>Page views</span></div><div class="analytics-stat"><strong>${propertyViews.length.toLocaleString('en-IN')}</strong><span>Property detail views</span></div>`;
    const counts = (list, keyFn) => { const map = new Map(); list.forEach(e => { const k=keyFn(e) || 'Direct / unknown'; map.set(k,(map.get(k)||0)+1); }); return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6); };
    const topIds = counts(propertyViews, e => e.property_id).filter(x=>x[0] !== 'Direct / unknown');
    let names = {};
    if (topIds.length) {
      const {data: props} = await db.from('properties').select('id,project_name,title').in('id',topIds.map(x=>x[0]));
      (props || []).forEach(p => names[p.id] = p.project_name || p.title || 'Property');
    }
    $('#topProperties').innerHTML = topIds.length ? topIds.map(([id,n])=>`<p><span>${esc(names[id] || 'Property')}</span><strong>${n}</strong></p>`).join('') : '<p class="analytics-empty">No property views recorded yet.</p>';
    const sources = counts(rows.filter(e=>e.event_type==='page_view'), e=>e.utm_source || e.referrer_host || 'Direct');
    $('#topSources').innerHTML = sources.length ? sources.map(([name,n])=>`<p><span>${esc(name)}</span><strong>${n}</strong></p>`).join('') : '<p class="analytics-empty">No source data yet.</p>';
    const devices = counts(views,e=>e.device_type);
    $('#deviceBreakdown').innerHTML = devices.length ? devices.map(([name,n])=>`<p><span>${esc(name)}</span><strong>${n}</strong></p>`).join('') : '<p class="analytics-empty">No device data yet.</p>';
  }
  async function loadLeads() {
    const { data, error } = await db.from('leads').select('*').order('created_at', {ascending:false}).limit(100);
    if (error) { say('#leadList', `Could not load enquiries: ${error.message}`); return; }
    $('#leadList').innerHTML = (data || []).map(l => `<article class="admin-row lead-row"><div><strong>${esc(l.name)} · ${esc(l.phone)}</strong><small>${esc(l.requirement || 'Enquiry')} · ${esc(l.preferred_location || '')} · ${l.created_at ? new Date(l.created_at).toLocaleString() : ''}</small><small>${esc(l.message || '')}</small></div><div><select data-lead-status="${esc(l.id)}" aria-label="Lead status"><option value="new" ${l.status==='new'?'selected':''}>New</option><option value="contacted" ${l.status==='contacted'?'selected':''}>Contacted</option><option value="site_visit" ${l.status==='site_visit'?'selected':''}>Site visit</option><option value="qualified" ${l.status==='qualified'?'selected':''}>Qualified</option><option value="closed" ${l.status==='closed'?'selected':''}>Closed</option></select><a class="small-link" href="https://wa.me/${String(l.phone).replace(/\D/g,'')}" target="_blank" rel="noopener">WhatsApp ↗</a></div></article>`).join('') || '<p>No website enquiries yet.</p>';
  }
  function setField(name, value) { if (form.elements[name]) form.elements[name].value = value ?? ''; }
  function openEditor(p) {
    form.reset(); editing = p || null; form.classList.remove('hidden'); $('#editorTitle').textContent = p ? 'Edit project' : 'Add a project';
    setField('id', p?.id); ['project_name','title','developer_name','project_type','location','locality','listing_type','possession_status','rera_id','price','description','payment_plan','image_url','brochure_url','video_url','virtual_tour_url','map_url','latitude','longitude','status'].forEach(k => setField(k, p?.[k]));
    setField('highlights_text', (p?.project_highlights || []).join('\n')); setField('amenities_text', (p?.amenities || []).join(', ')); setField('floor_plans_text', (p?.floor_plans || []).map(x => typeof x === 'string' ? x : x.url).filter(Boolean).join('\n'));
    form.elements.featured.checked = !!p?.featured; setConfigurations(p?.configurations || [], p || {}); form.scrollIntoView({behavior:'smooth', block:'start'});
  }
  function validHttpUrl(value, label) { if (!value) return null; let u; try { u = new URL(value); } catch { throw new Error(`${label} must be a valid URL.`); } if (!['http:','https:'].includes(u.protocol)) throw new Error(`${label} must start with http:// or https://.`); return u.href; }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!db) { say('#loginMessage','Supabase configuration is missing.'); return; }
    const f = new FormData(e.currentTarget); say('#loginMessage','Signing in…');
    const { data, error } = await db.auth.signInWithPassword({email:f.get('email'), password:f.get('password')});
    if (error) { say('#loginMessage', error.message); return; } await showDashboard(data.user);
  });
  $('#logoutBtn').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
  $('#newPropertyBtn').addEventListener('click', () => openEditor());
  $('#addConfigurationBtn').addEventListener('click', () => configRow());
  $('#cancelEdit').addEventListener('click', () => { form.classList.add('hidden'); editing = null; });
  $('#adminList').addEventListener('click', async e => {
    const edit = e.target.dataset.edit, del = e.target.dataset.delete;
    if (edit) { const {data,error} = await db.from('properties').select('*').eq('id',edit).single(); if (error) say('#adminMessage',error.message); else openEditor(data); }
    if (del && confirm('Delete this project listing? This does not automatically delete its stored images.')) { const {error} = await db.from('properties').delete().eq('id',del); say('#adminMessage',error ? error.message : 'Project deleted.'); await loadList(); }
  });
  $('#refreshLeads').addEventListener('click', loadLeads);
  $('#refreshAnalytics')?.addEventListener('click', loadAnalytics);
  $('#leadList').addEventListener('change', async e => { const id=e.target.dataset.leadStatus; if (!id) return; const {error}=await db.from('leads').update({status:e.target.value}).eq('id',id); say('#adminMessage',error ? error.message : 'Enquiry status updated.'); });

  form.addEventListener('submit', async e => {
    e.preventDefault(); const button=$('#savePropertyBtn'); button.disabled=true; button.textContent='Saving…'; say('#saveMessage','');
    const uploadedPaths=[];
    try {
      const f=new FormData(form), id=f.get('id'); let imageUrl=f.get('image_url') || null;
      const files=Array.from(form.elements.images.files || []); if (files.length>10) throw new Error('Upload a maximum of 10 images.');
      const oldGallery=Array.isArray(editing?.gallery_urls) ? editing.gallery_urls : [];
      for (const file of files) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error(`${file.name} is not a supported JPG, PNG or WebP image.`);
        if (file.size>8*1024*1024) throw new Error(`${file.name} is larger than 8 MB.`);
        const ext=(file.name.split('.').pop() || 'jpg').toLowerCase(), path=`${crypto.randomUUID()}.${ext}`;
        const {error:upErr}=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type}); if (upErr) throw upErr;
        uploadedPaths.push(path); const {data}=db.storage.from(bucket).getPublicUrl(path); if (data?.publicUrl) uploadedPaths[uploadedPaths.length-1]={path,url:data.publicUrl};
      }
      const newUrls=uploadedPaths.map(x => typeof x === 'string' ? null : x.url).filter(Boolean);
      const galleryUrls=newUrls.length ? [...oldGallery,...newUrls] : oldGallery;
      if (!imageUrl) imageUrl=galleryUrls[0] || null;
      const configurations=readConfigurations();
      if (!configurations.length) throw new Error('Add at least one property configuration.');
      const primary=configurations[0];
      const amenities=f.get('amenities_text').split(',').map(x=>x.trim()).filter(Boolean);
      const highlights=f.get('highlights_text').split('\n').map(x=>x.trim()).filter(Boolean);
      const floorPlans=f.get('floor_plans_text').split('\n').map(x=>x.trim()).filter(Boolean).map(url=>({url:validHttpUrl(url,'Floor plan URL')}));
      const payload={project_name:f.get('project_name').trim(),title:f.get('title').trim()||f.get('project_name').trim(),developer_name:f.get('developer_name')||null,project_type:f.get('project_type')||'residential',location:f.get('location'),locality:f.get('locality')||null,listing_type:f.get('listing_type'),property_type:primary.label,price:f.get('price')?Number(f.get('price')):(primary.price??null),carpet_area:null,area_unit:'sq.ft.',bedrooms:primary.bedrooms??null,bathrooms:null,image_url:validHttpUrl(imageUrl,'Main image URL'),gallery_urls:galleryUrls,description:f.get('description')||null,status:f.get('status'),featured:form.elements.featured.checked,amenities,project_highlights:highlights,payment_plan:f.get('payment_plan')||null,video_url:validHttpUrl(f.get('video_url'),'Video URL'),virtual_tour_url:validHttpUrl(f.get('virtual_tour_url'),'Virtual tour URL'),floor_plans:floorPlans,configurations,possession_status:f.get('possession_status')||null,rera_id:f.get('rera_id')||null,map_url:validHttpUrl(f.get('map_url'),'Google Maps URL'),brochure_url:validHttpUrl(f.get('brochure_url'),'Brochure URL'),latitude:f.get('latitude')?Number(f.get('latitude')):null,longitude:f.get('longitude')?Number(f.get('longitude')):null};
      const result=id ? await db.from('properties').update(payload).eq('id',id) : await db.from('properties').insert(payload);
      if (result.error) throw result.error;
      say('#saveMessage','Project saved successfully.'); form.classList.add('hidden'); editing=null; await loadList(); say('#adminMessage','Project saved.');
    } catch(err) {
      // If the DB save failed after uploads, clean up those new objects to avoid orphaned files.
      const paths=uploadedPaths.map(x=>typeof x==='string'?x:x.path).filter(Boolean); if (paths.length) await db.storage.from(bucket).remove(paths);
      say('#saveMessage',err.message || 'Could not save project.');
    } finally { button.disabled=false; button.textContent='Save project'; }
  });
  async function boot() { if (!db) { loginPanel.classList.remove('hidden'); say('#loginMessage','Configure Supabase in config.js to activate the admin dashboard.'); return; } await requireAdmin(); db.auth.onAuthStateChange((_event,session) => { if (session) showDashboard(session.user); else { loginPanel.classList.remove('hidden'); dashboard.classList.add('hidden'); } }); }
  boot();
})();
