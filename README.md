# Backend del Proyecto Inmobiliario

Este directorio contiene el backend de la aplicación, desarrollado en Node.js con el framework Express.js.

## Propósito

La API se encarga de orquestar la lógica de negocio, incluyendo:
-   Gestión de propiedades.
-   Comunicación con las APIs de IA (Speech-to-Text, LLM).
-   Interacción con la base de datos PostgreSQL.

## Configuración Inicial

1.  Navega a este directorio (`/backend`).
2.  Instala las dependencias necesarias ejecutando:
    ```bash
    npm install
    ```

## Dependencias Principales

-   **Express.js**: Framework web para construir la API REST.
-   **pg**: Cliente de PostgreSQL para Node.js, utilizado para la comunicación con la base de datos Neon.

---

## Configuración de Nodemon (`nodemon.json`)

Se ha añadido un archivo `nodemon.json` para configurar el comportamiento de `nodemon`. Por defecto, `nodemon` no reinicia el servidor cuando se realizan cambios en archivos `.env`. Este archivo de configuración le indica explícitamente que vigile los cambios en los archivos con extensión `.env`, además de los habituales (`.js`, `.json`), asegurando que los cambios en las variables de entorno se carguen automáticamente durante el desarrollo.
