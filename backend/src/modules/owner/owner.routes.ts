import { FastifyInstance } from 'fastify';
import { OwnerController } from './owner.controller';
import { authenticate, requireOwner } from '../../middleware/auth';

export const ownerRoutes = async (fastify: FastifyInstance) => {
  const controller = new OwnerController();

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

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

  // Get employees in owner's companies
  fastify.get('/employees', controller.getEmployees.bind(controller));

  // Create employee
  fastify.post('/employees', controller.createEmployee.bind(controller));

  // Update employee
  fastify.put('/employees/:id', controller.updateEmployee.bind(controller));

  // Update employee permissions
  fastify.put('/employees/:id/permissions', controller.updateEmployeePermissions.bind(controller));

  // Set reporting manager
  fastify.put('/employees/:id/manager', controller.setEmployeeManager.bind(controller));

  // Reset password
  fastify.post('/employees/:id/reset-password', controller.resetEmployeePassword.bind(controller));

  // Delete employee
  fastify.delete('/employees/:id', controller.deleteEmployee.bind(controller));
};
