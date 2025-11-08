const jwt = require('jsonwebtoken');

// Middleware para proteger rutas y verificar el token JWT

const authMiddleware = (req, res, next) => {
  // Obtener el token del header de la petición
  const token = req.header('Authorization');

  // Verificar si no hay token
  if (!token) {
    return res.status(401).json({ error: 'No hay token, permiso no válido.' });
  }

  // El token usualmente viene como "Bearer <token>". Lo separamos.
  const tokenString = token.split(' ')[1];
  if (!tokenString) {
    return res.status(401).json({ error: 'Formato de token no válido.' });
  }

  try {
    // Verificar el token usando el secreto
    const jwtSecret = process.env.JWT_SECRET || 'YOUR_JWT_SECRET';
    const decoded = jwt.verify(tokenString, jwtSecret);

    // Si el token es válido, el payload decodificado se añade al objeto request
    // Así, las rutas que usan este middleware tendrán acceso a la info del usuario
    req.user = decoded.user;
    next(); // Continuar con la siguiente función en la ruta

  } catch (err) {
    res.status(401).json({ error: 'Token no es válido.' });
  }
};

module.exports = authMiddleware;
