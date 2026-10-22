(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const config = window.NXT_CONFIG || {};
  const ADMIN_ID = "5e2cf52c-cf4c-4a5b-b17b-310343f98611";
  const BUCKET = "property-photos";
  const supabaseLib = window.supabase;
  let client = null, currentUser = null, records = [];
  const form = $("propertyForm");
  const status = (id, message) => { const el=$(id); if(el) el.textContent=message; };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function show(el, yes=true){el?.classList.toggle("admin-hidden",!yes);}
  function formValue(name){return String(new FormData(form).get(name)||"").trim();}
  function setField(name,value){const el=form.elements.namedItem(name);if(!el)return;if(el.type==="checkbox")el.checked=Boolean(value);else el.value=value??"";}
  function resetEditor(){
    form.reset();setField("id","");setField("status","draft");setField("property_type","Residential");setField("purpose","buy");
    $("imagePreview").removeAttribute("src");show($("imagePreview"),false);show($("deleteProperty"),false);
    $("editorTitle").textContent="Add a property";show($("editorPanel"));status("saveStatus","New listings start as Draft. Set status to Active when you are ready to publish.");
  }
  function editRecord(p){
    resetEditor();
    ["id","title","builder","location","property_type","price","purpose","bhk","area","status","featured","details","description","image_url"].forEach(k=>setField(k,p[k]));
    $("editorTitle").textContent="Edit property";show($("deleteProperty"),true);
    if(p.image_url){$("imagePreview").src=p.image_url;show($("imagePreview"));}
    $("editorPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function renderList(){
    const list=$("adminPropertyList");
    if(!records.length){list.innerHTML='<p class="admin-muted">No property records found in the database yet. Use “New property” to add the first one.</p>';return;}
    list.innerHTML=records.map(p=>'<article class="admin-item"><div><h3>'+escapeHTML(p.title||"Untitled property")+'</h3><p>'+escapeHTML(p.location||"Location not set")+' · '+escapeHTML(p.price||"Price on request")+' · '+escapeHTML(p.status||"draft")+(p.featured?" · Featured":"")+'</p></div><div class="admin-item-actions"><button type="button" data-edit="'+escapeHTML(p.id)+'">Edit</button><button type="button" data-toggle="'+escapeHTML(p.id)+'" data-status="'+(p.status==="active"?"draft":"active")+'">'+(p.status==="active"?"Unpublish":"Publish")+'</button></div></article>').join("");
  }
  async function loadRecords(){
    status("managerStatus","Loading property records…");
    const {data,error}=await client.from("properties").select("*").order("created_at",{ascending:false});
    if(error){status("managerStatus","Could not load properties: "+error.message+". Check that your admin account has database access and the properties table policies permit admin reads.");return;}
    records=data||[];renderList();status("managerStatus",records.length+" database "+(records.length===1?"property":"properties")+". Active listings are eligible to appear on the public site.");
  }
  async function uploadImage(file){
    if(!file)return null;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Please choose a JPG, PNG or WebP image.");
    if(file.size>8*1024*1024)throw new Error("Image must be 8 MB or smaller.");
    const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp" })[file.type];
    const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-70);
    const path=Date.now()+"-"+crypto.randomUUID()+"-"+(safeName||("property."+ext));
    const {data,error}=await client.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error("Image upload failed: "+error.message+" If storage policies block uploads, add an admin-only INSERT policy for the public property-photos bucket.");
    const {data:publicData}=client.storage.from(BUCKET).getPublicUrl(data.path);
    return publicData.publicUrl;
  }
  async function saveProperty(forceDraft=false){
    const title=formValue("title"),location=formValue("location");
    if(!title||!location){status("saveStatus","Project name and location are required.");return;}
    const saveBtn=form.querySelector('[type="submit"]');saveBtn.disabled=true;
    try{
      status("saveStatus","Saving property…");
      const file=$("imageFile").files?.[0];
      if(file){const url=await uploadImage(file);setField("image_url",url);}
      const payload={
        title,location,property_type:formValue("property_type")||"Residential",
        price:formValue("price")||"Price on request",details:formValue("details"),
        description:formValue("description"),image_url:formValue("image_url")||null,
        status:forceDraft?"draft":formValue("status"),featured:form.elements.namedItem("featured").checked,
        bhk:formValue("bhk")||null,area:formValue("area")||null,
        purpose:formValue("purpose")||"buy",updated_at:new Date().toISOString()
      };
      const id=formValue("id");
      let query;
      if(id){payload.id=id;query=client.from("properties").update(payload).eq("id",id);}
      else query=client.from("properties").insert(payload);
      const {error}=await query.select().single();
      if(error)throw error;
      status("saveStatus",payload.status==="active"?"Saved and published. The public catalogue should show this listing after refresh.":"Saved as a draft. It is hidden from the public catalogue.");
      await loadRecords();resetEditor();
    }catch(e){console.error(e);status("saveStatus","Save failed: "+(e.message||String(e))+". Your database may need columns for builder/purpose only if you added them to the schema; this form uses the core properties fields plus bhk and area.");}
    finally{saveBtn.disabled=false;}
  }
  async function setListingStatus(id,nextStatus){
    const {error}=await client.from("properties").update({status:nextStatus,updated_at:new Date().toISOString()}).eq("id",id);
    if(error){status("managerStatus","Could not update listing: "+error.message);return;}
    status("managerStatus",nextStatus==="active"?"Listing published.":"Listing unpublished.");await loadRecords();
  }
  async function deleteCurrent(){
    const id=formValue("id");if(!id)return;
    if(!confirm("Permanently delete this property record? This cannot be undone."))return;
    const {error}=await client.from("properties").delete().eq("id",id);
    if(error){status("saveStatus","Delete failed: "+error.message);return;}
    status("managerStatus","Property deleted.");show($("editorPanel"),false);await loadRecords();
  }
  async function enterManager(session){
    currentUser=session?.user||null;
    if(!currentUser){show($("loginPanel"));show($("managerPanel"),false);show($("signOut"),false);return;}
    if(currentUser.id!==ADMIN_ID){
      await client.auth.signOut();
      show($("loginPanel"));show($("managerPanel"),false);
      status("loginStatus","This account is not authorised to manage The NXT Realty listings. Sign in with the authorised admin account.");return;
    }
    show($("loginPanel"),false);show($("managerPanel"));show($("signOut"));
    await loadRecords();
  }
  async function start(){
    if(!supabaseLib?.createClient||!config.supabaseUrl||!config.supabaseAnonKey){
      status("loginStatus","Supabase configuration is missing. Please check config.js.");return;
    }
    client=supabaseLib.createClient(config.supabaseUrl,config.supabaseAnonKey);
    const {data,error}=await client.auth.getSession();
    if(error)status("loginStatus","Could not check sign-in session: "+error.message);
    await enterManager(data?.session||null);
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>enterManager(session),0);});
  }
  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();const d=new FormData(e.currentTarget);
    status("loginStatus","Signing in…");
    const {data,error}=await client.auth.signInWithPassword({email:String(d.get("email")||"").trim(),password:String(d.get("password")||"")});
    if(error){status("loginStatus","Sign-in failed: "+error.message);return;}
    await enterManager(data.session);
  });
  $("signOut").addEventListener("click",async()=>{await client.auth.signOut();});
  $("newProperty").addEventListener("click",resetEditor);
  $("cancelEdit").addEventListener("click",()=>show($("editorPanel"),false));
  $("adminPropertyList").addEventListener("click",async e=>{
    const edit=e.target.closest("[data-edit]"),toggle=e.target.closest("[data-toggle]");
    if(edit){const p=records.find(r=>String(r.id)===edit.dataset.edit);if(p)editRecord(p);}
    if(toggle)await setListingStatus(toggle.dataset.toggle,toggle.dataset.status);
  });
  form.addEventListener("submit",e=>{e.preventDefault();saveProperty(false);});
  $("saveDraft").addEventListener("click",()=>saveProperty(true));
  $("deleteProperty").addEventListener("click",deleteCurrent);
  $("imageFile").addEventListener("change",()=>{
    const file=$("imageFile").files?.[0];if(!file){show($("imagePreview"),false);return;}
    $("imagePreview").src=URL.createObjectURL(file);show($("imagePreview"));
  });
  start();
})();