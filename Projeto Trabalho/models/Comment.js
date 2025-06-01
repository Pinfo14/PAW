// models/Comment.js
const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  imagePath: {
    type: String,
    required: true,
  },
});

const CommentSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  images: {
    type: [ImageSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

CommentSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', CommentSchema);