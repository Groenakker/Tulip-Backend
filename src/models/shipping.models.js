import mongoose from "mongoose";

const shippingSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    shippingCode: {
      type: String,
      required: true,
      trim: true,
    },
    shipmentOrigin: {
      type: String,
      required: true,
    },
    shipmentDestination: {
      type: String,
      required: true,
    },
    logisticsProvider: {
      type: String,
      
      trim: true,
    },
    note: {
      type: String,
      
      trim: true,
    },
    shipmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    projectID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      
    },
    projectCode: {
      type: String,
      
    },
    projectDesc: {
      type: String,
      
    },
    estimatedArrivalDate: {
      type: Date,
      
    },
    estDate: {
      type: Date,
      
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    bPartnerCode: {
      type: String,
      
    },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner",
      
    },
    contactID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
    },
    image: {
      type: String, // Will store base64 string
      required: false,
    },

    // ============================================================
    // Shippo integration fields
    // ============================================================
    // When the user selects a customer first (our new flow), we store the
    // bPartner id + a snapshot of their contact/address so the record keeps
    // working even if the bPartner is later edited.
    customerSnapshot: {
      name: String,
      email: String,
      phone: String,
      company: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },

    // Parcel used to get rates / buy a label.
    parcel: {
      length: String,
      width: String,
      height: String,
      distance_unit: { type: String, default: "in" },
      weight: String,
      mass_unit: { type: String, default: "lb" },
    },

    // Ship-from address snapshot (may be edited per-shipment).
    // `addressId` (if set) references a specific entry in the Company's
    // shippingAddresses array, so we can show the user which saved
    // address they picked (and re-load it if they want to reset).
    shipFrom: {
      addressId: { type: mongoose.Schema.Types.ObjectId },
      label: String,
      name: String,
      company: String,
      street1: String,
      street2: String,
      city: String,
      state: String,
      zip: String,
      country: String,
      phone: String,
      email: String,
    },

    // ============================================================
    // Customs declaration (international shipments only)
    // ------------------------------------------------------------
    // Mirrors the fields Shippo accepts on a customs declaration +
    // customs items. We persist our own copy so the user can edit and
    // re-create the Shippo declaration without re-entering everything.
    // ============================================================
    customs: {
      enabled: { type: Boolean, default: false },
      contentsType: {
        type: String,
        enum: [
          "MERCHANDISE",
          "GIFT",
          "DOCUMENTS",
          "RETURNED_GOODS",
          "SAMPLE",
          "HUMANITARIAN_DONATION",
          "OTHER",
          "",
        ],
        default: "",
      },
      contentsExplanation: String, // required when contentsType = OTHER
      nonDeliveryOption: {
        type: String,
        enum: ["ABANDON", "RETURN", ""],
        default: "",
      },
      incoterm: {
        type: String,
        enum: ["DDP", "DDU", "FCA", "NONE", ""],
        default: "",
      },
      certify: { type: Boolean, default: true },
      certifySigner: String,
      eelPfc: String,       // EEL / PFC code (e.g. "NOEEI_30_37_a")
      invoicedCharges: {
        totalShipping: String,
        totalTaxes: String,
        totalDuties: String,
        otherFees: String,
        currency: String,
      },
      items: [
        {
          description: String,
          quantity: Number,
          netWeight: String,
          massUnit: { type: String, default: "lb" },
          valueAmount: String,
          valueCurrency: { type: String, default: "USD" },
          originCountry: { type: String, default: "US" },
          tariffNumber: String,    // HS tariff code
          skuCode: String,
        },
      ],
      // Shippo ids (after we create the declaration)
      shippoCustomsDeclarationId: String,
      shippoCustomsItemIds: [String],
    },

    // Shippo references
    shippoShipmentId: { type: String, index: true },
    shippoRateId: String,
    shippoTransactionId: { type: String, index: true },

    // Carrier info (copied from Shippo response for display and tracking)
    carrier: String,          // e.g. "usps"
    serviceLevel: String,     // e.g. "usps_priority"
    serviceLevelName: String, // human readable
    shippingCost: String,     // amount
    shippingCurrency: String, // e.g. "USD"

    // Label info
    labelUrl: String,          // PDF/PNG url from Shippo
    labelFileType: String,     // PDF | PDF_4x6 | PNG | ZPLII
    commercialInvoiceUrl: String,

    // Tracking info
    trackingNumber: { type: String, index: true },
    trackingUrlProvider: String,
    trackingStatus: String,    // UNKNOWN | PRE_TRANSIT | TRANSIT | DELIVERED | RETURNED | FAILURE
    trackingStatusDetails: String,
    trackingStatusDate: Date,
    trackingHistory: [
      {
        status: String,
        status_details: String,
        status_date: Date,
        location: {
          city: String,
          state: String,
          zip: String,
          country: String,
        },
      },
    ],

    // Refund info (if label was voided)
    refundId: String,
    refundStatus: String,
  },

  { timestamps: true }
);

// Compound indexes for common queries
shippingSchema.index({ company_id: 1, status: 1 });
shippingSchema.index({ company_id: 1, createdAt: -1 });
shippingSchema.index({ company_id: 1, shippingCode: 1 }, { unique: true });
shippingSchema.index({ company_id: 1, projectID: 1 });


const Shipping = mongoose.model("Shipping", shippingSchema);

export default Shipping;