const mongoose = require('mongoose');

const MealCategorySchema = new mongoose.Schema({
  approved: {type: Boolean, default: false},
  name: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('MealCategory', MealCategorySchema);
