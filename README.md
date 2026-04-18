# MedChain Insight

A production-ready, deterministic simulation and analytics platform for public sector hospital supply chains. Built with Next.js 14 and Tailwind CSS as a static application (`output: 'export'`).

## Architecture & Features

This platform simulates 3 fiscal years (1,095 days) of synthetic supply chain data for a 1,200-bed tertiary hospital. All data generation is purely deterministic (seeded PRNG) and runs entirely in the browser without any backend.

### Key Capabilities

1. **Deterministic Data Engine**: Simulates daily consumption, procurement, expiration, and stockouts for 200 SKUs using `mulberry32` PRNG.
2. **Scenario Lab**: Interactive intervention modeling (e.g. extending procurement cycles, advance budget requests, LIFO-to-FIFO transition) simulating financial and operational impact over 5 years.
3. **SKU Intelligence**: Deep dive into individual SKUs with monthly consumption patterns and batch histories.
4. **Decision Tools**: Budget Blackout Survival Planner, Forecast Error Cost Calculator, and Pre-Positioning ROI Calculator.
5. **Technology Roadmap**: Extrapolates a phased solution rollout with CAPEX/OPEX modeling, payback ROI analysis, and risk management registry.

## Local Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# The app will be available at http://localhost:3000
```

## Production Build & Vercel Deployment

This project uses `output: 'export'` in `next.config.mjs` to generate a static site that can be served anywhere without a Node.js runtime.

```bash
# Build the application
npm run build

# The output will be inside the "out" directory.
```

### Deploying to Vercel

1. Push your repository to GitHub/GitLab/Bitbucket.
2. Go to your Vercel dashboard and click **Add New** -> **Project**.
3. Import your repository.
4. Vercel will automatically detect the **Next.js** framework.
5. In the Build and Output Settings, Next.js will automatically build and export the `out` directory as a static site.
6. Click **Deploy**.

## Tech Stack
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- UI Components: shadcn/ui & Radix UI
- Icons: Lucide React
- Charts: Recharts
- Date Handling: date-fns
- Static Export: Fully client-side logic
