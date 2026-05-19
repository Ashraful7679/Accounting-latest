-- Seed missing roles for user management
DO $$
BEGIN
  -- Manager
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'Manager') THEN
    INSERT INTO "Role" (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Manager', 'Manager - can verify', true, true, NOW(), NOW());
  END IF;

  -- Co-Owner
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'Co-Owner') THEN
    INSERT INTO "Role" (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Co-Owner', 'Co-Owner - secondary owner role', true, true, NOW(), NOW());
  END IF;

  -- Accountant
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'Accountant') THEN
    INSERT INTO "Role" (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Accountant', 'Accountant - can create entries', true, true, NOW(), NOW());
  END IF;

  -- DataEntry
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'DataEntry') THEN
    INSERT INTO "Role" (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'DataEntry', 'Data Entry Operator', true, true, NOW(), NOW());
  END IF;

  -- User (Normal User)
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'User') THEN
    INSERT INTO "Role" (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'User', 'Basic user', true, true, NOW(), NOW());
  END IF;
END $$;
