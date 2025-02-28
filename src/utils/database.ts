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
        db.createObjectStore("todos", {
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
    });
  }

  async getAllTodos() {
    if (!this.db) await this.initDatabase();
    const todos = await this.db!.getAll("todos");
    return todos.filter(todo => !todo.deleted);
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

  async deleteTodo(id: number) {
    if (!this.db) await this.initDatabase();
    const todo = await this.db!.get("todos", id);
    if (!todo) throw new Error("Todo not found");

    // Soft delete - mark as deleted and update sync status
    return this.db!.put("todos", {
      ...todo,
      deleted: true,
      lastAction: 'delete' as const,
      updatedAt: Date.now(),
      syncedAt: undefined, // Reset sync status to trigger sync
    });
  }

  async markTodoSynced(id: number) {
    return this.updateTodo(id, { 
      syncedAt: Date.now(),
      lastAction: undefined // Clear last action after successful sync
    });
  }

  // New method to permanently remove todos that have been synced and deleted
  async cleanupDeletedTodos() {
    if (!this.db) await this.initDatabase();
    const todos = await this.db!.getAll("todos");
    const deletedAndSynced = todos.filter(todo => 
      todo.deleted && todo.syncedAt && todo.lastAction !== 'delete'
    );
    
    for (const todo of deletedAndSynced) {
      await this.db!.delete("todos", todo.id!);
    }
  }
}

export const dbService = new DatabaseService();
export type { TodoItem };
