import { openDB, IDBPDatabase } from "idb";

interface TodoItem {
  id?: number;
  serverId?: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  deleted?: boolean;
  lastAction?: 'create' | 'update' | 'delete';
  localOnly?: boolean; // Track if item exists only locally
  serverDeleted?: boolean; // Track if item was deleted on server
  syncError?: string; // Track sync errors
}

declare module "idb" {
  interface DBSchema {
    todos: {
      key: number;
      value: TodoItem;
    };
  }
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

class DatabaseService {
  private db: IDBPDatabase | null = null;

  async initDatabase() {
    this.db = await openDB("offline-app-db", 1, {
      upgrade(db) {
        const todoStore = db.createObjectStore("todos", {
          keyPath: "id",
          autoIncrement: true,
        });
      },
    });
  }

  async addTodo(todo: Omit<TodoItem, "id">) {
    if (!this.db) await this.initDatabase();
    const timestamp = Date.now();
    return this.db!.add("todos", {
      ...todo,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncedAt: undefined,
      deleted: false,
      lastAction: 'create' as const,
      localOnly: true
    });
  }

  async getAllTodos(includeDeleted = false) {
    if (!this.db) await this.initDatabase();
    const todos = await this.db!.getAll("todos");
    return includeDeleted ? todos : todos.filter(todo => !todo.deleted);
  }

  async getUnsyncedTodos() {
    if (!this.db) await this.initDatabase();
    const allTodos = await this.db!.getAll("todos");
    const unsyncedTodos = allTodos.filter(
      (todo) => todo.syncedAt === undefined || 
                (todo.deleted && todo.lastAction === 'delete') ||
                (todo.lastAction === 'update' && todo.updatedAt > (todo.syncedAt || 0))
    );
    console.log("Unsynced todos found:", unsyncedTodos.length);
    return unsyncedTodos;
  }

  async updateTodo(id: number, updates: Partial<TodoItem>) {
    if (!this.db) await this.initDatabase();
    const todo = await this.db!.get("todos", id);
    if (!todo) throw new Error("Todo not found");

    const updatedTodo = {
      ...todo,
      ...updates,
      id: todo.id,
      serverId: updates.serverId || todo.serverId,
      updatedAt: Date.now(),
      lastAction: updates.lastAction || 'update' as const,
      createdAt: isDate(updates.createdAt)
        ? updates.createdAt.getTime()
        : updates.createdAt || todo.createdAt,
      syncedAt: updates.syncedAt
        ? new Date(updates.syncedAt).getTime()
        : todo.syncedAt,
    };

    return this.db!.put("todos", updatedTodo);
  }

  async markTodoDeleted(id: number, isDeleted: boolean) {
    return this.updateTodo(id, {
      deleted: isDeleted,
      lastAction: isDeleted ? 'delete' as const : undefined,
      syncedAt: isDeleted ? undefined : Date.now(),
      serverDeleted: isDeleted
    });
  }

  async deleteTodo(id: number) {
    return this.markTodoDeleted(id, true);
  }

  async permanentlyDeleteTodo(id: number) {
    if (!this.db) await this.initDatabase();
    return this.db!.delete("todos", id);
  }

  async markTodoSynced(id: number) {
    return this.updateTodo(id, { 
      syncedAt: Date.now(),
      lastAction: undefined,
      localOnly: false,
      syncError: undefined
    });
  }

  async cleanupDeletedTodos() {
    if (!this.db) await this.initDatabase();
    const todos = await this.db!.getAll("todos");
    const deletedAndSynced = todos.filter(todo => 
      todo.deleted && 
      todo.serverDeleted && 
      todo.syncedAt && 
      !todo.syncError
    );
    
    for (const todo of deletedAndSynced) {
      await this.permanentlyDeleteTodo(todo.id!);
    }
  }
}

export const dbService = new DatabaseService();
export type { TodoItem };
