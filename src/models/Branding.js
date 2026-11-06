const mongoose = require('mongoose');
const assetSchema = new mongoose.Schema({
  storage: { type: String, enum: ['local', 'cloudinary'] },
  filename: String, publicId: String, mimeType: String, size: Number,
}, { _id: false });
const brandingSchema = new mongoose.Schema({
  scope: { type: String, enum: ['platform', 'organization'], required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  displayName: { type: String, trim: true, maxlength: 80, default: '' },
  welcomeMessage: { type: String, trim: true, maxlength: 240, default: '' },
  logoUrl: { type: String, trim: true, maxlength: 500, default: '' },
  logoAsset: { type: assetSchema, default: null },
  logoAlt: { type: String, trim: true, maxlength: 120, default: '' },
  primaryColor: { type: String, trim: true, default: '#6d4bd1', match: /^#[0-9a-fA-F]{6}$/ },
  secondaryColor: { type: String, trim: true, default: '#8b75dc', match: /^#[0-9a-fA-F]{6}$/ },
  accentColor: { type: String, trim: true, default: '#26a69a', match: /^#[0-9a-fA-F]{6}$/ },
  loginBackgroundUrl: { type: String, trim: true, maxlength: 500, default: '' },
  loginBackgroundAsset: { type: assetSchema, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
brandingSchema.index({ scope: 1, organization: 1 }, { unique: true });
module.exports = mongoose.model('Branding', brandingSchema);
