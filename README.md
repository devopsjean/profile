# Profile Site

Static profile website built with React + Vite and deployed via GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Public URL

- Expected Pages URL: `https://devopsjean.github.io/profile/`

## Deployment

- Deployment is automated by `.github/workflows/deploy.yml`.
- Every push to `main` triggers build + Pages deploy.
- In GitHub repo settings, ensure **Pages -> Build and deployment -> Source** is set to **GitHub Actions**.
