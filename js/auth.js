async function cargarMunicipiosYCategorias() {
  const municipioSelect = document.getElementById("municipio");
  const categoriaSelect = document.getElementById("categoria");

  if (!municipioSelect || !categoriaSelect) {
    return;
  }

  const [
    municipiosRes,
    categoriasRes
  ] = await Promise.all([
    db
      .from("municipalities")
      .select("*")
      .eq("active", true)
      .order("name"),

    db
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("name")
  ]);

  if (municipiosRes.error) {
    console.error(
      "Error municipios:",
      municipiosRes.error
    );
    return;
  }

  if (categoriasRes.error) {
    console.error(
      "Error categorías:",
      categoriasRes.error
    );
    return;
  }

  municipioSelect.innerHTML =
    '<option value="">Selecciona municipio</option>';

  categoriaSelect.innerHTML =
    '<option value="">Selecciona categoría</option>';

  (municipiosRes.data || []).forEach((municipio) => {
    const option = document.createElement("option");

    option.value = municipio.id;
    option.textContent = municipio.name;

    municipioSelect.appendChild(option);
  });

  (categoriasRes.data || []).forEach((categoria) => {
    const option = document.createElement("option");

    option.value = categoria.id;
    option.textContent = categoria.name;

    categoriaSelect.appendChild(option);
  });
}

function mostrarMensaje(texto, tipo = "error") {
  const elemento = document.getElementById("mensaje");

  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `alert ${tipo}`;
  elemento.style.display = "block";
}

function obtenerDestinoDespuesLogin() {
  const destino = sessionStorage.getItem(
    "pagina_despues_login"
  );

  if (!destino) {
    return "mi-cuenta.html";
  }

  /*
   * Solo permitimos páginas internas conocidas.
   * Así evitamos redirecciones externas o valores incorrectos.
   */
  const destinosPermitidos = [
    "mercado-publicar.html",
    "mis-productos.html",
    "mi-cuenta.html"
  ];

  return destinosPermitidos.includes(destino)
    ? destino
    : "mi-cuenta.html";
}

async function registerProvider(event) {
  event.preventDefault();

  const form = event.target;

  const email = document
    .getElementById("email")
    ?.value
    .trim();

  const password = document
    .getElementById("password")
    ?.value
    .trim();

  const name = document
    .getElementById("name")
    ?.value
    .trim();

  const businessName = document
    .getElementById("business_name")
    ?.value
    .trim();

  const phone = document
    .getElementById("phone")
    ?.value
    .trim();

  const whatsapp = document
    .getElementById("whatsapp")
    ?.value
    .trim();

  const municipalityId =
    document.getElementById("municipio")?.value;

  const categoryId =
    document.getElementById("categoria")?.value;

  const barrio = document
    .getElementById("barrio")
    ?.value
    .trim();

  const description = document
    .getElementById("description")
    ?.value
    .trim();

  const schedule = document
    .getElementById("schedule")
    ?.value
    .trim();

  if (
    !email ||
    !password ||
    !name ||
    !phone ||
    !municipalityId ||
    !categoryId ||
    !description
  ) {
    mostrarMensaje(
      "Completa todos los campos obligatorios.",
      "error"
    );
    return;
  }

  try {
    mostrarMensaje(
      "Creando usuario...",
      "success"
    );

    const {
      data: authData,
      error: signUpError
    } = await db.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      throw signUpError;
    }

    const authUser = authData?.user;

    if (!authUser) {
      throw new Error(
        "No se pudo crear la cuenta."
      );
    }

    const {
      data: providerData,
      error: insertError
    } = await db
      .from("providers")
      .insert([
        {
          auth_user_id: authUser.id,
          name,
          business_name: businessName || null,
          phone,
          whatsapp: whatsapp || null,
          municipality_id: municipalityId,
          category_id: categoryId,
          barrio: barrio || null,
          description,
          schedule: schedule || null,
          availability: "Disponible",
          status: "active"
        }
      ])
      .select("id")
      .single();

    if (insertError) {
      console.error(
        "Error insertando perfil:",
        insertError
      );
      throw insertError;
    }

    if (!providerData?.id) {
      throw new Error(
        "No se pudo obtener el ID del proveedor."
      );
    }

    const {
      error: creditAccountError
    } = await db
      .from("credit_accounts")
      .insert({
        provider_id: providerData.id,
        balance: 150
      });

    if (creditAccountError) {
      console.error(
        "Error creando cuenta de créditos:",
        creditAccountError
      );
      throw creditAccountError;
    }

    const {
      error: creditTransactionError
    } = await db
      .from("credit_transactions")
      .insert({
        provider_id: providerData.id,
        amount: 150,
        type: "welcome_bonus",
        description:
          "Bono de bienvenida por registro"
      });

    if (creditTransactionError) {
      console.error(
        "Error registrando bono:",
        creditTransactionError
      );
      throw creditTransactionError;
    }

    form.reset();

    mostrarMensaje(
      "Cuenta creada correctamente. Recibiste 150 créditos de bienvenida.",
      "success"
    );

    /*
     * Se conserva pagina_despues_login.
     * Así, después del registro, el usuario entra al login
     * y luego regresa a mercado-publicar.html.
     */
    setTimeout(() => {
      window.location.href = "login-proveedor.html";
    }, 1800);
  } catch (error) {
    console.error(error);

    mostrarMensaje(
      error.message ||
        "Error al crear el usuario.",
      "error"
    );
  }
}

async function loginProvider(event) {
  event.preventDefault();

  const email = document
    .getElementById("email")
    ?.value
    .trim();

  const password = document
    .getElementById("password")
    ?.value
    .trim();

  if (!email || !password) {
    mostrarMensaje(
      "Debes escribir correo y contraseña.",
      "error"
    );
    return;
  }

  try {
    const {
      data,
      error
    } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const user = data?.user;

    if (!user) {
      throw new Error(
        "No se pudo iniciar sesión."
      );
    }

    const {
      data: providerData,
      error: providerError
    } = await db
      .from("providers")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (providerError || !providerData) {
      await db.auth.signOut();

      throw new Error(
        "Este usuario no tiene un perfil de proveedor registrado."
      );
    }

    localStorage.setItem(
      "user_role",
      "provider"
    );

    localStorage.setItem(
      "provider_id",
      providerData.id
    );

    const destino = obtenerDestinoDespuesLogin();

    sessionStorage.removeItem(
      "pagina_despues_login"
    );

    window.location.href = destino;
  } catch (error) {
    console.error(error);

    mostrarMensaje(
      error.message ||
        "Credenciales inválidas.",
      "error"
    );
  }
}

async function loginAdmin(event) {
  event.preventDefault();

  const email = document
    .getElementById("email")
    ?.value
    .trim();

  const password = document
    .getElementById("password")
    ?.value
    .trim();

  if (!email || !password) {
    mostrarMensaje(
      "Debes escribir correo y contraseña.",
      "error"
    );
    return;
  }

  try {
    const {
      data,
      error
    } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const user = data?.user;

    if (!user) {
      throw new Error(
        "No se pudo iniciar sesión."
      );
    }

    const {
      data: adminData,
      error: adminError
    } = await db
      .from("admin_users")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    if (adminError || !adminData) {
      await db.auth.signOut();

      throw new Error(
        "No tienes permisos de administrador."
      );
    }

    localStorage.setItem(
      "user_role",
      "admin"
    );

    window.location.href =
      "admin-panel.html";
  } catch (error) {
    console.error(error);

    mostrarMensaje(
      error.message ||
        "No tienes acceso como administrador.",
      "error"
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const registroForm =
      document.getElementById(
        "registroProveedorForm"
      );

    const loginProveedorForm =
      document.getElementById(
        "loginProveedorForm"
      );

    const loginAdminForm =
      document.getElementById(
        "loginAdminForm"
      );

    if (registroForm) {
      registroForm.addEventListener(
        "submit",
        registerProvider
      );
    }

    if (loginProveedorForm) {
      loginProveedorForm.addEventListener(
        "submit",
        loginProvider
      );
    }

    if (loginAdminForm) {
      loginAdminForm.addEventListener(
        "submit",
        loginAdmin
      );
    }
  }
);