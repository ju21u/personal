(function () {
  "use strict";

  // Linear equirectangular projection fitted to the "Simple World Map" SVG's
  // own coordinate space (see project notes): x = A*lon + B, y = C*lat + D.
  const A = 2.417958, B = 409.520265;
  const C = -2.798534, D = 530.207041;
  const lonToX = (lon) => A * lon + B;
  const latToY = (lat) => C * lat + D;
  const xToLon = (x) => (x - B) / A;
  const yToLat = (y) => (y - D) / C;

  const svg = document.getElementById("worldMap");
  const stationLayer = document.getElementById("stationLayer");
  const domainLayer = document.getElementById("domainLayer");
  const panel = document.getElementById("mapPanel");
  const legend = document.querySelector(".map-legend");

  const NS = "http://www.w3.org/2000/svg";
  let queryMarker = null;

  const NETWORK_INFO = {
    TCCON: "Ground-based FTIR spectrometer measuring total column CO₂, CH₄ &amp; CO — used to validate satellite column retrievals.",
    "NOAA GML": "In-situ or flask-air sampling site in NOAA's Global Greenhouse Gas Reference Network.",
    SKYNET: "Sky-radiometer site measuring aerosol and cloud optical/microphysical properties.",
    AERONET: "NASA sun-photometer site measuring aerosol optical depth and column water vapor.",
    ICOS: "European atmospheric greenhouse-gas monitoring station (Integrated Carbon Observation System).",
    AGAGE: "In-situ station measuring halocarbons, N₂O and CH₄ at high precision — the reference network for Montreal Protocol gases.",
    NDACC: "Ground-based remote-sensing station (FTIR, lidar, spectrometer, or microwave radiometer) monitoring atmospheric composition change.",
    COCCON: "Portable EM27/SUN FTIR spectrometer site measuring column CO₂ &amp; CH₄ — a lower-cost, mobile counterpart to TCCON.",
  };

  function renderStations(list, network, className) {
    list.forEach((s) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", lonToX(s.lon).toFixed(2));
      c.setAttribute("cy", latToY(s.lat).toFixed(2));
      c.setAttribute("r", 2.2);
      c.setAttribute("class", "station-dot " + className);
      c.dataset.name = s.name;
      c.dataset.country = s.country || "";
      c.dataset.lat = s.lat;
      c.dataset.lon = s.lon;
      c.dataset.network = network;
      c.dataset.cls = className;
      if (s.status) c.dataset.status = s.status;
      stationLayer.appendChild(c);
    });
  }

  renderStations(TCCON_STATIONS, "TCCON", "tccon");
  renderStations(NOAA_GML_STATIONS, "NOAA GML", "noaa");
  renderStations(SKYNET_STATIONS, "SKYNET", "skynet");
  renderStations(AERONET_STATIONS, "AERONET", "aeronet");
  renderStations(ICOS_STATIONS, "ICOS", "icos");
  renderStations(AGAGE_STATIONS, "AGAGE", "agage");
  renderStations(NDACC_STATIONS, "NDACC", "ndacc");
  renderStations(COCCON_STATIONS, "COCCON", "coccon");

  // Layer visibility toggles (ground networks)
  legend.querySelectorAll('input[data-layer]').forEach((cb) => {
    const apply = () => {
      stationLayer.querySelectorAll(".station-dot." + cb.dataset.layer).forEach((dot) => {
        dot.style.display = cb.checked ? "" : "none";
      });
    };
    apply();
    cb.addEventListener("change", apply);
  });

  // Model + satellite coverage domain boxes. `group` lets several real
  // sub-regions (e.g. MethaneSAT's named target basins) share one legend
  // checkbox and color while still listing their own name/note when clicked.
  const ALL_DOMAINS = MODEL_DOMAINS.concat(SATELLITE_DOMAINS);

  ALL_DOMAINS.forEach((dom) => {
    const cls = (dom.group || dom.name).replace(/\s+/g, "-");
    let el;
    if (dom.global) {
      el = document.createElementNS(NS, "rect");
      el.setAttribute("x", 0);
      el.setAttribute("y", 240);
      el.setAttribute("width", 850);
      el.setAttribute("height", 550);
    } else {
      const x = lonToX(dom.lonMin);
      const w = lonToX(dom.lonMax) - x;
      const y = latToY(dom.latMax);
      const h = latToY(dom.latMin) - y;
      el = document.createElementNS(NS, "rect");
      el.setAttribute("x", x.toFixed(2));
      el.setAttribute("y", y.toFixed(2));
      el.setAttribute("width", w.toFixed(2));
      el.setAttribute("height", h.toFixed(2));
    }
    el.setAttribute("class", "domain-box " + cls);
    el.style.display = "none";
    el.dataset.domain = dom.group || dom.name;
    domainLayer.appendChild(el);
  });

  legend.querySelectorAll('input[data-domain]').forEach((cb) => {
    const apply = () => {
      domainLayer.querySelectorAll(`[data-domain="${cb.dataset.domain}"]`).forEach((el) => {
        el.style.display = cb.checked ? "" : "none";
      });
    };
    apply();
    cb.addEventListener("change", apply);
  });

  function setAllLayers(checked) {
    legend.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  document.getElementById("selectAllLayers").addEventListener("click", () => setAllLayers(true));
  document.getElementById("deselectAllLayers").addEventListener("click", () => setAllLayers(false));

  function domainsCovering(lat, lon) {
    return ALL_DOMAINS.filter((dom) => {
      if (dom.global) return true;
      return lat >= dom.latMin && lat <= dom.latMax && lon >= dom.lonMin && lon <= dom.lonMax;
    });
  }

  function showStationPanel(dot) {
    const { name, country, lat, lon, network, status, cls } = dot.dataset;
    panel.innerHTML = `
      <span class="panel-tag panel-tag-${cls}">${network}</span>
      <h3>${name}</h3>
      ${country ? `<p class="panel-meta">${country}</p>` : ""}
      <dl>
        <dt>Latitude</dt><dd>${Number(lat).toFixed(3)}&deg;</dd>
        <dt>Longitude</dt><dd>${Number(lon).toFixed(3)}&deg;</dd>
        ${status ? `<dt>Status</dt><dd>${status}</dd>` : ""}
      </dl>
      <p class="muted small" style="margin-top:14px;">${NETWORK_INFO[network] || ""}</p>
    `;
  }

  function placeQueryMarker(x, y) {
    if (queryMarker) queryMarker.remove();
    queryMarker = document.createElementNS(NS, "circle");
    queryMarker.setAttribute("cx", x);
    queryMarker.setAttribute("cy", y);
    queryMarker.setAttribute("r", 5);
    queryMarker.setAttribute("class", "query-marker");
    stationLayer.appendChild(queryMarker);
  }

  function domainListHTML(lat, lon) {
    const covering = domainsCovering(lat, lon);
    if (!covering.length) {
      return `<p class="muted small" style="margin-top:10px;">No regional high-resolution model in this set covers this point &mdash; only global reanalysis products like ERA5 would have data here.</p>`;
    }
    const items = covering
      .map((d) => {
        const linkHTML = d.link
          ? ` <a href="${d.link}" target="_blank" rel="noopener">Access data</a>`
          : "";
        return `<li><strong>${d.name}</strong> (${d.resolution}) &mdash; ${d.note}${linkHTML}</li>`;
      })
      .join("");
    return `
      <p class="panel-meta" style="margin-top:10px;">Model domains covering this point:</p>
      <ul class="muted small" style="margin:0 0 0 18px; padding:0;">${items}</ul>
    `;
  }

  async function showModelDataPanel(lat, lon, x, y) {
    placeQueryMarker(x, y);
    panel.innerHTML = `
      <span class="panel-tag">Live model data</span>
      <h3>${lat.toFixed(2)}&deg;, ${lon.toFixed(2)}&deg;</h3>
      <p class="muted small">Querying Open-Meteo&hellip;</p>
    `;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl&timezone=auto`;

    let weatherHTML = `<p class="muted small">Could not reach Open-Meteo right now. Try again in a moment.</p>`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      const cur = data.current;
      weatherHTML = `
        <p class="panel-meta">Model grid elevation: ${Math.round(data.elevation)} m</p>
        <dl>
          <dt>Temperature</dt><dd>${cur.temperature_2m}&deg;C</dd>
          <dt>Humidity</dt><dd>${cur.relative_humidity_2m}%</dd>
          <dt>Wind speed</dt><dd>${cur.wind_speed_10m} km/h</dd>
          <dt>Surface pressure</dt><dd>${cur.pressure_msl} hPa</dd>
        </dl>
        <p class="muted small" style="margin-top:14px;">
          Interpolated instantly via <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>
          (auto-selects the best available model for this point).
        </p>
      `;
    } catch (err) {
      /* keep default error message */
    }

    panel.innerHTML = `
      <span class="panel-tag">Live model data</span>
      <h3>${lat.toFixed(2)}&deg;, ${lon.toFixed(2)}&deg;</h3>
      ${weatherHTML}
      ${domainListHTML(lat, lon)}
    `;
  }

  function clientToSvgPoint(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function handleMapClick(clientX, clientY, target) {
    if (target && target.classList && target.classList.contains("station-dot")) {
      showStationPanel(target);
      return;
    }
    const svgPt = clientToSvgPoint(clientX, clientY);
    const lon = xToLon(svgPt.x);
    const lat = yToLat(svgPt.y);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    showModelDataPanel(lat, lon, svgPt.x, svgPt.y);
  }

  // ---- Zoom & pan ----
  const INITIAL_VB = { x: 0, y: 240, w: 850, h: 550 };
  const vb = { ...INITIAL_VB };
  const MIN_W = INITIAL_VB.w / 12;
  const MAX_W = INITIAL_VB.w;
  const PAN_MARGIN = 120;

  function clampViewBox() {
    vb.w = Math.min(Math.max(vb.w, MIN_W), MAX_W);
    vb.h = vb.w * (INITIAL_VB.h / INITIAL_VB.w);
    const minX = INITIAL_VB.x - PAN_MARGIN;
    const maxX = INITIAL_VB.x + INITIAL_VB.w + PAN_MARGIN - vb.w;
    const minY = INITIAL_VB.y - PAN_MARGIN;
    const maxY = INITIAL_VB.y + INITIAL_VB.h + PAN_MARGIN - vb.h;
    vb.x = Math.min(Math.max(vb.x, minX), Math.max(minX, maxX));
    vb.y = Math.min(Math.max(vb.y, minY), Math.max(minY, maxY));
  }

  function applyViewBox() {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  function zoomAtPoint(svgX, svgY, factor) {
    const newW = Math.min(Math.max(vb.w * factor, MIN_W), MAX_W);
    const ratio = newW / vb.w;
    vb.x = svgX - (svgX - vb.x) * ratio;
    vb.y = svgY - (svgY - vb.y) * ratio;
    vb.w = newW;
    vb.h = vb.w * (INITIAL_VB.h / INITIAL_VB.w);
    clampViewBox();
    applyViewBox();
  }

  document.getElementById("zoomIn").addEventListener("click", () => {
    zoomAtPoint(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / 1.4);
  });
  document.getElementById("zoomOut").addEventListener("click", () => {
    zoomAtPoint(vb.x + vb.w / 2, vb.y + vb.h / 2, 1.4);
  });
  document.getElementById("zoomReset").addEventListener("click", () => {
    Object.assign(vb, INITIAL_VB);
    applyViewBox();
  });

  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const svgPt = clientToSvgPoint(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      zoomAtPoint(svgPt.x, svgPt.y, factor);
    },
    { passive: false }
  );

  let panState = null;
  let dragged = false;

  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = svg.getBoundingClientRect();
    panState = {
      clientX: e.clientX,
      clientY: e.clientY,
      vb: { ...vb },
      scaleX: vb.w / rect.width,
      scaleY: vb.h / rect.height,
    };
    dragged = false;
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener("pointermove", (e) => {
    if (!panState) return;
    const dx = e.clientX - panState.clientX;
    const dy = e.clientY - panState.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragged = true;
      svg.classList.add("panning");
    }
    if (!dragged) return;
    vb.x = panState.vb.x - dx * panState.scaleX;
    vb.y = panState.vb.y - dy * panState.scaleY;
    clampViewBox();
    applyViewBox();
  });

  function endPan(e) {
    if (!panState) return;
    panState = null;
    svg.classList.remove("panning");
    if (!dragged) {
      // pointer capture retargets e.target to the svg itself, so look up
      // the real element under the cursor to detect station-dot clicks.
      const realTarget = document.elementFromPoint(e.clientX, e.clientY);
      handleMapClick(e.clientX, e.clientY, realTarget);
    }
    dragged = false;
  }

  svg.addEventListener("pointerup", endPan);
  svg.addEventListener("pointercancel", () => {
    panState = null;
    dragged = false;
    svg.classList.remove("panning");
  });
})();
