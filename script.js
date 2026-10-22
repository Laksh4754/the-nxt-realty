(() => {
  "use strict";
  const config = window.NXT_CONFIG || {};
  const $ = id => document.getElementById(id);
  const grid = $("propertyGrid");
  if (!grid) return;
  const empty = $("emptyState"), noResults = $("noResults"), status = $("listingStatus");
  const search = $("propertySearch"), locationFilter = $("locationFilter"), typeFilter = $("typeFilter");
  const purposeFilter = $("purposeFilter"), bhkFilter = $("bhkFilter"), budgetFilter = $("budgetFilter"), sortFilter = $("sortFilter");
  const dialog = $("propertyDialog"), dialogContent = $("propertyDialogContent");
  const supabaseLib = window.supabase;
  let properties = [], savedOnly = false, activeCollection = "";
  const savedKey = "nxt_saved_properties_v1";
  const saved = new Set(JSON.parse(localStorage.getItem(savedKey) || "[]").map(String));
  $("year")?.replaceChildren(document.createTextNode(String(new Date().getFullYear())));

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function moneyNumber(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).toLowerCase().replace(/,/g,"").trim();
    const n = Number(s.replace(/[^0-9.]/g,""));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (/cr|crore/.test(s)) return n * 10000000;
    if (/lakh|lac|\bl\b/.test(s)) return n * 100000;
    return n;
  }
  function whatsapp(message) {
    const number = String(config.whatsappNumber || "918108556994").replace(/\D/g,"");
    if (!number) { alert("Please contact The NXT Realty to enquire about this property."); return; }
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }
  function saveProperties() {
    localStorage.setItem(savedKey, JSON.stringify([...saved]));
    $("savedCount").textContent = String(saved.size);
    $("savedToggle").setAttribute("aria-pressed", String(savedOnly));
  }
  function fillFilters() {
    const locations = [...new Set(properties.map(p => p.location).filter(Boolean))].sort();
    const types = [...new Set(properties.map(p => p.type).filter(Boolean))].sort();
    locationFilter.innerHTML = '<option value="">All locations</option>' + locations.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
    typeFilter.innerHTML = '<option value="">All types</option>' + types.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
  }
  function card(p) {
    const isSaved = saved.has(String(p.id));
    return `<article class="property-card">
      <div class="property-photo-wrap">
        ${p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" loading="lazy" onerror="this.hidden=true">` : '<div class="property-image-placeholder">THE NXT REALTY</div>'}
        ${p.featured ? '<span class="property-badge">Featured</span>' : ''}
        <button class="save-property ${isSaved ? 'is-saved' : ''}" type="button" data-save="${escapeHTML(p.id)}" aria-label="${isSaved ? 'Remove saved property' : 'Save property'}" aria-pressed="${isSaved}">${isSaved ? '♥' : '♡'}</button>
      </div>
      <div class="property-card-body">
        <div class="property-location">${escapeHTML(p.location)}${p.type ? ' · ' + escapeHTML(p.type) : ''}</div>
        <h4>${escapeHTML(p.title)}</h4><div class="property-price">${escapeHTML(p.price || "Price on request")}</div>
        <div class="property-facts">${p.bhk ? `<span>⌂ ${escapeHTML(p.bhk)} BHK</span>` : ''}${p.area ? `<span>▧ ${escapeHTML(p.area)}</span>` : ''}${p.purpose ? `<span>${escapeHTML(p.purpose)}</span>` : ''}</div>
        <p class="property-details">${escapeHTML(p.details || p.description || "Contact us for project details.")}</p>
        <div class="property-card-actions"><button class="button button-outline" type="button" data-details="${escapeHTML(p.id)}">View details</button><button class="button button-dark" type="button" data-enquire="${escapeHTML(p.id)}">Enquire ↗</button></div>
      </div></article>`;
  }
  function filteredProperties() {
    const q = search.value.trim().toLowerCase(), loc = locationFilter.value, type = typeFilter.value;
    let list = properties.filter(p => {
      const text = [p.title,p.location,p.type,p.details,p.description,p.bhk,p.area,p.builder].join(" ").toLowerCase();
      const budget = moneyNumber(p.price);
      const bhkMatch = !bhkFilter.value || (bhkFilter.value === "4" ? Number(p.bhk) >= 4 : Number(p.bhk) === Number(bhkFilter.value));
      const purpose = (p.purpose || "").toLowerCase();
      const purposeMatch = !purposeFilter.value || purpose.includes(purposeFilter.value) || (purposeFilter.value === "buy" && !purpose);
      const collectionMatch = !activeCollection ||
        (activeCollection === "featured" && p.featured) ||
        (activeCollection === "ready" && /ready|resale|move/i.test([p.statusText,p.description,p.details].join(" "))) ||
        (activeCollection === "affordable" && budget !== null && budget <= 5000000) ||
        (activeCollection === "investment" && (/invest/i.test(p.title+" "+p.description+" "+p.purpose)));
      return text.includes(q) && (!loc || p.location === loc) && (!type || p.type === type) && bhkMatch &&
        (!budgetFilter.value || (budget !== null && budget <= Number(budgetFilter.value))) &&
        purposeMatch && (!savedOnly || saved.has(String(p.id))) && collectionMatch;
    });
    if (sortFilter.value === "price-low") list.sort((a,b)=>(moneyNumber(a.price) ?? Infinity)-(moneyNumber(b.price) ?? Infinity));
    if (sortFilter.value === "price-high") list.sort((a,b)=>(moneyNumber(b.price) ?? -Infinity)-(moneyNumber(a.price) ?? -Infinity));
    if (sortFilter.value === "newest") list.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    if (sortFilter.value === "featured") list.sort((a,b)=>Number(b.featured)-Number(a.featured) || new Date(b.createdAt||0)-new Date(a.createdAt||0));
    return list;
  }
  function render() {
    const list = filteredProperties();
    status.textContent = `${list.length} ${list.length === 1 ? "property" : "properties"} found`;
    grid.innerHTML = list.map(card).join("");
    empty.hidden = properties.length !== 0;
    noResults.hidden = properties.length === 0 || list.length !== 0;
    grid.hidden = list.length === 0;
    saveProperties();
  }
  function propertyById(id) { return properties.find(p => String(p.id) === String(id)); }
  function showDetails(p) {
    if (!p || !dialog) return;
    dialogContent.innerHTML = `<div class="detail-gallery">${p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}">` : '<div class="property-image-placeholder">THE NXT REALTY</div>'}</div>
      <div class="detail-content"><p class="eyebrow">${escapeHTML(p.location)} · ${escapeHTML(p.type || "Property")}</p><h2>${escapeHTML(p.title)}</h2><p class="detail-price">${escapeHTML(p.price || "Price on request")}</p>
      <div class="detail-facts">${p.bhk ? `<span><b>${escapeHTML(p.bhk)} BHK</b><small>Configuration</small></span>` : ''}${p.area ? `<span><b>${escapeHTML(p.area)}</b><small>Area</small></span>` : ''}${p.builder ? `<span><b>${escapeHTML(p.builder)}</b><small>Developer</small></span>` : ''}</div>
      <h3>About this property</h3><p>${escapeHTML(p.description || p.details || "Contact The NXT Realty for verified project details, availability and documentation.")}</p>
      <p class="detail-disclaimer">Please confirm current pricing, availability, approvals and possession details with our team before making a decision.</p>
      <button type="button" class="button button-dark detail-enquire" data-enquire="${escapeHTML(p.id)}">Enquire about this property ↗</button></div>`;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open","");
  }
  grid.addEventListener("click", event => {
    const saveButton = event.target.closest("[data-save]");
    const detailButton = event.target.closest("[data-details]");
    const enquireButton = event.target.closest("[data-enquire]");
    if (saveButton) {
      const id = String(saveButton.dataset.save);
      saved.has(id) ? saved.delete(id) : saved.add(id);
      render();
    }
    if (detailButton) showDetails(propertyById(detailButton.dataset.details));
    if (enquireButton) {
      const p = propertyById(enquireButton.dataset.enquire);
      if (p) whatsapp(`Hello The NXT Realty, I am interested in ${p.title} in ${p.location}. Please share verified pricing, availability, floor plans and project details.`);
    }
  });
  dialogContent?.addEventListener("click", event => {
    const button = event.target.closest("[data-enquire]");
    if (button) {
      const p = propertyById(button.dataset.enquire);
      if (p) whatsapp(`Hello The NXT Realty, I am interested in ${p.title} in ${p.location}. Please share verified pricing, availability and project details.`);
    }
  });
  $("dialogClose")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  [search,locationFilter,typeFilter,purposeFilter,bhkFilter,budgetFilter,sortFilter].forEach(el => el?.addEventListener("input", render));
  $("savedToggle")?.addEventListener("click", () => { savedOnly = !savedOnly; $("savedToggle").classList.toggle("active", savedOnly); render(); });
  document.querySelectorAll("[data-collection]").forEach(button => button.addEventListener("click", () => {
    activeCollection = activeCollection === button.dataset.collection ? "" : button.dataset.collection;
    document.querySelectorAll("[data-collection]").forEach(b => b.classList.toggle("active", b.dataset.collection === activeCollection));
    render();
  }));
  async function loadProperties() {
    if (!supabaseLib?.createClient || !config.supabaseUrl || !config.supabaseAnonKey) {
      status.textContent = "Listings are temporarily unavailable. Please contact our team.";
      empty.hidden = false; return;
    }
    try {
      const client = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const {data,error} = await client.from("properties").select("*").eq("status","active").order("featured",{ascending:false}).order("created_at",{ascending:false});
      if (error) throw error;
      properties = (data || []).map(p => ({
        id:p.id, title:p.title, location:p.location, type:p.property_type || p.type || "Property",
        price:p.price, details:p.details, description:p.description, image:p.image_url || p.image,
        bhk:p.bhk || "", area:p.area || "", featured:Boolean(p.featured), builder:p.builder || p.developer || "",
        purpose:p.purpose || p.listing_type || "", createdAt:p.created_at, statusText:p.status
      }));
      fillFilters();
      if (!properties.length) { status.textContent = "No published properties yet"; empty.hidden = false; }
      render();
    } catch (error) {
      console.error("Unable to load public property listings:", error);
      status.textContent = "We couldn’t load listings right now. Please contact us for current availability.";
      empty.hidden = false;
      empty.textContent = "Our team can share the latest available properties directly. Please use the enquiry form below.";
    }
  }
  loadProperties();
})();