import mongoose from 'mongoose';

const webhookDeliverySchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: '',
    },
    repository: {
      type: String,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
      index: { expires: '30d' }, // Automatically expire old delivery logs after 30 days
    },
  },
  {
    timestamps: true,
  }
);

export const WebhookDelivery = mongoose.model('WebhookDelivery', webhookDeliverySchema);
