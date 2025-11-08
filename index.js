// ========================
// Imports y configuración
// ========================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Routers
const departamentoRouter = require('./routes/departamento');
const usuariosRouter = require('./routes/usuarios');
const paisesRouter = require('./routes/paises');
const ciudadesRouter = require('./routes/ciudades');
const tiposPropiedadRouter = require('./routes/cat_inmueble_tipo');
const propiedadesRouter = require('./routes/propiedades');
const imagenesPropiedadesRouter = require('./routes/propiedad_imagenes');
const favoritosRouter = require('./routes/favoritos');
const categoriasAudioRouter = require('./routes/categorias_audio');
const procesamientosAudioRouter = require('./routes/procesamientos_audio');
const iaRouter = require('./routes/ia');
const propiedadUbicacionRouter = require('./routes/propiedad_ubicacion');

const app = express();
const port = 3000;

// ========================
// Middlewares
// ========================
const corsOptions = {
  origin: '*', // Reemplazar con la URL del frontend en producción
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Archivos estáticos
const uploadsPath = path.join(__dirname, 'public/uploads');
app.use('/uploads', express.static('public/uploads'));
app.use('/uploads', express.static(uploadsPath));

// Log de solicitudes
app.use((req, res, next) => {
  console.log(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Verificar carpeta uploads
if (!fs.existsSync(uploadsPath)) {
  console.error(`La carpeta 'public/uploads' no existe. Por favor, créala para servir archivos estáticos.`);
} else {
  console.log(`La carpeta 'public/uploads' está configurada correctamente.`);
}

// ========================
// Rutas
// ========================
app.get('/', (req, res) => {
  res.send('Hello World! La API del backend está funcionando.');
});

app.use('/cat-departamentos', departamentoRouter);
app.use('/usuarios', usuariosRouter);
app.use('/paises', paisesRouter);
app.use('/cat-ciudades', ciudadesRouter);
app.use('/cat-inmueble-tipo', tiposPropiedadRouter);
app.use('/propiedades', propiedadesRouter);
app.use('/propiedad-imagenes', imagenesPropiedadesRouter);
app.use('/favoritos', favoritosRouter);
app.use('/categorias-audio', categoriasAudioRouter);
app.use('/procesamientos-audio', procesamientosAudioRouter);
app.use('/ia', iaRouter);
app.use('/propiedad_ubicacion', propiedadUbicacionRouter);

// ========================
// Start server
// ========================
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});