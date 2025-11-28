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

export const updateCompany = async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const hasName = Object.prototype.hasOwnProperty.call(
    payload,
    "company_name"
  );
  const hasAddress = Object.prototype.hasOwnProperty.call(payload, "address");

  if (!hasName && !hasAddress) {
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

