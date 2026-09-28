const productSearch = document.getElementById("productSearch");
const searchProductsBtn = document.getElementById("searchProductsBtn");
const marketResults = document.getElementById("marketResults");

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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("es-CU");
}

function fechaActiva(value) {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date > new Date();
}

function promocionActiva(product) {
  return (
    product.promoted_home === true &&
    fechaActiva(product.promoted_home_until)
  );
}

function destacadoActivo(product) {
  return (
    product.featured === true &&
    fechaActiva(product.featured_until)
  );
}

function ordenarProductos(products) {
  return [...products].sort((a, b) => {
    const aFeatured = destacadoActivo(a);
    const bFeatured = destacadoActivo(b);

    if (aFeatured !== bFeatured) {
      return aFeatured ? -1 : 1;
    }

    const aPromoted = promocionActiva(a);
    const bPromoted = promocionActiva(b);

    if (aPromoted !== bPromoted) {
      return aPromoted ? -1 : 1;
    }

    const fechaA = new Date(a.created_at || 0).getTime();
    const fechaB = new Date(b.created_at || 0).getTime();

    return fechaB - fechaA;
  });
}

function renderMarketProducts(products) {
  if (!marketResults) return;

  if (!products.length) {
    marketResults.innerHTML = `
      <div class="empty">
        No hay productos disponibles con esa búsqueda.
      </div>
    `;
    return;
  }

  marketResults.innerHTML = ordenarProductos(products)
    .map((product) => {
      const phone = String(product.seller_phone || "").trim();
      const whatsapp = String(product.seller_whatsapp || "").trim();
      const whatsappNumber = whatsapp.replace(/\D/g, "");

      const badges = [];

      if (destacadoActivo(product)) {
        badges.push('<span class="market-badge featured">⭐ Destacado</span>');
      }

      if (promocionActiva(product)) {
        badges.push('<span class="market-badge promoted">📣 Promocionado</span>');
      }

      return `
        <article class="card market-card">
          ${
            badges.length
              ? `<div class="market-card-badges">${badges.join("")}</div>`
              : ""
          }

          ${
            product.image_url
              ? `
                <img
                  class="market-card-image"
                  src="${escapeHtml(product.image_url)}"
                  alt="${escapeHtml(product.title || "Producto")}"
                  loading="lazy"
                />
              `
              : `
                <div class="market-card-image placeholder">
                  🛍️
                </div>
              `
          }

          <h3>${escapeHtml(product.title || "Sin título")}</h3>

          <div class="market-price">
            ${formatPrice(product.price)} CUP
          </div>

          <p>
            ${escapeHtml(product.description || "Sin descripción")}
          </p>

          <div class="market-location">
            Vendedor: ${escapeHtml(product.seller_name || "Sin nombre")}
          </div>

          <div class="market-location">
            Publicado hasta: ${escapeHtml(formatDate(product.expires_at))}
          </div>

          <div class="card-actions">
            <a
              class="small-btn primary ${phone ? "" : "disabled"}"
              href="${phone ? `tel:${encodeURIComponent(phone)}` : "#"}"
              data-product-id="${escapeHtml(product.id)}"
              data-provider-id="${escapeHtml(product.provider_id || "")}"
              data-phone="${escapeHtml(phone)}"
            >
              📞 Llamar
            </a>

            <a
              class="small-btn green ${whatsappNumber ? "" : "disabled"}"
              href="${whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#"}"
              target="_blank"
              rel="noopener noreferrer"
              data-product-id="${escapeHtml(product.id)}"
              data-provider-id="${escapeHtml(product.provider_id || "")}"
              data-whatsapp="${escapeHtml(whatsappNumber)}"
            >
              WhatsApp
            </a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function registrarEventoMercado(providerId, eventType, productId = null) {
  if (!providerId || !eventType) return;

  if (typeof window.registrarEvento !== "function") {
    return;
  }

  try {
    await window.registrarEvento(providerId, eventType, {
      source: "mercado-buscar",
      product_id: productId || null
    });
  } catch (error) {
    console.error("Error registrando evento del mercado:", error);
  }
}

async function cargarProductosMercado() {
  if (!marketResults) return;

  marketResults.innerHTML = "<div class='empty'>Buscando productos...</div>";

  const searchTerm = productSearch?.value.trim() || "";

  let query = db
    .from("market_products")
    .select(`
      id,
      provider_id,
      seller_name,
      seller_phone,
      seller_whatsapp,
      title,
      description,
      price,
      image_url,
      status,
      expires_at,
      promoted_home,
      promoted_home_until,
      featured,
      featured_until,
      created_at
    `)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (searchTerm) {
    const term = searchTerm
      .replaceAll(",", " ")
      .replaceAll("(", " ")
      .replaceAll(")", " ");

    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando productos:", error);
    marketResults.innerHTML =
      "<div class='empty'>Ocurrió un error al cargar los productos.</div>";
    return;
  }

  const products = (data || []).filter((product) => {
    return (
      product.status === "active" &&
      fechaActiva(product.expires_at)
    );
  });

  renderMarketProducts(products);

  const promesas = products
    .filter((product) => product.provider_id)
    .map((product) =>
      registrarEventoMercado(product.provider_id, "search_impression", product.id)
    );

  await Promise.allSettled(promesas);
}

if (searchProductsBtn) {
  searchProductsBtn.addEventListener("click", async () => {
    await cargarProductosMercado();
  });
}

if (productSearch) {
  productSearch.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    await cargarProductosMercado();
  });
}

if (marketResults) {
  marketResults.addEventListener("click", async (event) => {
    const phoneButton = event.target.closest("a.small-btn.primary");
    const whatsappButton = event.target.closest("a.small-btn.green");

    if (!phoneButton && !whatsappButton) return;

    const providerId = (phoneButton || whatsappButton).dataset.providerId;
    const productId = (phoneButton || whatsappButton).dataset.productId;

    if (!providerId) return;

    if (phoneButton) {
      const phone = phoneButton.dataset.phone || "";

      if (!phone) {
        event.preventDefault();
        alert("Este vendedor no tiene teléfono registrado.");
        return;
      }

      await registrarEventoMercado(providerId, "phone_click", productId);
      return;
    }

    if (whatsappButton) {
      const whatsapp = whatsappButton.dataset.whatsapp || "";

      if (!whatsapp) {
        event.preventDefault();
        alert("Este vendedor no tiene WhatsApp registrado.");
        return;
      }

      await registrarEventoMercado(providerId, "whatsapp_click", productId);
    }
  });
}

cargarProductosMercado();