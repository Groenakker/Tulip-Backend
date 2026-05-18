import Company from "../models/company.models.js";
import {
  resolveShippoConfig,
  isShippoConfigured,
  isShippoTestMode,
  getDefaultParcel,
  getDefaultLabelFileType,
} from "./shippo.js";

export const maskApiToken = (token) => {
  if (!token || typeof token !== "string") return "";
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 12)}${"*".repeat(Math.min(8, trimmed.length - 16))}${trimmed.slice(-4)}`;
};

export const loadCompanyShippoConfig = async (companyId) => {
  if (!companyId) return null;
  const company = await Company.findById(companyId).select("+shippoConfig.apiToken shippoConfig");
  if (!company?.shippoConfig) return null;
  return company.shippoConfig.toObject ? company.shippoConfig.toObject() : company.shippoConfig;
};

export const sanitizeShippoConfigInput = (body = {}) => {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, "apiToken")) {
    const token = typeof body.apiToken === "string" ? body.apiToken.trim() : "";
    if (token) updates.apiToken = token;
  }

  if (Object.prototype.hasOwnProperty.call(body, "apiVersion")) {
    updates.apiVersion =
      typeof body.apiVersion === "string" ? body.apiVersion.trim() : "";
  }

  if (Object.prototype.hasOwnProperty.call(body, "labelFileType")) {
    const allowed = ["PDF", "PDF_4x6", "PDF_4x8", "PNG", "PNG_2.3x7.5", "ZPLII"];
    const value = typeof body.labelFileType === "string" ? body.labelFileType.trim() : "";
    if (value && allowed.includes(value)) updates.labelFileType = value;
  }

  const parcelFields = [
    ["defaultParcelLength", "length"],
    ["defaultParcelWidth", "width"],
    ["defaultParcelHeight", "height"],
    ["defaultParcelWeight", "weight"],
  ];
  for (const [inputKey, bodyKey] of parcelFields) {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      const value = body[bodyKey];
      if (value != null && String(value).trim() !== "") {
        updates[inputKey] = String(value).trim();
      }
    } else if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
      const value = body[inputKey];
      if (value != null && String(value).trim() !== "") {
        updates[inputKey] = String(value).trim();
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "distance_unit")) {
    const unit = String(body.distance_unit).trim();
    if (unit === "in" || unit === "cm") updates.defaultParcelDistanceUnit = unit;
  } else if (Object.prototype.hasOwnProperty.call(body, "defaultParcelDistanceUnit")) {
    const unit = String(body.defaultParcelDistanceUnit).trim();
    if (unit === "in" || unit === "cm") updates.defaultParcelDistanceUnit = unit;
  }

  if (Object.prototype.hasOwnProperty.call(body, "mass_unit")) {
    const unit = String(body.mass_unit).trim();
    if (["lb", "oz", "kg", "g"].includes(unit)) updates.defaultParcelMassUnit = unit;
  } else if (Object.prototype.hasOwnProperty.call(body, "defaultParcelMassUnit")) {
    const unit = String(body.defaultParcelMassUnit).trim();
    if (["lb", "oz", "kg", "g"].includes(unit)) updates.defaultParcelMassUnit = unit;
  }

  if (Object.prototype.hasOwnProperty.call(body, "testTrackingState")) {
    const allowed = [
      "",
      "SHIPPO_PRE_TRANSIT",
      "SHIPPO_TRANSIT",
      "SHIPPO_DELIVERED",
      "SHIPPO_RETURNED",
      "SHIPPO_FAILURE",
      "SHIPPO_UNKNOWN",
    ];
    const value = String(body.testTrackingState || "").trim().toUpperCase();
    if (allowed.includes(value)) updates.testTrackingState = value || "SHIPPO_TRANSIT";
  }

  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    updates.enabled = Boolean(body.enabled);
  }

  return updates;
};

export const formatShippoConfigResponse = (companyConfig) => {
  const resolved = resolveShippoConfig(companyConfig);
  const token = companyConfig?.apiToken || "";
  return {
    configured: isShippoConfigured(resolved),
    hasApiToken: Boolean(token && token.trim()),
    apiTokenMasked: maskApiToken(token),
    apiVersion: resolved.apiVersion || "",
    labelFileType: getDefaultLabelFileType(resolved),
    defaultParcel: getDefaultParcel(resolved),
    testTrackingState: resolved.testTrackingState || "SHIPPO_TRANSIT",
    isTestMode: isShippoTestMode(resolved),
    enabled: Boolean(companyConfig?.enabled),
  };
};

export const validateApiToken = (token) => {
  if (!token || typeof token !== "string") {
    return "API token is required.";
  }
  const trimmed = token.trim();
  if (!trimmed) return "API token cannot be empty.";
  if (trimmed.includes("REPLACE_ME")) return "Please provide a valid Shippo API token.";
  if (!/^shippo_(test|live)_/.test(trimmed)) {
    return "API token should start with shippo_test_ or shippo_live_.";
  }
  return null;
};
