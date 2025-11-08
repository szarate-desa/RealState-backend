const Joi = require('joi');

const propertySchema = Joi.object({}); // Eliminado todo el esquema de validación

const validateProperty = (req, res, next) => {
  next(); // Validación deshabilitada
};

module.exports = validateProperty;
