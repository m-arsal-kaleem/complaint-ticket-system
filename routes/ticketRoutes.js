const express = require('express');
const ticketController = require('../controllers/ticketController');
const authController = require('../controllers/authController');
const upload = require('../utils/multerConfig');
const { processTicketAttachment } = require('../utils/imageProcessor');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router
  .route('/')
  .get(ticketController.getAllTickets)
  .post(ticketController.createTicket);

router
  .route('/:id')
  .get(ticketController.getTicket)
  .patch(ticketController.updateTicket)
  .delete(ticketController.deleteTicket);

// Upload attachment to ticket
router.post(
  '/:id/attachments',
  upload.single('attachment'),
  processTicketAttachment,
  ticketController.uploadAttachment,
);

module.exports = router;
