import prisma from '../config/database';

async function main() {
  console.log('=== COA Migration Script ===');
  console.log('Fixes existing MANUFACTURING and TRADING company COAs');
  console.log('');

  const companies = await prisma.company.findMany({
    where: { category: { in: ['MANUFACTURING', 'TRADING'] } }
  });
  console.log(`Found ${companies.length} companies to process`);

  for (const company of companies) {
    console.log(`\n--- Company: ${company.name} (${company.category}) ---`);
    await fixCompanyCOA(company.id, company.category);
  }

  console.log('\n=== COA Migration Complete ===');
}

async function fixCompanyCOA(companyId: string, category: string) {
  if (category === 'MANUFACTURING') {
    await fixManufacturingCOA(companyId);
  } else if (category === 'TRADING') {
    await fixTradingCOA(companyId);
  }
  await fixDuplicateCapital(companyId);
}

async function fixManufacturingCOA(companyId: string) {
  // Find "Prepayments & Deposits" (GENERAL 1400) that may have manufacturing children
  const prepayments = await prisma.account.findFirst({
    where: { companyId, code: '1400', deletedAt: null }
  });

  if (!prepayments) {
    console.log('  No Prepayments & Deposits (1400) found — nothing to fix');
    return;
  }

  // Find children under prepayments that are actually manufacturing items
  const misplacedChildren = await prisma.account.findMany({
    where: {
      parentId: prepayments.id,
      name: { in: ['Raw Materials', 'Work in Progress', 'Finished Goods', 'Factory Supplies'] }
    }
  });

  if (misplacedChildren.length === 0) {
    console.log('  No misplaced manufacturing children found under Prepayments');
  } else {
    console.log(`  Found ${misplacedChildren.length} misplaced accounts under Prepayments`);

    // Find or create "Inventory" account under ASSETS parent
    const assetsParent = await prisma.account.findFirst({
      where: { companyId, code: '1000', deletedAt: null }
    });

    let inventory = await prisma.account.findFirst({
      where: { companyId, code: '1600', deletedAt: null }
    });

    if (!inventory) {
      const assetType = await prisma.accountType.findUnique({ where: { name: 'ASSET' } });
      inventory = await prisma.account.create({
        data: {
          code: '1600',
          name: 'Inventory',
          companyId,
          accountTypeId: assetType!.id,
          parentId: assetsParent?.id || null,
          category: 'INVENTORY',
          isActive: true
        }
      });
      console.log(`  Created new Inventory account (1600) id=${inventory.id}`);
    }

    // Re-parent misplaced children to Inventory
    for (const child of misplacedChildren) {
      const newCode = child.name === 'Raw Materials' ? '1601'
        : child.name === 'Work in Progress' ? '1602'
        : child.name === 'Finished Goods' ? '1603'
        : '1604';
      await prisma.account.update({
        where: { id: child.id },
        data: { parentId: inventory.id, code: newCode }
      });
      console.log(`  Moved "${child.name}" (${child.code}) → Inventory (${newCode})`);
    }
  }

  // Fix Plant & Machinery under "Other Assets"
  const otherAssets = await prisma.account.findFirst({
    where: { companyId, code: '1500', deletedAt: null }
  });

  if (otherAssets) {
    const plantChildren = await prisma.account.findMany({
      where: {
        parentId: otherAssets.id,
        name: { in: ['Factory Machines', 'Accumulated Depreciation - Machinery'] }
      }
    });

    if (plantChildren.length > 0) {
      console.log(`  Found ${plantChildren.length} misplaced accounts under Other Assets`);

      const assetsParent = await prisma.account.findFirst({
        where: { companyId, code: '1000', deletedAt: null }
      });

      let plantMachinery = await prisma.account.findFirst({
        where: { companyId, code: '1700', deletedAt: null }
      });

      if (!plantMachinery) {
        const assetType = await prisma.accountType.findUnique({ where: { name: 'ASSET' } });
        plantMachinery = await prisma.account.create({
          data: {
            code: '1700',
            name: 'Plant & Machinery',
            companyId,
            accountTypeId: assetType!.id,
            parentId: assetsParent?.id || null,
            isActive: true
          }
        });
        console.log(`  Created new Plant & Machinery account (1700) id=${plantMachinery.id}`);
      }

      for (const child of plantChildren) {
        const newCode = child.name === 'Factory Machines' ? '1701' : '1799';
        await prisma.account.update({
          where: { id: child.id },
          data: { parentId: plantMachinery.id, code: newCode }
        });
        console.log(`  Moved "${child.name}" (${child.code}) → Plant & Machinery (${newCode})`);
      }
    }
  }
}

async function fixTradingCOA(companyId: string) {
  // Check if "Inventory for Resale" exists
  const inventoryForResale = await prisma.account.findFirst({
    where: { companyId, name: 'Inventory for Resale', deletedAt: null }
  });

  if (inventoryForResale) {
    console.log('  Inventory for Resale already exists');
    return;
  }

  // Create "Inventory for Resale" (1600) under ASSETS
  const assetsParent = await prisma.account.findFirst({
    where: { companyId, code: '1000', deletedAt: null }
  });
  const assetType = await prisma.accountType.findUnique({ where: { name: 'ASSET' } });

  if (assetType) {
    await prisma.account.create({
      data: {
        code: '1600',
        name: 'Inventory for Resale',
        companyId,
        accountTypeId: assetType.id,
        parentId: assetsParent?.id || null,
        category: 'INVENTORY',
        isActive: true
      }
    });
    console.log('  Created Inventory for Resale (1600)');
  }
}

async function fixDuplicateCapital(companyId: string) {
  // Find template 3100 "Owner Capital" that might be unused
  const templateCapital = await prisma.account.findFirst({
    where: { companyId, code: '3100', deletedAt: null }
  });

  if (!templateCapital) return;

  const lineCount = await prisma.journalEntryLine.count({
    where: { accountId: templateCapital.id }
  });

  if (Number(templateCapital.currentBalance) === 0 && lineCount === 0) {
    // Safe to deactivate — no activity
    await prisma.account.update({
      where: { id: templateCapital.id },
      data: { isActive: false }
    });
    console.log('  Deactivated unused template "Owner Capital" (3100)');
  } else if (lineCount > 0 && templateCapital.name === 'Owner Capital') {
    // Has activity but generic name — add a note
    await prisma.account.update({
      where: { id: templateCapital.id },
      data: { name: 'Owner Capital (Legacy)' }
    });
    console.log('  Renamed active template "Owner Capital" (3100) to "Owner Capital (Legacy)"');
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
