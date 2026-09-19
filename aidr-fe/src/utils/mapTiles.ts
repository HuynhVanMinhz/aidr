import L from 'leaflet';

/**
 * Base layers for every Leaflet map in the app.
 *
 * `tile.openstreetmap.org` is unreachable from a lot of Vietnamese networks -
 * the request never resolves, so Leaflet paints its empty grey canvas and the
 * page looks broken. Tiles therefore come from a mirror, and the map walks down
 * the list when a source cannot be reached at all.
 */
type TileSource = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
};

/**
 * Keyless sources only. CARTO's basemaps now stamp "API KEY REQUIRED" across
 * every tile on the free endpoint, so it is not usable here at all.
 */
const SOURCES: TileSource[] = [
  {
    // OSM's German mirror: same data, and it answers on networks where
    // tile.openstreetmap.org does not.
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
  },
];

/** A source that never answers is only proven dead once several tiles have failed. */
const FAILURES_BEFORE_FALLBACK = 6;

function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export type BaseLayerHandle = {
  /** Detach the layer and stop watching the theme. */
  destroy: () => void;
};

/**
 * Add a base layer to <paramref name="map" />, keep it in step with the light /
 * dark theme, and walk down the source list if the current CDN is blocked.
 */
export function attachBaseLayer(map: L.Map): BaseLayerHandle {
  let layer: L.TileLayer | null = null;
  let sourceIndex = 0;
  let failures = 0;
  let anyTileLoaded = false;
  let disposed = false;

  function install() {
    if (disposed) return;

    const source = SOURCES[sourceIndex];
    if (!source) return;

    layer?.remove();
    failures = 0;
    anyTileLoaded = false;

    const next = L.tileLayer(source.url, {
      maxZoom: source.maxZoom,
      attribution: source.attribution,
      ...(source.subdomains ? { subdomains: source.subdomains } : {}),
    });

    next.on('tileload', () => {
      anyTileLoaded = true;
    });

    next.on('tileerror', () => {
      // A handful of missing tiles at the edge of a working map is normal; a
      // source that has never rendered anything is not.
      if (anyTileLoaded) return;
      failures += 1;
      if (failures < FAILURES_BEFORE_FALLBACK) return;
      if (sourceIndex >= SOURCES.length - 1) return;

      sourceIndex += 1;
      install();
    });

    next.addTo(map);
    layer = next;
  }

  /**
   * There is no keyless dark basemap, so the light tiles are inverted in CSS.
   * Only the tile pane is filtered - markers and route lines keep their colours.
   */
  function applyTheme() {
    map.getContainer().classList.toggle('leaflet-tiles-dark', isDark());
  }

  install();
  applyTheme();

  // The header toggle flips data-theme on <html>; the map should follow it.
  const observer = new MutationObserver(applyTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return {
    destroy() {
      disposed = true;
      observer.disconnect();
      layer?.remove();
      layer = null;
    },
  };
}
