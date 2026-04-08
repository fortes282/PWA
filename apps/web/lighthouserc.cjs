/**
 * Lighthouse CI — výkon a základní a11y skóre na vybrané URL.
 * Spusť po `pnpm -C apps/web build` z adresáře apps/web: `pnpm run test:lhci`
 * Výchozí port 3040 aby nekolidoval s `next dev` na :3000.
 */
const port = process.env.LHCI_PORT || "3040";
const origin = `http://localhost:${port}`;

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: { preset: "desktop" },
      startServerCommand: `pnpm exec next start -p ${port}`,
      startServerReadyPattern: `localhost:${port}`,
      url: [`${origin}/login`],
    },
    assert: {
      assertions: {
        "categories:accessibility": ["warn", { minScore: 0.82 }],
        "categories:performance": ["warn", { minScore: 0.35 }],
      },
    },
  },
};
