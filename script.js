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
      if (p) {
        const requirement = document.querySelector('[name="requirement"]');
        const location = document.querySelector('[name="location"]');
        if (requirement) requirement.value = "Help me find a property";
        if (location) {
          const match = [...location.options].find(o => o.value === p.location || o.text === p.location);
          if (match) location.value = match.value;
        }
        const nameField = document.querySelector('#enquiryForm [name="name"]');
        if (nameField) nameField.dataset.interestedProperty = p.title;
        document.getElementById("contact")?.scrollIntoView({behavior:"smooth"});
        nameField?.focus({preventScroll:true});
      }
    }
  });
  dialogContent?.addEventListener("click", event => {
    const button = event.target.closest("[data-enquire]");
    if (button) {
      const p = propertyById(button.dataset.enquire);
      if (p) {
        const location = document.querySelector('#enquiryForm [name="location"]');
        if (location) {
          const match = [...location.options].find(o => o.value === p.location || o.text === p.location);
          if (match) location.value = match.value;
        }
        dialog?.close();
        document.getElementById("contact")?.scrollIntoView({behavior:"smooth"});
      }
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
  function formatINR(value) {
    return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value);
  }
  function calculateEMI() {
    const principal = Number($("emiAmount")?.value || 0);
    const annualRate = Number($("emiRate")?.value || 0);
    const years = Number($("emiYears")?.value || 0);
    if (!principal || !annualRate || !years || principal < 0 || annualRate <= 0 || years <= 0) return;
    const months = years * 12, rate = annualRate / 1200;
    const emi = principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1);
    $("emiOutput").textContent = formatINR(emi);
    $("emiBreakdown").textContent = "Total repayment: " + formatINR(emi * months) + " · Interest: " + formatINR(emi * months - principal);
  }
  ["emiAmount","emiRate","emiYears"].forEach(id => $(id)?.addEventListener("input", calculateEMI));
  calculateEMI();
  $("requirementForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const d = new FormData(form), get = key => String(d.get(key) || "").trim();
    const phone = get("needPhone");
    const phoneField = form.querySelector('[name="needPhone"]');
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      phoneField.setCustomValidity("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
      phoneField.reportValidity();
      phoneField.addEventListener("input", () => phoneField.setCustomValidity(""), { once: true });
      return;
    }
    const endpoint = String(config.googleSheetsWebAppUrl || "").trim();
    const message = $("requirementStatus") || form.querySelector(".tool-note");
    const button = form.querySelector('[type="submit"]');
    if (!endpoint) {
      message.textContent = "Lead storage is not connected yet. Please use Chat with us for now, or try again after setup is complete.";
      return;
    }
    const original = button.textContent;
    button.disabled = true; button.textContent = "Submitting…";
    message.textContent = "Submitting your requirement…";
    fetch(endpoint, {method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({
      source:"Property Brief Form",name:get("needName"),phone,email:"",
      requirement:get("needType"),location:get("needLocation"),propertyType:get("needBhk"),budget:get("needBudget"),page:window.location.href
    })}).then(() => {
      message.textContent = "Thank you! Your requirement has been submitted. Our team will follow up.";
      form.reset();
    }).catch(error => {
      console.error("Lead submission failed:",error);
      message.textContent = "We couldn't submit your requirement just now. Please try again or use Chat with us.";
    }).finally(() => {button.disabled=false;button.textContent=original;});
  });

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
      render();
    } catch (error) {
      console.error("Unable to load public property listings:", error);
      properties = [];
      fillFilters();
      render();
      status.textContent = "Listings are temporarily unavailable. Please contact our team.";
    }
  }
  loadProperties();
})();