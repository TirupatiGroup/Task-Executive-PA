// People controller - thin; delegates to personService.

const express = require('express');
const { asyncHandler, success } = require('../utils/response');
const { personService } = require('../services/person.service');

const listPeople = asyncHandler(async (req, res) => {
  const result = await personService.listPeople({
    isActive: req.query.isActive,
    search: req.query.search,
    page: parseInt(req.query.page || '1', 10),
    limit: parseInt(req.query.limit || '50', 10),
  });
  return success(res, { message: 'People fetched', data: result });
});

const getPerson = asyncHandler(async (req, res) => {
  const result = await personService.getPerson(req.params.id);
  return success(res, { message: 'Person fetched', data: result });
});

const createPerson = asyncHandler(async (req, res) => {
  const person = await personService.createPerson(req.body, req.user.id);
  return success(res, { message: 'Person created', data: { person }, status: 201 });
});

const updatePerson = asyncHandler(async (req, res) => {
  const person = await personService.updatePerson(req.params.id, req.body, req.user.id);
  return success(res, { message: 'Person updated', data: { person } });
});

const setPersonStatus = asyncHandler(async (req, res) => {
  const person = await personService.setPersonStatus(req.params.id, Boolean(req.body.isActive), req.user.id);
  return success(res, { message: `Person ${person.isActive ? 'activated' : 'deactivated'}`, data: { person } });
});

module.exports = { listPeople, getPerson, createPerson, updatePerson, setPersonStatus };
