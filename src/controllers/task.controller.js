import Task from "../models/tasks.models.js";
import Project from "../models/projects.models.js";
import User from "../models/user.models.js";
import { createBulkDelete } from "../lib/bulkDelete.js";

// ============================================================
// Project Management - Task controller
// ------------------------------------------------------------
// All endpoints are tenant-scoped on company_id. Two business
// rules drive most of the complexity here:
//
//   1. Dependency check: when a task is given a startDate (or
//      moved into "In Progress" / "Done"), every dependency
//      must already be Done. We also reject scheduling a task
//      with startDate < max(dep.dueDate || dep.completedAt).
//
//   2. Workload check: when assignees change, or when dates
//      change, we estimate "hours booked per business day" for
//      each assignee across every task they're on. The new
//      assignment is rejected if any day for any assignee would
//      exceed that user's `dailyCapacityHours`.
//
// Both rules can be bypassed by sending `?force=true` (used by
// the Project Manager when they explicitly accept an overload).
// ============================================================

const isBusinessDay = (d) => {
  const day = d.getDay();
  return day !== 0 && day !== 6;
};

const startOfDayUTC = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

// Build the list of inclusive business days between two dates.
// If either is missing we treat the range as a single point on
// the provided date so a partially-scheduled task still booked
// against capacity for that day.
const businessDaysBetween = (start, end) => {
  const s = start ? startOfDayUTC(start) : null;
  const e = end ? startOfDayUTC(end) : null;
  if (!s && !e) return [];
  const from = s || e;
  const to = e || s;
  if (from > to) return [];
  const days = [];
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isBusinessDay(d)) days.push(new Date(d));
  }
  // No business days in the range (e.g. weekend-only span)?
  // Still book the original `from` so the task isn't invisible
  // to workload accounting.
  if (days.length === 0) days.push(from);
  return days;
};

// hours / day allocated by a task to each of its assignees.
const perDayHours = (task) => {
  const days = businessDaysBetween(task.startDate, task.dueDate);
  const hours = Number(task.estimatedHours || 4);
  if (days.length === 0) return { days: [], perDay: 0 };
  return { days, perDay: hours / days.length };
};

// Cycle detector. Returns true when adding `nextId` as a
// dependency of `task` would close a cycle. Cheap BFS — the
// graph is tiny per project.
const wouldCreateCycle = async (companyId, taskId, nextIds = []) => {
  const target = String(taskId);
  const queue = [...nextIds.map(String)];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const next = await Task.findOne(
      { _id: id, company_id: companyId },
      { dependencies: 1 }
    ).lean();
    if (!next) continue;
    for (const dep of next.dependencies || []) queue.push(String(dep));
  }
  return false;
};

// Validate that all dependencies are Done if this task is
// being scheduled. Returns { ok, reason } so the caller can
// surface a useful 409 to the UI.
const validateDependencies = async (companyId, task) => {
  if (!task.dependencies?.length) return { ok: true };
  // Only enforce once the task is actively being scheduled or
  // worked on. A backlog task with deps is fine.
  const needsCheck =
    task.startDate ||
    task.status === "In Progress" ||
    task.status === "In Review" ||
    task.status === "Done";
  if (!needsCheck) return { ok: true };

  const deps = await Task.find(
    { _id: { $in: task.dependencies }, company_id: companyId },
    { title: 1, status: 1, dueDate: 1, completedAt: 1 }
  ).lean();

  const blockers = deps.filter((d) => d.status !== "Done");
  if (blockers.length) {
    return {
      ok: false,
      reason: `Cannot schedule "${task.title}" until predecessor task(s) are Done: ${blockers.map((b) => b.title).join(", ")}`,
      blockers,
    };
  }
  if (task.startDate) {
    const latestDepEnd = deps
      .map((d) => d.completedAt || d.dueDate)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    if (latestDepEnd && new Date(task.startDate).getTime() < latestDepEnd) {
      return {
        ok: false,
        reason: `Start date is earlier than a predecessor's completion (${new Date(latestDepEnd).toLocaleDateString()}).`,
      };
    }
  }
  return { ok: true };
};

// Workload check. Sums hours/day for each assignee across all
// of their other scheduled tasks, then validates that the
// proposed task won't push any day past their personal
// dailyCapacityHours.
const validateWorkload = async (companyId, task, excludeTaskId = null) => {
  if (!task.assignees?.length) return { ok: true };
  const { days, perDay } = perDayHours(task);
  if (!days.length) return { ok: true }; // backlog task, no schedule
  const dayKeys = days.map((d) => d.toISOString().slice(0, 10));

  const userIds = task.assignees.map((a) => a.user || a);
  const users = await User.find(
    { _id: { $in: userIds }, company_id: companyId },
    { name: 1, dailyCapacityHours: 1 }
  ).lean();
  const capMap = new Map(users.map((u) => [String(u._id), u.dailyCapacityHours ?? 8]));
  const nameMap = new Map(users.map((u) => [String(u._id), u.name]));

  const minDay = days[0];
  const maxDay = days[days.length - 1];

  // Other in-flight tasks that overlap the date range.
  const overlapFilter = {
    company_id: companyId,
    status: { $nin: ["Done", "Backlog"] },
    "assignees.user": { $in: userIds },
    startDate: { $lte: maxDay },
    dueDate: { $gte: minDay },
  };
  if (excludeTaskId) overlapFilter._id = { $ne: excludeTaskId };

  const overlapping = await Task.find(overlapFilter, {
    assignees: 1,
    estimatedHours: 1,
    startDate: 1,
    dueDate: 1,
  }).lean();

  // Pre-compute existing booked hours per user/day.
  const booked = new Map(); // userId -> { dayKey -> hours }
  for (const t of overlapping) {
    const { days: tDays, perDay: tPer } = perDayHours(t);
    for (const a of t.assignees || []) {
      const uid = String(a.user);
      if (!userIds.map(String).includes(uid)) continue;
      let map = booked.get(uid);
      if (!map) { map = {}; booked.set(uid, map); }
      for (const td of tDays) {
        const k = td.toISOString().slice(0, 10);
        map[k] = (map[k] || 0) + tPer;
      }
    }
  }

  const violations = [];
  for (const a of task.assignees) {
    const uid = String(a.user || a);
    const cap = capMap.get(uid) ?? 8;
    const map = booked.get(uid) || {};
    for (const k of dayKeys) {
      const after = (map[k] || 0) + perDay;
      if (after > cap + 0.001) {
        violations.push({
          user: uid,
          name: nameMap.get(uid) || a.name || "User",
          date: k,
          booked: Number((map[k] || 0).toFixed(2)),
          proposed: Number(perDay.toFixed(2)),
          capacity: cap,
        });
      }
    }
  }

  if (violations.length) {
    const sample = violations[0];
    return {
      ok: false,
      reason: `${sample.name} is already booked ${sample.booked}h on ${sample.date} (capacity ${sample.capacity}h). Adding this task would push them to ${(sample.booked + sample.proposed).toFixed(2)}h.`,
      violations,
    };
  }
  return { ok: true };
};

// Hydrate assignee name/email/avatar from User docs so we can
// store a denormalized snapshot. Accepts either an array of
// user IDs or objects {user, ...}.
const hydrateAssignees = async (companyId, raw = []) => {
  if (!raw.length) return [];
  const ids = raw.map((a) => a.user || a._id || a).filter(Boolean);
  const users = await User.find(
    { _id: { $in: ids }, company_id: companyId },
    { name: 1, email: 1, profilePicture: 1 }
  ).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((u) => ({
      user: u._id,
      name: u.name,
      email: u.email,
      profilePicture: u.profilePicture,
    }));
};

// =================== Public endpoints ===================

// GET /api/tasks?project=:id&assignee=:userId&status=...
export const listTasks = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const { project, assignee, status, mine } = req.query;
    const filter = { company_id: companyId };
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (assignee) filter["assignees.user"] = assignee;
    if (mine === "true" && req.user?._id) filter["assignees.user"] = req.user._id;

    const tasks = await Task.find(filter).sort({ position: 1, createdAt: -1 }).lean();
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: "Failed to list tasks", error: err.message });
  }
};

// GET /api/tasks/:id
export const getTask = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const task = await Task.findOne({ _id: req.params.id, company_id: companyId }).lean();
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch task", error: err.message });
  }
};

// POST /api/tasks
export const createTask = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const force = req.query.force === "true";
    const body = req.body || {};
    if (!body.title || !body.project) {
      return res.status(400).json({ message: "title and project are required" });
    }

    // Sanity check the project belongs to the tenant.
    const project = await Project.findOne({ _id: body.project, company_id: companyId });
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Compute initial position at the bottom of the column.
    const last = await Task.findOne({
      company_id: companyId,
      project: body.project,
      status: body.status || "To Do",
    })
      .sort({ position: -1 })
      .lean();

    const draft = {
      ...body,
      company_id: companyId,
      assignees: await hydrateAssignees(companyId, body.assignees || []),
      position: (last?.position ?? -1) + 1,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    };

    // Guard rails (skippable via ?force=true).
    if (!force) {
      const dep = await validateDependencies(companyId, draft);
      if (!dep.ok) return res.status(409).json({ message: dep.reason, code: "DEPENDENCY_BLOCKED", details: dep });
      const wl = await validateWorkload(companyId, draft);
      if (!wl.ok) return res.status(409).json({ message: wl.reason, code: "WORKLOAD_EXCEEDED", details: wl });
    }

    const task = await Task.create(draft);
    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ message: "Failed to create task", error: err.message });
  }
};

// PUT /api/tasks/:id - full update with guard rails.
export const updateTask = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });
    const force = req.query.force === "true";

    const existing = await Task.findOne({ _id: req.params.id, company_id: companyId });
    if (!existing) return res.status(404).json({ message: "Task not found" });

    const merged = existing.toObject();
    const body = req.body || {};
    // Whitelist of editable fields.
    const editable = [
      "title",
      "description",
      "status",
      "priority",
      "tags",
      "startDate",
      "dueDate",
      "estimatedHours",
      "actualHours",
      "dependencies",
      "position",
      "parent",
    ];
    for (const f of editable) {
      if (f in body) merged[f] = body[f];
    }
    if (body.assignees) {
      merged.assignees = await hydrateAssignees(companyId, body.assignees);
    }
    if (body.status === "Done" && existing.status !== "Done") {
      merged.completedAt = new Date();
    } else if (body.status && body.status !== "Done") {
      merged.completedAt = null;
    }

    // Reject self-dependency / cycles.
    if (body.dependencies) {
      if (body.dependencies.some((d) => String(d) === String(existing._id))) {
        return res.status(400).json({ message: "A task cannot depend on itself." });
      }
      if (await wouldCreateCycle(companyId, existing._id, body.dependencies)) {
        return res.status(400).json({ message: "These dependencies would create a cycle." });
      }
    }

    if (!force) {
      const dep = await validateDependencies(companyId, merged);
      if (!dep.ok) return res.status(409).json({ message: dep.reason, code: "DEPENDENCY_BLOCKED", details: dep });
      const wl = await validateWorkload(companyId, merged, existing._id);
      if (!wl.ok) return res.status(409).json({ message: wl.reason, code: "WORKLOAD_EXCEEDED", details: wl });
    }

    Object.assign(existing, merged);
    existing.updatedBy = req.user?._id;
    await existing.save();
    res.json({ task: existing });
  } catch (err) {
    res.status(500).json({ message: "Failed to update task", error: err.message });
  }
};

// PATCH /api/tasks/:id/status — fast-path used by Kanban drag.
// Always validates dependencies (so a task can't be dragged
// into "In Progress" with unfinished blockers) but skips the
// workload check because dragging columns doesn't change the
// scheduled date range. `position` is optional.
export const updateTaskStatus = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { status, position } = req.body || {};
    const force = req.query.force === "true";

    const task = await Task.findOne({ _id: req.params.id, company_id: companyId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (status) task.status = status;
    if (typeof position === "number") task.position = position;
    if (status === "Done" && !task.completedAt) task.completedAt = new Date();
    if (status && status !== "Done") task.completedAt = null;

    if (!force) {
      const dep = await validateDependencies(companyId, task);
      if (!dep.ok) return res.status(409).json({ message: dep.reason, code: "DEPENDENCY_BLOCKED" });
    }
    task.updatedBy = req.user?._id;
    await task.save();
    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status", error: err.message });
  }
};

// POST /api/tasks/:id/comments
export const addComment = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const task = await Task.findOne({ _id: req.params.id, company_id: companyId });
    if (!task) return res.status(404).json({ message: "Task not found" });
    const body = (req.body?.body || "").trim();
    if (!body) return res.status(400).json({ message: "Comment body required" });
    task.comments.push({
      body,
      author: req.user?._id,
      authorName: req.user?.name,
      kind: "comment",
    });
    await task.save();
    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment", error: err.message });
  }
};

// DELETE /api/tasks/:id
export const deleteTask = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      company_id: companyId,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });
    // Clean up dependency references in other tasks so we don't
    // leave dangling pointers in the graph.
    await Task.updateMany(
      { company_id: companyId, dependencies: task._id },
      { $pull: { dependencies: task._id } }
    );
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete task", error: err.message });
  }
};

export const bulkDeleteTasks = createBulkDelete(Task, { entityName: "task" });

// GET /api/tasks/workload?user=:userId&from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns a per-day map of booked hours for the given user (or
// the current user if none specified) across the requested
// range. Powers the "My Workload" heatmap and the
// "is this person free?" hint on the assign-people dialog.
export const getWorkload = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const userId = req.query.user || req.user?._id;
    const from = req.query.from ? startOfDayUTC(new Date(req.query.from)) : startOfDayUTC(new Date());
    const to = req.query.to ? startOfDayUTC(new Date(req.query.to)) : new Date(from.getTime() + 30 * 86400000);

    const user = await User.findOne({ _id: userId, company_id: companyId }, { name: 1, dailyCapacityHours: 1 }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const tasks = await Task.find({
      company_id: companyId,
      "assignees.user": userId,
      startDate: { $lte: to },
      dueDate: { $gte: from },
    }).lean();

    const byDay = {};
    const events = [];
    for (const t of tasks) {
      const { days, perDay } = perDayHours(t);
      for (const d of days) {
        if (d < from || d > to) continue;
        const k = d.toISOString().slice(0, 10);
        if (!byDay[k]) byDay[k] = { hours: 0, tasks: [] };
        byDay[k].hours = Number((byDay[k].hours + perDay).toFixed(2));
        byDay[k].tasks.push({
          _id: t._id,
          title: t.title,
          project: t.project,
          status: t.status,
          priority: t.priority,
          hours: Number(perDay.toFixed(2)),
        });
      }
      events.push({
        _id: t._id,
        title: t.title,
        project: t.project,
        status: t.status,
        priority: t.priority,
        startDate: t.startDate,
        dueDate: t.dueDate,
        estimatedHours: t.estimatedHours,
      });
    }

    res.json({
      user: { _id: user._id, name: user.name, dailyCapacityHours: user.dailyCapacityHours ?? 8 },
      range: { from, to },
      byDay,
      events,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch workload", error: err.message });
  }
};

// GET /api/tasks/availability?users=a,b,c&from=...&to=...
// Quick "free?" check for the assign-people dialog.
export const getAvailability = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });
    const userIds = (req.query.users || "").split(",").filter(Boolean);
    if (!userIds.length) return res.json({ availability: [] });

    const from = req.query.from ? startOfDayUTC(new Date(req.query.from)) : startOfDayUTC(new Date());
    const to = req.query.to ? startOfDayUTC(new Date(req.query.to)) : from;

    const users = await User.find(
      { _id: { $in: userIds }, company_id: companyId },
      { name: 1, profilePicture: 1, dailyCapacityHours: 1 }
    ).lean();
    const capMap = new Map(users.map((u) => [String(u._id), u.dailyCapacityHours ?? 8]));

    const tasks = await Task.find({
      company_id: companyId,
      "assignees.user": { $in: userIds },
      status: { $nin: ["Done", "Backlog"] },
      startDate: { $lte: to },
      dueDate: { $gte: from },
    }).lean();

    const result = users.map((u) => {
      const days = businessDaysBetween(from, to);
      const dayMap = {};
      for (const d of days) dayMap[d.toISOString().slice(0, 10)] = 0;
      for (const t of tasks) {
        if (!t.assignees.some((a) => String(a.user) === String(u._id))) continue;
        const { days: td, perDay } = perDayHours(t);
        for (const d of td) {
          const k = d.toISOString().slice(0, 10);
          if (k in dayMap) dayMap[k] = Number((dayMap[k] + perDay).toFixed(2));
        }
      }
      const cap = capMap.get(String(u._id));
      const overloadedDays = Object.entries(dayMap)
        .filter(([_k, h]) => h >= cap)
        .map(([k]) => k);
      return {
        user: { _id: u._id, name: u.name, profilePicture: u.profilePicture, capacity: cap },
        booked: dayMap,
        overloadedDays,
        availableHours: Math.max(0, cap * days.length - Object.values(dayMap).reduce((a, b) => a + b, 0)),
      };
    });

    res.json({ availability: result });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch availability", error: err.message });
  }
};

// ============================================================
// Project-level extras (members + tags)
// ============================================================

export const addProjectMember = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { user, role } = req.body || {};
    if (!user) return res.status(400).json({ message: "user is required" });

    const project = await Project.findOne({ _id: id, company_id: companyId });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const target = await User.findOne({ _id: user, company_id: companyId });
    if (!target) return res.status(404).json({ message: "User not found" });

    if (project.members.some((m) => String(m.user) === String(user))) {
      return res.status(400).json({ message: "User is already on this project." });
    }
    project.members.push({
      user,
      role: role || "Member",
      addedBy: req.user?._id,
    });
    await project.save();
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to add member", error: err.message });
  }
};

export const updateProjectMember = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id, memberId } = req.params;
    const { role } = req.body || {};
    const project = await Project.findOne({ _id: id, company_id: companyId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    const m = project.members.id(memberId);
    if (!m) return res.status(404).json({ message: "Member not found" });
    if (role) m.role = role;
    await project.save();
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to update member", error: err.message });
  }
};

export const removeProjectMember = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id, memberId } = req.params;
    const project = await Project.findOne({ _id: id, company_id: companyId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    const m = project.members.id(memberId);
    if (!m) return res.status(404).json({ message: "Member not found" });
    m.deleteOne();
    await project.save();
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove member", error: err.message });
  }
};

export const setProjectTags = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { tags } = req.body || {};
    if (!Array.isArray(tags)) return res.status(400).json({ message: "tags must be an array" });
    const project = await Project.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { tags: tags.map((t) => ({ name: String(t.name || "").trim(), color: t.color || "#4570B6" })).filter((t) => t.name) },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to set tags", error: err.message });
  }
};

// GET /api/projects/:id/team-summary - members + their workload
// over the project's date range. Powers the project's "Team"
// tab and the "who is free?" assign-people dialog.
export const getTeamSummary = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const project = await Project.findOne({ _id: id, company_id: companyId }).lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const memberIds = project.members.map((m) => m.user);
    if (!memberIds.length) return res.json({ members: [] });

    const users = await User.find(
      { _id: { $in: memberIds }, company_id: companyId },
      { name: 1, email: 1, profilePicture: 1, dailyCapacityHours: 1 }
    ).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const projectTasks = await Task.find({ company_id: companyId, project: id }).lean();

    const out = project.members.map((m) => {
      const u = byId.get(String(m.user));
      const myTasks = projectTasks.filter((t) =>
        (t.assignees || []).some((a) => String(a.user) === String(m.user))
      );
      const open = myTasks.filter((t) => t.status !== "Done").length;
      const done = myTasks.filter((t) => t.status === "Done").length;
      const overdue = myTasks.filter(
        (t) => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < new Date()
      ).length;
      const bookedHours = myTasks.reduce((s, t) => {
        const { perDay, days } = perDayHours(t);
        return s + perDay * days.length;
      }, 0);
      return {
        _id: m._id,
        role: m.role,
        addedAt: m.addedAt,
        user: u
          ? {
              _id: u._id,
              name: u.name,
              email: u.email,
              profilePicture: u.profilePicture,
              dailyCapacityHours: u.dailyCapacityHours ?? 8,
            }
          : { _id: m.user, name: "Unknown" },
        counts: { open, done, overdue, total: myTasks.length },
        bookedHours: Number(bookedHours.toFixed(1)),
      };
    });

    res.json({ members: out });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch team summary", error: err.message });
  }
};

// GET /api/projects/:id/insights - aggregate counters used by the
// Insights tab (recharts on the frontend).
export const getProjectInsights = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const tasks = await Task.find({ company_id: companyId, project: id }).lean();

    const byStatus = {};
    const byPriority = {};
    const byAssignee = {};
    let overdue = 0;
    let totalEstimated = 0;
    let totalActual = 0;
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      totalEstimated += Number(t.estimatedHours || 0);
      totalActual += Number(t.actualHours || 0);
      if (t.status !== "Done" && t.dueDate && new Date(t.dueDate) < new Date()) overdue += 1;
      for (const a of t.assignees || []) {
        const key = String(a.user);
        if (!byAssignee[key]) byAssignee[key] = { name: a.name || "User", done: 0, open: 0, total: 0 };
        byAssignee[key].total += 1;
        if (t.status === "Done") byAssignee[key].done += 1;
        else byAssignee[key].open += 1;
      }
    }

    // Simple 30-day burndown: remaining open tasks day-by-day
    // from project.startDate (or first task created) to today.
    const project = await Project.findOne({ _id: id, company_id: companyId }, { startDate: 1, createdAt: 1 }).lean();
    const start = project?.startDate ? new Date(project.startDate) : project?.createdAt || new Date();
    const today = new Date();
    const burndown = [];
    const day = new Date(start);
    day.setUTCHours(0, 0, 0, 0);
    let safety = 60;
    while (day <= today && safety-- > 0) {
      const k = day.toISOString().slice(0, 10);
      const remaining = tasks.filter(
        (t) => (!t.completedAt || new Date(t.completedAt) > day) && new Date(t.createdAt) <= day
      ).length;
      burndown.push({ date: k, remaining });
      day.setUTCDate(day.getUTCDate() + 1);
    }

    res.json({
      total: tasks.length,
      overdue,
      totalEstimated,
      totalActual,
      byStatus,
      byPriority,
      byAssignee: Object.entries(byAssignee).map(([userId, v]) => ({ userId, ...v })),
      burndown,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch insights", error: err.message });
  }
};
