import mongoose from "mongoose";

// Project-management task. Each task belongs to a single project
// (the existing Project model) and is the unit of work that
// shows up on the Kanban board, Gantt chart, Calendar, and
// every member's personal "My Tasks" view.
//
// Key behaviours enforced in the controller layer (not here):
//   - dependencies must all be Done before this task can be
//     scheduled (startDate/dueDate set or status moved to
//     In Progress / Done). The check compares completedAt of
//     each predecessor against this task's startDate.
//   - assignees can only be added if their daily workload at
//     this task's date range stays within their personal
//     `dailyCapacityHours` budget. A task without dates skips
//     the workload check (it counts against "backlog" only).
const commentSchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    // Optional system / activity events ("status changed",
    // "assigned to X"). Lets us render a single chronological
    // feed on the task modal without spinning up a second
    // collection.
    kind: {
      type: String,
      enum: ["comment", "system"],
      default: "comment",
    },
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Workflow status. The Kanban board uses this as the column
    // key, so the order here matches the visual left-to-right
    // flow. "Blocked" is rendered as a 5th column on the right
    // but is also a valid status from anywhere.
    status: {
      type: String,
      enum: ["Backlog", "To Do", "In Progress", "In Review", "Done", "Blocked"],
      default: "To Do",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    // Per-project tags. We embed the label + colour directly so
    // a Tag rename on the project doesn't have to fan out across
    // tasks; the project's tag definitions are the canonical
    // palette but tasks keep their own snapshot.
    tags: [
      {
        name: { type: String, trim: true, required: true },
        color: { type: String, trim: true, default: "#4570B6" },
      },
    ],

    // People assigned. We keep both an ObjectId ref (for joins)
    // and a denormalized display name + avatar so list / board
    // views can render without a populate round-trip.
    assignees: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, trim: true },
        email: { type: String, trim: true },
        profilePicture: { type: String, trim: true },
      },
    ],

    // Scheduling. `startDate` and `dueDate` are inclusive and
    // are what the Gantt chart, Calendar, and workload checks
    // use. If both are null the task is in the backlog.
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },

    // Effort budget — used by the workload check to figure out
    // a per-day "hours booked" for each assignee. Splits the
    // estimate evenly across business days between startDate
    // and dueDate (inclusive). Defaults to 4h so an
    // unestimated task still consumes meaningful capacity.
    estimatedHours: { type: Number, default: 4, min: 0 },
    actualHours: { type: Number, default: 0, min: 0 },

    // Other tasks that must be Done before this one can start.
    // Cycle detection is enforced in the controller.
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],

    // Display ordering inside a Kanban column. Updated by the
    // board drag-drop endpoint.
    position: { type: Number, default: 0 },

    // Optional: a parent task so we can render simple
    // subtasks / checklists. Left flexible — we don't enforce a
    // tree depth.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },

    comments: [commentSchema],
    attachments: [attachmentSchema],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compound indexes for common queries.
taskSchema.index({ company_id: 1, project: 1, status: 1 });
taskSchema.index({ company_id: 1, project: 1, position: 1 });
taskSchema.index({ company_id: 1, "assignees.user": 1, dueDate: 1 });
taskSchema.index({ company_id: 1, dueDate: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
