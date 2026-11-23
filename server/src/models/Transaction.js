import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    stripeId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    plan: { type: String, required: true },
    credits: { type: Number, required: true },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
