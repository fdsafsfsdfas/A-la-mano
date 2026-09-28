async function requireAdmin() {
  const {
    data: sessionData,
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError || !sessionData?.session) {
    window.location.href = "admin-login.html";
    return false;
  }

  const user = sessionData.session.user;

  const {
    data: adminData,
    error: adminError
  } = await db
    .from("admin_users")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminError || !adminData) {
    console.error("Usuario no autorizado:", adminError);

    await db.auth.signOut();
    window.location.href = "admin-login.html";

    return false;
  }

  return true;
}

function formatStatus(status) {
  const mapa = {
    pending_payment: "Pendiente de pago",
    payment_review: "Revisión de pago",
    active: "Activo",
    rejected: "Rechazado",
    suspended: "Suspendido",
    expired: "Vencido",
    submitted: "En revisión",
    approved: "Aprobado",
    pending: "Pendiente"
  };

  return mapa[status] || status || "Sin estado";
}

function statusClass(status) {
  if (
    status === "active" ||
    status === "approved"
  ) {
    return "active";
  }

  if (
    status === "pending_payment" ||
    status === "payment_review" ||
    status === "submitted" ||
    status === "pending"
  ) {
    return "pending";
  }

  if (
    status === "rejected" ||
    status === "suspended" ||
    status === "expired"
  ) {
    return "rejected";
  }

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("es-CU", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-CU");
}

function formatMoney(value, currency = "CUP") {
  return `${Number(value || 0).toLocaleString("es-CU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency || "CUP"}`;
}

function renderAdminError(elementId, message) {
  const target = document.getElementById(elementId);

  if (!target) return;

  target.innerHTML = `
    <div class="admin-error">
      <strong>No se pudieron cargar los datos.</strong>
      <p>${escapeHtml(message || "Error desconocido")}</p>
    </div>
  `;
}

async function loadAdminData() {
  const {
    data: creditPurchasesData,
    error: creditPurchasesError
  } = await db
    .from("credit_purchases")
    .select(`
      id,
      provider_id,
      package_id,
      amount,
      credits,
      currency,
      payment_method,
      reference,
      payer_last4,
      confirmation_phone,
      transfer_date,
      submitted_at,
      created_at,
      reviewed_at,
      reviewed_by,
      approved_at,
      status,
      notes,
      providers (
        name,
        phone,
        whatsapp
      ),
      credit_packages (
        name,
        credits,
        price,
        currency
      )
    `)
    .eq("status", "submitted")
    .order("submitted_at", {
      ascending: false
    })
    .limit(50);

  if (creditPurchasesError) {
    console.error(
      "Error cargando compras de créditos:",
      creditPurchasesError
    );

    renderAdminError(
      "creditPurchasesTable",
      creditPurchasesError.message
    );
  } else {
    renderCreditPurchases(
      creditPurchasesData || []
    );
  }

  const {
    data: marketProductsData,
    error: marketProductsError
  } = await db
    .from("market_products")
    .select(`
      id,
      provider_id,
      seller_name,
      seller_phone,
      title,
      description,
      price,
      duration_days,
      publication_cost,
      status,
      expires_at,
      created_at
    `)
    .order("created_at", {
      ascending: false
    });

  if (marketProductsError) {
    console.error(
      "Error cargando productos del mercado:",
      marketProductsError
    );

    renderAdminError(
      "marketProductsTable",
      marketProductsError.message
    );

    renderAdminError(
      "activeMarketProductsTable",
      marketProductsError.message
    );
  } else {
    renderMarketProducts(
      marketProductsData || []
    );

    renderActiveMarketProducts(
      marketProductsData || []
    );
  }

  const {
    data: providersData,
    error: providersError
  } = await db
    .from("providers")
    .select(`
      *,
      categories (
        name
      ),
      municipalities (
        name
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (providersError) {
    console.error(
      "Error cargando proveedores:",
      providersError
    );

    renderAdminError(
      "providersTable",
      providersError.message
    );
  } else {
    renderProviders(
      providersData || []
    );
  }
}

function renderCreditPurchases(rows) {
  const target = document.getElementById(
    "creditPurchasesTable"
  );

  if (!target) {
    console.error(
      "No existe el elemento #creditPurchasesTable"
    );

    return;
  }

  if (!rows.length) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>No hay compras de créditos.</strong>
        <p>
          Las solicitudes nuevas aparecerán aquí
          cuando un proveedor envíe una compra.
        </p>
      </div>
    `;

    return;
  }

  target.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Paquete</th>
            <th>Monto</th>
            <th>Referencia</th>
            <th>Últimos 4</th>
            <th>Confirmación</th>
            <th>Transferencia</th>
            <th>Solicitud</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map((purchase) => {
            const pendiente =
              purchase.status === "submitted";

            const providerName =
              purchase.providers?.name ||
              "Sin nombre";

            const providerPhone =
              purchase.providers?.phone ||
              "-";

            const packageName =
              purchase.credit_packages?.name ||
              "Paquete de créditos";

            return `
              <tr>
                <td>
                  <strong>
                    ${escapeHtml(providerName)}
                  </strong>

                  <br>

                  <small>
                    ${escapeHtml(providerPhone)}
                  </small>
                </td>

                <td>
                  <strong>
                    ${escapeHtml(packageName)}
                  </strong>

                  <br>

                  <span>
                    ${escapeHtml(
                      formatNumber(purchase.credits)
                    )}
                    créditos
                  </span>
                </td>

                <td>
                  <strong>
                    ${escapeHtml(
                      formatMoney(
                        purchase.amount,
                        purchase.currency
                      )
                    )}
                  </strong>
                </td>

                <td>
                  ${escapeHtml(
                    purchase.reference || "-"
                  )}
                </td>

                <td>
                  ****${escapeHtml(
                    purchase.payer_last4 || "-"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    purchase.confirmation_phone || "-"
                  )}
                </td>

                <td>
                  ${formatDate(
                    purchase.transfer_date
                  )}
                </td>

                <td>
                  ${formatDate(
                    purchase.submitted_at ||
                    purchase.created_at
                  )}
                </td>

                <td>
                  <span class="status-pill ${statusClass(
                    purchase.status
                  )}">
                    ${escapeHtml(
                      formatStatus(purchase.status)
                    )}
                  </span>

                  ${
                    purchase.notes
                      ? `
                        <small class="purchase-notes">
                          ${escapeHtml(
                            purchase.notes
                          )}
                        </small>
                      `
                      : ""
                  }
                </td>

                <td>
                  ${
                    pendiente
                      ? `
                        <div class="purchase-actions">
                          <button
                            type="button"
                            class="btn btn-success"
                            data-action="approve-credit-purchase"
                            data-id="${escapeHtml(
                              purchase.id
                            )}"
                          >
                            Aprobar
                          </button>

                          <button
                            type="button"
                            class="btn btn-danger"
                            data-action="reject-credit-purchase"
                            data-id="${escapeHtml(
                              purchase.id
                            )}"
                          >
                            Rechazar
                          </button>
                        </div>
                      `
                      : `
                        <span class="reviewed-label">
                          Solicitud revisada
                        </span>
                      `
                  }
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMarketProducts(rows) {
  const target = document.getElementById(
    "marketProductsTable"
  );

  if (!target) {
    console.error(
      "No existe el elemento #marketProductsTable"
    );

    return;
  }

  if (!rows.length) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>No hay productos en el mercado.</strong>
      </div>
    `;

    return;
  }

  target.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Duración</th>
            <th>Estado</th>
            <th>Vence</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map((product) => `
            <tr>
              <td>
                <strong>
                  ${escapeHtml(
                    product.seller_name ||
                    "Sin nombre"
                  )}
                </strong>

                <br>

                ${escapeHtml(
                  product.seller_phone || "-"
                )}
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    product.title ||
                    "Sin título"
                  )}
                </strong>

                <br>

                ${escapeHtml(
                  (product.description || "")
                    .slice(0, 80)
                )}
              </td>

              <td>
                ${escapeHtml(
                  formatMoney(product.price, "CUP")
                )}
              </td>

              <td>
                ${escapeHtml(
                  String(
                    product.duration_days || 0
                  )
                )}
                días
              </td>

              <td>
                <span class="status-pill ${statusClass(
                  product.status
                )}">
                  ${escapeHtml(
                    formatStatus(product.status)
                  )}
                </span>
              </td>

              <td>
                ${formatDate(product.expires_at)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderActiveMarketProducts(rows) {
  const target = document.getElementById(
    "activeMarketProductsTable"
  );

  if (!target) {
    console.error(
      "No existe el elemento #activeMarketProductsTable"
    );

    return;
  }

  const ahora = new Date();

  const productosActivos = rows.filter((product) => {
    if (product.status !== "active") {
      return false;
    }

    if (!product.expires_at) {
      return false;
    }

    const fechaVencimiento =
      new Date(product.expires_at);

    return fechaVencimiento > ahora;
  });

  if (!productosActivos.length) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>
          No hay productos activos actualmente.
        </strong>
      </div>
    `;

    return;
  }

  target.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Duración</th>
            <th>Estado</th>
            <th>Vencimiento</th>
          </tr>
        </thead>

        <tbody>
          ${productosActivos.map((product) => `
            <tr>
              <td>
                <strong>
                  ${escapeHtml(
                    product.seller_name ||
                    "Sin nombre"
                  )}
                </strong>

                <br>

                ${escapeHtml(
                  product.seller_phone || "-"
                )}
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    product.title ||
                    "Sin título"
                  )}
                </strong>

                <br>

                ${escapeHtml(
                  (product.description || "")
                    .slice(0, 80)
                )}
              </td>

              <td>
                ${escapeHtml(
                  formatMoney(product.price, "CUP")
                )}
              </td>

              <td>
                ${escapeHtml(
                  String(
                    product.duration_days || 0
                  )
                )}
                días
              </td>

              <td>
                <span class="status-pill active">
                  Activo
                </span>
              </td>

              <td>
                ${formatDate(product.expires_at)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProviders(rows) {
  const target = document.getElementById(
    "providersTable"
  );

  if (!target) {
    console.error(
      "No existe el elemento #providersTable"
    );

    return;
  }

  if (!rows.length) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>
          No hay proveedores registrados.
        </strong>
      </div>
    `;

    return;
  }

  target.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Municipio</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Vencimiento</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map((provider) => `
            <tr>
              <td>
                ${escapeHtml(
                  provider.name || "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  provider.categories?.name || "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  provider.municipalities?.name || "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  provider.phone || "-"
                )}
              </td>

              <td>
                <span class="status-pill ${statusClass(
                  provider.status
                )}">
                  ${escapeHtml(
                    formatStatus(provider.status)
                  )}
                </span>
              </td>

              <td>
                ${formatDate(provider.expires_at)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function getCurrentAdminId() {
  const {
    data: sessionData
  } = await db.auth.getSession();

  return sessionData?.session?.user?.id || null;
}

async function handleCreditPurchaseAction(id, action) {
  if (!id) return;

  const adminId = await getCurrentAdminId();

  if (!adminId) {
    alert("La sesión del administrador ha expirado.");
    window.location.href = "admin-login.html";
    return;
  }

  const {
    data: purchase,
    error: purchaseError
  } = await db
    .from("credit_purchases")
    .select(`
      id,
      provider_id,
      credits,
      status
    `)
    .eq("id", id)
    .single();

  if (purchaseError || !purchase) {
    console.error(
      "Error consultando compra:",
      purchaseError
    );

    alert("No se encontró la compra de créditos.");
    return;
  }

  if (purchase.status !== "submitted") {
    alert(
      `Esta solicitud ya fue revisada: ${formatStatus(
        purchase.status
      )}.`
    );

    await loadAdminData();
    return;
  }

  if (action === "approve-credit-purchase") {
    const confirmar = confirm(
      "¿Confirmas que deseas aprobar esta compra y acreditar los créditos?"
    );

    if (!confirmar) return;

    const {
      data: account,
      error: accountError
    } = await db
      .from("credit_accounts")
      .select("provider_id, balance")
      .eq("provider_id", purchase.provider_id)
      .maybeSingle();

    if (accountError) {
      console.error(
        "Error leyendo cuenta de créditos:",
        accountError
      );

      alert(
        "No se pudo leer la cuenta de créditos del proveedor."
      );

      return;
    }

    /*
     * Si no existe cuenta, usa la función SQL encargada
     * de crearla y aprobar la compra.
     */
    if (!account) {
      const {
        data: rpcData,
        error: rpcError
      } = await db.rpc(
        "aprobar_compra_creditos",
        {
          p_purchase_id: purchase.id,
          p_admin_id: adminId
        }
      );

      if (rpcError || !rpcData?.ok) {
        console.error(
          "Error aprobando compra mediante RPC:",
          rpcError || rpcData
        );

        alert(
          rpcData?.message ||
          rpcError?.message ||
          "No se pudo aprobar la compra."
        );

        return;
      }

      alert(
        rpcData.message ||
        "Compra de créditos aprobada."
      );

      await loadAdminData();
      return;
    }

    const nuevoSaldo =
      Number(account.balance || 0) +
      Number(purchase.credits || 0);

    const {
      error: updateAccountError
    } = await db
      .from("credit_accounts")
      .update({
        balance: nuevoSaldo,
        updated_at: new Date().toISOString()
      })
      .eq("provider_id", purchase.provider_id);

    if (updateAccountError) {
      console.error(
        "Error actualizando saldo:",
        updateAccountError
      );

      alert(
        "No se pudo actualizar el saldo del proveedor."
      );

      return;
    }

    const {
      error: txError
    } = await db
      .from("credit_transactions")
      .insert({
        provider_id: purchase.provider_id,
        amount: Number(purchase.credits || 0),
        type: "purchase",
        description: "Compra de créditos aprobada",
        reference_type: "credit_purchase",
        reference_id: purchase.id
      });

    if (txError) {
      console.error(
        "Error registrando transacción:",
        txError
      );

      alert(
        "El saldo fue actualizado, pero no se registró el movimiento."
      );

      return;
    }

    const ahora = new Date().toISOString();

    const {
      error: purchaseUpdateError
    } = await db
      .from("credit_purchases")
      .update({
        status: "approved",
        reviewed_at: ahora,
        reviewed_by: adminId,
        approved_at: ahora
      })
      .eq("id", id)
      .eq("status", "submitted");

    if (purchaseUpdateError) {
      console.error(
        "Error actualizando compra:",
        purchaseUpdateError
      );

      alert(
        "El saldo se actualizó, pero no se pudo marcar la compra como aprobada."
      );

      return;
    }

    alert("Compra de créditos aprobada.");
    await loadAdminData();
  }

  if (action === "reject-credit-purchase") {
    const reason = prompt(
      "Escribe el motivo del rechazo:"
    );

    if (reason === null) {
      return;
    }

    const ahora = new Date().toISOString();

    const {
      error: purchaseUpdateError
    } = await db
      .from("credit_purchases")
      .update({
        status: "rejected",
        reviewed_at: ahora,
        reviewed_by: adminId,
        notes:
          reason.trim() ||
          "Compra rechazada por el administrador"
      })
      .eq("id", id)
      .eq("status", "submitted");

    if (purchaseUpdateError) {
      console.error(
        "Error rechazando compra:",
        purchaseUpdateError
      );

      alert(
        "No se pudo rechazar la compra."
      );

      return;
    }

    alert("Compra de créditos rechazada.");
    await loadAdminData();
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (!action || !id) return;

  if (
    action === "approve-credit-purchase" ||
    action === "reject-credit-purchase"
  ) {
    await handleCreditPurchaseAction(
      id,
      action
    );
  }
});

document
  .getElementById("logoutBtn")
  ?.addEventListener("click", async (event) => {
    event.preventDefault();

    await db.auth.signOut();

    localStorage.removeItem("user_role");
    localStorage.removeItem("provider_id");

    window.location.href = "admin-login.html";
  });

async function init() {
  const isAdmin = await requireAdmin();

  if (!isAdmin) return;

  await loadAdminData();
}

init();