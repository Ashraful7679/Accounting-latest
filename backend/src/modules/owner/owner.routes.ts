import { FastifyInstance } from 'fastify';
import { OwnerController } from './owner.controller';
import { authenticate, requireOwner } from '../../middleware/auth';

export const ownerRoutes = async (fastify: FastifyInstance) => {
  const controller = new OwnerController();

  // All routes require authentication and Owner role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireOwner);

  // Get companies assigned to this owner
  fastify.get('/companies', controller.getMyCompanies.bind(controller));

  // Update company (logo, info)
  fastify.put('/companies/:id', controller.updateCompany.bind(controller));

  // Create/Assign co-owners
  fastify.post('/companies', controller.createCompany.bind(controller));
  fastify.post('/companies/:id/owners', controller.addOwnerToCompany.bind(controller));

  // Get/update co-owners
  fastify.get('/companies/:id/owners', controller.getCoOwners.bind(controller));
  fastify.put('/companies/:id/owners/:ownerId', controller.updateCoOwner.bind(controller));

  // Remove owner from company
  fastify.delete('/companies/:id/owners/:ownerId', controller.removeOwnerFromCompany.bind(controller));

  // Get users in owner's companies
  fastify.get('/users', controller.getEmployees.bind(controller));

  // Create user
  fastify.post('/users', controller.createEmployee.bind(controller));

  // Update user
  fastify.put('/users/:id', controller.updateEmployee.bind(controller));

  // Update user permissions
  fastify.put('/users/:id/permissions', controller.updateEmployeePermissions.bind(controller));
  fastify.put('/users/:id/permissions/bulk', controller.bulkUpdateEmployeePermissions.bind(controller));

  // Set reporting manager
  fastify.put('/users/:id/manager', controller.setEmployeeManager.bind(controller));

  // Reset password
  fastify.post('/users/:id/reset-password', controller.resetEmployeePassword.bind(controller));

  // Toggle user active status
  fastify.put('/users/:id/activate', controller.toggleEmployeeStatus.bind(controller));

  // Delete user
  fastify.delete('/users/:id', controller.deleteEmployee.bind(controller));

  // One-shot: seed default permissions for ALL users based on their current role
  fastify.post('/users/sync-permissions', controller.syncAllPermissions.bind(controller));
};
