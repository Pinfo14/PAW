const mongoose = require("mongoose");
const locationSchema = require('./locationSchema');

const MealImageSchema = new mongoose.Schema({
    imagePath: {
      type: String,
      required: true,
    },
});

const MealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  sizes: {
    type: [{
      name: { type: String, required: true },
      price: { type: Number, required: true }
    }],
    validate: {
      validator: function(v) {
        // Verifica se o valor é um array com pelo menos um item
        return Array.isArray(v) && v.length >= 1;
      },
      message: 'Pelo menos uma dose é obrigatória.'
    }
  },
  category: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MealCategory' }],
  images: [MealImageSchema], // MULTER
});

const MenuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },  
  meals: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meal'
    }],
    validate: {
      validator: function (meals) {
        return meals.length <= 10;
      },
      message: 'O menu não pode ter mais do que 10 pratos.'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    type:locationSchema,
    required:true
  },
  maxOrders:{
    type:Number,
    required:true,
    default: 50
  },
  approvedByAdmin: {
    type: Boolean,
    default:false
  },
  maxDeliveryRange: {
    type: Number,
    required: true
  },
  menu: [MenuSchema],
  meals: [MealSchema],
  categories: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'RestaurantsCategory',
    validate: {
      validator: function(val) { return val.length <= 3; },
      message: 'Um restaurante só pode ter no máximo 3 categorias.'
    }
  },
  nif: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^[5]\d{8}$/.test(v);
      },
       message: 'O NIF deve ter 9 dígitos e começar com o dígito 5 (entidades como restaurantes).'
    }
  },
  companyName: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  image: {
    type: String,
    default: 'default-restaurant.jpg' // Imagem padrão para restaurantes sem foto
  }
});

module.exports.Restaurant = mongoose.model("Restaurant", RestaurantSchema);
module.exports.Meal = mongoose.model("Meal", MealSchema);
