# AED Empire Shopify Theme

Custom Shopify theme for AED Empire - AED and medical equipment e-commerce store.

**Version:** 1.0.0
**Author:** Nate Bullock

## Theme Structure

```
├── assets/          # CSS and JavaScript files
├── config/          # Theme settings (settings_schema.json, settings_data.json)
├── layout/          # Theme layouts (theme.liquid, password.liquid)
├── locales/         # Translation files (en.default.json)
├── sections/        # Reusable theme sections
├── snippets/        # Reusable code snippets
└── templates/       # Page templates (JSON templates)
```

## Key Sections

- **Header & Footer** - Site navigation and footer
- **Hero & Slideshow** - Homepage hero banners
- **Featured Collection** - Product showcases
- **Product Comparison** - Compare AED models
- **Compliance Badges** - Medical certifications display
- **Trust Bar** - Build customer trust
- **FAQ** - Frequently asked questions
- **Quote Request** - B2B quote functionality
- **Bulk Order** - Bulk ordering form
- **Testimonials** - Customer reviews
- **Newsletter** - Email signup

## Development

### Local Development

Use [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) for local development:

```bash
shopify theme dev --store your-store.myshopify.com
```

### Deploying

Push theme to Shopify:

```bash
shopify theme push
```

## Theme Customization

Access theme settings in your Shopify admin:
**Online Store > Themes > Customize**

Configurable options include:
- Logo and branding
- Colors and typography
- Social media links
- Header/footer settings
- Section-specific settings
