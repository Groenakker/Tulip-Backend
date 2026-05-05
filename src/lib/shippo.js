/**
 * Thin wrapper around the Shippo REST API.
 *
 * Why direct REST (instead of the `shippo` npm SDK)?
 *   - The SDK has gone through multiple major versions with breaking changes
 *     and mixes CJS/ESM in awkward ways. The REST API is stable and well
 *     documented: https://docs.goshippo.com/shippoapi/public-api
 *   - Keeps dependencies minimal and surfaces clearer error messages.
 *
 * SECURITY: This file must only ever run server-side. It reads the API token
 * from process.env and should never be imported by the frontend.
 */

const SHIPPO_BASE_URL = "https://api.goshippo.com";

const getApiToken = () => {
  const token = process.env.SHIPPO_API_TOKEN;
  if (!token || token.trim() === "" || token.includes("REPLACE_ME")) {
    const err = new Error(
      "Shippo is not configured. Set SHIPPO_API_TOKEN in the backend .env file."
    );
    err.status = 503;
    throw err;
  }
  return token;
};

const buildHeaders = () => {
  const headers = {
    Authorization: `ShippoToken ${getApiToken()}`,
    "Content-Type": "application/json",
  };
  if (process.env.SHIPPO_API_VERSION) {
    headers["Shippo-API-Version"] = process.env.SHIPPO_API_VERSION;
  }
  return headers;
};

const shippoFetch = async (path, { method = "GET", body } = {}) => {
  const url = `${SHIPPO_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (should be rare) — keep raw text for error context.
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message || data.error)) ||
      `Shippo API error (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.shippoResponse = data;
    throw err;
  }

  return data;
};

/**
 * Get a default "ship from" address from environment variables.
 * The frontend can override any field per-shipment.
 */
export const getDefaultFromAddress = () => ({
  name: process.env.SHIPPO_FROM_NAME || "",
  company: process.env.SHIPPO_FROM_COMPANY || "",
  street1: process.env.SHIPPO_FROM_STREET1 || "",
  street2: process.env.SHIPPO_FROM_STREET2 || "",
  city: process.env.SHIPPO_FROM_CITY || "",
  state: process.env.SHIPPO_FROM_STATE || "",
  zip: process.env.SHIPPO_FROM_ZIP || "",
  country: process.env.SHIPPO_FROM_COUNTRY || "US",
  phone: process.env.SHIPPO_FROM_PHONE || "",
  email: process.env.SHIPPO_FROM_EMAIL || "",
});

export const getDefaultParcel = () => ({
  length: process.env.SHIPPO_DEFAULT_PARCEL_LENGTH || "10",
  width: process.env.SHIPPO_DEFAULT_PARCEL_WIDTH || "8",
  height: process.env.SHIPPO_DEFAULT_PARCEL_HEIGHT || "4",
  distance_unit: process.env.SHIPPO_DEFAULT_PARCEL_DISTANCE_UNIT || "in",
  weight: process.env.SHIPPO_DEFAULT_PARCEL_WEIGHT || "2",
  mass_unit: process.env.SHIPPO_DEFAULT_PARCEL_MASS_UNIT || "lb",
});

export const getDefaultLabelFileType = () =>
  process.env.SHIPPO_LABEL_FILE_TYPE || "PDF_4x6";

/**
 * Normalize an incoming address object (from our DB bPartner or frontend input)
 * into a Shippo-compatible address payload.
 */
export const normalizeAddress = (addr = {}) => {
  return {
    name: addr.name || addr.fullName || "",
    company: addr.company || addr.companyName || "",
    street1: addr.street1 || addr.address1 || addr.address || "",
    street2: addr.street2 || addr.address2 || "",
    city: addr.city || "",
    state: addr.state || addr.province || "",
    zip: addr.zip || addr.postalCode || addr.postcode || "",
    country: (addr.country || "US").toUpperCase(),
    phone: addr.phone || "",
    email: addr.email || "",
    validate: Boolean(addr.validate),
  };
};

/**
 * Create a Shippo shipment and fetch rates.
 *
 * Shippo responds with a shipment object that includes a `rates` array
 * populated asynchronously. We use `async: false` so the response includes
 * rates inline (Shippo waits for carriers to respond).
 *
 * For international shipments, pass `customsDeclaration` (the Shippo
 * object_id of a previously-created customs declaration).
 */
export const createShipment = async ({
  addressFrom,
  addressTo,
  parcels,
  metadata,
  customsDeclaration,
}) => {
  const parcelArr = Array.isArray(parcels) ? parcels : [parcels];
  const body = {
    address_from: normalizeAddress(addressFrom),
    address_to: normalizeAddress(addressTo),
    parcels: parcelArr,
    async: false,
  };
  if (metadata) body.metadata = String(metadata).slice(0, 100);
  if (customsDeclaration) body.customs_declaration = customsDeclaration;
  return shippoFetch("/shipments/", { method: "POST", body });
};

// ============================================================
// Customs Items / Declaration
// ------------------------------------------------------------
// International shipments require a customs declaration made up of
// one or more customs items (one per distinct product). We expose
// thin wrappers so the controller can build these in one go.
// ============================================================

export const createCustomsItem = async (item = {}) => {
  const body = {
    description: item.description || "",
    quantity: Number(item.quantity) || 1,
    net_weight: String(item.netWeight ?? item.net_weight ?? ""),
    mass_unit: item.massUnit || item.mass_unit || "lb",
    value_amount: String(item.valueAmount ?? item.value_amount ?? ""),
    value_currency: item.valueCurrency || item.value_currency || "USD",
    origin_country: (item.originCountry || item.origin_country || "US").toUpperCase(),
  };
  if (item.tariffNumber || item.tariff_number) {
    body.tariff_number = item.tariffNumber || item.tariff_number;
  }
  if (item.skuCode || item.sku_code) {
    body.sku_code = item.skuCode || item.sku_code;
  }
  return shippoFetch("/customs/items/", { method: "POST", body });
};

export const createCustomsDeclaration = async (declaration = {}) => {
  const body = {
    contents_type: declaration.contentsType || declaration.contents_type || "MERCHANDISE",
    non_delivery_option:
      declaration.nonDeliveryOption || declaration.non_delivery_option || "RETURN",
    certify: declaration.certify !== false,
    certify_signer: declaration.certifySigner || declaration.certify_signer || "",
    items: Array.isArray(declaration.items) ? declaration.items : [],
  };
  if (declaration.contentsExplanation || declaration.contents_explanation) {
    body.contents_explanation =
      declaration.contentsExplanation || declaration.contents_explanation;
  }
  if (declaration.incoterm) body.incoterm = declaration.incoterm;
  if (declaration.eelPfc || declaration.eel_pfc) {
    body.eel_pfc = declaration.eelPfc || declaration.eel_pfc;
  }
  if (declaration.invoicedCharges) {
    body.invoiced_charges = {
      total_shipping: declaration.invoicedCharges.totalShipping,
      total_taxes: declaration.invoicedCharges.totalTaxes,
      total_duties: declaration.invoicedCharges.totalDuties,
      other_fees: declaration.invoicedCharges.otherFees,
      currency: declaration.invoicedCharges.currency,
    };
  }
  return shippoFetch("/customs/declarations/", { method: "POST", body });
};

export const retrieveShipment = async (shipmentId) =>
  shippoFetch(`/shipments/${shipmentId}/`);

export const retrieveRate = async (rateId) =>
  shippoFetch(`/rates/${rateId}/`);

/**
 * Purchase a label for a selected rate. This is what produces a tracking
 * number and a printable label.
 */
export const createTransaction = async ({ rateId, labelFileType, metadata }) => {
  const body = {
    rate: rateId,
    label_file_type: labelFileType || getDefaultLabelFileType(),
    async: false,
  };
  if (metadata) body.metadata = String(metadata).slice(0, 100);
  return shippoFetch("/transactions/", { method: "POST", body });
};

export const retrieveTransaction = async (transactionId) =>
  shippoFetch(`/transactions/${transactionId}/`);

/**
 * Refund a purchased label (voids the shipment). Only works if the label
 * has not been used yet and within the carrier's refund window.
 */
export const refundLabel = async (transactionId) =>
  shippoFetch("/refunds/", {
    method: "POST",
    body: { transaction: transactionId, async: false },
  });

/**
 * Look up live tracking for a shipment. `carrier` is the Shippo carrier
 * token (e.g. "usps", "ups", "fedex", "dhl_express").
 */
export const trackShipment = async (carrier, trackingNumber) =>
  shippoFetch(`/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`);

/**
 * Register a tracking subscription. Optional — only needed if you wire up
 * Shippo webhooks to receive push updates.
 */
export const registerTracking = async (carrier, trackingNumber, metadata) =>
  shippoFetch("/tracks/", {
    method: "POST",
    body: {
      carrier,
      tracking_number: trackingNumber,
      metadata: metadata ? String(metadata).slice(0, 100) : undefined,
    },
  });

export const validateAddress = async (address) =>
  shippoFetch("/addresses/", {
    method: "POST",
    body: { ...normalizeAddress(address), validate: true },
  });

export const listCarrierAccounts = async () =>
  shippoFetch("/carrier_accounts/?results=100");

export const isShippoConfigured = () => {
  const token = process.env.SHIPPO_API_TOKEN;
  return Boolean(token && token.trim() !== "" && !token.includes("REPLACE_ME"));
};

export default {
  getDefaultFromAddress,
  getDefaultParcel,
  getDefaultLabelFileType,
  normalizeAddress,
  createShipment,
  retrieveShipment,
  retrieveRate,
  createTransaction,
  retrieveTransaction,
  refundLabel,
  trackShipment,
  registerTracking,
  validateAddress,
  listCarrierAccounts,
  createCustomsItem,
  createCustomsDeclaration,
  isShippoConfigured,
};
