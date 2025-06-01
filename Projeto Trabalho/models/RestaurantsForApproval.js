const mongoose = require('mongoose');

const RestaurantsForApprovalSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    unique: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RestaurantsForApproval', RestaurantsForApprovalSchema);
