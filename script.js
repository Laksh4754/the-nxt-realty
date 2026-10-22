(() => {
  const config = window.NXT_CONFIG || {};
  const grid = document.getElementById("propertyGrid");
  if (!grid) return;
  const empty = document.getElementById("emptyState");
  const noResults = document.getElementById("noResults");
  const count = document.getElementById("listingStatus");
  const search = document.getElementById("propertySearch");
  const locationFilter = document.getElementById("locationFilter");
  const typeFilter = document.getElementById("typeFilter");
  const supabaseLib = window.supabase;
  let properties = [];
  document.getElementById("year")?.replaceChildren(document.createTextNode(String(new Date().getFullYear())));

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"})[char]);
  }
  function whatsapp(message) {
    const number = String(config.whatsappNumber || "918108556994").replace(/\D/g, "");
    if (!number) { alert("Please contact The NXT Realty to enquire about this property."); return; }
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }
  function fillFilters() {
    const locations = [...new Set(properties.map(p => p.location).filter(Boolean))].sort();
    const types = [...new Set(properties.map(p => p.type).filter(Boolean))].sort();
    locationFilter.innerHTML = '<option value="">All locations</option>' + locations.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
    typeFilter.innerHTML = '<option value="">All types</option>' + types.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
  }
  function render() {
    const q = search.value.trim().toLowerCase(), loc = locationFilter.value, type = typeFilter.value;
    const filtered = properties.filter(p => [p.title,p.location,p.type,p.details,p.description].join(" ").toLowerCase().includes(q) && (!loc || p.location === loc) && (!type || p.type === type));
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "property" : "properties"} available`;
    grid.innerHTML = filtered.map(p => `<article class="property-card">
      ${p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" loading="lazy" onerror="this.hidden=true">` : '<div class="property-image-placeholder">THE NXT REALTY</div>'}
      <div class="property-card-body"><div class="property-location">${escapeHTML(p.location)}${p.type ? ' · ' + escapeHTML(p.type) : ''}</div><h4>${escapeHTML(p.title)}</h4><div class="property-price">${escapeHTML(p.price || "Price on request")}</div><p class="property-details">${escapeHTML(p.details || p.description || "Contact us for project details.")}</p><button class="button button-dark" type="button" data-property="${escapeHTML(p.id)}">Enquire on WhatsApp <span>↗</span></button></div></article>`).join("");
    empty.hidden = properties.length !== 0;
    noResults.hidden = properties.length === 0 || filtered.length !== 0;
    grid.hidden = filtered.length === 0;
    grid.querySelectorAll("[data-property]").forEach(button => button.addEventListener("click", () => {
      const p = properties.find(item => String(item.id) === button.dataset.property);
      if (p) whatsapp(`Hello The NXT Realty, I am interested in ${p.title} in ${p.location}. Please share verified pricing, availability and project details.`);
    }));
  }
  [search, locationFilter, typeFilter].forEach(el => el.addEventListener("input", render));
  async function loadProperties() {
    if (!supabaseLib?.createClient || !config.supabaseUrl || !config.supabaseAnonKey) {
      count.textContent = "Property listings are temporarily unavailable. Please enquire with our team."; empty.hidden = false; return;
    }
    try {
      const client = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data, error } = await client.from("properties").select("id,title,location,property_type,price,details,description,image_url,bhk,area,featured,created_at").eq("status", "active").order("featured", {ascending:false}).order("created_at", {ascending:false});
      if (error) throw error;
      properties = (data || []).map(p => ({ id:p.id, title:p.title, location:p.location, type:p.property_type, price:p.price, details:[p.bhk,p.area].filter(Boolean).join(" · ") || p.details, description:p.description, image:p.image_url }));
      fillFilters(); render();
    } catch (error) {
      console.error("Unable to load public property listings:", error);
      count.textContent = "We couldn’t load listings right now. Please contact us for current availability.";
      empty.hidden = false; empty.textContent = "Our team can share the latest available properties directly. Please use the enquiry form below.";
    }
  }
  loadProperties();
})();
