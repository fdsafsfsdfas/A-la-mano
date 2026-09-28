const creditBalanceElement =
  document.getElementById("creditBalance");

const publicationSelect =
  document.getElementById("publicationSelect");

const publicationHelp =
  document.getElementById("publicationHelp");

const summaryType =
  document.getElementById("summaryType");

const summaryAction =
  document.getElementById("summaryAction");

const summaryPublication =
  document.getElementById("summaryPublication");

const summaryCost =
  document.getElementById("summaryCost");

const summaryRemaining =
  document.getElementById("summaryRemaining");

const summaryMessage =
  document.getElementById("summaryMessage");

const confirmPromotionBtn =
  document.getElementById("confirmPromotionBtn");

const mensaje =
  document.getElementById("mensaje");

const actionCosts = {
  promocionar: 100,
  destacar: 250,
  anuncio: 350
};

const actionNames = {
  promocionar: "Promocionar",
  destacar: "Destacar",
  anuncio: "Anuncio premium en Inicio"
};

const typeNames = {
  service: "Servicio",
  product: "Producto"
};

let providerActual = null;
let productos = [];
let saldoActual = 0;
let tipoSeleccionado = "";
let accionSeleccionada = "";
let solicitudEnProceso = false;
let solicitudCompletada = false;

function mostrarMensaje(texto, tipo = "error") {
  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `alert ${tipo}`;
  mensaje.style.display = "block";
}

function limpiarMensaje() {
  if (!mensaje) return;

  mensaje.textContent = "";
  mensaje.className = "alert";
  mensaje.style.display = "none";
}

function actualizarTarjetasSeleccionadas() {
  document
    .querySelectorAll("[data-type-card]")
    .forEach((card) => {
      card.classList.toggle(
        "selected",
        card.dataset.typeCard === tipoSeleccionado
      );
    });

  document
    .querySelectorAll("[data-action-card]")
    .forEach((card) => {
      card.classList.toggle(
        "selected",
        card.dataset.actionCard === accionSeleccionada
      );
    });
}

function seleccionarTipo(tipo) {
  if (solicitudEnProceso) return;

  tipoSeleccionado = tipo;
  solicitudCompletada = false;

  const radio = document.querySelector(
    `input[name="publicationType"][value="${tipo}"]`
  );

  if (radio) {
    radio.checked = true;
  }

  actualizarTarjetasSeleccionadas();
  cargarPublicacionesDisponibles();
  actualizarResumen();
}

function seleccionarAccion(accion) {
  if (solicitudEnProceso) return;

  accionSeleccionada = accion;
  solicitudCompletada = false;

  const radio = document.querySelector(
    `input[name="promotionAction"][value="${accion}"]`
  );

  if (radio) {
    radio.checked = true;
  }

  actualizarTarjetasSeleccionadas();
  actualizarResumen();
}

function obtenerParametrosIniciales() {
  const params = new URLSearchParams(window.location.search);

  const tipo = params.get("tipo");
  const accion = params.get("accion");

  if (tipo === "servicio" || tipo === "service") {
    seleccionarTipo("service");
  }

  if (tipo === "producto" || tipo === "product") {
    seleccionarTipo("product");
  }

  if (
    accion === "promocionar" ||
    accion === "destacar" ||
    accion === "anuncio"
  ) {
    seleccionarAccion(accion);
  }
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
    .select(`
      id,
      name,
      business_name,
      phone,
      whatsapp,
      description,
      status,
      expires_at
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (providerError) {
    console.error("Error obteniendo proveedor:", providerError);

    mostrarMensaje(
      "No se pudo cargar tu perfil de proveedor.",
      "error"
    );

    return null;
  }

  if (!provider) {
    mostrarMensaje(
      "No se encontró tu perfil de proveedor.",
      "error"
    );

    return null;
  }

  return provider;
}

async function cargarSaldo() {
  if (!providerActual) return;

  const {
    data,
    error
  } = await db
    .from("credit_accounts")
    .select("balance")
    .eq("provider_id", providerActual.id)
    .maybeSingle();

  if (error) {
    console.error("Error cargando saldo:", error);

    mostrarMensaje(
      "No se pudo cargar tu saldo de créditos.",
      "error"
    );

    return;
  }

  saldoActual = Number(data?.balance || 0);

  if (creditBalanceElement) {
    creditBalanceElement.textContent =
      saldoActual.toLocaleString("es-CU");
  }

  actualizarResumen();
}

async function cargarProductosDelProveedor() {
  if (!providerActual) return;

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
      expires_at
    `)
    .eq("provider_id", providerActual.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error("Error cargando productos:", error);

    mostrarMensaje(
      "No se pudieron cargar tus productos.",
      "error"
    );

    return;
  }

  productos = data || [];
}

function limpiarSelect(texto) {
  if (!publicationSelect) return;

  publicationSelect.innerHTML = "";

  const option = document.createElement("option");
  option.value = "";
  option.textContent = texto;
  option.selected = true;

  publicationSelect.appendChild(option);
}

async function cargarPublicacionesDisponibles() {
  if (!publicationSelect) return;

  limpiarSelect("Cargando publicaciones...");
  publicationSelect.disabled = true;

  if (!tipoSeleccionado) {
    limpiarSelect("Primero selecciona el tipo");

    if (publicationHelp) {
      publicationHelp.textContent =
        "Selecciona si deseas promocionar un servicio o un producto.";
    }

    actualizarResumen();
    return;
  }

  if (tipoSeleccionado === "service") {
    publicationSelect.innerHTML = "";

    const option = document.createElement("option");
    option.value = providerActual?.id || "";
    option.textContent =
      providerActual?.business_name ||
      providerActual?.name ||
      "Mi servicio";

    publicationSelect.appendChild(option);
    publicationSelect.disabled = false;

    if (publicationHelp) {
      publicationHelp.textContent =
        "Se utilizará tu servicio registrado en el perfil.";
    }

    actualizarResumen();
    return;
  }

  if (tipoSeleccionado === "product") {
    if (!productos.length) {
      limpiarSelect("No tienes productos activos");

      if (publicationHelp) {
        publicationHelp.textContent =
          "Primero publica un producto activo para poder promocionarlo.";
      }

      actualizarResumen();
      return;
    }

    publicationSelect.innerHTML = "";

    const initialOption = document.createElement("option");
    initialOption.value = "";
    initialOption.textContent = "Selecciona un producto";
    initialOption.disabled = true;
    initialOption.selected = true;

    publicationSelect.appendChild(initialOption);

    productos.forEach((producto) => {
      const option = document.createElement("option");

      option.value = producto.id;
      option.textContent =
        `${producto.title} · ${Number(
          producto.price || 0
        ).toLocaleString("es-CU")} CUP`;

      publicationSelect.appendChild(option);
    });

    publicationSelect.disabled = false;

    if (publicationHelp) {
      publicationHelp.textContent =
        "Solo se muestran productos activos y no vencidos.";
    }
  }

  actualizarResumen();
}

function obtenerNombrePublicacion() {
  if (!tipoSeleccionado || !publicationSelect) {
    return "";
  }

  if (tipoSeleccionado === "service") {
    return (
      providerActual?.business_name ||
      providerActual?.name ||
      "Mi servicio"
    );
  }

  const producto = productos.find(
    (item) =>
      String(item.id) === String(publicationSelect.value)
  );

  return producto?.title || "";
}

function actualizarResumen() {
  const costo = actionCosts[accionSeleccionada] || 0;
  const nombrePublicacion = obtenerNombrePublicacion();

  if (summaryType) {
    summaryType.textContent =
      typeNames[tipoSeleccionado] || "No seleccionado";
  }

  if (summaryAction) {
    summaryAction.textContent =
      actionNames[accionSeleccionada] || "No seleccionada";
  }

  if (summaryPublication) {
    summaryPublication.textContent =
      nombrePublicacion || "No seleccionada";
  }

  if (summaryCost) {
    summaryCost.textContent =
      `${costo.toLocaleString("es-CU")} créditos`;
  }

  if (summaryRemaining) {
    if (!costo) {
      summaryRemaining.textContent = "-";
    } else {
      const restante = saldoActual - costo;

      summaryRemaining.textContent =
        `${restante.toLocaleString("es-CU")} créditos`;
    }
  }

  if (summaryMessage) {
    summaryMessage.innerHTML = "";

    /*
     * Si la solicitud ya fue procesada correctamente, no mostramos
     * "No tienes suficientes créditos" aunque el saldo haya bajado.
     */
    if (solicitudCompletada) {
      summaryMessage.innerHTML = `
        <div class="summary-success">
          La solicitud fue procesada correctamente.
          El costo ya fue descontado de tu saldo.
        </div>
      `;
    } else if (costo && saldoActual < costo) {
      summaryMessage.innerHTML = `
        <div class="summary-warning">
          No tienes suficientes créditos para esta acción.
        </div>
      `;
    } else if (costo && tipoSeleccionado && nombrePublicacion) {
      summaryMessage.innerHTML = `
        <div class="summary-success">
          Revisa bien los datos antes de continuar.
          Todavía no se han descontado créditos.
        </div>
      `;
    }
  }

  const formularioCompleto =
    Boolean(
      providerActual &&
      tipoSeleccionado &&
      accionSeleccionada &&
      publicationSelect?.value &&
      saldoActual >= costo &&
      !solicitudEnProceso &&
      !solicitudCompletada
    );

  if (confirmPromotionBtn) {
    confirmPromotionBtn.disabled = !formularioCompleto;

    if (solicitudEnProceso) {
      confirmPromotionBtn.textContent = "Procesando...";
    } else if (solicitudCompletada) {
      confirmPromotionBtn.textContent = "Solicitud procesada";
    } else {
      confirmPromotionBtn.textContent = "Confirmar acción";
    }
  }
}

document
  .querySelectorAll('input[name="publicationType"]')
  .forEach((radio) => {
    radio.addEventListener("change", () => {
      seleccionarTipo(radio.value);
    });
  });

document
  .querySelectorAll('input[name="promotionAction"]')
  .forEach((radio) => {
    radio.addEventListener("change", () => {
      seleccionarAccion(radio.value);
    });
  });

publicationSelect?.addEventListener("change", () => {
  solicitudCompletada = false;
  actualizarResumen();
});

async function ejecutarSolicitudPremium() {
  if (solicitudEnProceso) {
    return;
  }

  if (solicitudCompletada) {
    mostrarMensaje(
      "Esta solicitud ya fue procesada.",
      "success"
    );
    return;
  }

  if (!providerActual) {
    mostrarMensaje(
      "No se pudo identificar tu perfil de proveedor.",
      "error"
    );
    return;
  }

  if (!tipoSeleccionado) {
    mostrarMensaje(
      "Primero selecciona un tipo de publicación.",
      "error"
    );
    return;
  }

  if (!accionSeleccionada) {
    mostrarMensaje(
      "Primero selecciona una acción.",
      "error"
    );
    return;
  }

  if (!publicationSelect?.value) {
    mostrarMensaje(
      "Primero selecciona la publicación.",
      "error"
    );
    return;
  }

  const costo = actionCosts[accionSeleccionada] || 0;

  /*
   * Esta validación solo evita enviar una solicitud imposible.
   * La función SQL sigue siendo la autoridad final del saldo.
   */
  if (saldoActual < costo) {
    mostrarMensaje(
      "No tienes suficientes créditos para esta acción.",
      "error"
    );
    return;
  }

  solicitudEnProceso = true;
  limpiarMensaje();
  actualizarResumen();

  try {
    mostrarMensaje(
      "Procesando solicitud...",
      "success"
    );

    const payload = {
      p_provider_id: providerActual.id,
      p_product_id:
        tipoSeleccionado === "product"
          ? publicationSelect.value
          : null,
      p_ad_type: tipoSeleccionado
    };

    const {
      data,
      error
    } = await db.rpc(
      "solicitar_anuncio_premium",
      payload
    );

    if (error) {
      console.error("Error RPC:", error);

      mostrarMensaje(
        error.message ||
          "No se pudo procesar la solicitud.",
        "error"
      );

      return;
    }

    if (!data?.ok) {
      mostrarMensaje(
        data?.message ||
          "No se pudo completar la solicitud.",
        "error"
      );

      return;
    }

    /*
     * Se marca antes de cargar nuevamente el saldo.
     * Así actualizarResumen no mostrará por error
     * "No tienes suficientes créditos".
     */
    solicitudCompletada = true;

    mostrarMensaje(
      data.message ||
        "Solicitud procesada correctamente.",
      "success"
    );

    await cargarSaldo();

    if (tipoSeleccionado === "product") {
      await cargarProductosDelProveedor();
      await cargarPublicacionesDisponibles();
    }

    actualizarResumen();
  } catch (error) {
    console.error(
      "Error inesperado:",
      error
    );

    mostrarMensaje(
      "Ocurrió un error inesperado al procesar la solicitud.",
      "error"
    );
  } finally {
    solicitudEnProceso = false;
    actualizarResumen();
  }
}

confirmPromotionBtn?.addEventListener(
  "click",
  ejecutarSolicitudPremium
);

async function iniciarPagina() {
  limpiarMensaje();

  providerActual = await obtenerProveedorActual();

  if (!providerActual) return;

  await Promise.all([
    cargarSaldo(),
    cargarProductosDelProveedor()
  ]);

  obtenerParametrosIniciales();

  if (!tipoSeleccionado) {
    seleccionarTipo("service");
  }

  if (!accionSeleccionada) {
    seleccionarAccion("promocionar");
  }

  await cargarPublicacionesDisponibles();
  actualizarResumen();
}

iniciarPagina();