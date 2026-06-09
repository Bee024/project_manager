/* ── API base ──────────────────────────────────────────────────────────────── */
const getApiBase = () => {
  const v =
    window.API_BASE_URL ||
    document.querySelector('meta[name="api-base-url"]')?.content ||
    "";
  return v.trim().replace(/\/+$/, "");
};
const API_BASE = getApiBase();

/* ── State ─────────────────────────────────────────────────────────────────── */
const state = {
  authMode:          "login",
  token:             localStorage.getItem("project_camp_token") || "",
  user:              null,
  projects:          [],
  selectedProjectId: localStorage.getItem("project_camp_project") || "",
  selectedTab:       "tasks",
  selectedTaskId:    "",
  members:           [],
  tasks:             [],
  selectedTask:      null,
  notes:             [],
  message:           "",
  error:             "",
  lastLoginEmail:    "",
  loading:           false,
  resetToken: location.pathname.startsWith("/reset-password/")
    ? location.pathname.split("/").filter(Boolean).at(-1)
    : "",
};

const roles    = [["admin","Admin"],["project_admin","Project Admin"],["member","Member"]];
const statuses = [["todo","To Do"],["in_progress","In Progress"],["done","Done"]];

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const esc = (v = "") =>
  String(v).replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

const initials = (name = "", fallback = "?") => {
  const parts = String(name).trim().split(/\s+/);
  if (!parts[0]) return fallback.toUpperCase().slice(0,2);
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
};

const setNotice = ({ message = "", error = "" } = {}) => {
  state.message = message;
  state.error   = error;
};

const renderNotice = () => {
  if (state.error)
    return `<div class="notice error"><span>⚠</span>${esc(state.error)}</div>`;
  if (state.message)
    return `<div class="notice success"><span>✓</span>${esc(state.message)}</div>`;
  return "";
};

const statusLabel = (s) => statuses.find(([v]) => v === s)?.[1] ?? s;
const roleLabel   = (r) => roles.find(([v]) => v === r)?.[1] ?? r;

const projectInitial = (name = "") =>
  String(name).trim().slice(0,2).toUpperCase() || "P";

/* ── API ───────────────────────────────────────────────────────────────────── */
const authHeaders = () =>
  state.token ? { Authorization: `Bearer ${state.token}` } : {};

const request = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...authHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || "Request failed");
  return payload.data;
};

/* ── Data loaders ──────────────────────────────────────────────────────────── */
const currentProject = () =>
  state.projects.find((p) => p.project._id === state.selectedProjectId);

const canManageTasks   = () => ["admin","project_admin"].includes(currentProject()?.role);
const canAdminProject  = () => currentProject()?.role === "admin";

const loadCurrentUser = async () => {
  if (!state.token) return;
  state.user = await request("/api/v1/auth/current-user");
};

const loadProjects = async () => {
  state.projects = await request("/api/v1/projects");
  if (!state.selectedProjectId && state.projects.length)
    state.selectedProjectId = state.projects[0].project._id;
  if (
    state.selectedProjectId &&
    !state.projects.some((p) => p.project._id === state.selectedProjectId)
  ) state.selectedProjectId = state.projects[0]?.project._id || "";
  localStorage.setItem("project_camp_project", state.selectedProjectId);
};

const loadProjectData = async () => {
  if (!state.selectedProjectId) return;
  const [tasks, members, notes] = await Promise.all([
    request(`/api/v1/tasks/${state.selectedProjectId}`),
    request(`/api/v1/projects/${state.selectedProjectId}/members`),
    request(`/api/v1/notes/${state.selectedProjectId}`),
  ]);
  state.tasks   = tasks;
  state.members = members;
  state.notes   = notes;
  if (state.selectedTaskId) await loadTaskDetail(state.selectedTaskId);
};

const loadTaskDetail = async (taskId) => {
  state.selectedTaskId = taskId;
  state.selectedTask   = await request(
    `/api/v1/tasks/${state.selectedProjectId}/t/${taskId}`
  );
};

const refreshProject = async () => {
  await loadProjects();
  await loadProjectData();
  render();
};

const boot = async () => {
  try {
    if (state.token) {
      await loadCurrentUser();
      await loadProjects();
      await loadProjectData();
    }
  } catch {
    localStorage.removeItem("project_camp_token");
    state.token = "";
    state.user  = null;
  }
  render();
};

/* ══════════════════════════════════════════════════════════════════════════════
   RENDER — AUTH
══════════════════════════════════════════════════════════════════════════════ */
const renderAuth = () => {
  const isLogin = state.authMode === "login";
  const showResend =
    state.error?.toLowerCase().includes("not verified") && state.lastLoginEmail;

  document.querySelector("#app").innerHTML = `
    <div class="auth-shell">
      <!-- Hero panel -->
      <div class="auth-hero">
        <div class="auth-hero-brand">
          <div class="icon-box">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          Project Camp
        </div>

        <div class="auth-hero-copy">
          <h1>Manage projects.<br/>Ship faster.</h1>
          <p>A focused workspace for teams — plan work, assign tasks, track progress, and keep notes all in one place.</p>
        </div>

        <div class="auth-hero-features">
          <div class="auth-hero-feature"><div class="dot"></div>Role-based project access</div>
          <div class="auth-hero-feature"><div class="dot"></div>Tasks, subtasks &amp; file attachments</div>
          <div class="auth-hero-feature"><div class="dot"></div>Team notes &amp; member management</div>
          <div class="auth-hero-feature"><div class="dot"></div>Real-time status updates</div>
        </div>
      </div>

      <!-- Auth form panel -->
      <div class="auth-panel">
        <div class="auth-card">
          <div class="auth-card-header">
            <h2>${isLogin ? "Welcome back" : "Create your account"}</h2>
            <p>${isLogin ? "Sign in to your workspace" : "Get started — it only takes a minute"}</p>
          </div>

          <div class="auth-tabs">
            <button class="${isLogin ? "active" : ""}" data-action="auth-mode" data-mode="login">Sign in</button>
            <button class="${!isLogin ? "active" : ""}" data-action="auth-mode" data-mode="register">Sign up</button>
          </div>

          ${isLogin ? `
            <form class="form-grid" data-form="login" novalidate>
              <div class="field">
                <span>Email or username</span>
                <input name="identity" placeholder="you@example.com or your username"
                  autocomplete="username" required />
              </div>
              <div class="field">
                <span>Password</span>
                <input name="password" type="password" placeholder="••••••••"
                  autocomplete="current-password" required minlength="8" />
              </div>
              <button class="btn primary lg full" type="submit">Sign in</button>
            </form>
            ${showResend ? `
              <button class="btn full" style="margin-top:10px" data-action="resend-verification">
                Resend verification email
              </button>` : ""}
          ` : `
            <form class="form-grid" data-form="register" novalidate>
              <div class="field">
                <span>Full name <span class="muted font-medium">(optional)</span></span>
                <input name="fullName" placeholder="Jane Doe" autocomplete="name" maxlength="80" />
              </div>
              <div class="form-row">
                <div class="field">
                  <span>Username <span class="required">*</span></span>
                  <input name="username" placeholder="janedoe" autocomplete="off"
                    required minlength="3" style="text-transform:lowercase" />
                  <span class="hint">Lowercase · min 3 chars</span>
                </div>
                <div class="field">
                  <span>Email <span class="required">*</span></span>
                  <input name="email" type="email" placeholder="you@example.com"
                    autocomplete="email" required />
                </div>
              </div>
              <div class="field">
                <span>Password <span class="required">*</span></span>
                <input name="password" type="password" placeholder="Create a strong password"
                  autocomplete="new-password" required minlength="8" />
                <span class="hint">At least 8 characters</span>
              </div>
              <button class="btn primary lg full" type="submit">Create account</button>
            </form>
          `}

          <div class="auth-divider">Forgot your password?</div>

          <form class="form-grid" data-form="forgot-password" novalidate>
            <div class="field">
              <input name="email" type="email" placeholder="Enter your email to reset password"
                autocomplete="email" />
            </div>
            <button class="btn full" type="submit">Send reset link</button>
          </form>

          ${renderNotice()}
        </div>
      </div>
    </div>
  `;
};

const renderResetPassword = () => {
  document.querySelector("#app").innerHTML = `
    <div class="auth-shell">
      <div class="auth-hero">
        <div class="auth-hero-brand">
          <div class="icon-box">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          Project Camp
        </div>
        <div class="auth-hero-copy">
          <h1>Reset your password</h1>
          <p>Create a new password and get back to your workspace.</p>
        </div>
        <div></div>
      </div>
      <div class="auth-panel">
        <div class="auth-card">
          <div class="auth-card-header">
            <h2>New password</h2>
            <p>Choose a strong password — at least 8 characters.</p>
          </div>
          <form class="form-grid" data-form="reset-password">
            <div class="field">
              <span>New password <span class="required">*</span></span>
              <input name="newPassword" type="password" placeholder="••••••••"
                autocomplete="new-password" required minlength="8" />
              <span class="hint">At least 8 characters</span>
            </div>
            <button class="btn primary lg full" type="submit">Update password</button>
          </form>
          ${renderNotice()}
        </div>
      </div>
    </div>
  `;
};

/* ══════════════════════════════════════════════════════════════════════════════
   RENDER — DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
const renderDashboard = () => {
  const selected  = currentProject();
  const userInit  = initials(state.user?.fullName || state.user?.username, "U");
  const userDisplay = esc(state.user?.fullName || state.user?.username || "");
  const role      = selected?.role || "";

  document.querySelector("#app").innerHTML = `
    <div class="dashboard">
      <!-- ── Top bar ── -->
      <header class="topbar">
        <a class="topbar-brand" href="/">
          <div class="icon-box">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <span>Project Camp</span>
        </a>

        <div class="topbar-project-name">
          ${selected
            ? `<strong>${esc(selected.project.name)}</strong>
               <span> · ${esc(selected.project.description || "")}</span>`
            : `<span style="color:var(--text-3)">No project selected</span>`}
        </div>

        <div class="topbar-actions">
          <div class="topbar-user" data-action="logout" title="Sign out">
            <div class="avatar">${esc(userInit)}</div>
            <div>
              <div class="topbar-user-name truncate">${userDisplay}</div>
              ${role ? `<div class="topbar-user-role">${esc(roleLabel(role))}</div>` : ""}
            </div>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--text-3);margin-left:2px">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </div>
        </div>
      </header>

      <!-- ── Sidebar ── -->
      <aside class="sidebar">
        <div class="sidebar-section-label">Projects</div>
        <div class="project-list">
          ${state.projects.length
            ? state.projects.map(({ project, role }) => `
                <button class="project-btn ${project._id === state.selectedProjectId ? "active" : ""}"
                  data-action="select-project" data-project-id="${project._id}">
                  <div class="project-btn-icon">${esc(projectInitial(project.name))}</div>
                  <div class="project-btn-info">
                    <div class="project-btn-name truncate">${esc(project.name)}</div>
                    <div class="project-btn-meta">${esc(roleLabel(role))} · ${project.members || 0} members</div>
                  </div>
                </button>`).join("")
            : `<div class="empty-state" style="padding:20px"><p>No projects yet</p></div>`}
        </div>

        <div class="sidebar-section-label" style="margin-top:8px">New project</div>
        <div class="sidebar-new-project">
          <div class="form-panel">
            <div class="form-panel-body">
              <form class="form-grid" data-form="project" style="gap:10px">
                <div class="field">
                  <input name="name" placeholder="Project name" required />
                </div>
                <div class="field">
                  <textarea name="description" placeholder="Short description (optional)"
                    style="height:60px"></textarea>
                </div>
                <button class="btn primary full sm" type="submit">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Create project
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <!-- ── Main ── -->
      <main class="main">
        ${selected ? renderProjectMain(selected) : renderNoProject()}
      </main>
    </div>
  `;
};

const renderNoProject = () => `
  <div class="no-project">
    <div class="no-project-inner">
      <div class="icon-circle">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <h2>No project selected</h2>
      <p>Create a new project using the sidebar, or select an existing one to get started.</p>
    </div>
  </div>
`;

const renderProjectMain = (selected) => {
  const todo       = state.tasks.filter(t => t.status === "todo").length;
  const inProgress = state.tasks.filter(t => t.status === "in_progress").length;
  const done       = state.tasks.filter(t => t.status === "done").length;

  return `
    <div class="content-header">
      <div class="content-header-info">
        <h2>${esc(selected.project.name)}</h2>
        <p>${esc(selected.project.description || "No description")} · Your role: <strong>${esc(roleLabel(selected.role))}</strong></p>
      </div>
    </div>

    <nav class="tab-bar">
      ${[
        ["tasks",   "Tasks",   state.tasks.length,   svgTasks()],
        ["notes",   "Notes",   state.notes.length,   svgNotes()],
        ["members", "Members", state.members.length, svgMembers()],
      ].map(([id, label, count, icon]) => `
        <button class="tab-btn ${state.selectedTab === id ? "active" : ""}"
          data-action="tab" data-tab="${id}">
          ${icon} ${label}
          <span class="tab-count">${count}</span>
        </button>`).join("")}
    </nav>

    <div class="tab-content">
      ${renderNotice()}
      ${state.selectedTab === "tasks"
        ? renderTasksTab(todo, inProgress, done)
        : state.selectedTab === "notes"
        ? renderNotesTab()
        : renderMembersTab()}
    </div>
  `;
};

/* ── Tasks tab ─────────────────────────────────────────────────────────────── */
const renderTasksTab = (todo, inProgress, done) => `
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-card-label">To Do</div>
      <div class="stat-card-value" style="color:var(--blue)">${todo}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">In Progress</div>
      <div class="stat-card-value" style="color:var(--amber)">${inProgress}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Done</div>
      <div class="stat-card-value" style="color:var(--green)">${done}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Total</div>
      <div class="stat-card-value">${state.tasks.length}</div>
    </div>
  </div>

  <div class="two-pane">
    <div>
      ${state.selectedTask ? renderTaskDetail() : ""}
      <div class="task-list">
        ${state.tasks.length
          ? state.tasks.map(renderTaskItem).join("")
          : `<div class="empty-state">
              ${svgEmpty()}
              <p>No tasks yet. ${canManageTasks() ? "Create the first one →" : "Waiting for tasks to be assigned."}</p>
            </div>`}
      </div>
    </div>

    <div>
      ${canManageTasks() ? renderTaskForm() : `
        <div class="form-panel">
          <div class="form-panel-header">Tasks</div>
          <div class="form-panel-body">
            <p class="text-sm muted">Only admins and project admins can create tasks.</p>
          </div>
        </div>`}
    </div>
  </div>
`;

const renderTaskItem = (task) => `
  <div class="task-item">
    <div class="task-item-body">
      <div class="task-item-title">${esc(task.title)}</div>
      ${task.description ? `<div class="task-item-desc">${esc(task.description)}</div>` : ""}
      <div class="task-item-meta">
        <span class="badge ${task.status}">${esc(statusLabel(task.status))}</span>
        ${task.assignedTo
          ? `<span class="task-item-assignee">
              <div class="avatar" style="width:20px;height:20px;font-size:.6rem">
                ${esc(initials(task.assignedTo.fullName || task.assignedTo.username))}
              </div>
              ${esc(task.assignedTo.fullName || task.assignedTo.username)}
            </span>`
          : `<span class="text-xs muted">Unassigned</span>`}
      </div>
    </div>
    <div class="task-item-actions">
      ${canManageTasks() ? `
        <select class="status-select" data-action="task-status" data-task-id="${task._id}"
          title="Change status">
          ${statuses.map(([v, l]) =>
            `<option value="${v}" ${task.status === v ? "selected" : ""}>${l}</option>`
          ).join("")}
        </select>` : ""}
      <button class="btn sm" data-action="open-task" data-task-id="${task._id}">
        ${svgOpen()} Details
      </button>
      ${canManageTasks()
        ? `<button class="btn sm danger icon" data-action="delete-task" data-task-id="${task._id}" title="Delete task">
            ${svgTrash()}
          </button>`
        : ""}
    </div>
  </div>
`;

const renderTaskDetail = () => {
  const task = state.selectedTask;
  const subtasksDone  = (task.subtasks || []).filter(s => s.isCompleted).length;
  const subtasksTotal = (task.subtasks || []).length;

  return `
    <div class="task-detail" style="margin-bottom:16px">
      <div class="task-detail-header">
        <span class="badge ${task.status}">${esc(statusLabel(task.status))}</span>
        <h3>${esc(task.title)}</h3>
        <button class="btn ghost icon" data-action="close-task" title="Close">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="task-detail-body">
        ${task.description ? `<p class="text-sm muted" style="margin-bottom:12px;line-height:1.6">${esc(task.description)}</p>` : ""}

        ${task.assignedTo ? `
          <div class="flex items-center gap-2" style="margin-bottom:12px">
            <div class="avatar">${esc(initials(task.assignedTo.fullName || task.assignedTo.username))}</div>
            <div>
              <div class="text-sm font-semibold">${esc(task.assignedTo.fullName || task.assignedTo.username)}</div>
              <div class="text-xs muted">Assignee</div>
            </div>
          </div>` : ""}

        ${(task.attachments || []).length ? `
          <div class="attachment-list">
            ${task.attachments.map(f =>
              `<a class="attachment-link" href="${esc(f.url)}" target="_blank" rel="noreferrer">
                ${svgAttach()} ${esc(f.originalName || "Attachment")}
              </a>`
            ).join("")}
          </div>` : ""}

        <div class="divider"></div>

        <div class="flex items-center gap-2" style="margin-bottom:10px">
          <h4>Subtasks</h4>
          ${subtasksTotal
            ? `<span class="text-xs muted">${subtasksDone}/${subtasksTotal} done</span>`
            : ""}
        </div>

        <div class="subtask-list">
          ${(task.subtasks || []).length
            ? task.subtasks.map(sub => `
                <div class="subtask-item">
                  <input type="checkbox" ${sub.isCompleted ? "checked" : ""}
                    data-action="subtask-toggle" data-subtask-id="${sub._id}" />
                  <span style="${sub.isCompleted ? "text-decoration:line-through;color:var(--text-3)" : ""}">
                    ${esc(sub.title)}
                  </span>
                  ${canManageTasks()
                    ? `<button class="btn sm danger icon" data-action="delete-subtask"
                        data-subtask-id="${sub._id}" title="Delete subtask">${svgTrash()}</button>`
                    : ""}
                </div>`).join("")
            : `<p class="text-sm muted">No subtasks yet.</p>`}
        </div>

        ${canManageTasks() ? `
          <form class="form-grid" data-form="subtask" style="margin-top:14px;gap:8px">
            <input type="hidden" name="taskId" value="${task._id}" />
            <div style="display:flex;gap:8px">
              <input class="field input" name="title" placeholder="Add a subtask…"
                required style="flex:1;height:34px;padding:0 10px;border:1px solid var(--border);
                border-radius:var(--radius-sm);outline:none" />
              <button class="btn primary sm" type="submit">Add</button>
            </div>
          </form>` : ""}
      </div>
    </div>
  `;
};

const renderTaskForm = () => `
  <div class="form-panel">
    <div class="form-panel-header">
      ${svgPlus()} New task
    </div>
    <div class="form-panel-body">
      <form class="form-grid" data-form="task" style="gap:12px">
        <div class="field">
          <span>Title <span class="required">*</span></span>
          <input name="title" placeholder="Task title" required />
        </div>
        <div class="field">
          <span>Description</span>
          <textarea name="description" placeholder="What needs to be done?" style="height:72px"></textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <span>Assign to</span>
            <select name="assignedTo">
              <option value="">Unassigned</option>
              ${state.members.map(m =>
                `<option value="${m.user._id}">${esc(m.user.fullName || m.user.username)}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <span>Status</span>
            <select name="status">
              ${statuses.map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <span>Attachments</span>
          <input name="attachments" type="file" multiple style="height:auto;padding:6px 10px" />
        </div>
        <button class="btn primary full" type="submit">
          ${svgPlus()} Create task
        </button>
      </form>
    </div>
  </div>
`;

/* ── Notes tab ─────────────────────────────────────────────────────────────── */
const renderNotesTab = () => `
  <div class="two-pane">
    <div>
      <div class="note-list">
        ${state.notes.length
          ? state.notes.map(n => `
              <div class="note-item">
                <div class="note-content">${esc(n.content)}</div>
                <div class="note-meta">
                  <div class="flex items-center gap-2">
                    <div class="avatar" style="width:20px;height:20px;font-size:.6rem">
                      ${esc(initials(n.createdBy?.fullName || n.createdBy?.username))}
                    </div>
                    <span>${esc(n.createdBy?.fullName || n.createdBy?.username || "")}</span>
                  </div>
                  ${canAdminProject()
                    ? `<button class="btn sm danger" data-action="delete-note" data-note-id="${n._id}">
                        ${svgTrash()} Delete
                      </button>`
                    : ""}
                </div>
              </div>`).join("")
          : `<div class="empty-state">
              ${svgEmpty()}
              <p>No notes yet. ${canAdminProject() ? "Add the first one →" : "Only admins can add notes."}</p>
            </div>`}
      </div>
    </div>

    <div>
      ${canAdminProject() ? `
        <div class="form-panel">
          <div class="form-panel-header">${svgPlus()} Add note</div>
          <div class="form-panel-body">
            <form class="form-grid" data-form="note" style="gap:10px">
              <div class="field">
                <textarea name="content" placeholder="Write a note for your team…"
                  required style="height:100px"></textarea>
              </div>
              <button class="btn primary full" type="submit">Add note</button>
            </form>
          </div>
        </div>` : `
        <div class="form-panel">
          <div class="form-panel-body">
            <p class="text-sm muted">Only project admins can add notes.</p>
          </div>
        </div>`}
    </div>
  </div>
`;

/* ── Members tab ────────────────────────────────────────────────────────────── */
const renderMembersTab = () => `
  <div class="two-pane">
    <div>
      <div class="member-list">
        ${state.members.map(m => `
          <div class="member-item">
            <div class="avatar lg">${esc(initials(m.user.fullName || m.user.username))}</div>
            <div class="member-info">
              <div class="member-name">${esc(m.user.fullName || m.user.username)}</div>
              <div class="member-email">${esc(m.user.email || "")}</div>
            </div>
            <div class="member-actions">
              <span class="badge ${m.role}">${esc(roleLabel(m.role))}</span>
              ${canAdminProject() ? `
                <select class="status-select" data-action="member-role" data-user-id="${m.user._id}">
                  ${roles.map(([v,l]) =>
                    `<option value="${v}" ${m.role===v?"selected":""}>${l}</option>`
                  ).join("")}
                </select>
                <button class="btn sm danger icon" data-action="delete-member"
                  data-user-id="${m.user._id}" title="Remove member">${svgTrash()}</button>
              ` : ""}
            </div>
          </div>`).join("") || `
        <div class="empty-state">
          ${svgEmpty()}
          <p>No members yet.</p>
        </div>`}
      </div>
    </div>

    <div>
      ${canAdminProject() ? `
        <div class="form-panel">
          <div class="form-panel-header">${svgPlus()} Add member</div>
          <div class="form-panel-body">
            <form class="form-grid" data-form="member" style="gap:10px">
              <div class="field">
                <span>Email address <span class="required">*</span></span>
                <input name="email" type="email" placeholder="colleague@example.com" required />
              </div>
              <div class="field">
                <span>Role</span>
                <select name="role">
                  ${roles.map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}
                </select>
              </div>
              <button class="btn primary full" type="submit">Add member</button>
            </form>
          </div>
        </div>` : `
        <div class="form-panel">
          <div class="form-panel-body">
            <p class="text-sm muted">Only project admins can manage members.</p>
          </div>
        </div>`}
    </div>
  </div>
`;

/* ── SVG icons ──────────────────────────────────────────────────────────────── */
const svg = (d, size = 14) =>
  `<svg width="${size}" height="${size}" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    style="flex-shrink:0">${d}</svg>`;

const svgTasks   = () => svg(`<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>`);
const svgNotes   = () => svg(`<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>`);
const svgMembers = () => svg(`<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>`);
const svgTrash   = () => svg(`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>`);
const svgOpen    = () => svg(`<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`);
const svgPlus    = () => svg(`<path d="M12 4v16m8-8H4"/>`);
const svgAttach  = () => svg(`<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>`, 12);
const svgEmpty   = () => svg(`<circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>`, 40);

/* ── Main render ────────────────────────────────────────────────────────────── */
const render = () => {
  if (state.resetToken && !state.user) { renderResetPassword(); return; }
  if (!state.token || !state.user)     { renderAuth();         return; }
  renderDashboard();
};

/* ── Auth handler ───────────────────────────────────────────────────────────── */
const handleAuth = async (form) => {
  const data = Object.fromEntries(new FormData(form));

  if (form.dataset.form === "register") {
    const payload = {
      ...data,
      email:    (data.email    || "").trim().toLowerCase(),
      username: (data.username || "").trim().toLowerCase(),
      fullName: (data.fullName || "").trim(),
    };
    await request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.authMode = "login";
    setNotice({ message: "Account created! Check your inbox for the verification link." });
    render();
    return;
  }

  const identity = data.identity.trim().toLowerCase();
  state.lastLoginEmail = identity;
  const payload = identity.includes("@")
    ? { email: identity,    password: data.password }
    : { username: identity, password: data.password };

  const response = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  state.token = response.accessToken;
  state.user  = response.user;
  localStorage.setItem("project_camp_token", state.token);
  await loadProjects();
  await loadProjectData();
};

/* ── Event: submit ──────────────────────────────────────────────────────────── */
document.addEventListener("submit", async (e) => {
  const form = e.target.closest("form");
  if (!form) return;
  e.preventDefault();
  setNotice();

  // Disable submit button while loading
  const btn = form.querySelector('[type=submit]');
  const origText = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = "…"; }

  try {
    const type = form.dataset.form;
    const data = Object.fromEntries(new FormData(form));

    if (type === "login" || type === "register") {
      await handleAuth(form);
    }

    if (type === "forgot-password") {
      await request("/api/v1/auth/forgot-password", {
        method: "POST", body: JSON.stringify(data),
      });
      setNotice({ message: "If an account exists, a reset link has been sent." });
    }

    if (type === "reset-password") {
      await request(`/api/v1/auth/reset-password/${state.resetToken}`, {
        method: "POST", body: JSON.stringify(data),
      });
      state.resetToken = "";
      state.authMode = "login";
      history.replaceState({}, "", "/");
      setNotice({ message: "Password updated. You can sign in now." });
    }

    if (type === "project") {
      await request("/api/v1/projects", {
        method: "POST", body: JSON.stringify(data),
      });
      setNotice({ message: "Project created." });
      await refreshProject();
    }

    if (type === "task") {
      await request(`/api/v1/tasks/${state.selectedProjectId}`, {
        method: "POST", body: new FormData(form),
      });
      setNotice({ message: "Task created." });
      await refreshProject();
    }

    if (type === "subtask") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${data.taskId}/subtasks`,
        { method: "POST", body: JSON.stringify({ title: data.title }) }
      );
      setNotice({ message: "Subtask added." });
      await loadTaskDetail(data.taskId);
      await loadProjectData();
    }

    if (type === "note") {
      await request(`/api/v1/notes/${state.selectedProjectId}`, {
        method: "POST", body: JSON.stringify(data),
      });
      setNotice({ message: "Note added." });
      await refreshProject();
    }

    if (type === "member") {
      await request(`/api/v1/projects/${state.selectedProjectId}/members`, {
        method: "POST", body: JSON.stringify(data),
      });
      setNotice({ message: "Member added." });
      await refreshProject();
    }

    render();
  } catch (err) {
    setNotice({ error: err.message });
    render();
  } finally {
    if (btn && origText) { btn.disabled = false; btn.innerHTML = origText; }
  }
});

/* ── Event: click ───────────────────────────────────────────────────────────── */
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const { action } = target.dataset;

  try {
    setNotice();

    if (action === "auth-mode") {
      state.authMode = target.dataset.mode; render(); return;
    }

    if (action === "resend-verification") {
      setNotice({ message: "Check your spam/junk folder. If still missing, use the reset-password form." });
      render(); return;
    }

    if (action === "logout") {
      await request("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("project_camp_token");
      localStorage.removeItem("project_camp_project");
      Object.assign(state, {
        token: "", user: null, projects: [], selectedProjectId: "", selectedTask: null,
      });
      render(); return;
    }

    if (action === "select-project") {
      state.selectedProjectId = target.dataset.projectId;
      state.selectedTask = null; state.selectedTaskId = "";
      localStorage.setItem("project_camp_project", state.selectedProjectId);
      await loadProjectData(); render(); return;
    }

    if (action === "tab") {
      state.selectedTab = target.dataset.tab; render(); return;
    }

    if (action === "open-task") {
      await loadTaskDetail(target.dataset.taskId); render(); return;
    }

    if (action === "close-task") {
      state.selectedTask = null; state.selectedTaskId = ""; render(); return;
    }

    if (action === "delete-task") {
      if (!confirm("Delete this task and all its subtasks?")) return;
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${target.dataset.taskId}`,
        { method: "DELETE" }
      );
      state.selectedTask = null;
      setNotice({ message: "Task deleted." });
      await refreshProject(); return;
    }

    if (action === "delete-subtask") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/st/${target.dataset.subtaskId}`,
        { method: "DELETE" }
      );
      await loadTaskDetail(state.selectedTaskId);
      await loadProjectData(); render(); return;
    }

    if (action === "delete-note") {
      if (!confirm("Delete this note?")) return;
      await request(
        `/api/v1/notes/${state.selectedProjectId}/n/${target.dataset.noteId}`,
        { method: "DELETE" }
      );
      setNotice({ message: "Note deleted." });
      await refreshProject(); return;
    }

    if (action === "delete-member") {
      if (!confirm("Remove this member from the project?")) return;
      await request(
        `/api/v1/projects/${state.selectedProjectId}/members/${target.dataset.userId}`,
        { method: "DELETE" }
      );
      setNotice({ message: "Member removed." });
      await refreshProject(); return;
    }

  } catch (err) {
    setNotice({ error: err.message }); render();
  }
});

/* ── Event: change ──────────────────────────────────────────────────────────── */
document.addEventListener("change", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const { action } = target.dataset;

  try {
    setNotice();

    if (action === "task-status") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/t/${target.dataset.taskId}`,
        { method: "PUT", body: JSON.stringify({ status: target.value }) }
      );
      await refreshProject(); return;
    }

    if (action === "subtask-toggle") {
      await request(
        `/api/v1/tasks/${state.selectedProjectId}/st/${target.dataset.subtaskId}`,
        { method: "PUT", body: JSON.stringify({ isCompleted: target.checked }) }
      );
      await loadTaskDetail(state.selectedTaskId); render(); return;
    }

    if (action === "member-role") {
      await request(
        `/api/v1/projects/${state.selectedProjectId}/members/${target.dataset.userId}`,
        { method: "PUT", body: JSON.stringify({ role: target.value }) }
      );
      await refreshProject(); return;
    }
  } catch (err) {
    setNotice({ error: err.message }); render();
  }
});

boot();
