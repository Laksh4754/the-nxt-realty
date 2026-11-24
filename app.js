(() => {
  const cfg = window.NXT_CONFIG || {};
  const hasSupabase = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_") && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const db = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const whatsapp = (cfg.WHATSAPP_NUMBER || "917208015614").replace(/\D/g, "");
  // Apply configured WhatsApp number to all homepage contact links
const defaultMessage = "Hello The NXT Realty, I'd like help finding a property.";

document.querySelector("#contactWhatsApp")?.setAttribute(
  "href", `https://wa.me/${whatsapp}`
);

document.querySelector(".footer-contact")?.setAttribute(
  "href", `https://wa.me/${whatsapp}`
);

document.querySelector(".floating-wa")?.setAttribute(
  "href", `https://wa.me/${whatsapp}?text=${encodeURIComponent(defaultMessage)}`
);
  const $ = s => document.querySelector(s);
  const money = n => {
    if (n === null || n === undefined || n === "") return "Price on request";
    const x = Number(n);
    if (!Number.isFinite(x)) return "Price on request";
    if (x >= 10000000) return `₹${(x/10000000).toFixed(2).replace(/\.00$/,"")} Cr`;
    if (x >= 100000) return `₹${(x/100000).toFixed(1).replace(/\.0$/,"")} L`;
    return `₹${x.toLocaleString("en-IN")}`;
  };
  const safe = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let properties = [];
  let activeCategory = "All";

  function propertyCard(p) {
    const image = p.image_url || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80";
    const kind = p.listing_type || "Property";
    const configLabels = Array.isArray(p.configurations) ? p.configurations.map(c => c.label).filter(Boolean) : [];
    const specs = [configLabels.length ? configLabels.join(" · ") : p.property_type, p.carpet_area ? `${Number(p.carpet_area).toLocaleString("en-IN")} ${p.area_unit || "sq.ft."}` : "", p.bedrooms ? `${p.bedrooms} Bed` : ""].filter(Boolean);
    return `<article class="property-card" data-id="${safe(p.id)}" tabindex="0" role="link" aria-label="View ${safe(p.project_name || p.title)}">
      <div class="property-photo"><img src="${safe(image)}" alt="${safe(p.project_name || p.title)}" loading="lazy"><span class="tag ${p.featured ? "gold" : ""}">${safe(kind)}</span><span class="photo-count">View details ↗</span></div>
      <div class="property-info"><div class="property-location">${safe(p.locality || p.location || "Mumbai Metropolitan Region")}</div>
      <h3>${safe(p.project_name || p.title || "Property listing")}</h3><p class="property-desc">${safe(p.description || "Contact us for more information about this property.")}</p>
      <div class="property-specs">${specs.map(s=>`<span>${safe(s)}</span>`).join("")}</div>
      <div class="property-bottom"><div><div class="price-label">ASKING PRICE</div><div class="price">${money(p.price)}</div></div><span class="card-arrow">↗</span></div></div></article>`;
  }

  function render(list) {
    const grid = $("#propertyGrid");
    grid.innerHTML = list.map(propertyCard).join("");
    $("#resultsCount").textContent = `${list.length} ${list.length === 1 ? "property" : "properties"} found`;
    $("#emptyState").classList.toggle("hidden", list.length !== 0);
    grid.classList.toggle("hidden", list.length === 0);
  }

  function filterProperties() {
    const location = $("#locationFilter").value;
    const purpose = $("#purposeFilter").value;
    const type = $("#typeFilter").value;
    const budget = Number($("#budgetFilter").value || 0);
    const minBudget = Number($("#minBudgetFilter")?.value || 0);
    let list = properties.filter(p => {
      const loc = `${p.location || ""} ${p.locality || ""}`.toLowerCase();
      const matchesLoc = !location || loc.includes(location.toLowerCase());
      const matchesPurpose = !purpose || (purpose === "Sale" ? (p.listing_type || "").toLowerCase() !== "rent" : (p.listing_type || "").toLowerCase() === "rent");
      const configText = Array.isArray(p.configurations) ? p.configurations.map(c => c.label || "").join(" ") : "";
      const matchesType = !type || `${p.property_type || ""} ${configText}`.toLowerCase().includes(type.toLowerCase().replace("+",""));
      const matchesBudget = (!budget || !p.price || Number(p.price) <= budget) && (!minBudget || !p.price || Number(p.price) >= minBudget);
      const matchesCategory = activeCategory === "All" || (p.listing_type || "").toLowerCase().includes(activeCategory.toLowerCase());
      return matchesLoc && matchesPurpose && matchesType && matchesBudget && matchesCategory;
    });
    const sort = $("#sortFilter")?.value || "featured";
    if (sort === "price-low") list.sort((a,b)=>(Number(a.price)||Infinity)-(Number(b.price)||Infinity));
    if (sort === "price-high") list.sort((a,b)=>(Number(b.price)||0)-(Number(a.price)||0));
    if (sort === "newest") list.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    if (sort === "featured") list.sort((a,b)=>Number(!!b.featured)-Number(!!a.featured));
    render(list);
  }

  async function loadProperties() {
    if (db) {
      const {data, error} = await db.from("properties").select("*").eq("status","published").order("featured",{ascending:false}).order("created_at",{ascending:false});
      if (!error && data) { properties = data; render(properties); return; }
      console.error("Supabase property query failed.", error);
      properties = [];
      render(properties);
      const count = $("#resultsCount"); if (count) count.textContent = "Listings are temporarily unavailable. Please try again shortly.";
      return;
    }
    properties = [];
    render(properties);
    const count = $("#resultsCount"); if (count) count.textContent = "Property database is not connected.";
  }

  function showDetails(id) {
    const p = properties.find(x => String(x.id) === String(id));
    if (!p) return;
    const image = p.image_url || "";
    $("#dialogContent").innerHTML = `<img class="dialog-photo" src="${safe(image)}" alt="${safe(p.project_name || p.title)}">
      <div class="dialog-body"><div class="property-location">${safe(p.locality || p.location || "")} · ${safe(p.listing_type || "")}</div>
      <h2>${safe(p.project_name || p.title)}</h2><div class="price">${money(p.price)}</div>
      <p>${safe(p.description || "Contact our team for complete property details.")}</p>
      <div class="dialog-meta">${p.property_type ? `<span>${safe(p.property_type)}</span>` : ""}${p.carpet_area ? `<span>${Number(p.carpet_area).toLocaleString("en-IN")} ${safe(p.area_unit || "sq.ft.")} carpet</span>` : ""}${p.bedrooms ? `<span>${safe(p.bedrooms)} bedrooms</span>` : ""}${p.bathrooms ? `<span>${safe(p.bathrooms)} bathrooms</span>` : ""}</div>
      <div class="dialog-actions"><a class="btn btn-navy" target="_blank" rel="noopener" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello The NXT Realty, I am interested in ${p.project_name || p.title} in ${p.location || ""}. Please share more details.`)}">Enquire on WhatsApp ↗</a><a class="btn btn-outline" href="#contact" id="detailContact">Request a callback</a></div></div>`;
    $("#propertyDialog").showModal();
    $("#detailContact")?.addEventListener("click", () => $("#propertyDialog").close());
  }

  $("#propertyGrid").addEventListener("click", e => {
    const card = e.target.closest(".property-card");
    if (card) {
      const item = properties.find(x => String(x.id) === String(card.dataset.id));
      if (db && item) location.href = `property.html?id=${encodeURIComponent(item.id)}`;
    }
  });
  $("#propertyGrid").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".property-card")) { e.preventDefault(); location.href = `property.html?id=${encodeURIComponent(e.target.dataset.id)}`; }
  });
  $("#dialogClose").addEventListener("click", () => $("#propertyDialog").close());
  $("#propertyDialog").addEventListener("click", e => { if (e.target === $("#propertyDialog")) $("#propertyDialog").close(); });
  $("#searchForm").addEventListener("submit", e => { e.preventDefault(); filterProperties(); $("#properties").scrollIntoView({behavior:"smooth"}); });
  $("#sortFilter")?.addEventListener("change", filterProperties);
  $("#quickFilters").addEventListener("click", e => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeCategory = btn.dataset.filter;
    $("#quickFilters").querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x===btn));
    filterProperties();
  });
  document.querySelectorAll("[data-location]").forEach(el => el.addEventListener("click", () => {
    $("#locationFilter").value = el.dataset.location;
    activeCategory = "All";
    $("#quickFilters").querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x.dataset.filter==="All"));
    filterProperties();
  }));
  $("#menuToggle").addEventListener("click", () => {
    const open = $("#mainNav").classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(open));
  });
  $("#mainNav").querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>$("#mainNav").classList.remove("open")));
  $("#year").textContent = new Date().getFullYear();

  $("#enquiryForm").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const consent = form.elements.consent?.checked === true;
    const note = $("#formNote");

    if (!consent) {
      note.textContent = "Please agree to the use of your details before submitting this enquiry.";
      form.elements.consent?.focus();
      return;
    }

    const message = `Hello The NXT Realty,\nI would like to make an enquiry.\nName: ${data.name}\nPhone: ${data.phone}\nInterested in: ${data.requirement}\nPreferred location: ${data.location}\nRequirement: ${data.message || "Not specified"}`;
    const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;

    // Open the tab during the user gesture so popup blockers do not swallow it.
    const whatsappWindow = window.open("about:blank", "_blank");
    note.textContent = "Submitting your enquiry…";

    if (db) {
      try {
        const { error } = await db.from("leads").insert({
          name: data.name,
          phone: data.phone,
          requirement: data.requirement,
          preferred_location: data.location,
          message: data.message || null,
          source: "website",
          consent: true,
          status: "new"
        });
        if (error) throw error;
        note.textContent = "Your enquiry has been recorded. WhatsApp is opening so you can continue the conversation.";
      } catch (error) {
        console.error("Lead submission failed", error);
        note.textContent = "We couldn't save your enquiry just now. WhatsApp will still open so you can contact us.";
      }
    } else {
      note.textContent = "The website database is not connected yet. WhatsApp is opening so you can contact us.";
    }

    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
    form.reset();
  });

  loadProperties();
})();
