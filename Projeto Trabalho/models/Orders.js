const mongoose = require("mongoose");
const { Meal } = require("./Restaurants");
const locationSchema = require("./locationSchema");

/**
 * As Orders são "snapshots" dos pratos existentes no momento em que foi feito o pedido/encomenda.
 * Mesmo que os pratos ou restaurantes sejam apagados a informação do histórico de Encomendas persiste na base de dados.
 */
const OrderSchema = new mongoose.Schema({
  customer: {
    name:           { type: String, required: true },
    email:          { type: String, required: true },
    nif:            { type: String, required: true },
    contact:        { type: String, required: true },
    companyName:    { type: String },          // vazio se não for empresa a efetuar o pedido/encomenda (Se for NIF de empresa)
    role:           { type: String, required: true },
    location:       { type: locationSchema, required: true },
    deliveryLocation:{ type: locationSchema, required: true },
  },

  restaurant: {
    name:       { type: String, required: true },
    location:   { type: locationSchema, required: true },
    categories: { type: [String], required: true }, // nomes das categorias
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },

  worker: {
    name:  { type: String, required: true },
    email: { type: String, required: true }
  },

  meals:           [ Meal.schema ],
  canceledMeal:    { type: Boolean, default: false },
  createdAt:       { type: Date, default: Date.now },
  deliveredAt:     { type: Date, default: null },
  currentStatus:   {
    type: String,
    enum: ['Ordered','Preparing','Ready','Delivered'],
    default: 'Ordered'
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },

  preparationTime: { type: Number, required: true }
});

module.exports = mongoose.model("Order", OrderSchema);
