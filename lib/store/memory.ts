import type { AgentTask, StoredProject } from "@/lib/ai/types";

const globalForStore = globalThis as unknown as {
  animeProjects?: Map<string, StoredProject>;
  animeTasks?: Map<string, AgentTask>;
};

export const projectStore = globalForStore.animeProjects ?? new Map<string, StoredProject>();
export const taskStore = globalForStore.animeTasks ?? new Map<string, AgentTask>();

globalForStore.animeProjects = projectStore;
globalForStore.animeTasks = taskStore;

export function saveProject(project: StoredProject) {
  project.updatedAt = new Date().toISOString();
  projectStore.set(project.id, project);
  return project;
}

export function getProject(projectId: string) {
  const project = projectStore.get(projectId);
  if (!project) throw new Error(`项目不存在：${projectId}`);
  return project;
}

export function saveTask(task: AgentTask) {
  task.updatedAt = new Date().toISOString();
  taskStore.set(task.id, task);

  const project = projectStore.get(task.projectId);
  if (project) {
    const index = project.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) project.tasks[index] = task;
    else project.tasks.push(task);
    saveProject(project);
  }

  return task;
}

export function saveTasks(tasks: AgentTask[]) {
  for (const task of tasks) saveTask(task);
  return tasks;
}

export function replaceProjectTasks(projectId: string, tasks: AgentTask[]) {
  const project = getProject(projectId);
  for (const task of project.tasks) taskStore.delete(task.id);
  project.tasks = [];
  saveProject(project);
  for (const task of tasks) saveTask(task);
  return getProject(projectId);
}

export function removeProjectTasksByType(projectId: string, types: string[]) {
  const project = getProject(projectId);
  const removeSet = new Set(types);
  const kept = project.tasks.filter((task) => !removeSet.has(task.type));
  for (const task of project.tasks) {
    if (removeSet.has(task.type)) taskStore.delete(task.id);
  }
  project.tasks = kept;
  saveProject(project);
  return project;
}

export function getTask(taskId: string) {
  const task = taskStore.get(taskId);
  if (!task) throw new Error(`任务不存在：${taskId}`);
  return task;
}
