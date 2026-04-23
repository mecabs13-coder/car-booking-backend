const { default: mongoose } = require("mongoose");

const PermissionSchema = new mongoose.Schema({
    menuKey: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    roleId: { type: [Number], required: true },
},
    { timestamps: true, versionKey: false })

const Permission = mongoose.model("Permission", PermissionSchema);
module.exports = Permission;