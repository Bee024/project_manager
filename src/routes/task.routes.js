import { Router } from "express";
import {
  createSubTask,
  createTask,
  deleteSubTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
} from "../controllers/task.controllers.js";
import {
  validateProjectPermission,
  verifyJWT,
} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import {
  createSubtaskValidator,
  createTaskValidator,
  mongoIdParam,
  updateSubtaskValidator,
  updateTaskValidator,
} from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/:projectId")
  .get(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getTasks,
  )
  .post(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    upload.array("attachments", 5),
    createTaskValidator(),
    validate,
    createTask,
  );

router
  .route("/:projectId/t/:taskId")
  .get(
    mongoIdParam("projectId"),
    mongoIdParam("taskId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getTaskById,
  )
  .put(
    mongoIdParam("projectId"),
    mongoIdParam("taskId"),
    updateTaskValidator(),
    validate,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    updateTask,
  )
  .delete(
    mongoIdParam("projectId"),
    mongoIdParam("taskId"),
    validate,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteTask,
  );

router
  .route("/:projectId/t/:taskId/subtasks")
  .post(
    mongoIdParam("projectId"),
    mongoIdParam("taskId"),
    createSubtaskValidator(),
    validate,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    createSubTask,
  );

router
  .route("/:projectId/st/:subtaskId")
  .put(
    mongoIdParam("projectId"),
    mongoIdParam("subtaskId"),
    updateSubtaskValidator(),
    validate,
    validateProjectPermission(AvailableUserRole),
    updateSubTask,
  )
  .delete(
    mongoIdParam("projectId"),
    mongoIdParam("subtaskId"),
    validate,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteSubTask,
  );

export default router;
