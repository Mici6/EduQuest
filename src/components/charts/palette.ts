/**
 * Chart colours. Multi-series charts use the categorical order below, which
 * was validated (lightness band, chroma, CVD separation, contrast) against the
 * dark card surface #141B2B. Single-series charts use the brand gold.
 */
export const SERIES = ["#E86B25", "#8A78FA", "#1FA37A"] as const;
export const SINGLE = "#FFD34D";
export const SURFACE = "#141B2B";
export const GRID = "rgba(255,255,255,0.06)";
export const AXIS = "#707C91";
