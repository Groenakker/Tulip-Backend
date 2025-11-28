import Instance from "../models/instances.models.js";

export const getAllInstances = async (req, res) => {
  try {
    const instances = await Instance.find().populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');
    
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
    const instance = await Instance.findById(id).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');
    
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
  const { instanceCode, idSample, sampleCode, lotNo, status, createdBy, updatedBy } = req.body;
  
  try {
    // Check if instance code already exists
    const existingInstance = await Instance.findOne({ instanceCode });
    if (existingInstance) {
      return res.status(400).json({ message: "Instance code already exists" });
    }

    const newInstance = new Instance({
      instanceCode,
      idSample,
      sampleCode,
      lotNo,
      status: status || "Pending",
      createdBy,
      updatedBy
    });
    
    await newInstance.save();
    res.status(201).json(newInstance);
  } catch (error) {
    res.status(500).json({ message: "Failed to create instance", error: error.message });
  }
};

export const updateInstance = async (req, res) => {
  const { id } = req.params;
  const { instanceCode, idSample, sampleCode, lotNo, status, updatedBy } = req.body;

  try {
    // If instanceCode is being updated, check if it already exists
    if (instanceCode) {
      const existingInstance = await Instance.findOne({ 
        instanceCode, 
        _id: { $ne: id } 
      });
      if (existingInstance) {
        return res.status(400).json({ message: "Instance code already exists" });
      }
    }

    const updatedInstance = await Instance.findByIdAndUpdate(
      id,
      {
        instanceCode,
        idSample,
        sampleCode,
        lotNo,
        status,
        updatedBy
      },
      { new: true }
    ).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');

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
    const deletedInstance = await Instance.findByIdAndDelete(id);

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
    const instances = await Instance.find({ idSample: sampleId }).populate('idSample', 'name description').populate('createdBy', 'name email').populate('updatedBy', 'name email');
    
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
