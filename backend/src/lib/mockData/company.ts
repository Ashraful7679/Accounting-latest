export const demoCompany = {
  id: "demo-company-id",
  code: "DEMO01",
  name: "BrainyFlavors Demo Corp (OFFLINE)",
  baseCurrency: "BDT",
  isActive: true,
  address: "Demo Street, Dhaka",
  city: "Dhaka",
  country: "Bangladesh"
};

export const demoUser = {
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
      company: demoCompany
    }
  ]
};
