"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoUser = exports.demoCompany = void 0;
exports.demoCompany = {
    id: "demo-company-id",
    code: "DEMO01",
    name: "BrainyFlavors Demo Corp (OFFLINE)",
    baseCurrency: "BDT",
    isActive: true,
    address: "Demo Street, Dhaka",
    city: "Dhaka",
    country: "Bangladesh"
};
exports.demoUser = {
    id: "demo-user-id",
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    isActive: true,
    roles: ["Admin"],
    userCompanies: [
        {
            companyId: "demo-company-id",
            isDefault: true,
            company: exports.demoCompany
        }
    ]
};
//# sourceMappingURL=company.js.map