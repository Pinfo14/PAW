const mongoose = require('mongoose');
const locationSchema = require("./locationSchema");

const StaffSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Email inválido']
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['RestWorker', 'Admin', 'RestAdmin'],
    required:true
  },
  restID: {
    //ver versao com populate
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const ClientSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Email inválido']
  },
  password: {
    type: String
  },
  name: {
    type: String,
    required: true
  },
  location: {
    type:locationSchema,
    required:true
  },
  deliveryLocation: {
    type:locationSchema,
    required:true
  },
  nif: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{9}$/.test(v);
      },
      message: 'O NIF deve conter exatamente 9 dígitos.'
    }
  },
  companyName: {
    type: String,
    required: function() {
      // Só é obrigatório se o NIF for de empresa (1º dígito entre 5, 6, 8)
      return this.nif && /^[568]/.test(this.nif);
    },
    trim: true
  },

  contact: {
    type: String,
    required: true,
    match: [/^[29]\d{8}$/, 'O contacto deve começar por 2 ou 9 e conter 9 dígitos.']
  },

  role: {
    type: String,
    required: true,
    default: 'Client'
  }
});

module.exports.Staff = mongoose.model('Staff', StaffSchema);
module.exports.Client = mongoose.model('Client', ClientSchema);
