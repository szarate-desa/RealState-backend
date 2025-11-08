 1. Pantalla Principal / Home (Búsqueda y Visualización)

  El objetivo es que los compradores encuentren propiedades.
   * Mapa Interactivo (Elemento Central):
       * Debe ocupar un lugar predominante.
       * Mostrar pines para cada propiedad disponible.
       * Al hacer clic en un pin, mostrar una tarjeta de resumen (foto, título, precio).
   * Lista de Resultados:
       * Una vista de lista o tarjetas que corre en paralelo o debajo del mapa.
       * Cada tarjeta debe ser un resumen atractivo de la propiedad.
   * Barra de Búsqueda Principal:
       * Para buscar por ciudad, barrio o dirección.
   * Botón de Filtros Avanzados:
       * Un botón visible que abre un panel con más opciones de filtro.
   * Panel de Filtros:
       * Tipo de propiedad (Casa, Apartamento).
       * Rango de precios.
       * Número de habitaciones y baños.
       * (Futuro) Amenidades.
   * Botón "Crear Publicación":
       * Un llamado a la acción claro y accesible para que los usuarios inicien el proceso de creación.

  2. Pantalla de "Crear Nueva Publicación" (El Flujo Innovador)

  Esta es la pantalla más importante según el documento. Debe ser un asistente que guíe al usuario paso a paso.

   * Paso 1: Ubicación Precisa
       * Un mapa grande donde el usuario puede:
           * Buscar una dirección inicial.
           * Mover un pin para ajustar la ubicación exacta del inmueble.
       * Un botón de "Confirmar Ubicación" que congela la selección y pasa al siguiente paso.

   * Paso 2: Descripción por Voz
       * Un botón grande y claro para "Grabar Audio".
       * Indicaciones visuales de que la grabación está en curso (ej. un cronómetro o una onda de sonido).
       * Botones para "Pausar", "Detener" y "Volver a grabar".
       * Instrucciones simples en pantalla, como: "Ahora, describe tu propiedad. Menciona sus puntos fuertes, distribución y cualquier detalle
         que consideres importante."

   * Paso 3: Procesamiento (Feedback al Usuario)
       * Una vez detenido el audio, la interfaz debe mostrar un estado de "Procesando..." o "Generando anuncio con IA...".
       * Esto es crucial para que el usuario sepa que el sistema está trabajando (transcribiendo, llamando a las APIs, etc.).

   * Paso 4: Revisión y Edición
       * Mostrar el resultado generado por la IA:
           * Título sugerido (en un campo editable).
           * Descripción sugerida (en un área de texto editable).
       * Mostrar los datos extraídos de la geolocalización (ej. "Barrio: El Poblado", "Puntos de interés cercanos: ...").
       * Permitir al usuario editar manualmente el texto generado.
       * Incluir el resto de campos del formulario que la IA no puede adivinar (precio, número de habitaciones, etc., aunque algunos ya los
         tenemos en el formulario actual).
       * Un cargador de imágenes.
       * Un botón final de "Publicar".

  3. Pantalla de Detalle de la Propiedad

  Lo que ve un comprador al seleccionar una propiedad.
   * Galería de Imágenes: Un carrusel o grilla para visualizar las fotos.
   * Título y Precio: Claramente visibles en la parte superior.
   * Descripción Completa: El texto del anuncio.
   * Sección de Características: Iconos y texto para habitaciones, baños, superficie, etc.
   * Sección de "Contexto del Entorno" (Generado por IA): Mostrar los puntos de interés y datos del barrio.
   * Mapa de Ubicación: Un pequeño mapa mostrando dónde está la propiedad.
   * Botón de "Guardar en Favoritos".
   * Información de Contacto del Vendedor o un formulario para enviar un mensaje.

  4. Perfil de Usuario
   * Mis Publicaciones: Una lista de las propiedades que el usuario ha publicado.
   * Mis Favoritos: Una lista de las propiedades que ha guardado.
   * Datos básicos del perfil (nombre, etc.).