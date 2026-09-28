const FEATURED_VISIBLE_MS = 3500;
const FEATURED_PAUSE_MS = 10000;

const featuredRotator = document.getElementById("featuredRotator");

let featuredQueue = [];
let featuredIndex = 0;
let featuredTimer = null;
let featuredPaused = false;

function renderFeaturedCard(item) {
  if (!featuredRotator) return;

  const imageUrl =
    item.image_url ||
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=300&q=80";

  const title =
    item.title ||
    item.business_name ||
    "Publicación destacada";

  const meta =
    item.location || "En tu zona";

  const link =
    item.link ||
    "#";

  featuredRotator.innerHTML = `
    <div class="featured-item">
      <img
        class="featured-thumb"
        src="${imageUrl}"
        alt="${title}"
      />

      <div class="featured-info">
        <div class="featured-title">${title}</div>

        <div class="featured-meta">${meta}</div>

        <a
          class="featured-link"
          href="${link}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver publicación
        </a>
      </div>

      <button class="featured-close" type="button" aria-label="Cerrar">
        ×
      </button>
    </div>
  `;

  const closeBtn = featuredRotator.querySelector(".featured-close");

  closeBtn?.addEventListener("click", () => {
    featuredPaused = true;
    clearInterval(featuredTimer);
    featuredRotator.classList.add("hidden");
  });
}

function showFeaturedQueue() {
  if (!featuredRotator || !featuredQueue.length) {
    featuredRotator?.classList.add("hidden");
    return;
  }

  const item = featuredQueue[featuredIndex];

  renderFeaturedCard(item);
  featuredRotator.classList.remove("hidden");

  clearInterval(featuredTimer);

  featuredTimer = setTimeout(() => {
    if (!featuredPaused) {
      featuredRotator.classList.add("hidden");
      setTimeout(() => {
        featuredIndex = (featuredIndex + 1) % featuredQueue.length;
        showFeaturedQueue();
      }, FEATURED_PAUSE_MS);
    }
  }, FEATURED_VISIBLE_MS);
}

async function cargarFeaturedPublications() {
  const { data, error } = await db
    .from("featured_publications")
    .select(`
      id,
      provider_id,
      product_id,
      publication_type,
      status,
      expires_at,
      created_at
    `)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error cargando destacadas:", error);
    return;
  }

  if (!data || !data.length) {
    featuredRotator?.classList.add("hidden");
    return;
  }

  featuredQueue = [];

  for (const item of data) {
    let title = "";
    let image_url = "";
    let location = "";
    let link = "";

    if (item.publication_type === "product" && item.product_id) {
      const { data: productData } = await db
        .from("market_products")
        .select(`
          id,
          title,
          image_url,
          price,
          seller_name,
          seller_phone,
          seller_whatsapp
        `)
        .eq("id", item.product_id)
        .maybeSingle();

      if (productData) {
        title = productData.title;
        image_url = productData.image_url || "";
        location = productData.seller_name || "Producto destacado";
        link = `mercado-producto.html?id=${productData.id}`;
      }
    } else {
      const { data: providerData } = await db
        .from("providers")
        .select(`
          id,
          business_name,
          name,
          phone,
          whatsapp,
          logo_url
        `)
        .eq("id", item.provider_id)
        .maybeSingle();

      if (providerData) {
        title = providerData.business_name || providerData.name || "Servicio destacado";
        image_url = providerData.logo_url || "";
        location = "Servicio destacado";
        link = `perfil-proveedor.html?id=${providerData.id}`;
      }
    }

    if (title) {
      featuredQueue.push({
        id: item.id,
        title,
        image_url,
        location,
        link
      });
    }
  }

  if (!featuredQueue.length) {
    featuredRotator?.classList.add("hidden");
    return;
  }

  featuredIndex = 0;
  featuredPaused = false;
  showFeaturedQueue();
}

window.addEventListener("load", () => {
  if (typeof db !== "undefined") {
    cargarFeaturedPublications();
    setInterval(cargarFeaturedPublications, 60000);
  }
});