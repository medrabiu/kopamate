"use client";

import dynamic from "next/dynamic";

/**
 * The interactive graphical screens, each in its own chunk. next/dynamic only splits code when called from a
 * client module, so the pages import these instead of the components: text mode never downloads them.
 */
export const LazyPlanScene = dynamic(() => import("./PlanScene"));
export const LazyMarketStreet = dynamic(() => import("./MarketStreet"));
export const LazyBarberInterior = dynamic(() => import("./BarberInterior"));
