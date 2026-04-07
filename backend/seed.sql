-- Seed Data
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_0', 'Admin', 'System Administrator', true, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_1', 'Owner', 'Company Owner', true, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_2', 'Manager', 'Manager - can verify', true, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_3', 'Accountant', 'Accountant - can create entries', true, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Role" ("id", "name", "description", "isSystem", "createdAt", "updatedAt") VALUES ('role_4', 'User', 'Basic user', true, NOW(), NOW()) ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_0', 'BDT', 'Bangladeshi Taka', '৳', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_1', 'USD', 'US Dollar', '$', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_2', 'EUR', 'Euro', '€', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_3', 'GBP', 'British Pound', '£', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "Currency" ("id", "code", "name", "symbol", "isActive", "createdAt", "updatedAt") VALUES ('curr_4', 'INR', 'Indian Rupee', '₹', true, NOW(), NOW()) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "isActive", "maxCompanies", "createdAt", "updatedAt") VALUES ('usr_admin', 'admin@accounting.com', '$2a$10$T15z4tnVuk8f1tgsDj3Wuuh1ya8XdMBogTvhhM.ONpjj6uBT2qtEW', 'Admin', 'User', true, 100, NOW(), NOW()) ON CONFLICT ("email") DO NOTHING;
INSERT INTO "UserRole" ("id", "userId", "roleId") VALUES ('ur_admin', 'usr_admin', 'role_0') ON CONFLICT ("userId", "roleId") DO NOTHING;
INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_0', 'ASSET', 'DEBIT') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_1', 'LIABILITY', 'CREDIT') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_2', 'EQUITY', 'CREDIT') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_3', 'INCOME', 'CREDIT') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "AccountType" ("id", "name", "type") VALUES ('at_4', 'EXPENSE', 'DEBIT') ON CONFLICT ("name") DO NOTHING;
