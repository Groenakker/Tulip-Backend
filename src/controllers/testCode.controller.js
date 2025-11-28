import Testcode from "../models/testCodes.models.js";

export const getAllTestCodes = async (req, res) => {
  try {
    const codes = await Testcode.find();
    
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
    const code = await Testcode.findById(id);
    
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
  const { code,standard,descriptionShort,descriptionLong,turnAroundTime, STPNumber, numberOfExtract, minDevPerExtract, MinSAPerExtract, category, extractBased, minDevPerTest } = req.body;
  
  try {
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
  } = req.body;

  try {
    const updatedCode = await Testcode.findByIdAndUpdate(
      id,
      {
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
      },
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
    const deletedCode = await Testcode.findByIdAndDelete(id);

    if (!deletedCode) {
      return res.status(404).json({ message: "Code not found" });
    }

    res.json({ message: "Code deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete Code", error: error.message });
  }
}