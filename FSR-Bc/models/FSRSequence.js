import mongoose from "mongoose";

const fsrSequenceSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
    },
    prefix: {
      type: String,
      default: "FSR",
      trim: true,
    },
    currentNumber: {
      type: Number,
      default: 0,
    },
    digits: {
      type: Number,
      default: 3, // Pads numbers like 001, 002
    },
  },
  { timestamps: true }
);

export default mongoose.model("FSRSequence", fsrSequenceSchema);
