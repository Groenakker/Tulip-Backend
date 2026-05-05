/**
 * Shippo controller
 *
 * All Shippo calls happen server-side so the API token never reaches the
 * browser (per security rules). Each endpoint is authenticated and scoped
 * to the user's company.
 */

import Shipping from "../models/shipping.models.js";
import Bpartner from "../models/bPartners.models.js";
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
    // If the request supplied customs data OR we already stored
    // customs info AND the shipment is international, create a
    // Shippo customs declaration and attach it to the shipment.
    // ------------------------------------------------------------
    const customsInput = req.body?.customs;
    const existingCustoms = shipping.customs?.toObject
      ? shipping.customs.toObject()
      : shipping.customs || {};
    const customs = customsInput || existingCustoms;
    const isInternational =
      (addressFrom.country || "").toUpperCase() !==
      (addressTo.country || "").toUpperCase();

    let customsDeclarationId;
    if (
      isInternational &&
      customs &&
      customs.enabled &&
      Array.isArray(customs.items) &&
      customs.items.length > 0
    ) {
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
      } catch (rateErr) {
        console.warn(`[shippo] Could not hydrate rate: ${rateErr.message}`);
      }
    }

    shipping.status = "Shipped";
    if (!shipping.shipmentDate) shipping.shipmentDate = new Date();
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

    const tracking = await shippoTrackShipment(shipping.carrier, shipping.trackingNumber);

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
      carrier: tracking.carrier,
      trackingNumber: tracking.tracking_number,
      trackingUrlProvider: tracking.tracking_url_provider,
      eta: tracking.eta,
      tracking_status: latest,
      tracking_history: tracking.tracking_history || [],
      servicelevel: tracking.servicelevel,
      metadata: tracking.metadata,
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
};
