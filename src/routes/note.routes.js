import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "../controllers/note.controllers.js";
import {
  validateProjectPermission,
  verifyJWT,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { createNoteValidator, mongoIdParam } from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/:projectId")
  .get(
    mongoIdParam("projectId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getNotes,
  )
  .post(
    mongoIdParam("projectId"),
    createNoteValidator(),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    createNote,
  );

router
  .route("/:projectId/n/:noteId")
  .get(
    mongoIdParam("projectId"),
    mongoIdParam("noteId"),
    validate,
    validateProjectPermission(AvailableUserRole),
    getNoteById,
  )
  .put(
    mongoIdParam("projectId"),
    mongoIdParam("noteId"),
    createNoteValidator(),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    updateNote,
  )
  .delete(
    mongoIdParam("projectId"),
    mongoIdParam("noteId"),
    validate,
    validateProjectPermission([UserRolesEnum.ADMIN]),
    deleteNote,
  );

export default router;
