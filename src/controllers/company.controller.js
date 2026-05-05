import Company from "../models/company.models.js";
import User from "../models/user.models.js";

export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find();
    res.json(companies);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch companies", error: error.message });
  }
};

export const getCompanyById = async (req, res) => {
  const { id } = req.params;

  try {
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch company", error: error.message });
  }
};

export const createCompany = async (req, res) => {
  try {
    const payload = req.body || {};
    const { company_name, company_email } = payload;

    if (!company_name) {
      return res
        .status(400)
        .json({ message: "Company name is required" });
    }

    if (!company_email) {
      return res
        .status(400)
        .json({ message: "Company email is required" });
    }

    const existingByName = await Company.findOne({ company_name: company_name.trim() });
    if (existingByName) {
      return res
        .status(400)
        .json({ message: "Company with this name already exists" });
    }

    const normalizedEmail = company_email.trim().toLowerCase();
    const existingByEmail = await Company.findOne({ company_email: normalizedEmail });
    if (existingByEmail) {
      return res
        .status(400)
        .json({ message: "Company with this email already exists" });
    }

    const company = await Company.create({
      ...payload,
      company_name: company_name.trim(),
      company_email: normalizedEmail,
    });
    res.status(201).json(company);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create company", error: error.message });
  }
};

// Normalize a single shipping address entry (server-side, never trust
// anything the client sends verbatim). Returns a plain object suitable
// for storage in the sub-document array.
const sanitizeShippingAddress = (entry = {}) => ({
  ...(entry._id ? { _id: entry._id } : {}),
  label: typeof entry.label === "string" ? entry.label.trim() : "",
  name: typeof entry.name === "string" ? entry.name.trim() : "",
  company: typeof entry.company === "string" ? entry.company.trim() : "",
  street1: typeof entry.street1 === "string" ? entry.street1.trim() : "",
  street2: typeof entry.street2 === "string" ? entry.street2.trim() : "",
  city: typeof entry.city === "string" ? entry.city.trim() : "",
  state: typeof entry.state === "string" ? entry.state.trim() : "",
  zip: typeof entry.zip === "string" ? entry.zip.trim() : "",
  country:
    (typeof entry.country === "string" && entry.country.trim()
      ? entry.country.trim()
      : "US"
    ).toUpperCase(),
  phone: typeof entry.phone === "string" ? entry.phone.trim() : "",
  email:
    typeof entry.email === "string"
      ? entry.email.trim().toLowerCase()
      : "",
  isDefault: Boolean(entry.isDefault),
});

export const updateCompany = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const hasName = Object.prototype.hasOwnProperty.call(
    payload,
    "company_name"
  );
  const hasAddress = Object.prototype.hasOwnProperty.call(payload, "address");
  const hasEmail = Object.prototype.hasOwnProperty.call(
    payload,
    "company_email"
  );
  const hasShippingAddresses = Object.prototype.hasOwnProperty.call(
    payload,
    "shippingAddresses"
  );

  if (!hasName && !hasAddress && !hasEmail && !hasShippingAddresses) {
    return res
      .status(400)
      .json({ message: "No valid fields provided to update." });
  }

  const updates = {};

  if (hasName) {
    if (typeof payload.company_name !== "string") {
      return res
        .status(400)
        .json({ message: "Company name must be a string." });
    }

    const trimmedName = payload.company_name.trim();

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Company name cannot be empty." });
    }

    updates.company_name = trimmedName;
  }

  if (hasAddress) {
    if (typeof payload.address !== "string") {
      return res.status(400).json({ message: "Address must be a string." });
    }

    updates.address = payload.address.trim();
  }

  if (hasEmail) {
    if (typeof payload.company_email !== "string") {
      return res
        .status(400)
        .json({ message: "Email must be a string." });
    }
    updates.company_email = payload.company_email.trim().toLowerCase();
  }

  if (hasShippingAddresses) {
    if (!Array.isArray(payload.shippingAddresses)) {
      return res
        .status(400)
        .json({ message: "shippingAddresses must be an array." });
    }

    const sanitized = payload.shippingAddresses.map(sanitizeShippingAddress);

    for (const entry of sanitized) {
      if (!entry.label) {
        return res.status(400).json({
          message: "Each shipping address must have a label.",
        });
      }
    }

    // Enforce a single default — if multiple are flagged, keep the first.
    let seenDefault = false;
    for (const entry of sanitized) {
      if (entry.isDefault) {
        if (seenDefault) entry.isDefault = false;
        else seenDefault = true;
      }
    }

    updates.shippingAddresses = sanitized;
  }

  try {
    const updatedCompany = await Company.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(updatedCompany);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    res
      .status(500)
      .json({ message: "Failed to update company", error: error.message });
  }
};

export const deleteCompany = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedCompany = await Company.findByIdAndDelete(id);

    if (!deletedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete company", error: error.message });
  }
};

// ============================================================
// Shipping Addresses — dedicated endpoints
// ------------------------------------------------------------
// The PUT /:id route accepts a full shippingAddresses array, but
// the UI also likes a row-level API so it can add / edit / delete
// one address without having to replay the whole list.
// ============================================================

export const listShippingAddresses = async (req, res) => {
  const { id } = req.params;
  try {
    const company = await Company.findById(id).select("shippingAddresses");
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.json(company.shippingAddresses || []);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company ID" });
    }
    res
      .status(500)
      .json({ message: "Failed to fetch shipping addresses", error: error.message });
  }
};

export const addShippingAddress = async (req, res) => {
  const { id } = req.params;
  const entry = sanitizeShippingAddress(req.body || {});
  if (!entry.label) {
    return res
      .status(400)
      .json({ message: "Shipping address label is required." });
  }

  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // If this entry is default, clear the flag on the rest.
    if (entry.isDefault) {
      (company.shippingAddresses || []).forEach((a) => (a.isDefault = false));
    } else if ((company.shippingAddresses || []).length === 0) {
      // First address added — promote it to default automatically.
      entry.isDefault = true;
    }

    company.shippingAddresses.push(entry);
    await company.save();
    res.status(201).json(company.shippingAddresses);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company ID" });
    }
    res
      .status(500)
      .json({ message: "Failed to add shipping address", error: error.message });
  }
};

export const updateShippingAddress = async (req, res) => {
  const { id, addressId } = req.params;
  const entry = sanitizeShippingAddress(req.body || {});
  if (!entry.label) {
    return res
      .status(400)
      .json({ message: "Shipping address label is required." });
  }

  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const target = company.shippingAddresses.id(addressId);
    if (!target) {
      return res.status(404).json({ message: "Shipping address not found" });
    }

    if (entry.isDefault) {
      company.shippingAddresses.forEach((a) => {
        a.isDefault = String(a._id) === String(target._id);
      });
    }

    Object.assign(target, entry);
    await company.save();
    res.json(company.shippingAddresses);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company or address ID" });
    }
    res
      .status(500)
      .json({ message: "Failed to update shipping address", error: error.message });
  }
};

export const deleteShippingAddress = async (req, res) => {
  const { id, addressId } = req.params;
  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const target = company.shippingAddresses.id(addressId);
    if (!target) {
      return res.status(404).json({ message: "Shipping address not found" });
    }

    const wasDefault = target.isDefault;
    target.deleteOne();

    // If we removed the default, promote the first remaining address.
    if (wasDefault && company.shippingAddresses.length > 0) {
      company.shippingAddresses[0].isDefault = true;
    }

    await company.save();
    res.json(company.shippingAddresses);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company or address ID" });
    }
    res
      .status(500)
      .json({ message: "Failed to delete shipping address", error: error.message });
  }
};

export const getCompanyUsers = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    const users = await User.find({ company_id: id })
      .select("_id name email company_id companyName status")
      .populate("roles", "name");

    const formattedUsers = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles || [],
      companyId: user.company_id,
      companyName: user.companyName,
      status: user.status || "Active",
    }));

    return res.status(200).json(formattedUsers);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    res
      .status(500)
      .json({ message: "Failed to fetch company users", error: error.message });
  }
};

