/**
 * Shippo controller
 *
 * All Shippo calls happen server-side so the API token never reaches the
 * browser (per security rules). Each endpoint is authenticated and scoped
 * to the user's company.
 */

import Shipping from "../models/shipping.models.js";
import Bpartner from "../models/bPartners.models.js";
import ShippingLine from "../models/shippingLines.models.js";
import Sample from "../models/samples.models.js";
import {
  createShipment as shippoCreateShipment,
  createTransaction as shippoCreateTransaction,
  retrieveShipment as shippoRetrieveShipment,
  retrieveTransaction as shippoRetrieveTransaction,
  retrieveRate as shippoRetrieveRate,
  trackShipment as shippoTrackShipment,
  refundLabel as shippoRefundLabel,
  validateAddress as shippoValidateAddress,
  listCarrierAccounts as shippoListCarrierAccounts,
  createCustomsItem as shippoCreateCustomsItem,
  createCustomsDeclaration as shippoCreateCustomsDeclaration,
  getDefaultFromAddress,
  getDefaultParcel,
  getDefaultLabelFileType,
  isShippoConfigured,
  isShippoTestMode,
  SHIPPO_TEST_TRACKING_NUMBERS,
} from "../lib/shippo.js";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const requireCompany = (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) {
    res.status(403).json({ message: "Invalid tenant context" });
    return null;
  }
  return companyId;
};

const sendShippoError = (res, error) => {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  return res.status(status).json({
    message: error.message || "Shippo request failed",
    shippo: error.shippoResponse,
  });
};

const loadShipping = async (id, companyId) => {
  const shipping = await Shipping.findOne({ _id: id, company_id: companyId });
  return shipping;
};

const partnerToAddress = (partner) => {
  if (!partner) return null;
  const primaryContact =
    Array.isArray(partner.contacts) && partner.contacts.length > 0
      ? partner.contacts[0]
      : null;
  return {
    name: partner.name || primaryContact?.name || "",
    company: partner.name || "",
    street1: partner.address1 || "",
    street2: partner.address2 || "",
    city: partner.city || "",
    state: partner.state || "",
    zip: partner.zip || "",
    country: partner.country || "US",
    phone: partner.phone || primaryContact?.phone || "",
    email: partner.email || primaryContact?.email || "",
  };
};

// --------------------------------------------------------------------------
// GET /api/shippo/config
//   Returns the safe, non-secret config needed by the UI: the default
//   ship-from address, default parcel dimensions and preferred label format.
//   Never leaks the API token.
// --------------------------------------------------------------------------
export const getShippoConfig = async (req, res) => {
  try {
    res.json({
      configured: isShippoConfigured(),
      defaultFromAddress: getDefaultFromAddress(),
      defaultParcel: getDefaultParcel(),
      labelFileType: getDefaultLabelFileType(),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load Shippo config", error: error.message });
  }
};

// --------------------------------------------------------------------------
// GET /api/shippo/carriers
//   List carrier accounts linked to the Shippo account (for display only).
// --------------------------------------------------------------------------
export const listCarriers = async (req, res) => {
  try {
    const data = await shippoListCarrierAccounts();
    res.json({
      carriers: (data?.results || []).map((c) => ({
        object_id: c.object_id,
        carrier: c.carrier,
        account_id: c.account_id,
        active: c.active,
        test: c.test,
        is_shippo_account: c.is_shippo_account,
      })),
    });
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// POST /api/shippo/validate-address
//   Proxy to Shippo's address validation endpoint.
// --------------------------------------------------------------------------
export const validateAddress = async (req, res) => {
  try {
    const result = await shippoValidateAddress(req.body || {});
    res.json(result);
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// Build customs items from a shipping's lines + their referenced samples.
//
// Each ShippingLine points to a Sample; the Sample now carries the
// authoritative HS / Schedule B tariff code (set on the Sample submission
// form). This helper joins them and produces an array of customs item
// objects in the shape `createCustomsItem` expects.
//
// Defaults are chosen so Shippo never rejects the declaration for missing
// fields:
//   - quantity:     ShippingLine.quantity if > 0, else 1
//   - description:  Sample.tariffDescription -> Sample.sampleDescription
//                   -> ShippingLine.description -> "Laboratory sample"
//   - net weight:   Sample.sampleMass (parsed from grams) -> 0.1 kg
//   - value:        Sample.customsValue -> 1.00 USD
//   - origin:       Sample.countryOrigin -> "US"
//   - tariff#:      Sample.tariffCode (empty string if unset; that is what
//                   triggers the validation in createShipmentForShipping)
// --------------------------------------------------------------------------
const parseSampleMassToKg = (raw) => {
  if (!raw) return null;
  // Sample.sampleMass is a free-text field; users typically enter grams.
  // We accept "12.5", "12.5 g", "0.5 kg".
  const match = String(raw).trim().match(/^([\d.]+)\s*(g|kg|gram|grams|kilogram|kilograms)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] || "g").toLowerCase();
  if (unit.startsWith("k")) return value;
  return value / 1000;
};

export const buildCustomsItemsFromShipping = async (shipping) => {
  const lines = await ShippingLine.find({ shippingId: shipping._id })
    .populate("sampleId")
    .lean();

  return lines.map((line) => {
    const sample = line.sampleId || {};
    const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : 1;
    const description =
      sample.tariffDescription ||
      sample.sampleDescription ||
      line.description ||
      sample.name ||
      "Laboratory sample";

    const netWeightKg = parseSampleMassToKg(sample.sampleMass);
    return {
      description: String(description).slice(0, 200),
      quantity,
      netWeight: String(netWeightKg ?? 0.1),
      massUnit: "kg",
      valueAmount: String(sample.customsValue || "1.00"),
      valueCurrency: "USD",
      originCountry: (sample.countryOrigin || "US").toUpperCase(),
      tariffNumber: (sample.tariffCode || "").trim(),
      skuCode: sample.sampleCode || line.sampleCode || "",
      // Used by the UI to deep-link "fix this sample" from the customs row.
      sourceSampleId: sample._id ? String(sample._id) : undefined,
      sourceSampleCode: sample.sampleCode || line.sampleCode || "",
    };
  });
};

// --------------------------------------------------------------------------
// POST /api/shippo/shipping/:id/customs/auto-build
//   Returns the customs items derived from the shipping's lines + samples.
//   The frontend "Auto-fill from samples" button calls this so the user
//   sees the result in the form *before* anything is sent to Shippo.
// --------------------------------------------------------------------------
export const autoBuildCustomsItems = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;
  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });

    const items = await buildCustomsItemsFromShipping(shipping);
    const missing = items.filter((it) => !it.tariffNumber);

    res.json({
      items,
      summary: {
        total: items.length,
        missingTariff: missing.length,
        missingSamples: missing.map((m) => m.sourceSampleCode).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("[shippo] autoBuildCustomsItems failed:", error);
    res.status(500).json({
      message: error.message || "Failed to auto-build customs items",
    });
  }
};

// --------------------------------------------------------------------------
// POST /api/shipping/:id/shippo/shipment
//   Create a Shippo shipment for an existing Shipping record. The response
//   includes all available rates. Caller may pass:
//     - addressFrom (optional) — override env defaults
//     - addressTo   (optional) — override the customer's bPartner address
//     - parcel      (required) — dimensions + weight
// --------------------------------------------------------------------------
export const createShipmentForShipping = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });

    // Resolve "ship to" address — prefer explicit override, then customer
    // snapshot on the shipping doc, then fetch the bPartner from the DB.
    let addressTo = req.body?.addressTo;
    if (!addressTo) {
      if (shipping.customerSnapshot && shipping.customerSnapshot.street1) {
        addressTo = {
          name: shipping.customerSnapshot.name,
          company: shipping.customerSnapshot.company,
          street1: shipping.customerSnapshot.street1,
          street2: shipping.customerSnapshot.street2,
          city: shipping.customerSnapshot.city,
          state: shipping.customerSnapshot.state,
          zip: shipping.customerSnapshot.zip,
          country: shipping.customerSnapshot.country,
          phone: shipping.customerSnapshot.phone,
          email: shipping.customerSnapshot.email,
        };
      } else if (shipping.bPartnerID) {
        const bp = await Bpartner.findOne({ _id: shipping.bPartnerID, company_id: companyId });
        addressTo = partnerToAddress(bp);
      }
    }

    if (!addressTo || !addressTo.street1 || !addressTo.city || !addressTo.zip) {
      return res.status(400).json({
        message:
          "Destination address is incomplete. Please select a customer with a full address or provide one explicitly.",
      });
    }

    // Resolve ship-from address
    const addressFrom = {
      ...getDefaultFromAddress(),
      ...(shipping.shipFrom || {}),
      ...(req.body?.addressFrom || {}),
    };

    if (!addressFrom.street1 || !addressFrom.zip) {
      return res.status(400).json({
        message:
          "Ship-from address is incomplete. Configure SHIPPO_FROM_* in the backend .env or pass addressFrom in the request.",
      });
    }

    // Parcel: body override, else stored parcel, else env default
    const parcel = req.body?.parcel || shipping.parcel || getDefaultParcel();
    for (const key of ["length", "width", "height", "weight"]) {
      if (!parcel[key] || String(parcel[key]).trim() === "") {
        return res.status(400).json({
          message: `Parcel field "${key}" is required.`,
        });
      }
    }
    if (!parcel.distance_unit) parcel.distance_unit = "in";
    if (!parcel.mass_unit) parcel.mass_unit = "lb";

    console.log(
      `[shippo] createShipment shipping=${shipping._id} from=${addressFrom.city}/${addressFrom.zip} to=${addressTo.city}/${addressTo.zip}`
    );

    // ------------------------------------------------------------
    // Customs declaration (international only)
    // ------------------------------------------------------------
    // Customs source-of-truth precedence:
    //   1. customs.items passed in this request (user manually edited)
    //   2. customs.items previously saved on the shipping doc
    //   3. auto-built from the shipping's lines + samples (each sample
    //      carries its own Schedule B / HS tariff code, set on the
    //      Sample submission form)
    // For an international shipment we ALWAYS create a customs
    // declaration — if the user disabled it, we re-enable it because
    // Shippo will refuse to print international labels otherwise.
    // ------------------------------------------------------------
    const customsInput = req.body?.customs;
    const existingCustoms = shipping.customs?.toObject
      ? shipping.customs.toObject()
      : shipping.customs || {};
    let customs = customsInput || existingCustoms || {};
    const isInternational =
      (addressFrom.country || "").toUpperCase() !==
      (addressTo.country || "").toUpperCase();

    let customsDeclarationId;
    if (isInternational) {
      // Auto-build items from samples when none were provided.
      if (!Array.isArray(customs.items) || customs.items.length === 0) {
        try {
          const built = await buildCustomsItemsFromShipping(shipping);
          if (built.length === 0) {
            return res.status(400).json({
              message:
                "International shipment has no items to declare. Add samples to this shipping log first.",
            });
          }
          customs = {
            ...customs,
            enabled: true,
            contentsType: customs.contentsType || "SAMPLE",
            nonDeliveryOption: customs.nonDeliveryOption || "RETURN",
            certify: customs.certify !== false,
            items: built,
          };
          console.log(
            `[shippo] auto-built ${built.length} customs items from samples for shipping=${shipping._id}`
          );
        } catch (buildErr) {
          console.error("[shippo] customs auto-build failed:", buildErr);
          return res.status(500).json({
            message: "Failed to build customs items from samples.",
          });
        }
      }

      // Validate every item has a tariff number — Shippo accepts blanks
      // but most foreign customs authorities (and the carrier-printed
      // commercial invoice) require an HS code.
      const missing = customs.items
        .filter((it) => !it.tariffNumber || String(it.tariffNumber).trim() === "")
        .map((it) => it.sourceSampleCode || it.skuCode || it.description);
      if (missing.length > 0) {
        return res.status(400).json({
          message:
            `Cannot create international shipment: ${missing.length} item(s) are missing an HS / Schedule B tariff code. ` +
            `Open each sample and set its Customs / Export Classification, then try again.`,
          missing,
        });
      }

      if (!customs.certifySigner || String(customs.certifySigner).trim() === "") {
        return res.status(400).json({
          message:
            "International customs declaration requires a Certify Signer name on the shipping log.",
        });
      }

      // ----------------------------------------------------------------
      // EEL / PFC — Electronic Export Information exemption code.
      // ----------------------------------------------------------------
      // USPS (and most carriers) REQUIRE this on every export from the US
      // — leaving it blank produces:
      //   "Attribute customs_declaration.eel_pfc must not be empty."
      // The right value depends on the origin and the per-item value:
      //   - US -> Canada           : NOEEI_30_36   (FTR §30.36 exemption)
      //   - US -> elsewhere, item value ≤ $2,500 per Schedule B code
      //                            : NOEEI_30_37_a (FTR §30.37(a) low-value)
      //   - US -> elsewhere, item value > $2,500
      //                            : AES_ITN_<itn> (actual AES filing
      //                              required — we cannot default this; the
      //                              user must obtain an ITN from AESDirect)
      // We only auto-default for US-origin shipments. If the user already
      // typed something into the eelPfc field we never overwrite it.
      // ----------------------------------------------------------------
      const fromCountry = (addressFrom.country || "").toUpperCase();
      const toCountry = (addressTo.country || "").toUpperCase();
      if (fromCountry === "US") {
        const provided = String(customs.eelPfc || "").trim();
        if (!provided) {
          const totalExceedsLowValue = customs.items.some((it) => {
            const value = Number(it.valueAmount) || 0;
            const qty = Number(it.quantity) || 1;
            return value * qty > 2500;
          });
          if (toCountry === "CA") {
            customs.eelPfc = "NOEEI_30_36";
          } else if (!totalExceedsLowValue) {
            customs.eelPfc = "NOEEI_30_37_a";
          } else {
            return res.status(400).json({
              message:
                "This US export has at least one customs item over $2,500 in value. " +
                "An AES ITN is required — file with AESDirect (https://www.aesdirect.gov/) " +
                "and enter the ITN as the EEL/PFC code (format: AES_ITN_<your-ITN>) on the customs declaration.",
            });
          }
          console.log(
            `[shippo] eelPfc auto-defaulted to ${customs.eelPfc} for ${fromCountry}->${toCountry}`
          );
        } else if (provided === "AES_ITN" || /^AES_ITN_?$/.test(provided)) {
          // User picked "I have an AES ITN" but didn't paste the actual ITN.
          return res.status(400).json({
            message:
              "AES ITN selected but no ITN value provided. Enter your AESDirect-issued ITN " +
              "after the AES_ITN_ prefix (e.g. AES_ITN_X20250601000001).",
          });
        }
      }

      try {
        // Create all customs items in parallel, then the declaration.
        const itemObjects = await Promise.all(
          customs.items.map((it) => shippoCreateCustomsItem(it))
        );
        const itemIds = itemObjects.map((i) => i.object_id);

        const declaration = await shippoCreateCustomsDeclaration({
          ...customs,
          items: itemIds,
        });
        customsDeclarationId = declaration.object_id;

        // Persist so we can reuse / display later.
        shipping.customs = {
          ...customs,
          enabled: true,
          shippoCustomsDeclarationId: declaration.object_id,
          shippoCustomsItemIds: itemIds,
        };

        console.log(
          `[shippo] customs declaration created id=${declaration.object_id} items=${itemIds.length}`
        );
      } catch (customsErr) {
        console.error("[shippo] customs creation failed:", customsErr);
        return res.status(400).json({
          message:
            customsErr.message ||
            "Failed to create customs declaration for international shipment.",
          shippo: customsErr.shippoResponse,
        });
      }
    } else if (
      customs &&
      customs.enabled &&
      Array.isArray(customs.items) &&
      customs.items.length > 0
    ) {
      // Domestic but user explicitly enabled customs (rare, but allowed).
      try {
        const itemObjects = await Promise.all(
          customs.items.map((it) => shippoCreateCustomsItem(it))
        );
        const itemIds = itemObjects.map((i) => i.object_id);
        const declaration = await shippoCreateCustomsDeclaration({
          ...customs,
          items: itemIds,
        });
        customsDeclarationId = declaration.object_id;
        shipping.customs = {
          ...customs,
          shippoCustomsDeclarationId: declaration.object_id,
          shippoCustomsItemIds: itemIds,
        };
      } catch (customsErr) {
        console.error("[shippo] customs creation failed (domestic):", customsErr);
        return res.status(400).json({
          message:
            customsErr.message || "Failed to create customs declaration.",
          shippo: customsErr.shippoResponse,
        });
      }
    }

    const shippoResp = await shippoCreateShipment({
      addressFrom,
      addressTo,
      parcels: [parcel],
      metadata: shipping.shippingCode || String(shipping._id),
      customsDeclaration: customsDeclarationId,
    });

    console.log(
      `[shippo] shipment created object_id=${shippoResp.object_id} status=${shippoResp.status} rates=${(shippoResp.rates || []).length} messages=${JSON.stringify(shippoResp.messages || [])}`
    );

    // Persist latest attempt for resume/retry
    shipping.shippoShipmentId = shippoResp.object_id;
    shipping.shipFrom = addressFrom;
    shipping.parcel = parcel;
    // Keep a snapshot of the addressTo we used
    shipping.customerSnapshot = {
      name: addressTo.name || "",
      email: addressTo.email || "",
      phone: addressTo.phone || "",
      company: addressTo.company || "",
      street1: addressTo.street1 || "",
      street2: addressTo.street2 || "",
      city: addressTo.city || "",
      state: addressTo.state || "",
      zip: addressTo.zip || "",
      country: addressTo.country || "",
    };
    await shipping.save();

    // Only forward the fields the UI cares about.
    res.json({
      shipping,
      shippoShipmentId: shippoResp.object_id,
      status: shippoResp.status,
      rates: (shippoResp.rates || []).map((r) => ({
        object_id: r.object_id,
        provider: r.provider,
        provider_image_75: r.provider_image_75,
        servicelevel: r.servicelevel,
        amount: r.amount,
        currency: r.currency,
        estimated_days: r.estimated_days,
        duration_terms: r.duration_terms,
        carrier_account: r.carrier_account,
        attributes: r.attributes,
      })),
      messages: shippoResp.messages,
    });
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// GET /api/shipping/:id/shippo/rates
//   Re-fetch rates for the previously-created Shippo shipment.
// --------------------------------------------------------------------------
export const refreshRates = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });
    if (!shipping.shippoShipmentId) {
      return res.status(400).json({
        message: "No Shippo shipment has been created yet. Create one first.",
      });
    }

    const resp = await shippoRetrieveShipment(shipping.shippoShipmentId);
    res.json({
      shippoShipmentId: resp.object_id,
      status: resp.status,
      rates: (resp.rates || []).map((r) => ({
        object_id: r.object_id,
        provider: r.provider,
        provider_image_75: r.provider_image_75,
        servicelevel: r.servicelevel,
        amount: r.amount,
        currency: r.currency,
        estimated_days: r.estimated_days,
        duration_terms: r.duration_terms,
        attributes: r.attributes,
      })),
      messages: resp.messages,
    });
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// POST /api/shipping/:id/shippo/label
//   Purchase a label for the given rate. Stores tracking + label info on
//   the Shipping record and flips status to "Shipped".
//
// Handles three Shippo response states:
//   - SUCCESS  -> persist label + tracking and return the full transaction.
//   - QUEUED / WAITING -> poll the transaction until it's SUCCESS or ERROR.
//   - ERROR    -> surface the carrier's error messages so the UI can display them.
// --------------------------------------------------------------------------
const formatShippoMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  return messages
    .map((m) => {
      if (!m) return "";
      if (typeof m === "string") return m;
      // Shippo messages are usually { source, code, text }
      return [m.source, m.code, m.text].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("; ");
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForTransaction = async (transactionId, { maxAttempts = 10, delayMs = 1500 } = {}) => {
  let last = null;
  for (let i = 0; i < maxAttempts; i++) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
    // eslint-disable-next-line no-await-in-loop
    last = await shippoRetrieveTransaction(transactionId);
    if (last.status === "SUCCESS" || last.status === "ERROR") return last;
  }
  return last;
};

export const buyLabel = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;
  const { rateId, labelFileType } = req.body || {};

  if (!rateId) {
    return res.status(400).json({ message: "rateId is required" });
  }

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });

    console.log(
      `[shippo] buyLabel shipping=${shipping._id} rateId=${rateId} labelFileType=${labelFileType || getDefaultLabelFileType()}`
    );

    let tx = await shippoCreateTransaction({
      rateId,
      labelFileType,
      metadata: shipping.shippingCode || String(shipping._id),
    });

    console.log(
      `[shippo] transaction created object_id=${tx.object_id} status=${tx.status} messages=${JSON.stringify(tx.messages || [])}`
    );

    // If Shippo kicked this off asynchronously (the `async: false` flag is a
    // hint, not a guarantee — some carriers always process async), poll until
    // we get a terminal state.
    if ((tx.status === "QUEUED" || tx.status === "WAITING") && tx.object_id) {
      console.log(`[shippo] transaction ${tx.object_id} is ${tx.status}, polling...`);
      tx = await waitForTransaction(tx.object_id);
      console.log(`[shippo] polled status=${tx?.status} messages=${JSON.stringify(tx?.messages || [])}`);
    }

    if (!tx || tx.status !== "SUCCESS") {
      const detail = formatShippoMessages(tx?.messages);
      console.error(
        `[shippo] buyLabel failed status=${tx?.status} detail=${detail} full=${JSON.stringify(tx)}`
      );
      return res.status(400).json({
        message: detail
          ? `Shippo could not create the label: ${detail}`
          : `Shippo could not create the label (status: ${tx?.status || "UNKNOWN"}).`,
        shippoStatus: tx?.status,
        shippoMessages: tx?.messages || [],
        shippo: tx,
      });
    }

    shipping.shippoRateId = rateId;
    shipping.shippoTransactionId = tx.object_id;
    shipping.labelUrl = tx.label_url;
    shipping.labelFileType = tx.label_file_type || labelFileType || getDefaultLabelFileType();
    shipping.commercialInvoiceUrl = tx.commercial_invoice_url;
    shipping.trackingNumber = tx.tracking_number;
    shipping.trackingUrlProvider = tx.tracking_url_provider;
    shipping.trackingStatus = tx.tracking_status?.status || "UNKNOWN";

    // Pull carrier/service info from the rate if present (Shippo expands it).
    // We also derive `logisticsProvider` and `estimatedArrivalDate` here so
    // the shipping log displays them automatically — these fields used to
    // be entered by hand on the form and are no longer collected from the
    // user.
    let rateEstimatedDays;
    if (tx.rate) {
      try {
        let rateObj = tx.rate;
        if (typeof rateObj === "string") {
          rateObj = await shippoRetrieveRate(rateObj);
        }
        shipping.carrier = rateObj.provider;
        shipping.serviceLevel = rateObj.servicelevel?.token;
        shipping.serviceLevelName = rateObj.servicelevel?.name;
        shipping.shippingCost = rateObj.amount;
        shipping.shippingCurrency = rateObj.currency;
        // Mirror provider into the legacy `logisticsProvider` field for
        // any UI / report that still reads it.
        if (rateObj.provider) {
          shipping.logisticsProvider = rateObj.provider;
        }
        if (Number.isFinite(Number(rateObj.estimated_days))) {
          rateEstimatedDays = Number(rateObj.estimated_days);
        }
      } catch (rateErr) {
        console.warn(`[shippo] Could not hydrate rate: ${rateErr.message}`);
      }
    }

    shipping.status = "Shipped";
    if (!shipping.shipmentDate) shipping.shipmentDate = new Date();
    if (rateEstimatedDays != null) {
      const eta = new Date(shipping.shipmentDate);
      eta.setDate(eta.getDate() + rateEstimatedDays);
      shipping.estimatedArrivalDate = eta;
      shipping.estDate = eta;
    }
    await shipping.save();

    console.log(
      `[shippo] buyLabel SUCCESS shipping=${shipping._id} tracking=${tx.tracking_number} labelUrl=${tx.label_url}`
    );

    res.json({
      shipping,
      transaction: {
        object_id: tx.object_id,
        status: tx.status,
        tracking_number: tx.tracking_number,
        tracking_url_provider: tx.tracking_url_provider,
        label_url: tx.label_url,
        commercial_invoice_url: tx.commercial_invoice_url,
        rate: tx.rate,
      },
    });
  } catch (error) {
    console.error(`[shippo] buyLabel error:`, error);
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// GET /api/shipping/:id/shippo/label
//   Re-fetch the label URL / transaction info from Shippo (useful when the
//   signed URL has expired).
// --------------------------------------------------------------------------
export const getLabel = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });
    if (!shipping.shippoTransactionId) {
      return res.status(404).json({ message: "No label has been purchased for this shipping." });
    }

    const tx = await shippoRetrieveTransaction(shipping.shippoTransactionId);
    if (tx.label_url) {
      shipping.labelUrl = tx.label_url;
      await shipping.save();
    }
    res.json({
      labelUrl: tx.label_url,
      trackingNumber: tx.tracking_number,
      trackingUrlProvider: tx.tracking_url_provider,
      status: tx.status,
    });
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// GET /api/shipping/:id/shippo/track
//   Live tracking pull from Shippo. Persists latest status + history on
//   the Shipping record and mirrors DELIVERED -> status = "Delivered".
// --------------------------------------------------------------------------
export const trackLabel = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });
    if (!shipping.carrier || !shipping.trackingNumber) {
      return res.status(400).json({
        message: "This shipping has no carrier/tracking number yet. Buy a label first.",
      });
    }

    // ----------------------------------------------------------------
    // TEST-MODE TRACKING OVERRIDE (remove once SHIPPO_API_TOKEN is
    // switched to a shippo_live_* token).
    // ----------------------------------------------------------------
    // Shippo's sandbox refuses live tracking against real carrier
    // names ("dhl_express", "usps", ...) — it returns:
    //   "DHL Express is not a valid test tracking carrier. Please use 'shippo'"
    // To exercise the full tracking UI in test mode we swap the
    // request to use carrier "shippo" + one of Shippo's magic test
    // tracking numbers (e.g. "SHIPPO_TRANSIT"). The saved carrier /
    // tracking number on the shipping document are untouched, so the
    // moment you flip to a live token the override falls away and
    // tracking goes through to the real carrier.
    // ----------------------------------------------------------------
    let trackCarrier = shipping.carrier;
    let trackNumber = shipping.trackingNumber;
    let testOverrideApplied = false;
    if (isShippoTestMode()) {
      const desired = String(process.env.SHIPPO_TEST_TRACKING_STATE || "SHIPPO_TRANSIT")
        .trim()
        .toUpperCase();
      if (SHIPPO_TEST_TRACKING_NUMBERS.includes(desired)) {
        trackCarrier = "shippo";
        trackNumber = desired;
        testOverrideApplied = true;
        console.log(
          `[shippo] test-mode tracking override active: forwarding (carrier="shippo", trackingNumber="${desired}") instead of (${shipping.carrier}, ${shipping.trackingNumber})`
        );
      } else {
        console.warn(
          `[shippo] SHIPPO_TEST_TRACKING_STATE="${desired}" is not a valid Shippo sandbox tracking number; falling back to real carrier ${shipping.carrier}. Allowed values: ${SHIPPO_TEST_TRACKING_NUMBERS.join(", ")}`
        );
      }
    }

    const tracking = await shippoTrackShipment(trackCarrier, trackNumber);

    const latest = tracking.tracking_status || {};
    shipping.trackingStatus = latest.status || shipping.trackingStatus;
    shipping.trackingStatusDetails = latest.status_details;
    shipping.trackingStatusDate = latest.status_date ? new Date(latest.status_date) : undefined;
    shipping.trackingHistory = (tracking.tracking_history || []).map((h) => ({
      status: h.status,
      status_details: h.status_details,
      status_date: h.status_date ? new Date(h.status_date) : undefined,
      location: h.location
        ? {
            city: h.location.city,
            state: h.location.state,
            zip: h.location.zip,
            country: h.location.country,
          }
        : undefined,
    }));

    // Mirror the high-level status to our own enum.
    if (latest.status === "DELIVERED") shipping.status = "Delivered";
    else if (latest.status === "TRANSIT" || latest.status === "PRE_TRANSIT") {
      shipping.status = "Shipped";
    }

    await shipping.save();

    res.json({
      // Always echo the real carrier + tracking number the user expects
      // to see, even when the underlying lookup was redirected through
      // Shippo's test tracking endpoint.
      carrier: shipping.carrier,
      trackingNumber: shipping.trackingNumber,
      trackingUrlProvider: tracking.tracking_url_provider,
      eta: tracking.eta,
      tracking_status: latest,
      tracking_history: tracking.tracking_history || [],
      servicelevel: tracking.servicelevel,
      metadata: tracking.metadata,
      // Lets the UI render a "Simulated tracking (test mode)" banner so
      // QA isn't confused about why a never-mailed package shows
      // transit events. Removed automatically once the live token is in.
      testOverride: testOverrideApplied
        ? { active: true, state: process.env.SHIPPO_TEST_TRACKING_STATE }
        : undefined,
    });
  } catch (error) {
    sendShippoError(res, error);
  }
};

// --------------------------------------------------------------------------
// POST /api/shipping/:id/shippo/refund
//   Void / refund the purchased label.
// --------------------------------------------------------------------------
export const refundShippingLabel = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;
  const { id } = req.params;

  try {
    const shipping = await loadShipping(id, companyId);
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });
    if (!shipping.shippoTransactionId) {
      return res.status(400).json({ message: "No label to refund." });
    }

    const refund = await shippoRefundLabel(shipping.shippoTransactionId);
    shipping.refundId = refund.object_id;
    shipping.refundStatus = refund.status;
    if (refund.status === "SUCCESS" || refund.status === "QUEUED") {
      shipping.status = "Cancelled";
    }
    await shipping.save();

    res.json({ shipping, refund });
  } catch (error) {
    sendShippoError(res, error);
  }
};

export default {
  getShippoConfig,
  listCarriers,
  validateAddress,
  createShipmentForShipping,
  refreshRates,
  buyLabel,
  getLabel,
  trackLabel,
  refundShippingLabel,
  autoBuildCustomsItems,
};
