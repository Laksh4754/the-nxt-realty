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
    const message = [
      'Hello The NXT Realty, I would like to make a property enquiry.', '',
      `Name: ${get('name')}`,
      `Phone: ${get('phone')}`,
      get('email') ? `Email: ${get('email')}` : '',
      `Preferred location: ${get('location') || 'Not specified'}`,
      `Requirement: ${get('requirement') || 'Help me find a property'}`,
      `Property type: ${get('propertyType') || 'Not decided yet'}`,
      `Budget: ${get('budget') || 'Not specified'}`,
      '', 'Please let me know the next steps. Thank you.'
    ].filter(Boolean).join('\n');
    const status = document.getElementById('formMessage');
    status.textContent = 'WhatsApp is opening with your enquiry details. Please review the message and press Send to contact The NXT Realty.';
    openWhatsApp(message);
  });
})();
