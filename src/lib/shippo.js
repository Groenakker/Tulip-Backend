/**
 * Thin wrapper around the Shippo REST API.
 *
 * Why direct REST (instead of the `shippo` npm SDK)?
 *   - The SDK has gone through multiple major versions with breaking changes
 *     and mixes CJS/ESM in awkward ways. The REST API is stable and well
 *     documented: https://docs.goshippo.com/shippoapi/public-api
 *   - Keeps dependencies minimal and surfaces clearer error messages.
 *
 * SECURITY: This file must only ever run server-side. API tokens are read from
 * per-company settings (Settings > System Configuration) with env fallbacks.
 */

const SHIPPO_BASE_URL = "https://api.goshippo.com";

export const SHIPPO_TEST_TRACKING_NUMBERS = Object.freeze([
  "SHIPPO_PRE_TRANSIT",
  "SHIPPO_TRANSIT",
  "SHIPPO_DELIVERED",
  "SHIPPO_RETURNED",
  "SHIPPO_FAILURE",
  "SHIPPO_UNKNOWN",
]);

export const resolveShippoConfig = (companyConfig = null) => {
  const cc = companyConfig && typeof companyConfig === "object" ? companyConfig : {};
  const token =
    (cc.apiToken && String(cc.apiToken).trim()) ||
    process.env.SHIPPO_API_TOKEN ||
    "";

  return {
    apiToken: token,
    apiVersion: cc.apiVersion || process.env.SHIPPO_API_VERSION || "",
    labelFileType:
      cc.labelFileType || process.env.SHIPPO_LABEL_FILE_TYPE || "PDF_4x6",
    parcelLength:
      cc.defaultParcelLength || process.env.SHIPPO_DEFAULT_PARCEL_LENGTH || "10",
    parcelWidth:
      cc.defaultParcelWidth || process.env.SHIPPO_DEFAULT_PARCEL_WIDTH || "8",
    parcelHeight:
      cc.defaultParcelHeight || process.env.SHIPPO_DEFAULT_PARCEL_HEIGHT || "4",
    parcelDistanceUnit:
      cc.defaultParcelDistanceUnit ||
      process.env.SHIPPO_DEFAULT_PARCEL_DISTANCE_UNIT ||
      "in",
    parcelWeight:
      cc.defaultParcelWeight || process.env.SHIPPO_DEFAULT_PARCEL_WEIGHT || "2",
    parcelMassUnit:
      cc.defaultParcelMassUnit ||
      process.env.SHIPPO_DEFAULT_PARCEL_MASS_UNIT ||
      "lb",
    testTrackingState:
      cc.testTrackingState ||
      process.env.SHIPPO_TEST_TRACKING_STATE ||
      "SHIPPO_TRANSIT",
  };
};

export const isShippoConfigured = (companyConfig = null) => {
  const { apiToken } = resolveShippoConfig(companyConfig);
  return Boolean(
    apiToken && apiToken.trim() !== "" && !apiToken.includes("REPLACE_ME")
  );
};

export const isShippoTestMode = (companyConfig = null) => {
  const { apiToken } = resolveShippoConfig(companyConfig);
  return apiToken.startsWith("shippo_test_");
};

/**
 * Get a default "ship from" address from environment variables.
 * Ship-from addresses are managed per company under Settings > Company.
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

export const getDefaultParcel = (companyConfig = null) => {
  const cfg = resolveShippoConfig(companyConfig);
  return {
    length: cfg.parcelLength,
    width: cfg.parcelWidth,
    height: cfg.parcelHeight,
    distance_unit: cfg.parcelDistanceUnit,
    weight: cfg.parcelWeight,
    mass_unit: cfg.parcelMassUnit,
  };
};

export const getDefaultLabelFileType = (companyConfig = null) =>
  resolveShippoConfig(companyConfig).labelFileType;

/**
 * Normalize an incoming address object (from our DB bPartner or frontend input)
 * into a Shippo-compatible address payload.
 */
export const normalizeAddress = (addr = {}) => ({
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
});

export const createShippoClient = (companyConfig = null) => {
  const cfg = resolveShippoConfig(companyConfig);

  const getApiToken = () => {
    if (!cfg.apiToken || cfg.apiToken.trim() === "" || cfg.apiToken.includes("REPLACE_ME")) {
      const err = new Error(
        "Shippo is not configured. Add your Shippo API credentials under Settings > System Configuration."
      );
      err.status = 503;
      throw err;
    }
    return cfg.apiToken;
  };

  const buildHeaders = () => {
    const headers = {
      Authorization: `ShippoToken ${getApiToken()}`,
      "Content-Type": "application/json",
    };
    if (cfg.apiVersion) {
      headers["Shippo-API-Version"] = cfg.apiVersion;
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

  const createShipment = async ({
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

  const createCustomsItem = async (item = {}) => {
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

  const createCustomsDeclaration = async (declaration = {}) => {
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

  return {
    config: cfg,
    isShippoConfigured: () => isShippoConfigured(companyConfig),
    isShippoTestMode: () => isShippoTestMode(companyConfig),
    getDefaultParcel: () => getDefaultParcel(companyConfig),
    getDefaultLabelFileType: () => getDefaultLabelFileType(companyConfig),
    normalizeAddress,
    createShipment,
    retrieveShipment: (shipmentId) => shippoFetch(`/shipments/${shipmentId}/`),
    retrieveRate: (rateId) => shippoFetch(`/rates/${rateId}/`),
    createTransaction: async ({ rateId, labelFileType, metadata }) => {
      const body = {
        rate: rateId,
        label_file_type: labelFileType || getDefaultLabelFileType(companyConfig),
        async: false,
      };
      if (metadata) body.metadata = String(metadata).slice(0, 100);
      return shippoFetch("/transactions/", { method: "POST", body });
    },
    retrieveTransaction: (transactionId) =>
      shippoFetch(`/transactions/${transactionId}/`),
    refundLabel: (transactionId) =>
      shippoFetch("/refunds/", {
        method: "POST",
        body: { transaction: transactionId, async: false },
      }),
    trackShipment: (carrier, trackingNumber) =>
      shippoFetch(
        `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`
      ),
    registerTracking: (carrier, trackingNumber, metadata) =>
      shippoFetch("/tracks/", {
        method: "POST",
        body: {
          carrier,
          tracking_number: trackingNumber,
          metadata: metadata ? String(metadata).slice(0, 100) : undefined,
        },
      }),
    validateAddress: (address) =>
      shippoFetch("/addresses/", {
        method: "POST",
        body: { ...normalizeAddress(address), validate: true },
      }),
    listCarrierAccounts: () => shippoFetch("/carrier_accounts/?results=100"),
    createCustomsItem,
    createCustomsDeclaration,
  };
};

// Env-only default client for backward compatibility.
const defaultClient = createShippoClient(null);

export const createShipment = (...args) => defaultClient.createShipment(...args);
export const retrieveShipment = (...args) => defaultClient.retrieveShipment(...args);
export const retrieveRate = (...args) => defaultClient.retrieveRate(...args);
export const createTransaction = (...args) => defaultClient.createTransaction(...args);
export const retrieveTransaction = (...args) => defaultClient.retrieveTransaction(...args);
export const refundLabel = (...args) => defaultClient.refundLabel(...args);
export const trackShipment = (...args) => defaultClient.trackShipment(...args);
export const registerTracking = (...args) => defaultClient.registerTracking(...args);
export const validateAddress = (...args) => defaultClient.validateAddress(...args);
export const listCarrierAccounts = (...args) => defaultClient.listCarrierAccounts(...args);
export const createCustomsItem = (...args) => defaultClient.createCustomsItem(...args);
export const createCustomsDeclaration = (...args) =>
  defaultClient.createCustomsDeclaration(...args);

export default {
  resolveShippoConfig,
  getDefaultFromAddress,
  getDefaultParcel,
  getDefaultLabelFileType,
  normalizeAddress,
  createShippoClient,
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
  isShippoTestMode,
  SHIPPO_TEST_TRACKING_NUMBERS,
};
