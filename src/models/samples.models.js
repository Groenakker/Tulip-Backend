import mongoose from "mongoose";

const sampleSchema = new mongoose.Schema(
  {
    projectName: { type: String, trim: true },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    sampleCode: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled", "Draft", "Submitted", "Accepted", "Rejected"],
      default: "Draft",
    },
    projectID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      trim: true
    },
    actDate: { type: Date },
    estDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    bPartnerName : { type: String },
    poNumber: { type: String },
    poDate: { type: Date },
    bPartnerCode: { type: String },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner"
    },
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
    // Customs / export classification.
    // `tariffCode` is the 10-digit Schedule B / HS code that ends up in
    // Shippo's customs item `tariff_number` for international shipments.
    // `tariffDescription` is a denormalized snapshot of the description
    // selected at submission time — kept locally so commercial invoices
    // and audit logs still resolve even if Census later changes the
    // description in a future Schedule B revision.
    tariffCode: { type: String, trim: true, index: true },
    tariffDescription: { type: String, trim: true },
    // Per-unit customs declared value in USD. Optional; if missing, the
    // shipping flow falls back to "1.00" so Shippo doesn't reject the
    // declaration.
    customsValue: { type: String, trim: true },
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
    
    // ============================================================
    // Additional fields mined from customer TRF / TIDS / PCF forms
    // (Geneva Labs GLP Test Req, Bureau Veritas Medical TRF,
    // Accuprec TIDS, Eurofins/PSL PCF). All optional. Adding new
    // columns here is preferred over storing a free-form
    // `formData` blob because Mongoose strict mode would strip it
    // and audit logs would lose visibility.
    // ============================================================
    studyCompliance: { type: String, trim: true }, // GLP / Non-GLP / NABL (ISO 17025) / ASCA / Other
    batchNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    chemicalName: { type: String, trim: true },
    casNumber: { type: String, trim: true },
    molecularFormula: { type: String, trim: true },
    molecularWeight: { type: String, trim: true },
    productColor: { type: String, trim: true },
    pH: { type: String, trim: true },
    purityConcentration: { type: String, trim: true },
    density: { type: String, trim: true },
    solubility: { type: String, trim: true },
    composition: { type: String, trim: true },
    productType: { type: String, trim: true }, // Medical Device / Pharma / API / Herbal / Agrochem / Industrial / Food / Packaging
    methodOfManufacturing: { type: String, trim: true }, // Injection Molded / Formulated / 3D Printed / Other
    sterilizationDate: { type: String, trim: true },
    sterilizedBy: { type: String, trim: true },

    // Extraction details (richer than the existing
    // extractionRatios enum — these track the test article
    // extraction protocol the sponsor is requesting).
    extractionMethod: { type: String, trim: true }, // All Parts / External Only Submerged / Internal Only Filled / etc.
    polarVehicle: { type: String, trim: true }, // Physiological Saline / Distilled Water / USP 88 / Other / N/A
    nonPolarVehicle: { type: String, trim: true }, // Cottonseed Oil / Sesame Oil / USP 88 / Other / N/A
    extractionTemperature: { type: String, trim: true }, // 37°C / 50°C / 70°C / 121°C
    samplesPooled: { type: String, trim: true }, // Yes / No / N/A
    canBeCut: { type: String, trim: true }, // Yes / No / N/A
    biohazard: { type: String, trim: true }, // Yes / No

    // Detailed surface area / weight breakdowns used by
    // hemocompatibility studies (direct vs indirect blood contact).
    surfaceAreaDirect: { type: String, trim: true },
    surfaceAreaIndirect: { type: String, trim: true },
    netWeightTotal: { type: String, trim: true },
    netWeightDirect: { type: String, trim: true },
    netWeightIndirect: { type: String, trim: true },

    // Sponsor declarations
    predicateDevice: { type: String, trim: true }, // Supplied by Sponsor / Procured by Test facility / N/A
    absorptionCheck: { type: String, trim: true }, // Yes / No
    msdsAttached: { type: String, trim: true }, // Yes / No
    coaAttached: { type: String, trim: true }, // Yes / No
    cadDrawingsAttached: { type: String, trim: true }, // Yes / No
    productStable: { type: String, trim: true }, // Yes / No
    doseFormulationAnalysisRequired: { type: String, trim: true }, // Yes / No

    // Regulatory classifications
    mdrClassification: { type: String, trim: true }, // I / IIa / IIb / III
    mdrRule: { type: String, trim: true }, // 1-21
    indianMdrClass: { type: String, trim: true }, // A / B / C / D
    fdaClassification: { type: String, trim: true }, // I / II / III
    bodyContactNature: { type: String, trim: true }, // Intact skin / Intact mucosal / Breached / Circulating blood

    // Logistics + sponsor signoff
    packagingDetails: { type: String, trim: true },
    totalQuantitySupplied: { type: String, trim: true },
    numberOfSamplesShipped: { type: String, trim: true },
    supplierName: { type: String, trim: true },
    transportationDetails: { type: String, trim: true },
    handlingRequirements: { type: String, trim: true },
    testArticleNameForReport: { type: String, trim: true },
    vatNumber: { type: String, trim: true },
    mailingList: { type: String, trim: true },
    controlArticle: { type: String, trim: true },
    specialInstructions: { type: String, trim: true },
    solventForMoistening: { type: String, trim: true },
    sampleStability: { type: String, trim: true },
    sponsorRepresentative: { type: String, trim: true },
    sponsorSignatureDate: { type: String, trim: true },

    // ------------------------------------------------------------
    // Dynamic custom fields the user adopted from a BP-uploaded
    // document. The Sample Submission UI suggests these based on
    // labels the document scanner extracted; the user clicks
    // "Add" and the label+value get persisted here. Keeps the
    // form flexible without forcing a schema migration for every
    // novel TRF a customer ships us.
    // ------------------------------------------------------------
    customFields: [{
      key: { type: String, trim: true }, // normalized identifier (camelCase or normalizedKey)
      label: { type: String, trim: true }, // human-readable label as shown in the form
      value: { type: String, trim: true },
      sourceDocumentId: { type: mongoose.Schema.Types.ObjectId }, // BP sampleDocuments._id
      sourceBPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "Bpartner" },
      addedAt: { type: Date, default: Date.now },
    }],

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

// Compound indexes for common queries
sampleSchema.index({ company_id: 1, status: 1 });
sampleSchema.index({ company_id: 1, createdAt: -1 });
sampleSchema.index({ company_id: 1, sampleCode: 1 }, { unique: true });
sampleSchema.index({ company_id: 1, projectID: 1 });

const Sample = mongoose.model("Sample", sampleSchema);

export default Sample;