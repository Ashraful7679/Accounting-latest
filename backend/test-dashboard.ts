import prisma from './src/config/database';
import { DashboardController } from './src/modules/company/dashboard.controller';

async function test() {
  const req = {
    params: { id: '34283923-e63a-4f8a-beb4-5f84c05e9129' },
    user: { id: 'some-id' } // Will be bypassed if we simulate owner
  };
  
  // Actually, wait, let's just find the user ID for this company
  const comp = await prisma.company.findFirst({ where: { id: '34283923-e63a-4f8a-beb4-5f84c05e9129' }, include: { userCompanies: true } });
  if (!comp || !comp.userCompanies.length) {
    console.error('Company or members not found');
    return;
  }
  
  req.user.id = comp.userCompanies[0].userId;
  
  const reply = {
    status: (s) => ({ send: (d) => { console.log('STATUS', s, 'DATA', d); return d; } }),
    send: (d) => { console.log('DATA', JSON.stringify(d, null, 2)); return d; }
  };
  
  const ctrl = new DashboardController();
  try {
    await ctrl.getStats(req as any, reply as any);
  } catch (err) {
    console.error('ERROR THROWN', err);
  }
}

test().catch(console.error).finally(() => process.exit(0));
