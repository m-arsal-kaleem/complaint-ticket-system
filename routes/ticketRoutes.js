const express = require('express');
const ticketController = require('../controllers/ticketController');
const authController = require('../controllers/authController');
const upload = require('../utils/multerConfig');
const { processTicketAttachment } = require('../utils/imageProcessor');
const commentRouter = require('./commentRoutes');

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

router
  .route('/:id/replies')
  .get(ticketController.getAdminReplies)
  .post(ticketController.addAdminReply);

// Re-evaluate priority for a ticket (owner or admin)
router.post('/:id/re-evaluate-priority', ticketController.reEvaluatePriority);

// Nested comment routes
router.use('/:ticketId/comments', commentRouter);

module.exports = router;
