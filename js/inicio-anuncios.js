const homeAdsResults = document.getElementById("homeAdsResults");

let featuredAds = [];
let featuredIndex = 0;
let autoRotateTimer = null;
let touchStartX = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("es-CU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildSlideMarkup(item) {
  const isProduct = item.ad_type === "product";

  const title = isProduct
    ? item.market_products?.title || "Producto"
    : item.provider_name || "Servicio";

  const description = isProduct
    ? item.market_products?.description || "Sin descripción"
    : item.provider_description || "Sin descripción";

  const price = isProduct
    ? Number(item.market_products?.price || 0)
    : 0;

  const sellerName = isProduct
    ? item.market_products?.seller_name || "Proveedor"
    : item.provider_name || "Proveedor";

  const sellerPhone = isProduct
    ? item.market_products?.seller_phone || ""
    : item.provider_phone || "";

  const sellerWhatsapp = isProduct
    ? item.market_products?.seller_whatsapp || ""
    : item.provider_whatsapp || "";

  const whatsappNumber = formatPhone(sellerWhatsapp);

  const imageMarkup =
    isProduct && item.market_products?.image_url
      ? `
        <img
          class="featured-showcase-image"
          src="${escapeHtml(item.market_products.image_url)}"
          alt="${escapeHtml(title)}"
          loading="lazy"
        />
      `
      : `
        <div class="featured-showcase-image placeholder">
          🛍️
        </div>
      `;

  return `
    <article class="featured-showcase-slide">
      <div class="featured-showcase-visual">
        ${imageMarkup}
      </div>

      <div class="featured-showcase-content">
        <span class="featured-showcase-label">⭐ DESTACADO</span>

        <h3>${escapeHtml(title)}</h3>

        ${
          isProduct
            ? `<div class="featured-showcase-price">${formatPrice(price)} CUP</div>`
            : ""
        }

        <p>${escapeHtml(description)}</p>

        <div class="featured-showcase-meta">
          <span>Vendedor: ${escapeHtml(sellerName)}</span>
          <span>${isProduct ? "Producto" : "Servicio"}</span>
        </div>

        <div class="featured-showcase-actions">
          <a
            class="small-btn primary"
            href="${sellerPhone ? `tel:${encodeURIComponent(sellerPhone)}` : "#"}"
          >
            📞 Llamar
          </a>

          <a
            class="small-btn green"
            href="${whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#"}"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedShowcase() {
  if (!homeAdsResults) return;

  if (!featuredAds.length) {
    homeAdsResults.innerHTML =
      "<div class='empty'>No hay anuncios premium activos.</div>";
    return;
  }

  const slidesHtml = featuredAds
    .map((item) => buildSlideMarkup(item))
    .join("");

  const indicators = featuredAds
    .map(
      (_, index) =>
        `<button
          type="button"
          class="featured-dot ${index === featuredIndex ? "active" : ""}"
          data-index="${index}"
          aria-label="Ir al anuncio ${index + 1}"
        ></button>`
    )
    .join("");

  homeAdsResults.innerHTML = `
    <div class="featured-showcase">
      <button
        type="button"
        class="featured-arrow featured-arrow-left"
        aria-label="Anterior anuncio"
      >
        ‹
      </button>

      <div class="featured-showcase-viewport">
        <div class="featured-showcase-track">
          ${slidesHtml}
        </div>
      </div>

      <button
        type="button"
        class="featured-arrow featured-arrow-right"
        aria-label="Siguiente anuncio"
      >
        ›
      </button>

      <div class="featured-dots">
        ${indicators}
      </div>
    </div>
  `;

  const track = homeAdsResults.querySelector(".featured-showcase-track");
  const dots = homeAdsResults.querySelectorAll(".featured-dot");
  const leftArrow = homeAdsResults.querySelector(".featured-arrow-left");
  const rightArrow = homeAdsResults.querySelector(".featured-arrow-right");

  if (track) {
    track.style.transform = `translateX(-${featuredIndex * 100}%)`;
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      featuredIndex = Number(dot.dataset.index);
      updateFeaturedPosition();
    });
  });

  leftArrow?.addEventListener("click", () => {
    featuredIndex = (featuredIndex - 1 + featuredAds.length) % featuredAds.length;
    updateFeaturedPosition();
  });

  rightArrow?.addEventListener("click", () => {
    featuredIndex = (featuredIndex + 1) % featuredAds.length;
    updateFeaturedPosition();
  });

  const viewport = homeAdsResults.querySelector(".featured-showcase-viewport");

  viewport?.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  viewport?.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0].screenX;
    const delta = touchEndX - touchStartX;

    if (Math.abs(delta) < 50) {
      touchStartX = null;
      return;
    }

    if (delta < 0) {
      featuredIndex = (featuredIndex + 1) % featuredAds.length;
    } else {
      featuredIndex = (featuredIndex - 1 + featuredAds.length) % featuredAds.length;
    }

    touchStartX = null;
    updateFeaturedPosition();
  }, { passive: true });

  viewport?.addEventListener("mouseenter", stopAutoRotate);
  viewport?.addEventListener("mouseleave", startAutoRotate);
}

function updateFeaturedPosition() {
  const track = homeAdsResults?.querySelector(".featured-showcase-track");
  const dots = homeAdsResults?.querySelectorAll(".featured-dot");

  if (!track) return;

  track.style.transform = `translateX(-${featuredIndex * 100}%)`;

  dots?.forEach((dot) => {
    const isActive = Number(dot.dataset.index) === featuredIndex;
    dot.classList.toggle("active", isActive);
  });
}

function startAutoRotate() {
  stopAutoRotate();

  if (featuredAds.length <= 1) return;

  autoRotateTimer = setInterval(() => {
    featuredIndex = (featuredIndex + 1) % featuredAds.length;
    updateFeaturedPosition();
  }, 5000);
}

function stopAutoRotate() {
  if (autoRotateTimer) {
    clearInterval(autoRotateTimer);
    autoRotateTimer = null;
  }
}

async function cargarAnunciosInicio() {
  if (!homeAdsResults) return;

  homeAdsResults.innerHTML =
    "<div class='empty'>Cargando anuncios...</div>";

  const ahora = new Date().toISOString();

  const {
    data,
    error
  } = await db
    .from("premium_ad_requests")
    .select(`
      id,
      provider_id,
      product_id,
      ad_type,
      status,
      expires_at,
      activated_at,
      provider:provider_id (
        id,
        name,
        phone,
        whatsapp,
        description
      ),
      market_products:product_id (
        id,
        title,
        description,
        price,
        seller_name,
        seller_phone,
        seller_whatsapp,
        image_url
      )
    `)
    .eq("status", "active")
    .gt("expires_at", ahora)
    .order("activated_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error cargando anuncios premium:", error);
    homeAdsResults.innerHTML =
      "<div class='empty'>No hay anuncios premium activos.</div>";
    return;
  }

  if (!data || !data.length) {
    homeAdsResults.innerHTML =
      "<div class='empty'>No hay anuncios premium activos.</div>";
    return;
  }

  featuredAds = data.map((item) => {
    const provider = Array.isArray(item.provider)
      ? item.provider[0]
      : item.provider;

    const product = Array.isArray(item.market_products)
      ? item.market_products[0]
      : item.market_products;

    return {
      ...item,
      provider_name: provider?.name || "Proveedor",
      provider_phone: provider?.phone || "",
      provider_whatsapp: provider?.whatsapp || "",
      provider_description: provider?.description || "",
      market_products: product || null
    };
  });

  featuredIndex = 0;
  renderFeaturedShowcase();
  startAutoRotate();
}

cargarAnunciosInicio();