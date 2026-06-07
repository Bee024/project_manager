import mongoose from "mongoose";
import { ProjectMember } from "../models/projectmember.models.js";
import { Subtask } from "../models/subtask.models.js";
import { Task } from "../models/task.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum } from "../utils/constants.js";

const assertTaskInProject = async (projectId, taskId) => {
  const task = await Task.findOne({
    _id: taskId,
    project: projectId,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

const assertAssigneeBelongsToProject = async (projectId, userId) => {
  if (!userId) {
    return;
  }

  const membership = await ProjectMember.findOne({
    project: new mongoose.Types.ObjectId(projectId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!membership) {
    throw new ApiError(400, "Assignee must be a member of this project");
  }
};

const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  })
    .populate("assignedTo", "avatar username fullName email")
    .populate("assignedBy", "avatar username fullName email")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const { projectId } = req.params;

  await assertAssigneeBelongsToProject(projectId, assignedTo);

  const baseUrl =
    process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
  const files = req.files || [];

  const attachments = files.map((file) => ({
    url: `${baseUrl}/images/${file.filename}`,
    localPath: file.path,
    mimetype: file.mimetype,
    size: file.size,
    originalName: file.originalname,
  }));

  const task = await Task.create({
    title,
    description,
    project: new mongoose.Types.ObjectId(projectId),
    assignedTo: assignedTo
      ? new mongoose.Types.ObjectId(assignedTo)
      : undefined,
    status,
    assignedBy: req.user._id,
    attachments,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  const task = await Task.findOne({
    _id: taskId,
    project: projectId,
  })
    .populate("assignedTo", "avatar username fullName email")
    .populate("assignedBy", "avatar username fullName email")
    .lean();

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const subtasks = await Subtask.find({ task: taskId })
    .populate("createdBy", "avatar username fullName email")
    .sort({ createdAt: 1 })
    .lean();

  return res
    .status(200)
    .json(
      new ApiResponse(200, { ...task, subtasks }, "Task fetched successfully"),
    );
});

const updateTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  await assertTaskInProject(projectId, taskId);
  await assertAssigneeBelongsToProject(projectId, assignedTo);

  const update = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
  };

  const query = { $set: update };

  if (assignedTo !== undefined) {
    if (assignedTo) {
      query.$set.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    } else {
      query.$unset = { assignedTo: 1 };
    }
  }

  const task = await Task.findByIdAndUpdate(taskId, query, {
    new: true,
    runValidators: true,
  })
    .populate("assignedTo", "avatar username fullName email")
    .populate("assignedBy", "avatar username fullName email");

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  await assertTaskInProject(projectId, taskId);

  await Promise.all([
    Task.findByIdAndDelete(taskId),
    Subtask.deleteMany({ task: new mongoose.Types.ObjectId(taskId) }),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title } = req.body;

  await assertTaskInProject(projectId, taskId);

  const subtask = await Subtask.create({
    title,
    task: new mongoose.Types.ObjectId(taskId),
    createdBy: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, subtask, "Subtask created successfully"));
});

const updateSubTask = asyncHandler(async (req, res) => {
  const { projectId, subtaskId } = req.params;
  const { title, isCompleted } = req.body;

  const subtask = await Subtask.findById(subtaskId).populate("task", "project");

  if (
    !subtask ||
    !subtask.task ||
    String(subtask.task.project) !== String(projectId)
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  if (req.projectRole === UserRolesEnum.MEMBER && title !== undefined) {
    throw new ApiError(403, "Members can only update subtask completion");
  }

  const update = {
    ...(title !== undefined ? { title } : {}),
    ...(isCompleted !== undefined ? { isCompleted } : {}),
  };

  const updatedSubtask = await Subtask.findByIdAndUpdate(
    subtaskId,
    { $set: update },
    { new: true, runValidators: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedSubtask, "Subtask updated successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { projectId, subtaskId } = req.params;

  const subtask = await Subtask.findById(subtaskId).populate("task", "project");

  if (
    !subtask ||
    !subtask.task ||
    String(subtask.task.project) !== String(projectId)
  ) {
    throw new ApiError(404, "Subtask not found");
  }

  await Subtask.findByIdAndDelete(subtaskId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Subtask deleted successfully"));
});

export {
  createSubTask,
  createTask,
  deleteSubTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
};
