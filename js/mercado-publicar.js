const COSTO_PUBLICACION = 50;
const DURACION_PUBLICACION = 3;
const DESTINO_PUBLICACION = "mercado-publicar.html";
const BUCKET_IMAGENES = "market-images";

const durationDays = document.getElementById("durationDays");
const costPreview = document.getElementById("costPreview");
const marketForm = document.getElementById("marketForm");
const publishProductBtn = document.getElementById("publishProductBtn");

let proveedorActual = null;
let saldoActual = 0;
let comprobacionFinalizada = false;

function mostrarMensaje(texto, tipo = "error") {
  const elemento = document.getElementById("mensaje");

  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `alert ${tipo}`;
  elemento.style.display = "block";
}

function actualizarCosto() {
  if (!costPreview) return;

  costPreview.innerHTML = `
    <strong>
      Costo: ${COSTO_PUBLICACION} créditos ·
      Duración: ${DURACION_PUBLICACION} días
    </strong>
  `;
}

function actualizarSaldoEnPantalla(saldo) {
  const saldoElement = document.getElementById("availableCredits");

  if (saldoElement) {
    saldoElement.textContent = Number(saldo || 0).toLocaleString("es-CU");
  }
}

function guardarDestinoPublicacion() {
  sessionStorage.setItem(
    "pagina_despues_login",
    DESTINO_PUBLICACION
  );
}

function cambiarEstadoFormulario(bloqueado) {
  if (!marketForm) return;

  const elementos = marketForm.querySelectorAll(
    "input, textarea, select, button"
  );

  elementos.forEach((elemento) => {
    elemento.disabled = bloqueado;
  });

  if (durationDays) {
    durationDays.value = String(DURACION_PUBLICACION);
  }
}

async function obtenerProveedorActual() {
  const {
    data: sessionData,
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError || !sessionData?.session) {
    guardarDestinoPublicacion();
    window.location.replace("login-proveedor.html");
    return null;
  }

  const user = sessionData.session.user;

  const {
    data: provider,
    error: providerError
  } = await db
    .from("providers")
    .select("id, name, phone, whatsapp")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (providerError) {
    console.error("Error consultando proveedor:", providerError);

    mostrarMensaje(
      "No se pudo comprobar tu perfil de proveedor.",
      "error"
    );

    return null;
  }

  if (!provider) {
    guardarDestinoPublicacion();
    window.location.replace("registro-proveedor.html");
    return null;
  }

  return provider;
}

async function cargarSaldoProveedor(providerId) {
  const {
    data,
    error
  } = await db
    .from("credit_accounts")
    .select("balance")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    console.error("Error cargando saldo:", error);

    mostrarMensaje(
      "No se pudo cargar tu saldo de créditos.",
      "error"
    );

    actualizarSaldoEnPantalla(0);
    saldoActual = 0;

    return false;
  }

  if (!data) {
    mostrarMensaje(
      "Tu cuenta no tiene una cuenta de créditos.",
      "error"
    );

    actualizarSaldoEnPantalla(0);
    saldoActual = 0;

    return false;
  }

  saldoActual = Number(data.balance || 0);
  actualizarSaldoEnPantalla(saldoActual);

  return true;
}

function completarDatosProveedor(provider) {
  const sellerName = document.getElementById("sellerName");
  const sellerPhone = document.getElementById("sellerPhone");
  const sellerWhatsapp = document.getElementById("sellerWhatsapp");

  if (sellerName && !sellerName.value) {
    sellerName.value = provider.name || "";
  }

  if (sellerPhone && !sellerPhone.value) {
    sellerPhone.value = provider.phone || "";
  }

  if (sellerWhatsapp && !sellerWhatsapp.value) {
    sellerWhatsapp.value = provider.whatsapp || "";
  }
}

async function comprobarAccesoInicial() {
  cambiarEstadoFormulario(true);

  const provider = await obtenerProveedorActual();

  if (!provider) {
    return;
  }

  proveedorActual = provider;
  actualizarInformacionCosto(provider);

  completarDatosProveedor(provider);

  const saldoCargado = await cargarSaldoProveedor(provider.id);

  if (!saldoCargado) {
    return;
  }

  comprobacionFinalizada = true;
  cambiarEstadoFormulario(false);

  if (durationDays) {
    durationDays.value = String(DURACION_PUBLICACION);
  }

  actualizarCosto();
}

function obtenerNombreArchivo(file) {
  const extension = file.name.includes(".")
    ? file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase()
    : "";

  const identificador =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${identificador}${extension}`;
}

async function subirImagen(file) {
  if (!file) return null;

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!tiposPermitidos.includes(file.type)) {
    throw new Error(
      "La imagen debe ser JPG, PNG o WEBP."
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      "La imagen no puede superar los 5 MB."
    );
  }

  const fileName = obtenerNombreArchivo(file);

  const {
    error: uploadError
  } = await db.storage
    .from(BUCKET_IMAGENES)
    .upload(fileName, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type
    });

  if (uploadError) {
    if (
      uploadError.message?.toLowerCase().includes("bucket not found")
    ) {
      throw new Error(
        "No existe el bucket market-images en Supabase."
      );
    }

    throw uploadError;
  }

  const {
    data: publicUrlData
  } = db.storage
    .from(BUCKET_IMAGENES)
    .getPublicUrl(fileName);

  return publicUrlData?.publicUrl || null;
}

function cambiarEstadoBoton(procesando, costo = null) {
  if (!publishProductBtn) return;

  publishProductBtn.disabled = procesando;

  if (procesando) {
    publishProductBtn.textContent = "Publicando...";
    return;
  }

  if (costo === 0) {
    publishProductBtn.textContent = "Publicar gratis";
  } else {
    publishProductBtn.textContent = "Publicar por 50 créditos";
  }
}

async function publicarProducto(event) {
  event.preventDefault();

  if (!comprobacionFinalizada || !proveedorActual) {
    mostrarMensaje(
      "Debes iniciar sesión como proveedor para publicar.",
      "error"
    );

    return;
  }

  cambiarEstadoBoton(true);

  try {
    const sellerName = document
      .getElementById("sellerName")
      ?.value
      .trim();

    const sellerPhone = document
      .getElementById("sellerPhone")
      ?.value
      .trim();

    const sellerWhatsapp = document
      .getElementById("sellerWhatsapp")
      ?.value
      .trim();

    const title = document
      .getElementById("title")
      ?.value
      .trim();

    const description = document
      .getElementById("description")
      ?.value
      .trim();

    const price = Number(
      document.getElementById("price")?.value || 0
    );

    const productImage = document
      .getElementById("productImage")
      ?.files?.[0];

    if (
      !sellerName ||
      !sellerPhone ||
      !title ||
      !description
    ) {
      mostrarMensaje(
        "Completa todos los campos obligatorios.",
        "error"
      );

      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      mostrarMensaje(
        "El precio debe ser mayor que cero.",
        "error"
      );

      return;
    }

    mostrarMensaje(
      "Procesando publicación...",
      "success"
    );

    let imageUrl = null;

    if (productImage) {
      imageUrl = await subirImagen(productImage);
    }

    const {
      data,
      error
    } = await db.rpc(
      "publicar_producto_con_creditos",
      {
        p_provider_id: proveedorActual.id,
        p_title: title,
        p_description: description,
        p_price: price,
        p_duration_days: DURACION_PUBLICACION,
        p_seller_name: sellerName,
        p_seller_phone: sellerPhone,
        p_seller_whatsapp: sellerWhatsapp || null,
        p_image_url: imageUrl
      }
    );

    if (error) {
      console.error(
        "Error publicando producto:",
        error
      );

      mostrarMensaje(
        error.message ||
          "No se pudo publicar el producto.",
        "error"
      );

      return;
    }

    if (!data?.ok) {
      mostrarMensaje(
        data?.message ||
          `Necesitas ${COSTO_PUBLICACION} créditos.`,
        "error"
      );

      await cargarSaldoProveedor(proveedorActual.id);
      return;
    }

    const costoReal = Number(data.cost || 0);

    if (costoReal > 0) {
      saldoActual -= costoReal;
    }

    actualizarSaldoEnPantalla(saldoActual);

    mostrarMensaje(
      data.message ||
        (
          costoReal === 0
            ? "Tu primera publicación fue creada gratis."
            : `Producto publicado. Se descontaron ${costoReal} créditos.`
        ),
      "success"
    );

    if (marketForm) {
      marketForm.reset();
    }

    completarDatosProveedor(proveedorActual);

    if (durationDays) {
      durationDays.value = String(DURACION_PUBLICACION);
    }

    actualizarCosto();

    setTimeout(() => {
      window.location.href = "mercado.html";
    }, 1800);
  } catch (error) {
    console.error(
      "Error inesperado:",
      error
    );

    mostrarMensaje(
      error.message ||
        "Ocurrió un error al publicar.",
      "error"
    );
  }finally {
  cambiarEstadoBoton(false, null);
}
}

if (marketForm) {
  marketForm.addEventListener(
    "submit",
    publicarProducto
  );
}

if (durationDays) {
  durationDays.value = String(DURACION_PUBLICACION);
}

function actualizarInformacionCosto(provider) {
  const costPreview = document.getElementById("costPreview");
  const costText = document.getElementById("publicationCostText");
  const button = document.getElementById("publishProductBtn");

  const primeraGratis =
    provider?.first_publication_granted === false;

  const texto = primeraGratis
    ? "Primera publicación gratis · Duración: 3 días"
    : "Costo: 50 créditos · Duración: 3 días";

  if (costPreview) {
    costPreview.innerHTML = `<strong>${texto}</strong>`;
  }

  if (costText) {
    costText.textContent = primeraGratis
      ? "Tu primera publicación no consume créditos."
      : "Las siguientes publicaciones cuestan 50 créditos.";
  }

  if (button && !button.disabled) {
    button.textContent = primeraGratis
      ? "Publicar gratis"
      : "Publicar por 50 créditos";
  }
}

actualizarCosto();
comprobarAccesoInicial();