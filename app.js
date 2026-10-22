(() => {
  // Update this business WhatsApp number if it ever changes. International format, digits only.
  const WHATSAPP_NUMBER = '918108556994';
  const nav = document.getElementById('mainNav');
  const menuToggle = document.getElementById('menuToggle');
  menuToggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menuToggle.textContent = open ? '×' : '☰';
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open'); menuToggle?.setAttribute('aria-expanded', 'false');
    if (menuToggle) { menuToggle.textContent = '☰'; menuToggle.setAttribute('aria-label', 'Open navigation'); }
  }));
  document.getElementById('year').textContent = new Date().getFullYear();

  async function submitLead(lead, statusElement, button) {
    const endpoint = String((window.NXT_CONFIG || {}).googleSheetsWebAppUrl || "").trim();
    if (!endpoint) {
      statusElement.textContent = "Your form is ready, but lead storage is not connected yet. Please use Chat with us for now, or try again after setup is complete.";
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Submitting…";
    statusElement.textContent = "Submitting your enquiry securely…";
    try {
      await fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(lead) });
      statusElement.textContent = "Thank you! Your enquiry has been submitted. Our team will follow up with you.";
      document.getElementById("enquiryForm")?.reset();
    } catch (error) {
      console.error("Lead submission failed:", error);
      statusElement.textContent = "We couldn't submit your enquiry just now. Please try again or use Chat with us.";
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }
  function openWhatsApp(message) {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function scrollToContact() { document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); }
  function setSelect(name, value) {
    const select = document.querySelector(`[name="${name}"]`);
    if (select && [...select.options].some(option => option.value === value || option.text === value)) select.value = value;
  }
  document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => {
    setSelect('location', button.dataset.area === 'Another location' ? 'Another location' : button.dataset.area); scrollToContact();
  }));
  document.querySelectorAll('[data-requirement]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.requirement;
    setSelect('propertyType', value); if (value === 'Investment property') setSelect('requirement', value);
    scrollToContact();
  }));
  document.querySelectorAll('[data-guide]').forEach(button => button.addEventListener('click', () => {
    const guide = button.dataset.guide;
    setSelect('requirement', guide === 'Request project documents' ? 'Brochure / project documents' : guide === 'Help comparing projects' ? 'Help comparing projects' : 'Help me find a property');
    scrollToContact();
  }));
  document.getElementById('quickSearch')?.addEventListener('submit', event => {
    event.preventDefault();
    const type = document.getElementById('quickType').value;
    const area = document.getElementById('quickArea').value;
    setSelect('requirement', type === 'Buy a home' ? 'Buy a home' : type === 'Rent a property' ? 'Rent a property' : type === 'Sell a property' ? 'Sell a property' : 'Investment property');
    if (area) setSelect('location', area === 'Other' ? 'Another location' : area);
    scrollToContact();
  });
  document.getElementById('enquiryForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = key => String(data.get(key) || '').trim();
    const phone = get('phone');
    const status = document.getElementById('formMessage');
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      const phoneField = form.querySelector('[name="phone"]');
      phoneField.setCustomValidity("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
      phoneField.reportValidity();
      phoneField.addEventListener("input", () => phoneField.setCustomValidity(""), { once: true });
      return;
    }
    const button = form.querySelector('[type="submit"]');
    submitLead({
      source: "Property Enquiry Form",
      name: get('name'),
      phone,
      email: get('email'),
      location: get('location'),
      requirement: get('requirement'),
      propertyType: get('propertyType'),
      budget: get('budget'),
      page: window.location.href
    }, status, button);
  });
})();
