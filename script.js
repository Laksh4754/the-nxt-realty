(() => {
  const config = window.NXT_CONFIG || {};
  const properties = Array.isArray(window.NXT_PROPERTIES) ? window.NXT_PROPERTIES : [];
  const grid = document.getElementById("propertyGrid");
  const empty = document.getElementById("emptyState");
  const noResults = document.getElementById("noResults");
  const count = document.getElementById("listingCount");
  const search = document.getElementById("propertySearch");
  const locationFilter = document.getElementById("locationFilter");
  const typeFilter = document.getElementById("typeFilter");

  document.getElementById("year").textContent = new Date().getFullYear();

  function whatsapp(message) {
    const number = String(config.whatsappNumber || "").replace(/\D/g, "");
    if (!number) {
      alert("Before launch, add The NXT Realty's WhatsApp number in config.js. Use country code + number, digits only.");
      return;
    }
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

  document.querySelectorAll("[data-whatsapp]").forEach(button => {
    button.addEventListener("click", () => {
      const kind = button.getAttribute("data-whatsapp");
      whatsapp(kind === "sell"
        ? "Hello The NXT Realty, I would like to discuss selling my property."
        : "Hello The NXT Realty, I am looking for a property to buy. Please let me know about available options.");
    });
  });

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function renderProperties() {
    const q = search.value.trim().toLowerCase();
    const loc = locationFilter.value;
    const type = typeFilter.value;
    const filtered = properties.filter(p => {
      const haystack = [p.title, p.location, p.type, p.details, p.description].join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (!loc || p.location === loc) && (!type || p.type === type);
    });
    count.textContent = String(filtered.length);
    grid.innerHTML = filtered.map(p => `
      <article class="property-card">
        <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" loading="lazy">
        <div class="property-card-body">
          <div class="location">${escapeHTML(p.location)} · ${escapeHTML(p.type)}</div>
          <h3>${escapeHTML(p.title)}</h3>
          <div class="price">${escapeHTML(p.price)}</div>
          <p class="meta">${escapeHTML(p.details || "")}</p>
          <button class="button button-navy" data-property="${escapeHTML(p.id)}">Enquire about property <span>↗</span></button>
        </div>
      </article>`).join("");
    grid.querySelectorAll("[data-property]").forEach(button => {
      button.addEventListener("click", () => {
        const p = properties.find(item => String(item.id) === button.dataset.property);
        if (p) whatsapp("Hello The NXT Realty, I am interested in " + p.title + " in " + p.location + ". Please share more details.");
      });
    });
    empty.hidden = properties.length > 0;
    noResults.hidden = properties.length === 0 || filtered.length > 0;
    grid.hidden = filtered.length === 0;
  }
  [search, locationFilter, typeFilter].forEach(el => el.addEventListener("input", renderProperties));
  renderProperties();

  const menuToggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));

  document.getElementById("contactForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = [
      "Hello The NXT Realty,",
      "Name: " + form.get("name"),
      "Enquiry: " + form.get("interest"),
      "Preferred area: " + (form.get("area") || "Not specified"),
      "Message: " + (form.get("message") || "Not specified")
    ].join("\n");
    const number = String(config.whatsappNumber || "").replace(/\D/g, "");
    if (number) {
      window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
      document.getElementById("formNote").textContent = "WhatsApp opened with your enquiry. Please press Send in WhatsApp to submit it.";
    } else if (config.contactEmail) {
      window.location.href = "mailto:" + config.contactEmail + "?subject=" + encodeURIComponent("Website enquiry — The NXT Realty") + "&body=" + encodeURIComponent(message);
      document.getElementById("formNote").textContent = "Your email app should open with the enquiry ready to send.";
    } else {
      alert("The contact form is ready, but the business WhatsApp number or email must be added in config.js before enquiries can be sent.");
    }
  });
})();