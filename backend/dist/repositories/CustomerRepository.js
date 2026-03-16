"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerRepository = exports.demoCustomers = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
exports.demoCustomers = [
    { id: "cus-1", code: "CUS-001", name: "Modern Garments Ltd", email: "info@moderngarments.com", phone: "+8801711223344", address: "Ghazipur, Dhaka", city: "Dhaka", country: "Bangladesh" },
    { id: "cus-2", code: "CUS-002", name: "Elegant Textiles", email: "contact@elegant.com", phone: "+8801811998877", address: "Narayanganj", city: "Dhaka", country: "Bangladesh" },
];
class CustomerRepository {
    static async findMany(where = {}) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.customer.findMany({
                    where,
                    orderBy: { createdAt: 'desc' }
                });
            }
            catch (error) {
                console.error('Customer search failed, falling back to mock');
            }
        }
        return exports.demoCustomers;
    }
    static async create(data) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.customer.create({ data });
            }
            catch (error) {
                console.error('Customer creation failed');
            }
        }
        return { ...data, id: `offline-${Date.now()}` };
    }
}
exports.CustomerRepository = CustomerRepository;
//# sourceMappingURL=CustomerRepository.js.map