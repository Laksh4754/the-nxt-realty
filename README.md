# The NXT Realty website

A responsive, static website for **The NXT Realty**, styled in premium navy and gold with the existing logo and brand artwork. It is built with plain HTML, CSS and JavaScript and can be hosted free on GitHub Pages.

## Before publishing

1. Open `config.js` in a text editor.
2. Add the confirmed business WhatsApp number in international format, digits only (India example format: `91XXXXXXXXXX`), and/or a public business email address.
3. Open `properties.js` and add only verified property listings that you are authorised to advertise. Put property photos in `assets/` and use their relative paths, e.g. `assets/kalyan-flat.jpg`.
4. Do not put private bank details, identity documents or client paperwork on the public website.
5. Preview locally by opening `index.html` in a browser. For a better local preview, use VS Code with the Live Server extension.

## Add a property

In `properties.js`, add objects to the `window.NXT_PROPERTIES` array. Example structure (replace with verified details):

```js
{
  id: "property-001",
  title: "Verified property title",
  location: "Kalyan",
  type: "Apartment",
  price: "₹ 00 lakh",
  details: "2 BHK · 000 sq ft",
  image: "assets/your-property-photo.jpg",
  description: "Verified description"
}
```

Allowed location filter labels: `Mumbai`, `Navi Mumbai`, `Ambernath`, `Badlapur`, `Kalyan`.
Allowed property type labels: `Apartment`, `House`, `Plot`, `Commercial`.

## Publish free with GitHub Pages

1. Create or sign in to a GitHub account at https://github.com/.
2. Choose **New repository**. Name it `the-nxt-realty` and make it **Public** for the free GitHub Pages setup.
3. Extract this ZIP on your computer. Open the new repository on GitHub, choose **Add file → Upload files**, and upload the *contents* of this folder (make sure `index.html` is at the repository root, not inside another folder).
4. Commit the upload.
5. Open the repository **Settings → Pages**.
6. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/(root)`, then click **Save**.
7. Wait for GitHub Pages to finish deploying. Your site URL will usually be `https://YOUR-USERNAME.github.io/the-nxt-realty/`.
8. Test it on your phone and laptop. After changes, upload the updated files and commit again.

## Important

- GitHub Pages is static hosting. The search filters work on the listings you add, but there is no private admin panel or database in this starter version.
- A custom domain is optional and generally costs money. Use the free GitHub Pages URL initially.
- The contact form hands the enquiry to WhatsApp or email after you add a confirmed contact in `config.js`; it does not silently collect or store customer data.
- No property listings or business contact numbers have been invented in this starter version.
