import Instance from "../models/instances.models.js";

export const getAllInstances = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const instances = await Instance.find({ company_id: companyId }).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');

    if (!instances) {
      return res.status(404).json({ message: "No instances found" });
    }
    res.json(instances);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch instances", error: error.message });
  }
};

export const getInstanceById = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const instance = await Instance.findOne({ _id: id, company_id: companyId }).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');

    if (!instance) {
      return res.status(404).json({ message: "Instance not found" });
    }

    res.json(instance);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch instance", error: error.message });
  }
};

export const createInstance = async (req, res) => {
  const { instanceCode, idSample, sampleCode, lotNo, status, warehouseID, createdBy, updatedBy, company_id } = req.body;

  try {
    // Use company_id from authenticated user if not provided in body
    const instanceCompanyId = company_id || (req.user && req.user.company_id);

    // Check if instance code already exists (scoped to company)
    const existingInstance = await Instance.findOne({
      instanceCode,
      company_id: instanceCompanyId
    });
    if (existingInstance) {
      return res.status(400).json({ message: "Instance code already exists" });
    }

    const newInstance = new Instance({
      instanceCode,
      idSample,
      sampleCode,
      lotNo,
      status: status || "Pending",
      warehouseID,
      createdBy,
      updatedBy,
      company_id: instanceCompanyId
    });

    await newInstance.save();
    res.status(201).json(newInstance);
  } catch (error) {
    res.status(500).json({ message: "Failed to create instance", error: error.message });
  }
};

export const updateInstance = async (req, res) => {
  const { id } = req.params;
  const { instanceCode, idSample, sampleCode, lotNo, status, warehouseID, updatedBy, company_id } = req.body;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Get current instance to check company_id for uniqueness check
    const currentInstance = await Instance.findOne({ _id: id, company_id: companyId });
    if (!currentInstance) {
      return res.status(404).json({ message: "Instance not found" });
    }

    // If instanceCode is being updated, check if it already exists (scoped to company)
    if (instanceCode) {
      const instanceCompanyId = company_id || currentInstance.company_id || (req.user && req.user.company_id);
      const existingInstance = await Instance.findOne({
        instanceCode,
        _id: { $ne: id },
        company_id: instanceCompanyId
      });
      if (existingInstance) {
        return res.status(400).json({ message: "Instance code already exists" });
      }
    }

    const updateData = {
      instanceCode,
      idSample,
      sampleCode,
      lotNo,
      status,
      warehouseID,
      updatedBy
    };

    // Add company_id if provided
    if (company_id !== undefined) {
      updateData.company_id = company_id;
    }

    const updatedInstance = await Instance.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true }
    ).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email').populate('warehouseID', 'warehouseID address storage space');

    if (!updatedInstance) {
      return res.status(404).json({ message: "Instance not found" });
    }

    res.json(updatedInstance);
  } catch (error) {
    res.status(500).json({ message: "Failed to update instance", error: error.message });
  }
};

export const deleteInstance = async (req, res) => {
  const { id } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deletedInstance = await Instance.findOneAndDelete({ _id: id, company_id: companyId });

    if (!deletedInstance) {
      return res.status(404).json({ message: "Instance not found" });
    }

    res.json({ message: "Instance deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete instance", error: error.message });
  }
};

export const getInstancesBySample = async (req, res) => {
  const { sampleId } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const instances = await Instance.find({ idSample: sampleId, company_id: companyId }).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');

    if (!instances) {
      return res.status(404).json({ message: "No instances found for this sample" });
    }

    res.json(instances);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch instances by sample", error: error.message });
  }
};
