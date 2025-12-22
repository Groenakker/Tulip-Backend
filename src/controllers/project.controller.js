import Project from "../models/projects.models.js";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../lib/supabase.js";

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
  const { description,startDate,endDate,projectID,name, status, actDate, estDate, poNumber, poDate, commitDate, quoteNumber, salesOrderNumber , bPartnerID , bPartnerCode , contact  } = req.body;
  
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
      bPartnerCode,
      contact
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
    bPartnerCode,
    contact,
    image
  } = req.body;

  try {
    // Find project first to check if it exists and handle old image deletion
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Prepare update object
    const updateData = {
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
      bPartnerCode,
      contact
    };

    // Handle image update
    // Priority: 1. Multer file upload, 2. Base64 string in body, 3. Explicit null/empty
    if (req.file) {
      // Handle file uploaded via multer (multipart/form-data)
      try {
        const fileName = req.file.originalname || `project-${id}`;
        
        // Upload to Supabase
        const uploadResult = await uploadFileToSupabase(
          req.file.buffer,
          fileName,
          'user_media',
          `projects/${id}`,
          req.file.mimetype
        );

        const imageUrl = uploadResult.url;

        // Delete old image from Supabase if it exists and is not default
        if (project.image && 
            project.image !== "default.jpg" && 
            project.image.startsWith('http')) {
          try {
            const oldPath = project.image.split('/user_media/')[1];
            if (oldPath) {
              await deleteFileFromSupabase(oldPath, 'user_media');
            }
          } catch (deleteError) {
            console.error('Error deleting old project image:', deleteError);
          }
        }

        updateData.image = imageUrl;
      } catch (uploadError) {
        return res.status(500).json({ 
          message: "Failed to upload project image", 
          error: uploadError.message 
        });
      }
    } else if (image !== undefined) {
      // Handle base64 string or explicit null/empty
      if (image && image !== "" && image !== "null") {
        try {
          // Handle base64 string
          let fileName = `project-${id}`;
          let fileData = image;

          if (typeof image === 'string' && image.startsWith('data:')) {
            // Extract file extension from base64 data URL
            const matches = image.match(/data:image\/(\w+);base64,/);
            const extension = matches ? matches[1] : 'jpg';
            fileName = `project-${id}.${extension}`;
          }

          // Upload to Supabase
          const uploadResult = await uploadFileToSupabase(
            fileData,
            fileName,
            'user_media',
            `projects/${id}`
          );

          const imageUrl = uploadResult.url;

          // Delete old image from Supabase if it exists and is not default
          if (project.image && 
              project.image !== "default.jpg" && 
              project.image.startsWith('http')) {
            try {
              const oldPath = project.image.split('/user_media/')[1];
              if (oldPath) {
                await deleteFileFromSupabase(oldPath, 'user_media');
              }
            } catch (deleteError) {
              console.error('Error deleting old project image:', deleteError);
            }
          }

          updateData.image = imageUrl;
        } catch (uploadError) {
          return res.status(500).json({ 
            message: "Failed to upload project image", 
            error: uploadError.message 
          });
        }
      } else {
        // If image is null/empty, set to default or keep existing
        // You can set to null or "default.jpg" based on your preference
        updateData.image = image === null ? null : project.image;
      }
    }

    // Update project
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

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