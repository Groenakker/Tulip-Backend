import mongoose from "mongoose";

const testCodeSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
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
            unique: true,
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

const Testcode = mongoose.model("Testcode", testCodeSchema);

export default Testcode;