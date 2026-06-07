import mongoose from "mongoose";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ProjectNote } from "../models/note.models.js";
import { Subtask } from "../models/subtask.models.js";
import { Task } from "../models/task.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum } from "../utils/constants.js";

const assertProjectExists = async (projectId) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return project;
};

const assertNotLastAdmin = async (projectId, member) => {
  if (!member || member.role !== UserRolesEnum.ADMIN) {
    return;
  }

  const adminCount = await ProjectMember.countDocuments({
    project: new mongoose.Types.ObjectId(projectId),
    role: UserRolesEnum.ADMIN,
  });

  if (adminCount <= 1) {
    throw new ApiError(400, "A project must have at least one admin");
  }
};

const getProjects = asyncHandler(async (req, res) => {
  const memberships = await ProjectMember.find({
    user: req.user._id,
  })
    .populate("project", "name description createdBy createdAt updatedAt")
    .lean();

  const projectIds = memberships
    .filter((membership) => membership.project)
    .map((membership) => membership.project._id);

  const memberCounts = await ProjectMember.aggregate([
    {
      $match: {
        project: { $in: projectIds },
      },
    },
    {
      $group: {
        _id: "$project",
        count: { $sum: 1 },
      },
    },
  ]);

  const countByProject = new Map(
    memberCounts.map((item) => [String(item._id), item.count]),
  );

  const projects = memberships
    .filter((membership) => membership.project)
    .map((membership) => ({
      project: {
        ...membership.project,
        members: countByProject.get(String(membership.project._id)) || 0,
      },
      role: membership.role,
    }));

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await assertProjectExists(projectId);
  const members = await ProjectMember.countDocuments({ project: projectId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        project,
        role: req.projectRole,
        members,
      },
      "Project fetched successfully",
    ),
  );
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.create({
    name,
    description,
    createdBy: req.user._id,
  });

  await ProjectMember.create({
    user: req.user._id,
    project: project._id,
    role: UserRolesEnum.ADMIN,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, project, "Project created successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;

  const project = await Project.findByIdAndUpdate(
    projectId,
    {
      $set: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    },
    { new: true, runValidators: true },
  );

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findByIdAndDelete(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const tasks = await Task.find({ project: projectId }).select("_id");
  const taskIds = tasks.map((task) => task._id);

  await Promise.all([
    ProjectMember.deleteMany({ project: projectId }),
    ProjectNote.deleteMany({ project: projectId }),
    Subtask.deleteMany({ task: { $in: taskIds } }),
    Task.deleteMany({ project: projectId }),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully"));
});

const addMembersToProject = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const { projectId } = req.params;

  await assertProjectExists(projectId);

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const projectMember = await ProjectMember.findOneAndUpdate(
    {
      user: user._id,
      project: new mongoose.Types.ObjectId(projectId),
    },
    {
      $set: {
        user: user._id,
        project: new mongoose.Types.ObjectId(projectId),
        role,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).populate("user", "username fullName email avatar");

  return res
    .status(201)
    .json(new ApiResponse(201, projectMember, "Project member saved"));
});

const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  await assertProjectExists(projectId);

  const projectMembers = await ProjectMember.find({ project: projectId })
    .populate("user", "username fullName email avatar")
    .sort({ role: 1, createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, projectMembers, "Project members fetched"));
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { role } = req.body;

  let projectMember = await ProjectMember.findOne({
    project: new mongoose.Types.ObjectId(projectId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!projectMember) {
    throw new ApiError(404, "Project member not found");
  }

  if (role !== UserRolesEnum.ADMIN) {
    await assertNotLastAdmin(projectId, projectMember);
  }

  projectMember = await ProjectMember.findByIdAndUpdate(
    projectMember._id,
    {
      $set: { role },
    },
    { new: true, runValidators: true },
  ).populate("user", "username fullName email avatar");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        projectMember,
        "Project member updated successfully",
      ),
    );
});

const deleteMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  const projectMember = await ProjectMember.findOne({
    project: new mongoose.Types.ObjectId(projectId),
    user: new mongoose.Types.ObjectId(userId),
  });

  if (!projectMember) {
    throw new ApiError(404, "Project member not found");
  }

  await assertNotLastAdmin(projectId, projectMember);
  await ProjectMember.findByIdAndDelete(projectMember._id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project member deleted successfully"));
});

export {
  addMembersToProject,
  createProject,
  deleteMember,
  deleteProject,
  getProjectById,
  getProjectMembers,
  getProjects,
  updateMemberRole,
  updateProject,
};
