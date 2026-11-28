(() => {
  const cfg = window.NXT_CONFIG || {};
  const ready = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY;
  const db = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = s => document.querySelector(s);
  const loginPanel = $('#loginPanel'), dashboard = $('#dashboard'), form = $('#propertyForm');
  let editing = null, authCheck = false;
  const imagePipeline = window.NXTImagePipeline?.init(form);
  const say = (sel, msg) => { const el = $(sel); if (el) el.textContent = msg || ''; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatPrice = v => v === null || v === undefined || v === '' ? 'Price on request' : `₹${Number(v).toLocaleString('en-IN')}`;
  const bucket = cfg.PROPERTY_IMAGE_BUCKET || 'property-images';
  const floorPlanBucket = cfg.FLOOR_PLAN_BUCKET || 'floor-plan-private';

  function planFileRow(host, plan) {
    const url = typeof plan === 'string' ? plan : plan?.url;
    const path = typeof plan === 'object' ? plan.path : '';
    if (!url && !path) return;
    const row = document.createElement('div'); row.className = 'saved-media-row'; row.dataset.url = url || ''; row.dataset.path = path || ''; row.dataset.type = typeof plan === 'object' ? plan.type || '' : ''; row.dataset.thumbnail = typeof plan === 'object' ? plan.thumbnail_url || '' : ''; row.dataset.visible = typeof plan === 'object' && plan.visible === false ? 'false' : 'true'; row.dataset.featured = typeof plan === 'object' && plan.featured === true ? 'true' : 'false';
    const label = document.createElement('input'); label.className='plan-name'; label.setAttribute('aria-label','Floor plan name'); label.value = typeof plan === 'object' && plan.name ? plan.name : ((url || path).split('/').pop() || 'Floor plan');
    const visibility = document.createElement('label'); visibility.className='plan-visibility'; visibility.innerHTML='<input type="checkbox" aria-label="Show this floor plan publicly"> Show on listing'; visibility.querySelector('input').checked=row.dataset.visible==='true'; visibility.querySelector('input').addEventListener('change',()=>row.dataset.visible=visibility.querySelector('input').checked?'true':'false');
    const featured = document.createElement('label'); featured.className='plan-featured'; featured.innerHTML='<input type="checkbox" aria-label="Feature this floor plan for its configuration"> Featured plan'; featured.querySelector('input').checked=row.dataset.featured==='true'; featured.querySelector('input').addEventListener('change',()=>{if(featured.querySelector('input').checked){row.parentElement.querySelectorAll('.saved-media-row').forEach(other=>{if(other!==row){other.dataset.featured='false';other.querySelector('.plan-featured input').checked=false;}});row.dataset.visible='true';visibility.querySelector('input').checked=true;}row.dataset.featured=featured.querySelector('input').checked?'true':'false';});
    const order = document.createElement('span'); order.className='plan-order'; order.textContent='';
    const up = document.createElement('button'); up.type='button'; up.className='secondary'; up.textContent='Move up'; up.setAttribute('aria-label','Move floor plan up'); up.addEventListener('click',()=>{const prev=row.previousElementSibling;if(prev)row.parentElement.insertBefore(row,prev);});
    const down = document.createElement('button'); down.type='button'; down.className='secondary'; down.textContent='Move down'; down.setAttribute('aria-label','Move floor plan down'); down.addEventListener('click',()=>{const next=row.nextElementSibling;if(next)row.parentElement.insertBefore(next,row);});
    const moveLabel=document.createElement('label');moveLabel.className='plan-move-label';moveLabel.textContent='Configuration';const move=document.createElement('select');move.className='plan-move';moveLabel.append(move);
    const replaceLabel=document.createElement('label');replaceLabel.className='plan-replace-label';replaceLabel.textContent='Replace file';const replacement=document.createElement('input');replacement.type='file';replacement.className='plan-replacement';replacement.dataset.mediaKind='floor-plan';replacement.accept='image/png,image/jpeg,image/webp,image/avif,application/pdf';replaceLabel.append(replacement);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove from listing'; remove.setAttribute('aria-label', 'Remove floor plan from listing; keep uploaded file'); remove.addEventListener('click', () => row.remove());
    move.addEventListener('change',()=>{const target=$('#configurationRows').querySelector(`[data-config-id="${CSS.escape(move.value)}"]`);if(target&&target!==row.closest('.configuration-row')){const destination=target.querySelector('[data-existing-plans]');destination.append(row);if(row.dataset.featured==='true')destination.querySelectorAll('.saved-media-row').forEach(other=>{if(other!==row){other.dataset.featured='false';other.querySelector('.plan-featured input').checked=false;}});}refreshPlanMoves();});
    row.append(label, visibility, featured, moveLabel, replaceLabel, order, up, down, remove); host.append(row);
  }
  function refreshPlanMoves(){const rows=[...$('#configurationRows').querySelectorAll('.configuration-row')];rows.forEach(config=>{if(!config.dataset.configId)config.dataset.configId=crypto.randomUUID();config.querySelectorAll('[data-existing-plans] .saved-media-row').forEach(plan=>{const select=plan.querySelector('.plan-move');if(!select)return;select.replaceChildren(...rows.map((target,index)=>{const option=document.createElement('option');option.value=target.dataset.configId;option.textContent=target.querySelector('[data-k="label"]')?.value.trim()||`Configuration ${index+1}`;return option;}));select.value=config.dataset.configId;});});}
  function configRow(c = {}) {
    const row = document.createElement('div'); row.className = 'configuration-row';
    row.innerHTML = `<div class="configuration-fields"><label>Configuration<input data-k="label" value="${esc(c.label || '')}" placeholder="e.g. 2 BHK" required></label><label>Carpet area range<input data-k="area" value="${esc(c.area || '')}" placeholder="e.g. 609–733 sq.ft."></label><label>Starting price (INR)<input data-k="price" type="number" min="0" step="1" value="${esc(c.price ?? '')}" placeholder="e.g. 7768000"></label><label>Bedrooms<input data-k="bedrooms" type="number" min="0" step="1" value="${esc(c.bedrooms ?? '')}"></label></div><div class="configuration-plan-editor"><label>Floor plans for this configuration<input data-k="floor_plan_files" type="file" data-media-kind="floor-plan" accept="image/png,image/jpeg,image/webp,image/avif,application/pdf" multiple><small>Upload one or more approved images or PDFs, up to 10 MB each. Floor-plan originals are never cropped or replaced by thumbnails.</small></label><div class="saved-media-list" data-existing-plans></div><button type="button" class="secondary remove-config" aria-label="Remove configuration">Remove configuration</button></div>`;
    (Array.isArray(c.floor_plans) ? c.floor_plans : []).forEach(plan => planFileRow(row.querySelector('[data-existing-plans]'), plan));
    row.dataset.configId=crypto.randomUUID();row.querySelector('.remove-config').addEventListener('click', () => row.remove());
    row.querySelector('[data-k="label"]').addEventListener('input',refreshPlanMoves);
    $('#configurationRows').append(row);refreshPlanMoves();
  }
  function readConfigurations() {
    return [...$('#configurationRows').querySelectorAll('.configuration-row')].map(row => {
      const v = key => row.querySelector(`[data-k="${key}"]`).value.trim();
      return { row, label:v('label'), area:v('area') || null, price:v('price') ? Number(v('price')) : null, bedrooms:v('bedrooms') ? Number(v('bedrooms')) : null, floor_plans:[...row.querySelectorAll('[data-existing-plans] .saved-media-row')].map((x,sort_order) => ({...(x.dataset.url?{url:x.dataset.url}:{}),...(x.dataset.path?{path:x.dataset.path}:{}), name:x.querySelector('.plan-name').value.trim(), type:x.dataset.type || null, thumbnail_url:x.dataset.thumbnail || null, visible:x.dataset.visible==='true', featured:x.dataset.featured==='true', sort_order, rowElement:x})) };
    }).filter(c => c.label);
  }
  function setConfigurations(items, legacy = {}) { $('#configurationRows').innerHTML = ''; const rows = Array.isArray(items) && items.length ? items : (legacy.property_type ? [{label:legacy.property_type, area:legacy.carpet_area ? `${legacy.carpet_area} ${legacy.area_unit || 'sq.ft.'}` : '', price:legacy.price, bedrooms:legacy.bedrooms}] : [{}]); rows.forEach(configRow);refreshPlanMoves(); }
  function lifestyleHighlightRow(item = {}) {
    const row = document.createElement('div'); row.className = 'lifestyle-highlight-row'; row.dataset.imageUrl = item.image_url || '';
    row.innerHTML = `<label>Feature title<input data-k="title" value="${esc(item.title || '')}" placeholder="e.g. Sky lounge"></label><label>Short description<input data-k="description" value="${esc(item.description || '')}" placeholder="A calm space above the city"></label><label>Feature image<input data-k="image" type="file" data-media-kind="photo" accept="image/png,image/jpeg,image/webp,image/avif"><small>JPG, PNG, WebP or AVIF · max 10 MB</small></label><button type="button" class="secondary remove-highlight" aria-label="Remove lifestyle highlight">Remove</button>`;
    if (item.image_url) { const current = document.createElement('img'); current.className = 'current-highlight-image'; current.alt = item.title ? `Current image for ${item.title}` : 'Current lifestyle highlight image'; current.src = item.image_url; current.addEventListener('error',()=>{const warning=document.createElement('span');warning.className='media-health-warning';warning.textContent='Saved lifestyle image could not be loaded.';current.replaceWith(warning);},{once:true}); row.querySelector('[data-k="image"]').after(current); }
    row.querySelector('.remove-highlight').addEventListener('click', () => row.remove());
    $('#lifestyleHighlightRows').append(row);
  }
  function setLifestyleHighlights(items) { $('#lifestyleHighlightRows').innerHTML = ''; (Array.isArray(items) ? items : []).forEach(lifestyleHighlightRow); }
  function readLifestyleHighlights() { return [...$('#lifestyleHighlightRows').querySelectorAll('.lifestyle-highlight-row')].map(row => ({row, title:row.querySelector('[data-k="title"]').value.trim(), description:row.querySelector('[data-k="description"]').value.trim(), image_url:row.dataset.imageUrl || null})).filter(x => x.title || x.image_url || rowHasFile(x.row)); }
  function rowHasFile(row) { return !!row.querySelector('[data-k="image"]').files.length; }
  async function uploadFile(file, category, uploadedPaths, allowPdf = false) {
    if (!db) throw new Error('Admin storage is unavailable.');
    const asset = imagePipeline?.assetFor(file);
    if (!asset) throw new Error("Review and approve " + file.name + " before upload.");
    const chosen = asset.kind==='floor-plan' ? file : asset.kind === 'logo' && asset.useCrop && asset.crop ? asset.crop.blob : asset.primary;
    const baseType = asset.kind === 'floor-plan' ? file.type : asset.pdf ? 'application/pdf' : asset.kind === 'logo' && asset.useCrop && asset.crop ? asset.crop.type : asset.metrics.outputFormat;
    const baseExt = asset.kind === 'floor-plan' ? (file.name.split('.').pop()||'jpg').toLowerCase() : asset.pdf ? 'pdf' : asset.kind === 'logo' && asset.useCrop && asset.crop ? asset.crop.ext : asset.metrics.outputExt;
    const objectBase = category + '/' + crypto.randomUUID();
    async function saveBlob(blob, suffix, ext, type, originalName) {
      const path = objectBase + suffix + '.' + ext;
      const { error } = await db.storage.from(category==='floor-plans'?floorPlanBucket:bucket).upload(path, blob, { upsert:false, contentType:type });
      if (error) throw error;
      uploadedPaths.push(path);
      if(category==='floor-plans') return path;
      const { data } = db.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not create a public URL for " + originalName + ".");
      return data.publicUrl;
    }
    const url = await saveBlob(chosen, '', baseExt, baseType, file.name);
    if(category==='floor-plans') {
      let thumbnailUrl=null;
      if(asset.thumbnail){
        const previewPath='floor-plan-previews/'+crypto.randomUUID()+'.'+(asset.metrics.thumbExt||'webp');
        const {error}=await db.storage.from(bucket).upload(previewPath,asset.thumbnail,{upsert:false,contentType:asset.metrics.thumbFormat||'image/webp'});
        if(error)throw error;
        uploadedPaths.push(previewPath);
        thumbnailUrl=db.storage.from(bucket).getPublicUrl(previewPath).data?.publicUrl||null;
        if(!thumbnailUrl)throw new Error('Could not create a public floor-plan preview for '+file.name+'.');
      }
      return {path:url,name:file.name,type:file.type,thumbnail_url:thumbnailUrl,visible:true,featured:false,sort_order:0};
    }
    const originalExt=(file.name.split('.').pop()||'jpg').toLowerCase();
    const originalUrl=asset.kind==='floor-plan'?url:await saveBlob(file, '-original', originalExt, file.type, file.name);
    const thumbnailUrl = asset.thumbnail ? await saveBlob(asset.thumbnail, '-thumb', asset.metrics.thumbExt || 'webp', asset.metrics.thumbFormat || 'image/webp', file.name) : null;
    const variants = [];
    for (let i=0; i<asset.variants.length; i++) {
      const rendition = asset.variants[i];
      const renditionUrl = await saveBlob(rendition.blob, '-' + rendition.width, rendition.ext, rendition.type, file.name);
      variants.push({width:rendition.width,url:renditionUrl,type:rendition.type});
    }
    return {url,name:file.name,type:file.type,thumbnail_url:thumbnailUrl,media_asset:{source_url:url,original_url:originalUrl,kind:asset.kind,width:asset.kind==='logo'&&asset.useCrop?asset.crop.width:(asset.primaryWidth||asset.metrics.width||null),height:asset.kind==='logo'&&asset.useCrop?asset.crop.height:(asset.primaryHeight||asset.metrics.height||null),format:baseType,thumbnail_url:thumbnailUrl,variants:asset.kind==='logo'&&asset.useCrop?[]:variants}};
  }

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
  async function checkMediaHealth(p) {
    const host=$('#mediaHealthWarnings'); if(!host)return; host.replaceChildren(); if(!p)return;
    const entries=[]; const add=(label,url)=>{if(url&&/^https?:\/\//i.test(url)&&!/(?:\.pdf)(?:[?#]|$)/i.test(url)&&!entries.some(x=>x.url===url))entries.push({label,url});};
    add('Main listing photo',p.image_url); (p.gallery_urls||[]).forEach((u,i)=>add('Gallery photo '+(i+1),u)); add('Project logo',p.project_logo_url); add('Developer logo',p.developer_logo_url);
    (p.lifestyle_highlights||[]).forEach((x,i)=>add('Lifestyle highlight '+(i+1),x.image_url));
    (p.media_assets||[]).forEach((x,i)=>{add('Processed media '+(i+1),x.source_url);add('Original media '+(i+1),x.original_url);add('Thumbnail '+(i+1),x.thumbnail_url);(x.variants||[]).forEach((v,j)=>add('Responsive rendition '+(i+1)+'.'+(j+1),v.url));});
    (p.floor_plans||[]).forEach((x,i)=>add('Additional floor plan '+(i+1),typeof x==='string'?x:x?.url));
    (p.configurations||[]).forEach(c=>(c.floor_plans||[]).forEach((x,i)=>add((c.label||'Configuration')+' floor plan '+(i+1),typeof x==='string'?x:x?.thumbnail_url||x?.url)));
    if(!entries.length)return; const title=document.createElement('p');title.textContent='Checking '+entries.length+' saved image and plan links…';host.append(title);
    const results=await Promise.all(entries.map(item=>new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>resolve({...item,ok:false}),8000);img.onload=()=>{clearTimeout(timer);resolve({...item,ok:img.naturalWidth>0});};img.onerror=()=>{clearTimeout(timer);resolve({...item,ok:false});};img.src=item.url;})));
    host.replaceChildren(); const broken=results.filter(x=>!x.ok); const message=document.createElement('p'); message.className=broken.length?'media-health-warning':'media-health-ok'; message.textContent=broken.length?broken.length+' saved image link(s) could not be loaded. Check the URLs before publishing.':'All '+results.length+' saved image links loaded.';host.append(message);
    broken.forEach(item=>{const row=document.createElement('p');row.className='media-health-warning';row.textContent=item.label+' · '+item.url;host.append(row);});
  }
  function openEditor(p) {
    form.reset(); imagePipeline?.clear(); editing = p || null; checkMediaHealth(p); form.classList.remove('hidden'); $('#editorTitle').textContent = p ? 'Edit project' : 'Add a project';
    setField('id', p?.id); ['project_name','title','developer_name','developer_logo_url','project_logo_url','project_type','location','locality','listing_type','possession_status','rera_id','price','description','payment_plan','image_url','brochure_url','video_url','virtual_tour_url','map_url','latitude','longitude','status'].forEach(k => setField(k, p?.[k]));
    setField('highlights_text', (p?.project_highlights || []).join('\n')); setField('amenities_text', (p?.amenities || []).join(', '));
    setLifestyleHighlights(p?.lifestyle_highlights || []);
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
  $('#addLifestyleHighlightBtn').addEventListener('click', () => lifestyleHighlightRow());
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
    e.preventDefault(); if (imagePipeline) { await imagePipeline.waitForProcessing(); if (!imagePipeline.assertApproved()) return; } const button=$('#savePropertyBtn'); button.disabled=true; button.textContent='Saving…'; say('#saveMessage','');
    const uploadedPaths=[], mediaAssets=[...(Array.isArray(editing?.media_assets)?editing.media_assets:[])];
    try {
      const f=new FormData(form), id=f.get('id'); let imageUrl=f.get('image_url') || null;
      const files=Array.from(form.elements.images.files || []); if (files.length>10) throw new Error('Upload a maximum of 10 images.');
      const oldGallery=Array.isArray(editing?.gallery_urls) ? editing.gallery_urls : []; const uploadedGallery=[];
      for (const file of files) {
        const uploaded = await uploadFile(file, 'listing-images', uploadedPaths);
        mediaAssets.push(uploaded.media_asset);
        uploadedGallery.push(uploaded);
      }
      const newUrls=uploadedGallery.map(x=>x.url);
      const galleryUrls=newUrls.length ? [...oldGallery,...newUrls] : oldGallery;
      if (!imageUrl) imageUrl=galleryUrls[0] || null;
      const configurations = readConfigurations();
      if (!configurations.length) throw new Error('Add at least one property configuration.');
      for (const item of configurations) {
        for(let index=0;index<item.floor_plans.length;index++){
          const plan=item.floor_plans[index],replacement=plan.rowElement?.querySelector('.plan-replacement')?.files?.[0];
          if(replacement){const uploaded=await uploadFile(replacement,'floor-plans',uploadedPaths,true);uploaded.visible=plan.visible;uploaded.featured=plan.featured;uploaded.sort_order=plan.sort_order;item.floor_plans[index]=uploaded;}
          else delete plan.rowElement;
        }
        const input = item.row.querySelector('[data-k="floor_plan_files"]');
        for (const file of Array.from(input.files || [])) { const uploaded=await uploadFile(file, 'floor-plans', uploadedPaths, true); uploaded.sort_order=item.floor_plans.length; item.floor_plans.push(uploaded); }
        delete item.row;
      }
      const highlightRows = readLifestyleHighlights();
      const lifestyleHighlights = [];
      for (const item of highlightRows) {
        const imageFile = item.row.querySelector('[data-k="image"]').files[0];
        const uploaded = imageFile ? await uploadFile(imageFile, 'lifestyle-highlights', uploadedPaths) : null; if (uploaded?.media_asset) mediaAssets.push(uploaded.media_asset);
        const imageUrl = uploaded?.url || validHttpUrl(item.image_url, 'Lifestyle highlight image');
        if (!item.title || !imageUrl) throw new Error('Each lifestyle highlight needs a title and an image.');
        lifestyleHighlights.push({title:item.title, description:item.description || null, image_url:imageUrl});
      }
      const developerLogoFile = form.elements.developer_logo_file.files[0];
      const projectLogoFile = form.elements.project_logo_file.files[0];
      const developerLogo = developerLogoFile ? await uploadFile(developerLogoFile, 'developer-logos', uploadedPaths) : null;
      const projectLogo = projectLogoFile ? await uploadFile(projectLogoFile, 'project-logos', uploadedPaths) : null;
      if (developerLogo?.media_asset) mediaAssets.push(developerLogo.media_asset); if (projectLogo?.media_asset) mediaAssets.push(projectLogo.media_asset);
      const configurationsPayload = configurations;
      const primary = configurations[0];
      const amenities = f.get('amenities_text').split(',').map(x=>x.trim()).filter(Boolean);
      const highlights = f.get('highlights_text').split('\n').map(x=>x.trim()).filter(Boolean);
      // Preserve legacy data without offering a path that exposes newly-entered public URLs.
      const floorPlans = Array.isArray(editing?.floor_plans) ? editing.floor_plans : [];
      const developerLogoUrl = developerLogo?.url || validHttpUrl(f.get('developer_logo_url'), 'Developer logo URL') || editing?.developer_logo_url || null;
      const projectLogoUrl = projectLogo?.url || validHttpUrl(f.get('project_logo_url'), 'Project logo URL') || editing?.project_logo_url || null;
      const payload = {project_name:f.get('project_name').trim(),title:f.get('title').trim()||f.get('project_name').trim(),developer_name:f.get('developer_name')||null,developer_logo_url:developerLogoUrl,project_logo_url:projectLogoUrl,media_assets:mediaAssets,lifestyle_highlights:lifestyleHighlights,project_type:f.get('project_type')||'residential',location:f.get('location'),locality:f.get('locality')||null,listing_type:f.get('listing_type'),property_type:primary.label,price:f.get('price')?Number(f.get('price')):(primary.price??null),carpet_area:null,area_unit:'sq.ft.',bedrooms:primary.bedrooms??null,bathrooms:null,image_url:validHttpUrl(imageUrl,'Main image URL'),gallery_urls:galleryUrls,description:f.get('description')||null,status:f.get('status'),featured:form.elements.featured.checked,amenities,project_highlights:highlights,payment_plan:f.get('payment_plan')||null,video_url:validHttpUrl(f.get('video_url'),'Video URL'),virtual_tour_url:validHttpUrl(f.get('virtual_tour_url'),'Virtual tour URL'),floor_plans:floorPlans,configurations:configurationsPayload,possession_status:f.get('possession_status')||null,rera_id:f.get('rera_id')||null,map_url:validHttpUrl(f.get('map_url'),'Google Maps URL'),brochure_url:validHttpUrl(f.get('brochure_url'),'Brochure URL'),latitude:f.get('latitude')?Number(f.get('latitude')):null,longitude:f.get('longitude')?Number(f.get('longitude')):null};
      const result=id ? await db.from('properties').update(payload).eq('id',id) : await db.from('properties').insert(payload);
      if (result.error) throw result.error;
      say('#saveMessage','Project saved successfully.'); form.classList.add('hidden'); editing=null; await loadList(); say('#adminMessage','Project saved.');
    } catch(err) {
      // If the DB save failed after uploads, clean up those new objects to avoid orphaned files.
      const paths=uploadedPaths.map(x=>typeof x==='string'?x:x.path).filter(Boolean); if (paths.length) { const privatePaths=paths.filter(x=>x.startsWith('floor-plans/')); const publicPaths=paths.filter(x=>!x.startsWith('floor-plans/')); if(privatePaths.length)await db.storage.from(floorPlanBucket).remove(privatePaths); if(publicPaths.length)await db.storage.from(bucket).remove(publicPaths); }
      say('#saveMessage',err.message || 'Could not save project.');
    } finally { button.disabled=false; button.textContent='Save project'; }
  });
  async function boot() { if (!db) { loginPanel.classList.remove('hidden'); say('#loginMessage','Configure Supabase in config.js to activate the admin dashboard.'); return; } await requireAdmin(); db.auth.onAuthStateChange((_event,session) => { if (session) showDashboard(session.user); else { loginPanel.classList.remove('hidden'); dashboard.classList.add('hidden'); } }); }
  boot();
})();
