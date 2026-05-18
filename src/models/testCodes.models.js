import mongoose from "mongoose";

const testCodeSchema = new mongoose.Schema(
    {
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        code: {
            type: String,
            required: true,
        },
        standard: {
            type: String,
            required: true,
        },
        descriptionShort: {
            type: String,
            required: true,
        },
        descriptionLong: {
            type: String,

        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        turnAroundTime: {
            type: Number,

        },
        STPNumber: {
            type: String,
            // NOTE: do NOT add `unique: true` here. STPNumber is optional and
            // most rows (including everything that comes from the Items
            // Master Data import) leave it blank. A non-sparse unique index
            // would cause every row after the first to fail with E11000
            // because Mongo treats multiple `null` values as duplicates.
            // Per-tenant uniqueness is enforced by the sparse compound
            // index `{ company_id: 1, STPNumber: 1 }` declared below.
        },
        numberOfExtract: {
            type: Number,

        },
        minDevPerExtract: {
            type: Number,

        },
        MinSAPerExtract: {
            type: Number,

        },
        minMLPerExtract: {
            type: Number,

        },
        category: {
            type: String,


        },
        extractBased: {
            type: String,
        },
        minDevPerTest: {
            type: Number,

        },

    },
    {
        timestamps: true,
    });

// Compound indexes for tenant-scoped uniqueness.
//
// `code` is required, so the simple compound unique index is fine.
//
// `STPNumber` is OPTIONAL. We can't use `sparse: true` here: in MongoDB,
// a sparse compound index only skips a document when ALL of its indexed
// fields are missing, and `company_id` is always set, so every document
// would be indexed with `STPNumber: null` and the second insert would
// collide. `partialFilterExpression` is the correct mechanism — it only
// indexes documents that actually have a string STPNumber, leaving
// blanks completely outside the unique constraint.
testCodeSchema.index({ company_id: 1, code: 1 }, { unique: true });
testCodeSchema.index(
    { company_id: 1, STPNumber: 1 },
    {
        unique: true,
        partialFilterExpression: { STPNumber: { $type: "string" } },
    }
);

const Testcode = mongoose.model("Testcode", testCodeSchema);

export default Testcode;