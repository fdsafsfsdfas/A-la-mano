const municipioSelect = document.getElementById("municipio");
const categoriaSelect = document.getElementById("categoria");
const resultadosDiv = document.getElementById("resultados");
const buscarBtn = document.getElementById("buscarBtn");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function cargarMunicipios() {
  if (!municipioSelect) return;

  const { data, error } = await db
    .from("municipalities")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Error cargando municipios:", error);
    return;
  }

  municipioSelect.innerHTML =
    '<option value="">Todos los municipios</option>';

  (data || []).forEach((municipio) => {
    const option = document.createElement("option");

    option.value = municipio.id;
    option.textContent = municipio.name;

    municipioSelect.appendChild(option);
  });
}

async function cargarCategorias() {
  if (!categoriaSelect) return;

  const { data, error } = await db
    .from("categories")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Error cargando categorías:", error);
    return;
  }

  categoriaSelect.innerHTML =
    '<option value="">Todas las categorías</option>';

  (data || []).forEach((categoria) => {
    const option = document.createElement("option");

    option.value = categoria.id;
    option.textContent = categoria.name;

    categoriaSelect.appendChild(option);
  });
}

function renderResultados(proveedores) {
  if (!resultadosDiv) return;

  resultadosDiv.innerHTML = "";

  proveedores.forEach((proveedor) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "card";

    const categoria =
      proveedor.categories?.name || "Sin categoría";

    const municipio =
      proveedor.municipalities?.name || "Sin municipio";

    const descripcion =
      proveedor.description || "Sin descripción";

    const telefono = proveedor.phone || "";
    const whatsapp = proveedor.whatsapp || "";
    const whatsappNumero = whatsapp.replace(/\D/g, "");

    tarjeta.innerHTML = `
      <h3>${escapeHtml(proveedor.name || "Sin nombre")}</h3>

      <div class="meta">
        ${escapeHtml(categoria)} · ${escapeHtml(municipio)}
      </div>

      <div class="badge">
        ${escapeHtml(proveedor.availability || "Disponible")}
      </div>

      <p>${escapeHtml(descripcion.slice(0, 140))}</p>

      <div class="meta">
        📞 ${escapeHtml(telefono || "Sin teléfono")}
      </div>

      <div class="card-actions">
        <a
          class="small-btn primary btn-phone"
          href="${telefono ? `tel:${encodeURIComponent(telefono)}` : "#"}"
          data-provider-id="${escapeHtml(proveedor.id)}"
          data-phone="${escapeHtml(telefono)}">
          Llamar
        </a>

        <a
          class="small-btn green btn-whatsapp"
          href="${
            whatsappNumero
              ? `https://wa.me/${whatsappNumero}`
              : "#"
          }"
          target="_blank"
          rel="noopener noreferrer"
          data-provider-id="${escapeHtml(proveedor.id)}">
          WhatsApp
        </a>
      </div>
    `;

    resultadosDiv.appendChild(tarjeta);
  });
}

async function registrarImpresiones(proveedores) {
  if (typeof window.registrarEvento !== "function") {
    console.error(
      "No se cargó analytics.js antes de buscar.js."
    );
    return;
  }

  const searchTerm = [
    municipioSelect?.value || "",
    categoriaSelect?.value || ""
  ]
    .filter(Boolean)
    .join(" - ");

  const promesas = proveedores
    .filter((proveedor) => proveedor.id)
    .map((proveedor) =>
      window.registrarEvento(
        proveedor.id,
        "search_impression",
        {
          source: "buscar",
          search_term: searchTerm
        }
      )
    );

  const resultados = await Promise.allSettled(promesas);

  resultados.forEach((resultado) => {
    if (resultado.status === "rejected") {
      console.error(
        "Error registrando aparición:",
        resultado.reason
      );
    }
  });
}

async function buscarProveedores() {
  if (!resultadosDiv) return;

  const municipioId = municipioSelect?.value || "";
  const categoriaId = categoriaSelect?.value || "";

  resultadosDiv.innerHTML =
    "<div class='empty'>Buscando servicios...</div>";

  let query = db
    .from("providers")
    .select(`
      id,
      name,
      phone,
      whatsapp,
      availability,
      description,
      schedule,
      status,
      expires_at,
      municipality_id,
      category_id,
      categories ( name ),
      municipalities ( name )
    `)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  if (municipioId) {
    query = query.eq("municipality_id", municipioId);
  }

  if (categoriaId) {
    query = query.eq("category_id", categoriaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error buscando proveedores:", error);

    resultadosDiv.innerHTML =
      "<div class='empty'>Hubo un error al buscar servicios.</div>";

    return;
  }

  const proveedores = data || [];

  if (proveedores.length === 0) {
    resultadosDiv.innerHTML =
      "<div class='empty'>No hay servicios disponibles con esos filtros.</div>";

    return;
  }

  // Primero muestra los resultados.
  renderResultados(proveedores);

  // Luego registra una aparición por proveedor.
  await registrarImpresiones(proveedores);
}

if (buscarBtn) {
  buscarBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await buscarProveedores();
  });
}

if (resultadosDiv) {
  resultadosDiv.addEventListener("click", async (event) => {
    const phoneButton = event.target.closest(".btn-phone");
    const whatsappButton = event.target.closest(".btn-whatsapp");

    if (!phoneButton && !whatsappButton) {
      return;
    }

    const boton = phoneButton || whatsappButton;
    const providerId = boton.dataset.providerId;

    if (!providerId) {
      console.error("El botón no tiene data-provider-id.");
      return;
    }

    if (typeof window.registrarEvento !== "function") {
      console.error("No existe registrarEvento().");
    } else if (phoneButton) {
      await window.registrarEvento(
        providerId,
        "phone_click",
        {
          source: "buscar"
        }
      );
    } else if (whatsappButton) {
      await window.registrarEvento(
        providerId,
        "whatsapp_click",
        {
          source: "buscar"
        }
      );
    }

    // La estadística se intenta registrar antes de continuar.
    if (phoneButton) {
      const phone = phoneButton.dataset.phone || "";

      if (phone) {
        window.location.href = `tel:${phone}`;
      } else {
        alert("Este proveedor no tiene teléfono registrado.");
      }

      return;
    }

    if (whatsappButton) {
      const whatsappUrl = whatsappButton.href;

      if (whatsappUrl && whatsappUrl !== "#") {
        window.open(
          whatsappUrl,
          "_blank",
          "noopener,noreferrer"
        );
      } else {
        alert("Este proveedor no tiene WhatsApp registrado.");
      }
    }
  });
}

async function init() {
  if (
    !municipioSelect ||
    !categoriaSelect ||
    !resultadosDiv
  ) {
    console.error(
      "Faltan elementos HTML: municipio, categoria o resultados."
    );
    return;
  }

  await Promise.all([
    cargarMunicipios(),
    cargarCategorias()
  ]);
}

init();