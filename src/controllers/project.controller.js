import Project from "../models/projects.models.js";

export const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find();
    
    if (!projects) {
      return res.status(404).json({ message: "No projects found" });
      
    }
    res.json(projects);

  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch projects", error: error.message });
  }
};

export const getProjectById = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.json(project);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch project", error: error.message });
  }
}

export const createProject = async (req, res) => {
  const { description,startDate,endDate,projectID,name, status, actDate, estDate, poNumber, poDate, commitDate, quoteNumber, salesOrderNumber , bPartnerID , bPartnerCode } = req.body;
  
  try {
    const newProject = new Project({
      description,
      name,
      status,
      startDate,
      endDate,
      projectID,
      actDate,
      estDate,
      poDate,
      poNumber,
      commitDate,
      salesOrderNumber,
      quoteNumber,
      bPartnerID,
      bPartnerCode
    });
    
    await newProject.save();
    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ message: "Failed to create project", error: error.message });
  }
}

export const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    description,
    startDate,
    endDate,
    projectID,
    name,
    status,
    actDate,
    estDate,
    poNumber,
    poDate,
    commitDate,
    quoteNumber,
    salesOrderNumber,
    bPartnerID,
    bPartnerCode
  } = req.body;

  try {
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      {
        description,
        startDate,
        endDate,
        projectID,
        name,
        status,
        actDate,
        estDate,
        poNumber,
        poDate,
        commitDate,
        quoteNumber,
        salesOrderNumber,
        bPartnerID,
        bPartnerCode
      },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Failed to update project", error: error.message });
  }
}

export const deleteProject = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProject = await Project.findByIdAndDelete(id);

    if (!deletedProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete project", error: error.message });
  }
}