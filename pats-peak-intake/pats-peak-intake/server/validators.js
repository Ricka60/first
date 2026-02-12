import Joi from 'joi';

const zipPattern = /^\d{5}(?:-\d{4})?$/;
const phonePattern = /^[+()\-.\s\d]{7,25}$/;

export const lookupSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(60).required(),
  lastName: Joi.string().trim().min(1).max(60).required(),
  dob: Joi.date().iso().less('now').required(), // DOB must be in past
  zip: Joi.string().trim().pattern(zipPattern).required(),
  phone: Joi.string().trim().pattern(phonePattern).max(25).required()
});

export const intakeSchema = Joi.object({
  guestId: Joi.string().trim().allow(null, ''),
  firstName: Joi.string().trim().min(1).max(60).required(),
  lastName: Joi.string().trim().min(1).max(60).required(),
  dob: Joi.date().iso().less('now').required(),
  zip: Joi.string().trim().pattern(zipPattern).required(),
  phone: Joi.string().trim().pattern(phonePattern).max(25).required(),
  skierType: Joi.string().valid('I', 'II', 'III').required(),
  weightLbs: Joi.number().min(30).max(400).required(),
  heightIn: Joi.number().min(36).max(84).required(),
  shoeSize: Joi.number().min(1).max(18).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(200).required()
});
