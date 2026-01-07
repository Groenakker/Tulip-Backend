import mongoose from "mongoose";

const sampleSchema = new mongoose.Schema(
  {
    projectName: { type: String, trim: true },
    description: { type: String, trim: true },
    sampleCode: { type: String, unique: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled", "Draft", "Submitted", "Accepted", "Rejected"],
      default: "Draft",
    },
    projectID: { type: String, trim: true },
    projectId: { type: String, trim: true },
    actDate: { type: Date },
    estDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    bPartnerName : { type: String },
    poNumber: { type: String },
    poDate: { type: Date },
    bPartnerCode: { type: String },
    bPartnerID: { type: String, ref: "Bpartner" },
    contactName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    commitDate: { type: Date },
    quoteNumber: { type: String },
    salesOrderNumber: { type: String },
    image: { type: String },
    signatureImage: { type: String },
    
    // Client Information fields
    SAPid: { type: String, trim: true },
    address: { type: String, trim: true },
    
    // Sample Information fields
    sampleId: { type: String, trim: true },
    sampleDescription: { type: String, trim: true },
    intendedUse: { type: String, trim: true },
    partNumber: { type: String, trim: true },
    lotNumber: { type: String, trim: true },
    devicesUsed: { type: String, trim: true, default: "1" },
    countryOrigin: { type: String, trim: true },
    sampleMass: { type: String, trim: true },
    surfaceArea: { type: String, trim: true },
    contactType: { 
      type: String, 
      enum: ["Tissue / Bone", "Blood", "Skin", ""],
      trim: true 
    },
    contactDuration: { 
      type: String, 
      enum: ["A - Limited (<24h)", "B - Prolonged (24h-30d)", "C - Permanent (>30d)", ""],
      trim: true 
    },
    manufacturer: { type: String, trim: true },
    desiredMarkets: { type: String, trim: true, default: "U" },
    manufactureDate: { type: String, trim: true },
    expirationDate: { type: String, trim: true },
    wallThickness: { 
      type: String, 
      enum: [">1.0 mm", "<1.0 mm", ""],
      trim: true 
    },
    extractionRatios: { 
      type: String, 
      enum: ["3 cm2/ml", "6 cm2/ml", ""],
      trim: true 
    },
    sampleSterile: { 
      type: String, 
      enum: ["Sterile", "Non-Sterile", ""],
      trim: true 
    },
    sterilizationMethod: { 
      type: String, 
      enum: ["Radiation", "EtO", "Steam", ""],
      trim: true 
    },
    appearance: { type: String, trim: true },
    deviceType: { 
      type: String, 
      enum: ["Device", "Solid", "Liquid", "Gel", ""],
      trim: true 
    },
    materialsOfConstruction: { type: String, trim: true },
    
    // Sample Conditions fields
    shippingCondition: { 
      type: String, 
      enum: ["Ambient", "On Ice", "On Dry Ice", ""],
      trim: true 
    },
    sampleStorage: { 
      type: String, 
      enum: ["Room Temperature", "Refrigerated", "Freezer -10°C to -25°C", "Freezer ≤ -70°C", ""],
      trim: true 
    },
    sampleDisposition: { 
      type: String, 
      enum: ["Discard", "Return Unused Samples", "Return All Samples", ""],
      trim: true 
    },
    safetyPrecautions: { type: String, trim: true },
    
    // Sample Images
    sampleImages: {
      general: { type: String },
      labeling: { type: String }
    },
    
    // store full submission form here so UI fields persist
   // formData: { type: mongoose.Schema.Types.Mixed },
     // Requested tests for this sample
     requestedTests: [{
      testCodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Testcode" },
      grkCode: { type: String },
      description: { type: String },
      samplesSubmitted: { type: String },
      extractionTime: { type: String },
      extractionTemp: { type: String },
      quality: { type: String, enum: ["GLP", "Non-GLP"] },
      category: { type: String },
      extractBased: { type: String }
    }],
    // Test metadata
    testMetadata: {
      totalSamplesSubmitted: { type: String },
      serviceLevel: { type: String, enum: ["Standard", "Expedited"] },
      notes: { type: String }
    }
  },
  
  { timestamps: true }
);

const Sample = mongoose.model("Sample", sampleSchema);

export default Sample;