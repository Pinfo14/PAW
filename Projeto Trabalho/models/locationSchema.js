const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  address: {
    street: {
      type: String,
      required: true
    },
    postalCode: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
            return /^\d{4}-\d{3}$/.test(v);
            },
            message: 'O código postal deve ter o formato XXXX-XXX (ex: 1234-567).'
        }
    },
    city: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'Portugal'
    }
  },
  coordinates: {
    lat: {
      type: Number,
      required: true
    },
    lon: {
      type: Number,
      required: true
    }
  }
});

module.exports = locationSchema;
