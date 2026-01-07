import Bpartner from "../models/bPartners.models.js";
import Project from "../models/projects.models.js";
import Shipping from "../models/shipping.models.js";
import Sample from "../models/samples.models.js";
import Testcode from "../models/testCodes.models.js";
import Contact from "../models/contacts.models.js";

// Add a contact directly to the embedded contacts array for a business partner
export const addPartnerContact = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, jobTitle } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Contact name is required" });
  }

  try {
    const updatedPartner = await Bpartner.findByIdAndUpdate(
      id,
      { $push: { contacts: { name, email, phone, jobTitle } } },
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // return the newly added contact (last element after push)
    const newContact = updatedPartner.contacts[updatedPartner.contacts.length - 1];
    res.status(201).json({ message: "Contact added", contact: newContact });
  } catch (error) {
    res.status(500).json({ message: "Failed to add contact", error: error.message });
  }
};

// Remove a contact from the embedded contacts array
export const deletePartnerContact = async (req, res) => {
  const { id, contactId } = req.params;

  try {
    const partner = await Bpartner.findById(id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    const contact = partner.contacts.id(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found for this partner" });
    }

    contact.deleteOne();
    await partner.save();

    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete contact", error: error.message });
  }
};

// Add a test code to a business partner's testCodes array
export const addPartnerTestCode = async (req, res) => {
  const { id } = req.params;
  const { testCodeId } = req.body;

  if (!testCodeId) {
    return res.status(400).json({ message: "Test code ID is required" });
  }

  try {
    // Verify that the test code exists
    const testCode = await Testcode.findById(testCodeId);
    if (!testCode) {
      return res.status(404).json({ message: "Test code not found" });
    }

    // Check if partner exists
    const partner = await Bpartner.findById(id);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if test code is already in the array (convert to string for comparison)
    const testCodeExists = partner.testCodes.some(
      (tc) => tc.toString() === testCodeId
    );

    if (testCodeExists) {
      return res.status(400).json({ message: "Test code already added to this partner" });
    }

    // Add the test code
    partner.testCodes.push(testCodeId);
    await partner.save();

    // Populate the test code to return full details
    await partner.populate("testCodes");
    const addedTestCode = partner.testCodes[partner.testCodes.length - 1];

    res.status(201).json({ message: "Test code added successfully", testCode: addedTestCode });
  } catch (error) {
    res.status(500).json({ message: "Failed to add test code", error: error.message });
  }
};

// Remove a test code from a business partner's testCodes array
export const removePartnerTestCode = async (req, res) => {
  const { id, testCodeId } = req.params;

  try {
    const partner = await Bpartner.findById(id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if test code exists in the array (convert to string for comparison)
    const testCodeExists = partner.testCodes.some(
      (tc) => tc.toString() === testCodeId
    );

    if (!testCodeExists) {
      return res.status(404).json({ message: "Test code not found for this partner" });
    }

    // Remove the test code using pull method
    partner.testCodes.pull(testCodeId);
    await partner.save();

    res.json({ message: "Test code removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove test code", error: error.message });
  }
};

export const getAllPartners = async (req, res) => {
  try {
    const partners = await Bpartner.find().populate("testCodes");

    if (!partners) {
      return res.status(404).json({ message: "No partners found" });

    }
    res.json(partners);

  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partners", error: error.message });
  }
};

export const getPartnerById = async (req, res) => {
  const { id } = req.params;
  try {
    const partner = await Bpartner.findById(id).populate("testCodes");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json(partner);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partner", error: error.message });
  }
}

export const createPartner = async (req, res) => {
  const { partnerNumber, email, phone, category, name, status, address1, address2, city, state, zip, country, image, company_id } = req.body;

  try {
    // Convert empty email string to undefined for sparse index compatibility
    const normalizedEmail = email && email.trim() !== "" ? email.trim() : undefined;

    const newPartner = new Bpartner({
      partnerNumber,
      name,
      status,
      address1,
      address2,
      city,
      state,
      zip,
      country,
      email: normalizedEmail,
      phone,
      category,
      image,
      company_id
    });

    await newPartner.save();
    res.status(201).json(newPartner);
  } catch (error) {
    res.status(500).json({ message: "Failed to create partner", error: error.message });
  }
}

export const updatePartner = async (req, res) => {
  const { id } = req.params;
  const { name, status, address1, address2, city, state, zip, country, image, email, phone, category, partnerNumber, company_id } = req.body;

  try {
    // Convert empty email string to undefined for sparse index compatibility
    const normalizedEmail = email && email.trim() !== "" ? email.trim() : undefined;

    const updatedPartner = await Bpartner.findByIdAndUpdate(
      id,
      { name, status, address1, address2, city, state, zip, country, image, email: normalizedEmail, phone, category, partnerNumber, company_id },
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json(updatedPartner);
  } catch (error) {
    res.status(500).json({ message: "Failed to update partner", error: error.message });
  }
}

export const deletePartner = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPartner = await Bpartner.findByIdAndDelete(id);

    if (!deletedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json({ message: "Partner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete partner", error: error.message });
  }
}

export const getRelatedDataForPartner = async (req, res) => {
  const { id } = req.params;
  try {
    // First, get the business partner to get their partnerNumber
    const partner = await Bpartner.findById(id);
    if (!partner) {
      return res.status(404).json({ message: "Business partner not found" });
    }

    // Fetch all related data using both bPartnerID and bPartnerCode
    const [projects, shipments, samples, testCodes, contacts] = await Promise.all([
      // Projects related to this business partner
      Project.find({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Shipments related to this business partner
      Shipping.find({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Samples related to this business partner
      Sample.find({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Test codes (these might not be directly related, but we can include them)
      // If you have a specific relationship for test codes, update this query
      Testcode.find({}),

      // Contacts related to this business partner
      Contact.find({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      })
    ]);

    // Get projects for shipments to provide more context
    const projectIds = shipments.map(shipment => shipment.projectID);
    const relatedProjects = await Project.find({
      $or: [
        { _id: { $in: projectIds } },
        { projectID: { $in: projectIds } }
      ]
    });

    // Extract unique contact IDs from projects, shipments, and samples
    const contactIds = new Set();
    [...projects, ...shipments, ...samples].forEach(item => {
      if (item.contactID) {
        contactIds.add(item.contactID);
      }
    });

    res.json({
      businessPartner: {
        id: partner._id,
        name: partner.name,
        partnerNumber: partner.partnerNumber,
        category: partner.category,
        status: partner.status,
        email: partner.email,
        phone: partner.phone,
        address: {
          address1: partner.address1,
          address2: partner.address2,
          city: partner.city,
          state: partner.state,
          zip: partner.zip,
          country: partner.country
        }
      },
      projects: {
        count: projects.length,
        data: projects
      },
      shipments: {
        count: shipments.length,
        data: shipments,
        relatedProjects: relatedProjects
      },
      samples: {
        count: samples.length,
        data: samples
      },
      testCodes: {
        count: testCodes.length,
        data: testCodes
      },
      contacts: {
        count: contacts.length,
        data: contacts,
        legacyContactIds: Array.from(contactIds),
        note: contacts.length > 0 ? "Full contact details available" : "No dedicated contacts found. Legacy contact IDs from related records available."
      },
      summary: {
        totalProjects: projects.length,
        totalShipments: shipments.length,
        totalSamples: samples.length,
        totalTestCodes: testCodes.length,
        totalContacts: contacts.length
      }
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch related data", error: error.message });
  }
};

// New endpoint for getting just summary data
export const getPartnerSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const partner = await Bpartner.findById(id);
    if (!partner) {
      return res.status(404).json({ message: "Business partner not found" });
    }

    // Get counts only for better performance
    const [projectCount, shipmentCount, sampleCount] = await Promise.all([
      Project.countDocuments({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),
      Shipping.countDocuments({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),
      Sample.countDocuments({
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      })
    ]);

    res.json({
      businessPartner: {
        id: partner._id,
        name: partner.name,
        partnerNumber: partner.partnerNumber,
        category: partner.category,
        status: partner.status
      },
      summary: {
        totalProjects: projectCount,
        totalShipments: shipmentCount,
        totalSamples: sampleCount
      }
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partner summary", error: error.message });
  }
};