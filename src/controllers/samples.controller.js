import Sample from "../models/samples.models.js";

export const getAllSamples = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const samples = await Sample.find({ company_id: companyId }).sort({ createdAt: -1 });

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

        // Find the next serial number for this partner on this date (scoped to company)
        const existingSamples = await Sample.find({
          sampleCode: { $regex: `^SP-${dateStr}-${partnerSuffix}-` },
          company_id: companyId
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
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const sample = await Sample.findOne({ _id: id, company_id: companyId });
    if (!sample) return res.status(404).json({ message: "Sample not found" });
    res.json(sample);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sample", error: error.message });
  }
};

export const createSample = async (req, res) => {
  try {
    const body = req.body || {};

    // Use company_id from authenticated user if not provided in body
    const sampleCompanyId = body.company_id || (req.user && req.user.company_id);

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

      // Find the next serial number for this partner on this date (scoped to company)
      const existingSamples = await Sample.find({
        sampleCode: { $regex: `^SP-${dateStr}-${partnerSuffix}-` },
        company_id: sampleCompanyId
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
      company_id: sampleCompanyId
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
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const body = req.body || {};
    const updateData = {
      ...body,
      description: body.description || body.sampleDescription || body.formData?.sampleDescription,
      formData: body.formData || body,
    };

    // Add company_id if provided
    if (body.company_id !== undefined) {
      updateData.company_id = body.company_id;
    }

    const updated = await Sample.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
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
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await Sample.findOneAndDelete({ _id: id, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Sample not found" });
    res.json({ message: "Sample deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sample", error: error.message });
  }
};


