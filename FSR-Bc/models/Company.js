import mongoose from "mongoose";

const contactPersonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, lowercase: true, default: "" },
  mobile: { type: String, trim: true, default: "" },
});

const locationSchema = new mongoose.Schema({
  locationName: { type: String, required: true, trim: true }, // e.g. "Chennai Plant", "Mumbai HQ"
  address: { type: String, trim: true, default: "" },
  contactPersons: [contactPersonSchema],
});

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Legacy single-contact fields (kept for existing records)
    contactPerson: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },

    // Multiple company-level contacts
    contactPersons: [contactPersonSchema],

    // Multiple Locations & Contacts
    locations: [locationSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);
