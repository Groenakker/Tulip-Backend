import Sample from "../models/samples.models.js";

export const getAllSamples = async (req, res) => {
  try {
    const samples = await Sample.find().sort({ createdAt: -1 });
    
    // Generate sampleCode for samples that don't have one
    for (let sample of samples) {
      if (!sample.sampleCode) {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const dateStr = yy + mm + dd;
        
        // Get last 4 digits of bPartnerCode from various possible fields
        const bPartnerCode = sample.bPartnerCode || 
                            sample.formData?.bPartnerCode || 
                            sample.formData?.SAPid || 
                            sample.SAPid || 
                            '0000';
        const partnerSuffix = bPartnerCode.slice(-4).padStart(4, '0');
        
        // Find the next serial number for this partner on this date
        const existingSamples = await Sample.find({
          sampleCode: { $regex: `^SP-${dateStr}-${partnerSuffix}-` }
        }).sort({ sampleCode: -1 });
        
        let serialNo = 1;
        if (existingSamples.length > 0) {
          const lastCode = existingSamples[0].sampleCode;
          const lastSerial = parseInt(lastCode.split('-')[3]) || 0;
          serialNo = lastSerial + 1;
        }
        
        const sampleCode = `SP-${dateStr}-${partnerSuffix}-${serialNo}`;
        sample.sampleCode = sampleCode;
        await sample.save();
      }
    }
    
    res.json(samples);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch samples", error: error.message });
  }
};

export const getSampleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sample = await Sample.findById(id);
    if (!sample) return res.status(404).json({ message: "Sample not found" });
    res.json(sample);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sample", error: error.message });
  }
};

export const createSample = async (req, res) => {
  try {
    const body = req.body || {};
    
    // Generate sampleCode if not provided
    let sampleCode = body.sampleCode;
    if (!sampleCode) {
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const dateStr = yy + mm + dd;
      
      // Get last 4 digits of bPartnerCode from various possible fields
      const bPartnerCode = body.bPartnerCode || 
                          body.formData?.bPartnerCode || 
                          body.formData?.SAPid || 
                          body.SAPid || 
                          '0000';
      const partnerSuffix = bPartnerCode.slice(-4).padStart(4, '0');
      
      // Find the next serial number for this partner on this date
      const existingSamples = await Sample.find({
        sampleCode: { $regex: `^SP-${dateStr}-${partnerSuffix}-` }
      }).sort({ sampleCode: -1 });
      
      let serialNo = 1;
      if (existingSamples.length > 0) {
        const lastCode = existingSamples[0].sampleCode;
        const lastSerial = parseInt(lastCode.split('-')[3]) || 0;
        serialNo = lastSerial + 1;
      }
      
      sampleCode = `SP-${dateStr}-${partnerSuffix}-${serialNo}`;
    }
    
    const sample = new Sample({
      ...body,
      sampleCode,
      description: body.description || body.sampleDescription || body.formData?.sampleDescription,
      formData: body.formData || body,
    });
    await sample.save();
    res.status(201).json(sample);
  } catch (error) {
    res.status(500).json({ message: "Failed to create sample", error: error.message });
  }
};

export const updateSample = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updated = await Sample.findByIdAndUpdate(
      id,
      {
        ...body,
        description: body.description || body.sampleDescription || body.formData?.sampleDescription,
        formData: body.formData || body,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Sample not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update sample", error: error.message });
  }
};

export const deleteSample = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Sample.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Sample not found" });
    res.json({ message: "Sample deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sample", error: error.message });
  }
};


