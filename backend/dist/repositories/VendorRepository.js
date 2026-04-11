"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorRepository = exports.demoVendors = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
exports.demoVendors = [
    { id: "ven-1", code: "VEN-001", name: "Apex Chemicals", email: "sales@apexchem.com", phone: "+8801911445566", address: "Tejgaon I/A", city: "Dhaka", country: "Bangladesh" },
    { id: "ven-2", code: "VEN-002", name: "Global Logistics", email: "support@globallog.com", phone: "+8801611002233", address: "Chittagong Port", city: "Chittagong", country: "Bangladesh" },
];
class VendorRepository {
    static async findMany(where = {}) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.vendor.findMany({
                    where,
                    orderBy: { createdAt: 'desc' }
                });
            }
            catch (error) {
                console.error('Vendor search failed, falling back to mock:', error);
            }
        }
        return exports.demoVendors;
    }
    static async create(data, tx) {
        const client = tx || database_1.default;
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await client.vendor.create({ data });
            }
            catch (error) {
                console.error('Vendor creation failed:', error);
            }
        }
        return { ...data, id: `offline-${Date.now()}` };
    }
}
exports.VendorRepository = VendorRepository;
//# sourceMappingURL=VendorRepository.js.map