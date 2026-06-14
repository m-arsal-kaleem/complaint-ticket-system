const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A ticket must have a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'A ticket must have a description'],
    },
    category: {
      type: String,
      enum: ['general', 'billing', 'technical', 'other'],
      default: 'general',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A ticket must belong to a user'],
    },
    attachments: [
      {
        filename: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    adminReplies: [
      {
        text: {
          type: String,
          required: true,
        },
        admin: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        repliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

ticketSchema.index({ user: 1, status: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
