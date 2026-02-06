# Eltham Green Community Church - SvelteKit 5 + Tailwind CSS

A modern church website for Eltham Green Community Church (EGCC) built with SvelteKit 5 and Tailwind CSS.

## Features

- **SvelteKit 5** - Modern full-stack framework
- **Tailwind CSS** - Utility-first CSS framework
- **Responsive Design** - Mobile-first approach
- **Smooth Scrolling** - Native smooth scroll navigation
- **Image Lightbox** - Interactive menu item viewer
- **Carousel Sliders** - Hero slider and testimonials carousel
- **Form Validation** - Contact form with client-side validation
- **Component-Based Architecture** - Modular, reusable components

## Project Structure

```
├── src/
│   ├── lib/
│   │   └── components/
│   │       ├── About.svelte
│   │       ├── Contact.svelte
│   │       ├── Footer.svelte
│   │       ├── Hero.svelte
│   │       ├── Menu.svelte
│   │       ├── Navbar.svelte
│   │       ├── Preloader.svelte
│   │       ├── Team.svelte
│   │       └── Testimonial.svelte
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   ├── app.css
│   ├── app.d.ts
│   └── app.html
├── static/
│   └── images/
│       └── (all image assets)
├── package.json
├── svelte.config.js
├── tailwind.config.js
└── vite.config.ts
```

## Getting Started

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The site will be available at `http://localhost:5173`

### Build

Build for production:

```bash
npm run build
```

### Preview

Preview the production build:

```bash
npm run preview
```

## Components

### Navbar
Responsive navigation bar with smooth scroll links and mobile menu. Features church branding and contact information.

### Hero
Image carousel slider with automatic rotation showcasing church messaging, worship times, and community involvement.

### About
Two-column layout sharing the church's story, mission, and welcoming message.

### Leadership
Leadership team cards featuring pastors and ministry leaders with hover effects and contact information.

### Services
Grid layout showcasing church services and programs including worship times, Bible study, youth group, and more.

### Testimonial
Carousel of member testimonials sharing their experiences with the church community.

### Contact
Contact form with Google Maps integration (Eltham, London) and form validation for inquiries and prayer requests.

### Footer
Multi-column footer with church address, contact information, service times, and social media links.

## Styling

The project uses Tailwind CSS for styling. Custom colors and fonts are defined in `tailwind.config.js`:

- Primary color: `#2d7a32` (green - reflecting "Green" in church name)
- Primary dark: `#1e5a22` (darker green)
- Font: Montserrat (Google Fonts)

## Notes

- All images are stored in the `static/images/` directory
- Font Awesome icons are loaded via CDN
- The contact form currently simulates submission (replace with actual API endpoint or email service)
- Smooth scrolling is implemented natively without jQuery
- All animations are CSS-based for better performance
- Google Maps embed shows Eltham, London (update with exact church location coordinates)
- Service times and contact information should be verified and updated as needed

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge)

