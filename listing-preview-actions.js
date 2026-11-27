(() => {
  const dialog = document.querySelector('#enquiry-modal');
  const form = document.querySelector('#preview-enquiry-form');
  const config = form?.elements.configuration;
  if (!dialog || !form || !config) return;

  document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(!img.isConnected)return;const fallback=document.createElement('span');fallback.className='preview-image-fallback';fallback.setAttribute('role','img');fallback.setAttribute('aria-label',img.alt||'Image unavailable');fallback.textContent='Image temporarily unavailable';img.replaceWith(fallback);},{once:true}));

  const modalTitle = dialog.querySelector('#modal-title');
  const defaultTitle = modalTitle.innerHTML;
  const previewNote = dialog.querySelector('.preview-note');
  const defaultNote = previewNote.textContent;
  const mapUrl = document.querySelector('#location .text-link')?.href;
  const topics = {
    pricing: 'Ask about<br><em>pricing & availability.</em>',
    amenities: 'Ask about<br><em>amenities.</em>',
    gallery: 'Ask about<br><em>the gallery.</em>',
    location: 'Ask about<br><em>the location.</em>',
    tour: 'Request a<br><em>private tour.</em>',
    advisor: 'Speak with<br><em>an advisor.</em>'
  };
  const touchInput = matchMedia('(hover: none), (pointer: coarse)');
  let pendingMapIntent = null;

  function selectedConfiguration(source) {
    const card = source.closest('.config-card, .plan-card');
    return card?.querySelector('.config-title')?.textContent.trim()
      || card?.querySelector('.plan-caption b')?.textContent.match(/\b\d+(?:\.\d+)?\s*BHK\b/i)?.[0]
      || source.dataset.config
      || '';
  }

  function openEnquiry(source, explicitTopic = '', options = {}) {
    if (options.mapRedirect) {
      const toast = document.querySelector('#preview-toast');
      toast?.classList.remove('is-visible');
      if (toast) toast.textContent = '';
      dialog.querySelector('.map-save-status')?.remove();
    }
    const selection = selectedConfiguration(source);
    config.value = selection;
    const section = source.closest('section');
    const topic = explicitTopic || source.dataset.topic
      || (section?.id === 'residences' ? 'pricing'
        : section?.id === 'amenities' ? 'amenities'
        : section?.id === 'gallery' ? 'gallery'
        : section?.id === 'location' ? 'location'
        : section?.id === 'tour' ? 'tour'
        : source.classList.contains('header-cta') ? 'advisor' : '');
    modalTitle.innerHTML = selection
      ? `Ask about<br><em>${selection}.</em>`
      : topic ? topics[topic] : defaultTitle;
    previewNote.textContent = options.mapRedirect
      ? 'YOUR ENQUIRY WILL BE SAVED BEFORE GOOGLE MAPS OPENS'
      : defaultNote;
    pendingMapIntent = options.mapRedirect ? { url: options.mapRedirect, cancelled: false } : null;
    dialog.showModal();
    form.querySelector('[name="name"]')?.focus();
  }

  function addCardAction(card, kind) {
    card.classList.add('enquiry-card');
    const selection = selectedConfiguration(card);
    const label = kind === 'map' ? 'the project location'
      : kind === 'plan' ? `${selection || 'this'} floor plan`
      : selection || 'this configuration';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-enquire';
    button.textContent = 'ENQUIRE NOW';
    button.setAttribute('aria-label', `Enquire now about ${label}`);
    button.addEventListener('click', event => {
      event.stopPropagation();
      openEnquiry(card, kind === 'map' ? 'location' : '');
    });
    card.append(button);

    card.addEventListener('click', event => {
      if (!touchInput.matches || event.target.closest('a,button,input,select,textarea')) return;
      card.classList.toggle('is-revealed');
    });
  }

  document.addEventListener('click', event => {
    const mapLink = event.target.closest('#location .text-link');
    if (mapLink) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEnquiry(mapLink, 'location', { mapRedirect: mapUrl });
      return;
    }
    const anchor = event.target.closest('a[href="#enquire"]');
    if (!anchor) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEnquiry(anchor);
  }, true);

  document.querySelectorAll('.config-card').forEach(card => addCardAction(card, 'configuration'));
  document.querySelectorAll('.plan-card').forEach(card => addCardAction(card, 'plan'));
  const mapCard = document.querySelector('.map-card');
  if (mapCard) addCardAction(mapCard, 'map');

  const grid = document.querySelector('#residences .config-grid');
  if (grid && !document.querySelector('#residences [data-topic="pricing"]')) {
    const link = document.createElement('a');
    link.className = 'section-enquire pricing-enquire';
    link.href = '#enquire';
    link.dataset.topic = 'pricing';
    link.textContent = 'Ask about pricing & availability ↗';
    grid.insertAdjacentElement('afterend', link);
  }

  function showMapStatus(message, isError = false) {
    let status = dialog.querySelector('.map-save-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'map-save-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.querySelector('.modal-submit')?.insertAdjacentElement('beforebegin', status);
    }
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  dialog.addEventListener('close', () => {
    if (pendingMapIntent) {
      pendingMapIntent.cancelled = true;
      pendingMapIntent.popup?.close();
    }
    pendingMapIntent = null;
    previewNote.textContent = defaultNote;
  });

  form.addEventListener('submit', async event => {
    const intent = pendingMapIntent;
    if (!intent) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;

    const name = String(form.elements.name.value || '').trim();
    const phone = String(form.elements.mobile.value || '').trim();
    const email = String(form.elements.email.value || '').trim();
    const selected = String(config.value || '').trim();
    const consent = form.elements.consent.checked;
    if (!name || !phone || !consent) return;

    // Open a blank tab from the submit gesture so browser popup blockers allow
    // the eventual post-save navigation; failed, cancelled, or closed flows close it.
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      showMapStatus('Allow a new tab to open, then submit again. Your enquiry was not sent.', true);
      return;
    }
    intent.popup = popup;
    const submit = form.querySelector('.modal-submit');
    submit.disabled = true;
    showMapStatus('Saving your enquiry…');
    try {
      const settings = window.NXT_CONFIG;
      if (!settings?.SUPABASE_URL || !settings?.SUPABASE_ANON_KEY) {
        throw new Error('Enquiry service is unavailable.');
      }
      const message = [
        'Requested directions to Sai World Dreams via Google Maps.',
        selected ? `Configuration: ${selected}.` : '',
        email ? `Email: ${email}.` : ''
      ].filter(Boolean).join(' ');
      const response = await fetch(`${settings.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          apikey: settings.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${settings.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
        name,
        phone,
        requirement: 'Google Maps directions',
        preferred_location: 'Dombivli, Maharashtra',
        message,
        source: 'listing_preview_maps',
        consent: true,
        status: 'new'
        })
      });
      if (!response.ok) throw new Error(`Enquiry save failed (${response.status}).`);

      if (intent.cancelled || pendingMapIntent !== intent || !dialog.open) {
        popup.close();
        return;
      }
      pendingMapIntent = null;
      popup.opener = null;
      popup.location.href = intent.url;
      showMapStatus('Your enquiry has been saved. Google Maps is opening in a new tab.');
      dialog.close();
      form.reset();
      if (typeof window.notify === 'function') window.notify('Your enquiry has been saved.');
    } catch (error) {
      popup.close();
      if (!intent.cancelled && pendingMapIntent === intent && dialog.open) {
        showMapStatus('We could not save your enquiry, so Google Maps was not opened. Please try again.', true);
      }
    } finally {
      submit.disabled = false;
    }
  }, true);

  document.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
