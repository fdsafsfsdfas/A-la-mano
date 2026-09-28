window.registrarEvento = async function registrarEvento(
  providerId,
  eventType,
  metadata = {}
) {
  if (!providerId || !eventType) {
    console.error("Faltan datos para registrar el evento:", {
      providerId,
      eventType
    });

    return false;
  }

  const eventosPermitidos = [
    "profile_view",
    "phone_click",
    "whatsapp_click",
    "search_impression"
  ];

  if (!eventosPermitidos.includes(eventType)) {
    console.error("Tipo de evento no permitido:", eventType);
    return false;
  }

  try {
    const { error } = await db
      .from("analytics_events")
      .insert({
        provider_id: providerId,
        event_type: eventType,
        metadata
      });

    if (error) {
      console.error("Error registrando estadística:", error);
      return false;
    }

    console.log("Evento registrado:", eventType, providerId);
    return true;
  } catch (error) {
    console.error("Error inesperado registrando evento:", error);
    return false;
  }
};