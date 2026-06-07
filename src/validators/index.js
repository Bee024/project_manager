import { body, param } from "express-validator";
import {
  AvailableTaskStatuses,
  AvailableUserRole,
} from "../utils/constants.js";

const mongoIdParam = (name) => {
  return param(name).isMongoId().withMessage(`${name} must be a valid id`);
};

const userRegisterValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is not valid")
      .normalizeEmail(),
    body("username")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLowercase()
      .withMessage("Username must be lowercase")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters long"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    body("fullName").optional().trim().isLength({ max: 80 }),
  ];
};

const userLoginValidator = () => {
  return [
    body("email").optional().trim().isEmail().withMessage("Email is invalid"),
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters long"),
    body("password").notEmpty().withMessage("Password is required"),
    body().custom((value) => {
      if (!value.email && !value.username) {
        throw new Error("Email or username is required");
      }

      return true;
    }),
  ];
};

const userChangeCurrentPasswordValidator = () => {
  return [
    body("oldPassword").notEmpty().withMessage("Old password is required"),
    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long"),
  ];
};

const userForgotPasswordValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid")
      .normalizeEmail(),
  ];
};

const userResetForgotPasswordValidator = () => {
  return [
    body("newPassword")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ];
};

const createProjectValidator = () => {
  return [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("description").optional().trim().isLength({ max: 1000 }),
  ];
};

const updateProjectValidator = () => {
  return [
    body("name").optional().trim().notEmpty().withMessage("Name is required"),
    body("description").optional().trim().isLength({ max: 1000 }),
  ];
};

const addMembersToProjectValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid")
      .normalizeEmail(),
    body("role")
      .notEmpty()
      .withMessage("Role is required")
      .isIn(AvailableUserRole)
      .withMessage("Role is invalid"),
  ];
};

const updateMemberRoleValidator = () => {
  return [
    body("role")
      .notEmpty()
      .withMessage("Role is required")
      .isIn(AvailableUserRole)
      .withMessage("Role is invalid"),
  ];
};

const createTaskValidator = () => {
  return [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").optional().trim().isLength({ max: 3000 }),
    body("assignedTo")
      .optional({ values: "falsy" })
      .isMongoId()
      .withMessage("assignedTo must be a valid user id"),
    body("status")
      .optional()
      .isIn(AvailableTaskStatuses)
      .withMessage("Status is invalid"),
  ];
};

const updateTaskValidator = () => {
  return [
    body("title").optional().trim().notEmpty().withMessage("Title is required"),
    body("description").optional().trim().isLength({ max: 3000 }),
    body("assignedTo")
      .optional({ values: "falsy" })
      .isMongoId()
      .withMessage("assignedTo must be a valid user id"),
    body("status")
      .optional()
      .isIn(AvailableTaskStatuses)
      .withMessage("Status is invalid"),
  ];
};

const createSubtaskValidator = () => {
  return [body("title").trim().notEmpty().withMessage("Title is required")];
};

const updateSubtaskValidator = () => {
  return [
    body("title").optional().trim().notEmpty().withMessage("Title is required"),
    body("isCompleted")
      .optional()
      .isBoolean()
      .withMessage("isCompleted must be a boolean"),
  ];
};

const createNoteValidator = () => {
  return [body("content").trim().notEmpty().withMessage("Content is required")];
};

export {
  addMembersToProjectValidator,
  createNoteValidator,
  createProjectValidator,
  createSubtaskValidator,
  createTaskValidator,
  mongoIdParam,
  updateMemberRoleValidator,
  updateProjectValidator,
  updateSubtaskValidator,
  updateTaskValidator,
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgotPasswordValidator,
};
