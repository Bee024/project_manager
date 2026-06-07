import { Router } from "express";
import {
  addMembersToProject,
  createProject,
  deleteMember,
  deleteProject,
  getProjectById,
  getProjectMembers,
  getProjects,
  updateMemberRole,
  updateProject,
} from "../controllers/project.controllers.js";
import {
  validateProjectPermission,
  verifyJWT,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import {
  addMembersToProjectValidator,
  createProjectValidator,
  mongoIdParam,
  updateMemberRoleValidator,
  updateProjectValidator,
} from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/")
  .get(getProjects)
  .post(createProjectValidator(), validate, createProject);

router
  .route("/:projectId")
  .get(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getProjectById,
  )
  .put(
    mongoIdParam("projectId"),
    updateProjectValidator(),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    updateProject,
  )
  .delete(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    deleteProject,
  );

router
  .route("/:projectId/members")
  .get(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getProjectMembers,
  )
  .post(
    mongoIdParam("projectId"),
    addMembersToProjectValidator(),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    addMembersToProject,
  );

router
  .route("/:projectId/members/:userId")
  .put(
    mongoIdParam("projectId"),
    mongoIdParam("userId"),
    updateMemberRoleValidator(),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    updateMemberRole,
  )
  .delete(
    mongoIdParam("projectId"),
    mongoIdParam("userId"),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    deleteMember,
  );

export default router;
