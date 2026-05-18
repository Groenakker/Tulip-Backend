import mongoose from "mongoose";

// One-shot index migrations that need to run on every cold start.
//
// Mongoose only ever *creates* indexes that it sees in the schema; it
// never drops indexes that have been removed from the schema, and it
// never alters the options of an index that already exists with the
// same key. That means whenever we change a unique/sparse/partial index
// we also have to drop the old version from the live database — Mongoose
// will then re-create it with the new options on the next sync.
const dropStaleTestCodeIndexes = async () => {
    const collection = mongoose.connection.collection("testcodes");

    let indexes;
    try {
        indexes = await collection.indexes();
    } catch (err) {
        if (err?.codeName === "NamespaceNotFound") return; // brand-new DB
        console.warn(
            "Could not list testcodes indexes:",
            err?.message || err
        );
        return;
    }

    const dropIfPresent = async (name, reason) => {
        if (!indexes.find((idx) => idx.name === name)) return;
        try {
            await collection.dropIndex(name);
            console.log(`Dropped legacy testcodes.${name} index (${reason})`);
        } catch (err) {
            console.warn(
                `Could not drop testcodes.${name}:`,
                err?.message || err
            );
        }
    };

    // Created when the schema had `STPNumber: { unique: true }` at the
    // field level. Non-sparse, so multiple null STPNumbers collided.
    await dropIfPresent("STPNumber_1", "single-field non-sparse unique");

    // Created when an earlier schema had `code: { unique: true }` at the
    // field level. That makes `code` globally unique across all tenants,
    // which breaks multi-company isolation. The intended uniqueness is
    // the compound `{ company_id: 1, code: 1 }` index.
    await dropIfPresent("code_1", "global non-tenant-scoped unique");

    // The compound { company_id, STPNumber } index needs to be a
    // *partial* unique index (only index docs that actually have a
    // STPNumber string). The historical version is non-sparse / non-
    // partial, which makes every blank-STPNumber import row collide on
    // (company_id, null). Mongoose won't change the options on an
    // existing index, so we drop and let it recreate.
    const stp = indexes.find(
        (idx) => idx.name === "company_id_1_STPNumber_1"
    );
    if (stp && !stp.partialFilterExpression) {
        await dropIfPresent(
            "company_id_1_STPNumber_1",
            "needs partialFilterExpression"
        );
    }
};

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB connected successfully: ${conn.connection.host}`);
        await dropStaleTestCodeIndexes();
    } catch (error) {
        console.log("MongoDB connection failed:", error);
        // Exit the process with failure
    }
};