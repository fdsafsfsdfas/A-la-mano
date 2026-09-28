const contenedor =
  document.getElementById("misProductosContainer");

let intervaloDuracion = null;

function mostrarMensaje(texto, tipo = "error") {
  const elemento = document.getElementById("mensaje");

  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `alert ${tipo}`;
  elemento.style.display = "block";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fechaValida(value) {
  if (!value) return null;

  const fecha = new Date(value);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
}

function productoActivo(producto) {
  const fechaExpiracion = fechaValida(producto.expires_at);

  return (
    producto.status === "active" &&
    fechaExpiracion &&
    fechaExpiracion > new Date()
  );
}

function obtenerDuracionRestante(expiresAt) {
  const fechaExpiracion = fechaValida(expiresAt);

  if (!fechaExpiracion) {
    return "Sin fecha de vencimiento";
  }

  const diferencia =
    fechaExpiracion.getTime() - Date.now();

  if (diferencia <= 0) {
    return "Vencido";
  }

  const minutosTotales = Math.floor(diferencia / 60000);

  const dias = Math.floor(minutosTotales / 1440);
  const horas = Math.floor((minutosTotales % 1440) / 60);
  const minutos = minutosTotales % 60;

  if (dias > 0) {
    return `${dias} día${dias === 1 ? "" : "s"}, ${horas} hora${horas === 1 ? "" : "s"}`;
  }

  if (horas > 0) {
    return `${horas} hora${horas === 1 ? "" : "s"}, ${minutos} min`;
  }

  return `${Math.max(minutos, 1)} minuto${minutos === 1 ? "" : "s"}`;
}

function actualizarDuraciones() {
  document
    .querySelectorAll("[data-expires-at]")
    .forEach((elemento) => {
      const expiresAt = elemento.dataset.expiresAt;
      const texto = obtenerDuracionRestante(expiresAt);

      elemento.textContent = texto;

      if (texto === "Vencido") {
        elemento.classList.add("expired");
      }
    });
}

async function obtenerProveedorActual() {
  const {
    data: sessionData,
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError || !sessionData?.session) {
    window.location.href = "login-proveedor.html";
    return null;
  }

  const user = sessionData.session.user;

  const {
    data: provider,
    error: providerError
  } = await db
    .from("providers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (providerError || !provider) {
    window.location.href = "registro-proveedor.html";
    return null;
  }

  return provider;
}

async function cambiarEstadoProducto(productId, nuevoEstado) {
  const provider = await obtenerProveedorActual();

  if (!provider) return;

  const producto = document.querySelector(
    `[data-product-id="${productId}"]`
  );

  const boton = producto?.querySelector(
    "[data-action='toggle-status']"
  );

  if (boton) {
    boton.disabled = true;
    boton.textContent = "Guardando...";
  }

  const {
    data,
    error
  } = await db
    .from("market_products")
    .update({
      status: nuevoEstado,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId)
    .eq("provider_id", provider.id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Error cambiando estado:", error);

    mostrarMensaje(
      "No se pudo cambiar la visibilidad del producto.",
      "error"
    );

    if (boton) {
      boton.disabled = false;
    }

    return;
  }

  if (!data) {
    mostrarMensaje(
      "No se pudo actualizar el producto.",
      "error"
    );

    if (boton) {
      boton.disabled = false;
    }

    return;
  }

  if (nuevoEstado === "paused") {
    mostrarMensaje(
      "Producto retirado de las búsquedas.",
      "success"
    );
  } else {
    mostrarMensaje(
      "Producto visible nuevamente en las búsquedas.",
      "success"
    );
  }

  await cargarProductos();
}

async function eliminarProducto(productId) {
  const confirmar = window.confirm(
    "¿Seguro que quieres eliminar esta publicación? Esta acción no se puede deshacer."
  );

  if (!confirmar) return;

  const provider = await obtenerProveedorActual();

  if (!provider) return;

  const boton = document.querySelector(
    `button[data-action="delete-product"][data-id="${productId}"]`
  );

  if (boton) {
    boton.disabled = true;
    boton.textContent = "…";
  }

  const { error } = await db
    .from("market_products")
    .delete()
    .eq("id", productId)
    .eq("provider_id", provider.id);

  if (error) {
    console.error("Error eliminando producto:", error);

    mostrarMensaje(
      "No se pudo eliminar la publicación.",
      "error"
    );

    if (boton) {
      boton.disabled = false;
      boton.textContent = "×";
    }

    return;
  }

  mostrarMensaje(
    "Publicación eliminada correctamente.",
    "success"
  );

  await cargarProductos();
}

async function cargarProductos() {
  if (!contenedor) return;

  const provider = await obtenerProveedorActual();

  if (!provider) return;

  const {
    data,
    error
  } = await db
    .from("market_products")
    .select(`
      id,
      title,
      description,
      price,
      status,
      expires_at,
      created_at
    `)
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando productos:", error);

    contenedor.innerHTML =
      "<p>No se pudieron cargar tus productos.</p>";

    return;
  }

  if (!data || !data.length) {
    contenedor.innerHTML =
      "<p>Aún no tienes productos publicados.</p>";

    return;
  }

  contenedor.innerHTML = `
    <div class="market-product-list">
      ${data.map((producto) => {
        const activo = productoActivo(producto);
        const pausado = producto.status === "paused";
        const vencido =
          producto.status === "active" && !activo;

        const estadoTexto = pausado
          ? "Retirado de las búsquedas"
          : vencido
            ? "Vencido"
            : activo
              ? "Activo y visible"
              : producto.status || "Sin estado";

        const botonTexto = activo
          ? "Bajar de las búsquedas"
          : pausado
            ? "Volver a publicar"
            : "Producto vencido";

        const siguienteEstado =
          activo ? "paused" : "active";

        const puedeCambiar =
          activo ||
          (pausado && fechaValida(producto.expires_at) > new Date());

        return `
          <article
            class="market-product-item card"
            data-product-id="${escapeHtml(producto.id)}"
          >
            <button
              type="button"
              class="delete-product-btn"
              data-action="delete-product"
              data-id="${escapeHtml(producto.id)}"
              aria-label="Eliminar publicación"
              title="Eliminar publicación"
            >
              ×
            </button>

            <div>
              <h3>
                ${escapeHtml(producto.title || "Sin título")}
              </h3>

              <p>
                ${escapeHtml(
                  producto.description || "Sin descripción"
                )}
              </p>

              <div class="market-price">
                ${Number(producto.price || 0).toLocaleString(
                  "es-CU",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }
                )} CUP
              </div>

              <div class="market-location">
                Estado: ${escapeHtml(estadoTexto)}
              </div>

              <div class="market-location">
                Vence:
                ${escapeHtml(
                  producto.expires_at
                    ? new Date(producto.expires_at).toLocaleString("es-CU")
                    : "-"
                )}
              </div>

              <div class="product-remaining">
                <strong>Tiempo restante:</strong>
                <span
                  data-expires-at="${escapeHtml(producto.expires_at || "")}"
                >
                  ${escapeHtml(obtenerDuracionRestante(producto.expires_at))}
                </span>
              </div>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="small-btn ${activo ? "danger" : "primary"}"
                data-action="toggle-status"
                data-id="${escapeHtml(producto.id)}"
                data-next-status="${siguienteEstado}"
                ${puedeCambiar ? "" : "disabled"}
              >
                ${botonTexto}
              </button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  clearInterval(intervaloDuracion);

  intervaloDuracion = setInterval(
    actualizarDuraciones,
    60000
  );
}

document.addEventListener("click", async (event) => {
  const boton = event.target.closest("button[data-action]");

  if (!boton) return;

  const action = boton.dataset.action;
  const productId = boton.dataset.id;

  if (!productId) return;

  if (action === "delete-product") {
    await eliminarProducto(productId);
    return;
  }

  if (action === "toggle-status") {
    const nextStatus = boton.dataset.nextStatus;

    if (!nextStatus) return;

    await cambiarEstadoProducto(productId, nextStatus);
  }
});

cargarProductos();