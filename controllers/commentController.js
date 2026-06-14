const Comment = require('../models/commentModel');
const Ticket = require('../models/ticketModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createComment = catchAsync(async (req, res, next) => {
  const { text } = req.body;
  const { ticketId } = req.params;

  // Check if ticket exists
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  // Only ticket owner or admin can comment
  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to comment on this ticket', 403),
    );
  }

  // Create comment with current user as author
  const comment = await Comment.create({
    text,
    author: req.user.id,
    ticket: ticketId,
  });

  // Populate author details
  await comment.populate('author', 'name email photo');

  res.status(201).json({
    status: 'success',
    data: { comment },
  });
});

exports.getCommentsByTicket = catchAsync(async (req, res, next) => {
  const { ticketId } = req.params;

  // Check if ticket exists
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  // Only ticket owner or admin can view comments
  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id) {
    return next(
      new AppError(
        'You do not have permission to view comments on this ticket',
        403,
      ),
    );
  }

  const comments = await Comment.find({ ticket: ticketId })
    .populate('author', 'name email photo')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: comments.length,
    data: { comments },
  });
});

exports.getComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id).populate(
    'author',
    'name email photo',
  );

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Get the ticket to check ownership
  const ticket = await Ticket.findById(comment.ticket);

  // Only ticket owner or admin can view comment
  if (req.user.role !== 'admin' && ticket.user.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to view this comment', 403),
    );
  }

  res.status(200).json({
    status: 'success',
    data: { comment },
  });
});

exports.updateComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Only author or admin can update
  if (req.user.role !== 'admin' && comment.author.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to update this comment', 403),
    );
  }

  // Only allow text to be updated
  if (req.body.text) {
    comment.text = req.body.text;
  }

  await comment.save();

  await comment.populate('author', 'name email photo');

  res.status(200).json({
    status: 'success',
    data: { comment },
  });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Only author or admin can delete
  if (req.user.role !== 'admin' && comment.author.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to delete this comment', 403),
    );
  }

  await Comment.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
