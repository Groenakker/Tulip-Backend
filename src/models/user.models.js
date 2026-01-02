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
    },
    {
        timestamps: true,
    });

// Compound indexes for tenant-scoped uniqueness
userSchema.index({ company_id: 1, email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

export default User;