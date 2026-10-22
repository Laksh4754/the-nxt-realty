# The NXT Realty website

A responsive static website preview for The NXT Realty, styled in navy and gold and designed to turn social-media visitors into property enquiries.

## Open locally
1. Extract this folder.
2. Open the folder in Visual Studio Code.
3. If you have the Live Server extension, right-click `index.html` and choose **Open with Live Server** (or click **Go Live**).
4. The preview runs on your computer. It does not change your live GitHub Pages website.

## Included
- Responsive homepage and mobile navigation
- Hero image and illustrative property imagery
- Location and property-type shortcuts that prefill the enquiry form
- Short enquiry form with WhatsApp hand-off
- WhatsApp chat button configured for the business number provided by the owner
- Buyer guide, FAQs, and privacy information page

## Important before publishing
- The number in `app.js` is set to `918108556994` (international digits only). Verify it is the correct business WhatsApp account.
- The form opens WhatsApp with a pre-filled message. The visitor must press **Send**. This static site does not save submissions to a database or automatically email/store leads in Excel.
- Images are illustrative, not verified listings. Replace them with approved real property/project photos before advertising specific properties.
- Confirm all claims, project names, pricing, availability, RERA details, contact links and privacy terms before publishing or running ads.
- `privacy-policy.html` is a starter notice and should be reviewed against the business's actual practices.
- Google Fonts load from the internet; the site falls back to system fonts if unavailable.

## Files
- `index.html` — page content
- `styles.css` — design and responsive layout
- `app.js` — navigation and WhatsApp enquiry behaviour
- `privacy-policy.html` — starter privacy notice
- `assets/` — local image assets
