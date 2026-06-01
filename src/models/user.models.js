import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        companyName: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
            set: (val) => (val === null || val === undefined || val === "" ? undefined : val),
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        profilePicture: {
            type: String,
            default: "default.jpg",
        },
        roles: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Role",
            default: [],
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        isVerified: {
            type: Boolean,
            default: true
        },
        // Project Management daily workload budget. The task
        // controller rejects an assignment when an assignee's
        // booked hours on any day in the task's range would
        // exceed this. 8 mirrors a standard work-day; admins
        // can adjust per user (e.g. part-time at 4).
        dailyCapacityHours: {
            type: Number,
            default: 8,
            min: 0,
            max: 24,
        },
    },
    {
        timestamps: true,
    });

// Compound indexes for tenant-scoped uniqueness
userSchema.index({ company_id: 1, email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

export default User;
