const app = document.querySelector("#app");

// In production the frontend is served statically and needs to know
// where the backend lives. Set window.API_BASE_URL via a meta tag or
// leave empty to use relative URLs (same-origin / local dev).
const API_BASE = window.API_BASE_URL || "";

const state = {
  authMode: "login",
  token: localStorage.getItem("project_camp_token") || "",
  user: null,
  projects: [],
  selectedProjectId: localStorage.getItem("project_camp_project") || "",
  selectedTab: "tasks",
  selectedTaskId: "",
  members: [],
  tasks: [],
  selectedTask: null,
  notes: [],
  message: "",
  error: "",
  resetToken: location.pathname.startsWith("/reset-password/")
    ? location.pathname.split("/").filter(Boolean).at(-1)
    : "",
};

const roles = [
  ["admin", "Admin"],
  ["project_admin", "Project Admin"],
  ["member", "Member"],
];

const statuses = [
  ["todo", "Todo"],
  ["in_progress", "In Progress"],
  ["done", "Done"],
];

const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const setNotice = ({ message = "", error = "" } = {}) => {
  state.message = message;
  state.error = error;
};

const authHeaders = () => {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
};

const request = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...authHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data;
};

const currentProject = () => {
  return state.projects.find(
    (item) => item.project._id === state.selectedProjectId,
  );
};

const canManageTasks = () => {
  return ["admin", "project_admin"].includes(currentProject()?.role);
};

const canAdminProject = () => currentProject()?.role === "admin";

const loadCurrentUser = async () => {
  if (!state.token) return;
  state.user = await request("/api/v1/auth/current-user");
};

const loadProjects = async () => {
  state.projects = await request("/api/v1/projects");

  if (!state.selectedProjectId && state.projects.length) {
    state.selectedProjectId = state.projects[0].project._id;
  }

  if (
    state.selectedProjectId &&
    !state.projects.some((item) => item.project._id === state.selectedProjectId)
  ) {
    state.selectedProjectId = state.projects[0]?.project._id || "";
  }

  localStorage.setItem("project_camp_project", state.selectedProjectId);
};

const loadProjectData = async () => {
  if (!state.selectedProjectId) return;

  const [tasks, members, notes] = await Promise.all([
    request(`/api/v1/tasks/${state.selectedProjectId}`),
    request(`/api/v1/projects/${state.selectedProjectId}/members`),
    request(`/api/v1/notes/${state.selectedProjectId}`),
  ]);

  state.tasks = tasks;
  state.members = members;
  state.notes = notes;

  if (state.selectedTaskId) {
    await loadTaskDetail(state.selectedTaskId);
  }
};

const loadTaskDetail = async (taskId) => {
  state.selectedTaskId = taskId;
  state.selectedTask = await request(
    `/api/v1/tasks/${state.selectedProjectId}/t/${taskId}`,
  );
};

const boot = async () => {
  try {
    if (state.token) {
      await loadCurrentUser();
      await loadProjects();
      await loadProjectData();
    }
  } catch (error) {
    localStorage.removeItem("project_camp_token");
    state.token = "";
    state.user = null;
    setNotice({ error: error.message });
  }

  render();
};

const renderNotice = () => {
  if (state.error) return `<div class="error">${escapeHtml(state.error)}</div>`;
  if (state.message) {
    return `<div class="success">${escapeHtml(state.message)}</div>`;
  }
  return "";
};

const renderAuth = () => {
  const isLogin = state.authMode === "login";

  app.innerHTML = `
    <main class="auth-layout">
      <section class="brand-panel">
        <div class="logo">
          <strong>Project Camp</strong>
          <span>Team delivery workspace</span>
        </div>
        <div class="brand-title">
          <h1>Project Camp</h1>
          <p>Plan projects, assign work, track subtasks, and keep project notes in one focused workspace.</p>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-box">
          <div class="auth-tabs">
            <button class="${isLogin ? "active" : ""}" data-action="auth-mode" data-mode="login">Login</button>
            <button class="${!isLogin ? "active" : ""}" data-action="auth-mode" data-mode="register">Register</button>
          </div>
          <form class="form-stack" data-form="${isLogin ? "login" : "register"}">
            ${
              isLogin
                ? `
                  <label class="field"><span>Email or username</span><input name="identity" autocomplete="username" required /></label>
                `
                : `
                  <label class="field"><span>Full name</span><input name="fullName" autocomplete="name" /></label>
                  <label class="field"><span>Username</span><input name="username" autocomplete="username" required /></label>
                  <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>
                `
            }
            <label class="field"><span>Password</span><input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" required minlength="8" /></label>
            <button class="btn primary" type="submit">${isLogin ? "Login" : "Create account"}</button>
          </form>
          <form class="form-stack" data-form="forgot-password">
            <label class="field"><span>Reset password</span><input name="email" type="email" placeholder="email@example.com" /></label>
            <button class="btn" type="submit">Send reset link</button>
          </form>
          ${renderNotice()}
        </div>
      </section>
    </main>
  `;
};

const renderResetPassword = () => {
  app.innerHTML = `
    <main class="auth-layout">
      <section class="brand-panel">
        <div class="logo">
          <strong>Project Camp</strong>
          <span>Secure account recovery</span>
        </div>
        <div class="brand-title">
          <h1>Reset password</h1>
          <p>Create a new password and return to your project workspace.</p>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-box">
          <form class="form-stack" data-form="reset-password">
            <label class="field"><span>New password</span><input name="newPassword" type="password" autocomplete="new-password" required minlength="8" /></label>
            <button class="btn primary" type="submit">Update password</button>
          </form>
          ${renderNotice()}
        </div>
      </section>
    </main>
  `;
};

const renderProjectList = () => {
  if (!state.projects.length) {
    return `<div class="empty">No projects yet.</div>`;
  }

  return state.projects
    .map(({ project, role }) => {
      const active = project._id === state.selectedProjectId ? "active" : "";
      return `
        <button class="project-button ${active}" data-action="select-project" data-project-id="${project._id}">
          <strong>${escapeHtml(project.name)}</strong>
          <span class="muted">${escapeHtml(role)} · ${project.members || 0} members</span>
        </button>
      `;
    })
    .join("");
};

const renderProjectForm = () => {
  return `
    <form class="compact-form" data-form="project">
      <label class="field"><span>Project name</span><input name="name" required /></label>
      <label class="field"><span>Description</span><textarea name="description"></textarea></label>
      <button class="btn primary" type="submit">Create project</button>
    </form>
  `;
};

const renderSidebar = () => {
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <strong>Project Camp</strong>
          <span>${escapeHtml(state.user?.email || "")}</span>
        </div>
        <button class="btn ghost" data-action="logout">Logout</button>
      </div>
      <div class="project-list">${renderProjectList()}</div>
      <div class="panel">${renderProjectForm()}</div>
    </aside>
  `;
};

const renderTabs = () => {
  return `
    <div class="tabs">
      ${["tasks", "notes", "members"]
        .map(
          (tab) => `
            <button class="${state.selectedTab === tab ? "active" : ""}" data-action="tab" data-tab="${tab}">
              ${tab[0].toUpperCase()}${tab.slice(1)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderTaskForm = () => {
  if (!canManageTasks()) return "";

  return `
    <form class="compact-form" data-form="task">
      <label class="field"><span>Title</span><input name="title" required /></label>
      <label class="field"><span>Description</span><textarea name="description"></textarea></label>
      <div class="two-column">
        <label class="field">
          <span>Assignee</span>
          <select name="assignedTo">
            <option value="">Unassigned</option>
            ${state.members
              .map(
                (member) => `
                  <option value="${member.user._id}">${escapeHtml(member.user.fullName || member.user.username)}</option>
                `,
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select name="status">
            ${statuses
              .map(
                ([value, label]) =>
                  `<option value="${value}">${label}</option>`,
              )
              .join("")}
          </select>
        </label>
      </div>
      <label class="field"><span>Attachments</span><input name="attachments" type="file" multiple /></label>
      <button class="btn primary" type="submit">Create task</button>
    </form>
  `;
};

const renderTasks = () => {
  const list = state.tasks.length
    ? state.tasks
        .map(
          (task) => `
            <article class="card">
              <div class="card-header">
                <div>
                  <h4>${escapeHtml(task.title)}</h4>
                  <p>${escapeHtml(task.description || "No description")}</p>
                </div>
                <span class="badge ${task.status}">${escapeHtml(task.status.replace("_", " "))}</span>
              </div>
              <div class="row" style="margin-top: 12px">
                <span class="muted">${escapeHtml(task.assignedTo?.fullName || task.assignedTo?.username || "Unassigned")}</span>
                <div class="row">
                  ${
                    canManageTasks()
                      ? `
                        <select data-action="task-status" data-task-id="${task._id}">
                          ${statuses
                            .map(
                              ([value, label]) => `
                                <option value="${value}" ${task.status === value ? "selected" : ""}>${label}</option>
                              `,
                            )
                            .join("")}
                        </select>
                      `
                      : ""
                  }
                  <button class="btn" data-action="open-task" data-task-id="${task._id}">Open</button>
                  ${canManageTasks() ? `<button class="btn danger" data-action="delete-task" data-task-id="${task._id}">Delete</button>` : ""}
                </div>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty">No tasks yet.</div>`;

  return `
    <section class="content-grid">
      <div class="panel">
        <div class="section-header">
          <h3>Tasks</h3>
        </div>
        <div class="list">${list}</div>
        ${state.selectedTask ? renderTaskDetail() : ""}
      </div>
      <div class="panel">${renderTaskForm()}</div>
    </section>
  `;
};

const renderTaskDetail = () => {
  const task = state.selectedTask;

  return `
    <section class="task-detail panel">
      <div class="section-header">
        <h3>${escapeHtml(task.title)}</h3>
        <button class="btn ghost" data-action="close-task">Close</button>
      </div>
      <p class="muted">${escapeHtml(task.description || "No description")}</p>
      <div class="attachment-list">
        ${(task.attachments || [])
          .map(
            (file) =>
              `<a href="${file.url}" target="_blank" rel="noreferrer">${escapeHtml(file.originalName || "Attachment")}</a>`,
          )
          .join("")}
      </div>
      <div class="list">
        ${
          (task.subtasks || [])
            .map(
              (subtask) => `
              <label class="subtask">
                <input type="checkbox" ${subtask.isCompleted ? "checked" : ""} data-action="subtask-toggle" data-subtask-id="${subtask._id}" />
                <span>${escapeHtml(subtask.title)}</span>
                ${
                  canManageTasks()
                    ? `<button class="btn danger" data-action="delete-subtask" data-subtask-id="${subtask._id}" type="button">Delete</button>`
                    : ""
                }
              </label>
            `,
            )
            .join("") || `<div class="empty">No subtasks yet.</div>`
        }
      </div>
      ${
        canManageTasks()
          ? `
            <form class="compact-form" data-form="subtask">
              <input type="hidden" name="taskId" value="${task._id}" />
              <label class="field"><span>Subtask</span><input name="title" required /></label>
              <button class="btn primary" type="submit">Add subtask</button>
            </form>
          `
          : ""
      }
    </section>
  `;
};

const renderNotes = () => {
  const list = state.notes.length
    ? state.notes
        .map(
          (note) => `
            <article class="card">
              <p>${escapeHtml(note.content)}</p>
              <div class="row" style="margin-top: 12px">
                <span class="muted">${escapeHtml(note.createdBy?.fullName || note.createdBy?.username || "")}</span>
                ${canAdminProject() ? `<button class="btn danger" data-action="delete-note" data-note-id="${note._id}">Delete</button>` : ""}
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty">No notes yet.</div>`;

  return `
    <section class="content-grid">
      <div class="panel">
        <div class="section-header"><h3>Notes</h3></div>
        <div class="list">${list}</div>
      </div>
      <div class="panel">
        ${
          canAdminProject()
            ? `
              <form class="compact-form" data-form="note">
                <label class="field"><span>Note</span><textarea name="content" required></textarea></label>
                <button class="btn primary" type="submit">Add note</button>
              </form>
            `
            : `<div class="empty">Only project admins can add notes.</div>`
        }
      </div>
    </section>
  `;
};

const renderMembers = () => {
  const list = state.members
    .map(
      (member) => `
        <article class="card">
          <div class="card-header">
            <div>
              <h4>${escapeHtml(member.user.fullName || member.user.username)}</h4>
              <p>${escapeHtml(member.user.email || "")}</p>
            </div>
            <span class="badge">${escapeHtml(member.role)}</span>
          </div>
          ${
            canAdminProject()
              ? `
                <div class="row" style="margin-top: 12px">
                  <select data-action="member-role" data-user-id="${member.user._id}">
                    ${roles
                      .map(
                        ([value, label]) => `
                          <option value="${value}" ${member.role === value ? "selected" : ""}>${label}</option>
                        `,
                      )
                      .join("")}
                  </select>
                  <button class="btn danger" data-action="delete-member" data-user-id="${member.user._id}">Remove</button>
                </div>
              `
              : ""
          }
        </article>
      `,
    )
    .join("");

  return `
    <section class="content-grid">
      <div class="panel">
        <div class="section-header"><h3>Members</h3></div>
        <div class="list">${list || `<div class="empty">No members yet.</div>`}</div>
      </div>
      <div class="panel">
        ${
          canAdminProject()
            ? `
              <form class="compact-form" data-form="member">
                <label class="field"><span>Email</span><input name="email" type="email" required /></label>
                <label class="field">
                  <span>Role</span>
                  <select name="role">
                    ${roles
                      .map(
                        ([value, label]) =>
                          `<option value="${value}">${label}</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <button class="btn primary" type="submit">Save member</button>
              </form>
            `
            : `<div class="empty">Only project admins can manage members.</div>`
        }
      </div>
    </section>
  `;
};

const renderMain = () => {
  const selected = currentProject();

  if (!selected) {
    return `
      <main class="main">
        <div class="panel">
          <div class="empty">Create a project to begin.</div>
        </div>
      </main>
    `;
  }

  return `
    <main class="main">
      <div class="topbar">
        <div>
          <h2>${escapeHtml(selected.project.name)}</h2>
          <span class="muted">${escapeHtml(selected.project.description || "No description")} · ${escapeHtml(selected.role)}</span>
        </div>
        ${renderTabs()}
      </div>
      ${renderNotice()}
      ${
        state.selectedTab === "tasks"
          ? renderTasks()
          : state.selectedTab === "notes"
            ? renderNotes()
            : renderMembers()
      }
    </main>
  `;
};

const renderDashboard = () => {
  app.innerHTML = `
    <div class="dashboard">
      ${renderSidebar()}
      ${renderMain()}
    </div>
  `;
};

const render = () => {
  if (state.resetToken && !state.user) {
    renderResetPassword();
    return;
  }

  if (!state.token || !state.user) {
    renderAuth();
    return;
  }

  renderDashboard();
};

const handleAuth = async (form) => {
  const data = Object.fromEntries(new FormData(form));

  if (form.dataset.form === "register") {
    await request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    state.authMode = "login";
    setNotice({
      message: "Account created. Check your email verification link.",
    });
    render();
    return;
  }

  const identity = data.identity.trim();
  const payload = identity.includes("@")
    ? { email: identity, password: data.password }
    : { username: identity, password: data.password };

  const response = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  state.token = response.accessToken;
  state.user = response.user;
  localStorage.setItem("project_camp_token", state.token);
  await loadProjects();
  await loadProjectData();
};

const refreshProject = async () => {
  await loadProjects();
  await loadProjectData();
  render();
};

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form");
  if (!form) return;

  event.preventDefault();
  setNotice();

  try {
    const formType = form.dataset.form;
    const data = Object.fromEntries(new FormData(form));

    if (formType === "login" || formType === "register") {
      await handleAuth(form);
    }

    if (formType === "forgot-password") {
      await request("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setNotice({
        message: "Password reset email sent when the account exists.",
      });
    }

    if (formType === "reset-password") {
      await request(`/api/v1/auth/reset-password/${state.resetToken}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      state.resetToken = "";
      state.authMode = "login";
      history.replaceState({}, "", "/");
      setNotice({ message: "Password updated. You can log in now." });
    }

    if (formType === "project") {
      await request("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setNotice({ message: "Project created." });
      await refreshProject();
    }

    if (formType === "task") {
      const body = new FormData(form);
      await request(`/api/v1/tasks/${state.selectedProjectId}`, {
        method: "POST",
        body,
      });
      setNotice({ message: "Task created." });
      await refreshProject();
    }

    if (formType === "subtask") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${data.taskId}/subtasks`,
        {
          method: "POST",
          body: JSON.stringify({ title: data.title }),
        },
      );
      setNotice({ message: "Subtask added." });
      await loadTaskDetail(data.taskId);
      await loadProjectData();
      render();
    }

    if (formType === "note") {
      await request(`/api/v1/notes/${state.selectedProjectId}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setNotice({ message: "Note added." });
      await refreshProject();
    }

    if (formType === "member") {
      await request(`/api/v1/projects/${state.selectedProjectId}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setNotice({ message: "Member saved." });
      await refreshProject();
    }

    render();
  } catch (error) {
    setNotice({ error: error.message });
    render();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action } = target.dataset;

  try {
    setNotice();

    if (action === "auth-mode") {
      state.authMode = target.dataset.mode;
      render();
    }

    if (action === "logout") {
      await request("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("project_camp_token");
      localStorage.removeItem("project_camp_project");
      Object.assign(state, {
        token: "",
        user: null,
        projects: [],
        selectedProjectId: "",
        selectedTask: null,
      });
      render();
    }

    if (action === "select-project") {
      state.selectedProjectId = target.dataset.projectId;
      state.selectedTask = null;
      state.selectedTaskId = "";
      localStorage.setItem("project_camp_project", state.selectedProjectId);
      await loadProjectData();
      render();
    }

    if (action === "tab") {
      state.selectedTab = target.dataset.tab;
      render();
    }

    if (action === "open-task") {
      await loadTaskDetail(target.dataset.taskId);
      render();
    }

    if (action === "close-task") {
      state.selectedTask = null;
      state.selectedTaskId = "";
      render();
    }

    if (action === "delete-task") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${target.dataset.taskId}`,
        { method: "DELETE" },
      );
      state.selectedTask = null;
      await refreshProject();
    }

    if (action === "delete-subtask") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/st/${target.dataset.subtaskId}`,
        { method: "DELETE" },
      );
      await loadTaskDetail(state.selectedTaskId);
      await loadProjectData();
      render();
    }

    if (action === "delete-note") {
      await request(
        `/api/v1/notes/${state.selectedProjectId}/n/${target.dataset.noteId}`,
        { method: "DELETE" },
      );
      await refreshProject();
    }

    if (action === "delete-member") {
      await request(
        `/api/v1/projects/${state.selectedProjectId}/members/${target.dataset.userId}`,
        { method: "DELETE" },
      );
      await refreshProject();
    }
  } catch (error) {
    setNotice({ error: error.message });
    render();
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action } = target.dataset;

  try {
    setNotice();

    if (action === "task-status") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${target.dataset.taskId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: target.value }),
        },
      );
      await refreshProject();
    }

    if (action === "subtask-toggle") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/st/${target.dataset.subtaskId}`,
        {
          method: "PUT",
          body: JSON.stringify({ isCompleted: target.checked }),
        },
      );
      await loadTaskDetail(state.selectedTaskId);
      render();
    }

    if (action === "member-role") {
      await request(
        `/api/v1/projects/${state.selectedProjectId}/members/${target.dataset.userId}`,
        {
          method: "PUT",
          body: JSON.stringify({ role: target.value }),
        },
      );
      await refreshProject();
    }
  } catch (error) {
    setNotice({ error: error.message });
    render();
  }
});

boot();
