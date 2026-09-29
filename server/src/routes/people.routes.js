// People routes: /api/v1/people

const express = require('express');
const { requireAuth, getOwnerUserId } = require('../middleware/auth');
const { validate, validateParams } = require('../middleware/validate');
const { idParams, personQuery, createPersonBody, updatePersonBody, statusBody } = require('../validators/person.validator');
const controller = require('../controllers/people.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', validate({ query: personQuery }), controller.listPeople);
router.get('/:id', validateParams(idParams), controller.getPerson);
router.post('/', validate({ body: createPersonBody }), controller.createPerson);
router.patch('/:id', validate({ params: idParams, body: updatePersonBody }), controller.updatePerson);
router.patch('/:id/status', validate({ params: idParams, body: statusBody }), controller.setPersonStatus);

module.exports = router;
