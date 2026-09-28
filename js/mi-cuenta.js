const logoutBtn =
  document.getElementById("logoutBtn");

const publishServiceBtn =
  document.getElementById("publishServiceBtn");

let intervaloMembresia = null;

function setMensaje(texto, tipo = "error") {
  const elemento =
    document.getElementById("mensaje");

  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `alert ${tipo}`;
  elemento.style.display = "block";
}

function traducirEstado(status) {
  const estados = {
    pending_payment: "Pendiente de pago",
    payment_review: "Pago en revisión",
    submitted: "En revisión",
    approved: "Aprobada",
    completed: "Completada",
    active: "Activo",
    paused: "Pausado",
    rejected: "Rechazada",
    suspended: "Suspendido",
    expired: "Vencido",
    sold: "Vendido"
  };

  return estados[status] || status || "Desconocido";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obtenerFechaValida(value) {
  if (!value) return null;

  const fecha = new Date(value);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
}

/*
 * Cerrar sesión
 */
if (logoutBtn) {
  logoutBtn.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();

      await db.auth.signOut();

      localStorage.removeItem("user_role");
      localStorage.removeItem("provider_id");

      window.location.href =
        "login-proveedor.html";
    }
  );
}

/*
 * Mostrar una sola sección de la cuenta
 */
function mostrarSeccionAccount(sectionId) {
  document
    .querySelectorAll(".account-section")
    .forEach((section) => {
      section.classList.toggle(
        "active",
        section.id === sectionId
      );
    });

  document
    .querySelectorAll(
      ".account-action-btn[data-target]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.target === sectionId
      );
    });
}

/*
 * Botones de navegación de Mi cuenta
 */
document
  .querySelectorAll(
    ".account-action-btn[data-target]"
  )
  .forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;

      if (!target) return;

      mostrarSeccionAccount(target);
    });
  });

/*
 * Carga de municipios y categorías
 */
async function cargarMunicipiosYCategorias() {
  const municipioSelect =
    document.getElementById("municipio");

  const categoriaSelect =
    document.getElementById("categoria");

  if (!municipioSelect || !categoriaSelect) {
    return;
  }

  const [
    municipiosRes,
    categoriasRes
  ] = await Promise.all([
    db
      .from("municipalities")
      .select("id, name")
      .eq("active", true)
      .order("name"),

    db
      .from("categories")
      .select("id, name")
      .eq("active", true)
      .order("name")
  ]);

  if (municipiosRes.error) {
    console.error(
      "Error cargando municipios:",
      municipiosRes.error
    );

    setMensaje(
      "No se pudieron cargar los municipios.",
      "error"
    );

    return;
  }

  if (categoriasRes.error) {
    console.error(
      "Error cargando categorías:",
      categoriasRes.error
    );

    setMensaje(
      "No se pudieron cargar las categorías.",
      "error"
    );

    return;
  }

  municipioSelect.innerHTML =
    '<option value="">Selecciona municipio</option>';

  categoriaSelect.innerHTML =
    '<option value="">Selecciona categoría</option>';

  (municipiosRes.data || []).forEach(
    (municipio) => {
      const option =
        document.createElement("option");

      option.value = municipio.id;
      option.textContent = municipio.name;

      municipioSelect.appendChild(option);
    }
  );

  (categoriasRes.data || []).forEach(
    (categoria) => {
      const option =
        document.createElement("option");

      option.value = categoria.id;
      option.textContent = categoria.name;

      categoriaSelect.appendChild(option);
    }
  );
}

/*
 * Obtener el proveedor autenticado
 */
async function obtenerProveedorActual() {
  const {
    data: sessionData,
    error: sessionError
  } = await db.auth.getSession();

  if (
    sessionError ||
    !sessionData?.session
  ) {
    window.location.href =
      "login-proveedor.html";

    return null;
  }

  const user =
    sessionData.session.user;

  const {
    data: provider,
    error: providerError
  } = await db
    .from("providers")
    .select(`
      *,
      municipalities ( name ),
      categories ( name )
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (providerError) {
    console.error(
      "Error consultando proveedor:",
      providerError
    );

    setMensaje(
      "No se pudo cargar tu perfil.",
      "error"
    );

    return null;
  }

  if (!provider) {
    setMensaje(
      "Tu cuenta no tiene un perfil de proveedor registrado.",
      "error"
    );

    return null;
  }

  return provider;
}

/*
 * Estado del proveedor
 */
function mostrarEstadoProveedor(status) {
  const statusValue =
    document.getElementById("statusValue");

  const statusBadge =
    document.getElementById("statusBadge");

  const texto =
    traducirEstado(status);

  if (statusValue) {
    statusValue.textContent = texto;
  }

  if (statusBadge) {
    statusBadge.textContent = texto;

    if (
      status === "pending_payment" ||
      status === "payment_review"
    ) {
      statusBadge.className =
        "status-badge pending";
    } else if (
      status === "rejected" ||
      status === "suspended"
    ) {
      statusBadge.className =
        "status-badge rejected";
    } else {
      statusBadge.className =
        "status-badge";
    }
  }
}

/*
 * Rellenar formulario del perfil
 */
function rellenarFormularioPerfil(provider) {
  const campos = {
    name: provider.name,
    business_name: provider.business_name,
    phone: provider.phone,
    whatsapp: provider.whatsapp,
    barrio: provider.barrio,
    schedule: provider.schedule,
    description: provider.description,
    availability:
      provider.availability || "Disponible",
    municipio: provider.municipality_id,
    categoria: provider.category_id
  };

  Object.entries(campos).forEach(
    ([id, valor]) => {
      const elemento =
        document.getElementById(id);

      if (elemento) {
        elemento.value = valor || "";
      }
    }
  );

  const municipioValue =
    document.getElementById("municipioValue");

  const categoriaValue =
    document.getElementById("categoriaValue");

  if (municipioValue) {
    municipioValue.textContent =
      provider.municipalities?.name || "-";
  }

  if (categoriaValue) {
    categoriaValue.textContent =
      provider.categories?.name || "-";
  }
}

/*
 * Créditos
 */
async function obtenerSaldoActual(providerId) {
  if (!providerId) return 0;

  const {
    data,
    error
  } = await db
    .from("credit_accounts")
    .select("balance")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    console.error(
      "Error obteniendo saldo:",
      error
    );

    return 0;
  }

  return Number(data?.balance || 0);
}

async function descontarCreditos(
  providerId,
  cantidad,
  descripcion
) {
  const cuentaActual =
    await obtenerSaldoActual(providerId);

  if (cuentaActual < cantidad) {
    return false;
  }

  const nuevoSaldo =
    cuentaActual - cantidad;

  const {
    error: updateError
  } = await db
    .from("credit_accounts")
    .update({
      balance: nuevoSaldo,
      updated_at: new Date().toISOString()
    })
    .eq("provider_id", providerId);

  if (updateError) {
    console.error(
      "Error actualizando saldo:",
      updateError
    );

    return false;
  }

  const {
    error: txError
  } = await db
    .from("credit_transactions")
    .insert({
      provider_id: providerId,
      amount: -cantidad,
      type: "service_publication",
      description:
        descripcion ||
        "Publicación de servicio",
      reference_type: "provider_publication",
      created_at: new Date().toISOString()
    });

  if (txError) {
    console.error(
      "Error registrando transacción:",
      txError
    );

    return false;
  }

  return true;
}

async function publicarServicioDesdeCuenta() {
  if (publishServiceBtn) {
    publishServiceBtn.disabled = true;
  }

  try {
    const provider =
      await obtenerProveedorActual();

    if (!provider) return;

    const ahora = new Date();

    const fechaExpiracion =
      obtenerFechaValida(provider.expires_at);

    const tieneServicioActivo =
      provider.status === "active" &&
      fechaExpiracion &&
      fechaExpiracion > ahora;

    if (tieneServicioActivo) {
      setMensaje(
        "Ya tienes un servicio activo. Puedes publicar otro servicio después de que expire.",
        "error"
      );

      return;
    }

    const esPrimeraPublicacionGratis =
      provider.first_publication_granted === false;

    if (esPrimeraPublicacionGratis) {
      const {
        error
      } = await db
        .from("providers")
        .update({
          first_publication_granted: true,
          status: "active",
          expires_at:
            new Date(
              ahora.getTime() +
              3 * 24 * 60 * 60 * 1000
            ).toISOString(),
          updated_at:
            new Date().toISOString()
        })
        .eq("id", provider.id);

      if (error) {
        console.error(
          "Error activando primera publicación:",
          error
        );

        setMensaje(
          "No se pudo activar tu primera publicación.",
          "error"
        );

        return;
      }

      setMensaje(
        "Tu primera publicación fue creada correctamente y es gratis.",
        "success"
      );

      await cargarPerfil();

      return;
    }

    const saldo =
      await obtenerSaldoActual(provider.id);

    if (saldo < 50) {
      setMensaje(
        "Necesitas 50 créditos para publicar otra publicación.",
        "error"
      );

      return;
    }

    const descuentoOk =
      await descontarCreditos(
        provider.id,
        50,
        "Publicación de servicio"
      );

    if (!descuentoOk) {
      setMensaje(
        "No se pudo descontar los 50 créditos.",
        "error"
      );

      return;
    }

    const {
      error: updateError
    } = await db
      .from("providers")
      .update({
        status: "active",
        expires_at:
          new Date(
            ahora.getTime() +
            3 * 24 * 60 * 60 * 1000
          ).toISOString(),
        updated_at:
          new Date().toISOString()
      })
      .eq("id", provider.id);

    if (updateError) {
      console.error(
        "Error activando servicio:",
        updateError
      );

      setMensaje(
        "No se pudo activar tu servicio.",
        "error"
      );

      return;
    }

    setMensaje(
      "Publicación realizada. Se descontaron 50 créditos.",
      "success"
    );

    await cargarPerfil();
  } finally {
    if (publishServiceBtn) {
      publishServiceBtn.disabled = false;
    }
  }
}

if (publishServiceBtn) {
  publishServiceBtn.addEventListener(
    "click",
    async () => {
      await publicarServicioDesdeCuenta();
    }
  );
}

/*
 * Cargar créditos e historial
 */
async function cargarCreditos(providerId) {
  const balanceElement =
    document.getElementById("creditBalance");

  const balanceTextElement =
    document.getElementById("creditBalanceText");

  const transactionsElement =
    document.getElementById("creditTransactions");

  if (!providerId) {
    if (balanceElement) {
      balanceElement.textContent = "0";
    }

    if (balanceTextElement) {
      balanceTextElement.textContent = "0";
    }

    if (transactionsElement) {
      transactionsElement.innerHTML =
        "<p>No se encontró el proveedor.</p>";
    }

    return;
  }

  const {
    data: account,
    error: accountError
  } = await db
    .from("credit_accounts")
    .select("balance")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (accountError) {
    console.error(
      "Error cargando saldo:",
      accountError
    );

    if (transactionsElement) {
      transactionsElement.innerHTML =
        "<p>No se pudo cargar el saldo de créditos.</p>";
    }

    return;
  }

  const saldo =
    Number(account?.balance || 0);

  if (balanceElement) {
    balanceElement.textContent =
      saldo.toLocaleString("es-CU");
  }

  if (balanceTextElement) {
    balanceTextElement.textContent =
      saldo.toLocaleString("es-CU");
  }

  const {
    data: purchases,
    error: purchasesError
  } = await db
    .from("credit_purchases")
    .select(`
      id,
      amount,
      credits,
      currency,
      reference,
      status,
      submitted_at,
      reviewed_at,
      approved_at,
      notes,
      credit_packages (
        name
      )
    `)
    .eq("provider_id", providerId)
    .order("submitted_at", {
      ascending: false
    })
    .limit(5);

  if (purchasesError) {
    console.error(
      "Error cargando compras:",
      purchasesError
    );
  }

  const {
    data: transactions,
    error: transactionsError
  } = await db
    .from("credit_transactions")
    .select(`
      id,
      amount,
      type,
      description,
      reference_type,
      reference_id,
      created_at
    `)
    .eq("provider_id", providerId)
    .order("created_at", {
      ascending: false
    })
    .limit(20);

  if (transactionsError) {
    console.error(
      "Error cargando movimientos:",
      transactionsError
    );
  }

  const purchaseIds =
    new Set(
      (purchases || []).map(
        (purchase) => purchase.id
      )
    );

  const otherTransactions =
    (transactions || []).filter(
      (transaction) => {
        const esCompra =
          transaction.reference_type ===
          "credit_purchase";

        const yaMostrada =
          purchaseIds.has(
            transaction.reference_id
          );

        return !(esCompra && yaMostrada);
      }
    );

  const purchaseMovements =
    (purchases || []).map(
      (purchase) => ({
        id: `purchase-${purchase.id}`,
        movementType: "purchase",
        amount: Number(
          purchase.credits || 0
        ),
        description:
          purchase.credit_packages?.name ||
          "Compra de créditos",
        status: purchase.status,
        reference: purchase.reference,
        notes: purchase.notes,
        created_at:
          purchase.submitted_at ||
          purchase.approved_at ||
          purchase.reviewed_at
      })
    );

  const normalMovements =
    otherTransactions.map(
      (transaction) => ({
        id: `transaction-${transaction.id}`,
        movementType: "transaction",
        amount: Number(
          transaction.amount || 0
        ),
        description:
          transaction.description ||
          "Movimiento de créditos",
        status: "completed",
        reference: null,
        notes: null,
        created_at:
          transaction.created_at
      })
    );

  const allMovements =
    [
      ...purchaseMovements,
      ...normalMovements
    ]
      .sort((a, b) => {
        const dateA =
          new Date(
            a.created_at || 0
          ).getTime();

        const dateB =
          new Date(
            b.created_at || 0
          ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);

  renderCreditTransactions(
    allMovements
  );
}

function renderCreditTransactions(
  movements
) {
  const target =
    document.getElementById(
      "creditTransactions"
    );

  if (!target) return;

  if (!movements.length) {
    target.innerHTML = `
      <div class="credit-history-empty">
        Aún no tienes movimientos de créditos.
      </div>
    `;

    return;
  }

  target.innerHTML = `
    <div class="credit-transaction-list">
      ${movements.map((movement) => {
        const amount =
          Number(movement.amount || 0);

        const positive = amount > 0;
        const sign = positive ? "+" : "";

        const date =
          movement.created_at
            ? new Date(
                movement.created_at
              ).toLocaleString(
                "es-CU",
                {
                  dateStyle: "short",
                  timeStyle: "short"
                }
              )
            : "-";

        const status =
          movement.status || "completed";

        const statusText =
          traducirEstado(status);

        let statusClass =
          "completed";

        if (status === "submitted") {
          statusClass = "submitted";
        }

        if (status === "approved") {
          statusClass = "approved";
        }

        if (status === "rejected") {
          statusClass = "rejected";
        }

        let message = "";

        if (status === "submitted") {
          message = `
            <p class="credit-history-message pending">
              Tu compra está pendiente de revisión.
            </p>
          `;
        }

        if (status === "approved") {
          message = `
            <p class="credit-history-message success">
              Compra aprobada. Los créditos fueron agregados a tu saldo.
            </p>
          `;
        }

        if (status === "rejected") {
          message = `
            <p class="credit-history-message rejected">
              ${escapeHtml(
                movement.notes ||
                "La compra fue rechazada."
              )}
            </p>
          `;
        }

        return `
          <article class="credit-transaction">
            <div class="credit-transaction-content">
              <div class="credit-transaction-description">
                ${escapeHtml(
                  movement.description
                )}
              </div>

              <span class="credit-transaction-date">
                ${escapeHtml(date)}
              </span>

              ${
                movement.reference
                  ? `
                    <span class="credit-transaction-reference">
                      Referencia:
                      ${escapeHtml(
                        movement.reference
                      )}
                    </span>
                  `
                  : ""
              }

              ${message}
            </div>

            <div class="credit-transaction-right">
              <span class="credit-status ${statusClass}">
                ${escapeHtml(
                  statusText
                )}
              </span>

              <div class="credit-transaction-amount ${
                positive
                  ? "positive"
                  : "negative"
              }">
                ${sign}${amount.toLocaleString(
                  "es-CU"
                )} créditos
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

/*
 * Cargar estadísticas
 */
async function cargarEstadisticas(providerId) {
  const eventos = [
    {
      tipo: "profile_view",
      elemento: "profileViews"
    },
    {
      tipo: "phone_click",
      elemento: "phoneClicks"
    },
    {
      tipo: "whatsapp_click",
      elemento: "whatsappClicks"
    },
    {
      tipo: "search_impression",
      elemento: "searchImpressions"
    }
  ];

  eventos.forEach((evento) => {
    const elemento =
      document.getElementById(
        evento.elemento
      );

    if (elemento) {
      elemento.textContent = "0";
    }
  });

  if (!providerId) return;

  for (const evento of eventos) {
    const {
      count,
      error
    } = await db
      .from("analytics_events")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("provider_id", providerId)
      .eq("event_type", evento.tipo);

    if (error) {
      console.error(
        `Error cargando ${evento.tipo}:`,
        error
      );

      continue;
    }

    const elemento =
      document.getElementById(
        evento.elemento
      );

    if (elemento) {
      elemento.textContent =
        count || 0;
    }
  }
}

/*
 * Contador de membresía
 */
function iniciarContadorMembresia(
  expiresAt
) {
  const countdown =
    document.getElementById(
      "membershipCountdown"
    );

  const membershipDate =
    document.getElementById(
      "membershipDate"
    );

  if (!countdown) return;

  if (intervaloMembresia) {
    clearInterval(intervaloMembresia);
  }

  const fechaVencimiento =
    obtenerFechaValida(expiresAt);

  if (!fechaVencimiento) {
    countdown.textContent =
      "Fecha no disponible";

    return;
  }

  if (membershipDate) {
    membershipDate.textContent =
      `Vence el ${fechaVencimiento.toLocaleString(
        "es-CU"
      )}`;
  }

  function actualizar() {
    const diferencia =
      fechaVencimiento.getTime() -
      Date.now();

    if (diferencia <= 0) {
      countdown.textContent =
        "Membresía vencida";

      if (intervaloMembresia) {
        clearInterval(
          intervaloMembresia
        );
      }

      return;
    }

    const dias = Math.floor(
      diferencia /
      (1000 * 60 * 60 * 24)
    );

    const horas = Math.floor(
      (diferencia /
        (1000 * 60 * 60)) %
        24
    );

    const minutos = Math.floor(
      (diferencia /
        (1000 * 60)) %
        60
    );

    const segundos = Math.floor(
      (diferencia / 1000) % 60
    );

    countdown.textContent =
      `${dias} días, ${horas} horas, ` +
      `${minutos} minutos y ${segundos} segundos`;
  }

  actualizar();

  intervaloMembresia =
    setInterval(actualizar, 1000);
}

/*
 * Actualizar estadísticas y membresía
 *
 * Las estadísticas se cargan siempre.
 * El contador solamente se muestra cuando
 * la publicación está activa.
 */
async function actualizarVistaMembresia(
  provider
) {
  const statsPanel =
    document.getElementById(
      "statsPanel"
    );

  const countdown =
    document.getElementById(
      "membershipCountdown"
    );

  const membershipDate =
    document.getElementById(
      "membershipDate"
    );

  if (statsPanel) {
    statsPanel.style.display =
      "block";
  }

  await cargarEstadisticas(
    provider.id
  );

  const fechaVencimiento =
    obtenerFechaValida(
      provider.expires_at
    );

  const membresiaActiva =
    provider.status === "active" &&
    fechaVencimiento &&
    fechaVencimiento > new Date();

  if (membresiaActiva) {
    if (countdown) {
      countdown.style.display =
        "block";
    }

    if (membershipDate) {
      membershipDate.style.display =
        "block";
    }

    iniciarContadorMembresia(
      provider.expires_at
    );

    return;
  }

  if (countdown) {
    countdown.textContent =
      "Membresía no activa";
    countdown.style.display =
      "block";
  }

  if (membershipDate) {
    membershipDate.textContent =
      "No tienes una publicación activa en este momento.";
    membershipDate.style.display =
      "block";
  }
}

/*
 * Cargar todos los datos del perfil
 */
async function cargarPerfil() {
  const provider =
    await obtenerProveedorActual();

  if (!provider) return;

  rellenarFormularioPerfil(
    provider
  );

  mostrarEstadoProveedor(
    provider.status
  );

  localStorage.setItem(
    "provider_id",
    provider.id
  );

  await cargarCreditos(
    provider.id
  );

  await actualizarVistaMembresia(
    provider
  );
}

/*
 * Guardar cambios del perfil
 */
const profileForm =
  document.getElementById(
    "profileForm"
  );

if (profileForm) {
  profileForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const {
        data: sessionData,
        error: sessionError
      } = await db.auth.getSession();

      if (
        sessionError ||
        !sessionData?.session
      ) {
        window.location.href =
          "login-proveedor.html";

        return;
      }

      const obtenerValor = (id) => {
        const elemento =
          document.getElementById(id);

        return elemento?.value?.trim() || "";
      };

      const authUserId =
        sessionData.session.user.id;

      const payload = {
        name: obtenerValor("name"),
        business_name:
          obtenerValor("business_name"),
        phone: obtenerValor("phone"),
        whatsapp:
          obtenerValor("whatsapp"),
        barrio:
          obtenerValor("barrio"),
        availability:
          document.getElementById(
            "availability"
          )?.value || "Disponible",
        schedule:
          obtenerValor("schedule"),
        municipality_id:
          document.getElementById(
            "municipio"
          )?.value || null,
        category_id:
          document.getElementById(
            "categoria"
          )?.value || null,
        description:
          obtenerValor("description"),
        updated_at:
          new Date().toISOString()
      };

      const {
        error
      } = await db
        .from("providers")
        .update(payload)
        .eq(
          "auth_user_id",
          authUserId
        );

      if (error) {
        console.error(
          "Error actualizando perfil:",
          error
        );

        setMensaje(
          "No se pudieron guardar los cambios.",
          "error"
        );

        return;
      }

      setMensaje(
        "Perfil actualizado correctamente.",
        "success"
      );

      await cargarPerfil();
    }
  );
}

/*
 * Inicialización
 */
async function init() {
  try {
    await cargarMunicipiosYCategorias();
    await cargarPerfil();

    /*
     * La sección de créditos se muestra
     * inicialmente. Las demás quedan ocultas
     * si el HTML usa la clase account-section.
     */
    mostrarSeccionAccount(
    "publicationSection"
  );
  } catch (error) {
    console.error(
      "Error inicializando Mi cuenta:",
      error
    );

    setMensaje(
      "No se pudo cargar completamente tu cuenta.",
      "error"
    );
  }
}

init();