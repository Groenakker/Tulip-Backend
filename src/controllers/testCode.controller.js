import Testcode from "../models/testCodes.models.js";

export const getAllTestCodes = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const codes = await Testcode.find({ company_id: companyId });

    if (!codes) {
      return res.status(404).json({ message: "No partners codes" });

    }
    res.json(codes);

  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch codes", error: error.message });
  }
};

export const getTestCodeById = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const code = await Testcode.findOne({ _id: id, company_id: companyId });

    if (!code) {
      return res.status(404).json({ message: "Code not found" });
    }

    res.json(code);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch code", error: error.message });
  }
}

export const createTestCode = async (req, res) => {
  const { code, standard, descriptionShort, descriptionLong, turnAroundTime, STPNumber, numberOfExtract, minDevPerExtract, MinSAPerExtract, category, extractBased, minDevPerTest, company_id } = req.body;

  try {
    // Use company_id from authenticated user if not provided in body
    const testCodeCompanyId = company_id || (req.user && req.user.company_id);
    if (!testCodeCompanyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const newCode = new Testcode({
      code,
      standard,
      descriptionShort,
      descriptionLong,
      turnAroundTime,
      STPNumber,
      numberOfExtract,
      minDevPerExtract,
      MinSAPerExtract,
      category,
      extractBased,
      minDevPerTest,
      company_id: testCodeCompanyId,
    });

    await newCode.save();
    res.status(201).json(newCode);
  } catch (error) {
    res.status(500).json({ message: "Failed to create code", error: error.message });
  }
}

export const updateTestCode = async (req, res) => {
  const { id } = req.params;
  const {
    code,
    standard,
    descriptionShort,
    descriptionLong,
    turnaroundTime,
    STPNumber,
    numberOfExtract,
    minDevPerExtract,
    MinSAPerExtract,
    category,
    extractBased,
    minDevPerTest,
    company_id,
  } = req.body;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const updateData = {
      code,
      standard,
      descriptionShort,
      descriptionLong,
      turnaroundTime,
      STPNumber,
      numberOfExtract,
      minDevPerExtract,
      MinSAPerExtract,
      category,
      extractBased,
      minDevPerTest,
    };

    // Add company_id if provided
    if (company_id !== undefined) {
      updateData.company_id = company_id;
    }

    const updatedCode = await Testcode.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true }
    );

    if (!updatedCode) {
      return res.status(404).json({ message: "Code not found" });
    }

    res.json(updatedCode);
  } catch (error) {
    res.status(500).json({ message: "Failed to Code", error: error.message });
  }
}

export const deleteTestCode = async (req, res) => {
  const { id } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deletedCode = await Testcode.findOneAndDelete({ _id: id, company_id: companyId });

    if (!deletedCode) {
      return res.status(404).json({ message: "Code not found" });
    }

    res.json({ message: "Code deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete Code", error: error.message });
  }
}