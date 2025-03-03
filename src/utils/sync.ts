import { dbService, TodoItem } from "./database";

const API_BASE_URL = "http://localhost:5000/api";

type SyncEventType =
  | "syncStart"
  | "syncComplete"
  | "syncError"
  | "onlineStatusChange";
type SyncEventListener = (data?: unknown) => void;

class SyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private eventListeners: Map<SyncEventType, SyncEventListener[]> = new Map();
  private retryTimeout: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryCount = 0;

  constructor() {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Initial sync when service is created
    if (document.visibilityState === "visible" && navigator.onLine) {
      console.log("Initial sync on service creation...");
      this.syncData();
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && this.isOnline) {
      console.log("App became visible, checking for unsynced todos...");
      this.syncData();
    }
  };

  addEventListener(event: SyncEventType, listener: SyncEventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(listener);
  }

  removeEventListener(event: SyncEventType, listener: SyncEventListener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      this.eventListeners.set(
        event,
        listeners.filter((l) => l !== listener)
      );
    }
  }

  private emitEvent(event: SyncEventType, data?: unknown) {
    this.eventListeners.get(event)?.forEach((listener) => listener(data));
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.emitEvent("onlineStatusChange", true);
    this.retryCount = 0;
    this.syncData();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.emitEvent("onlineStatusChange", false);
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  };

  private async sendToServer(todos: TodoItem[]): Promise<boolean> {
    if (!this.isOnline) return false;

    try {
      console.log("Sending todos to server:", todos);
      const response = await fetch(`${API_BASE_URL}/todos/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          todos: todos.map((todo) => ({
            _id: todo.serverId,
            title: todo.title,
            completed: todo.completed,
            deleted: todo.deleted,
            action: todo.lastAction,
            createdAt: new Date(todo.createdAt).toISOString(),
            updatedAt: new Date(todo.updatedAt).toISOString(),
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server returned error:", errorData);
        throw new Error(
          `Sync failed: ${errorData.message || response.statusText}`
        );
      }

      const { todos: serverTodos } = await response.json();
      console.log("Received synced todos from server:", serverTodos);

      if (!Array.isArray(serverTodos)) {
        throw new Error("Invalid response format from server");
      }

      // Get all local todos for comparison
      const allLocalTodos = await dbService.getAllTodos(true);

      // Update local database with synced todos
      for (const serverTodo of serverTodos) {
        const localTodo = allLocalTodos.find(
          (t) =>
            t.serverId === serverTodo._id ||
            (!t.serverId && t.title === serverTodo.title)
        );

        if (localTodo) {
          if (serverTodo.deleted) {
            // Server confirms deletion
            await dbService.markTodoDeleted(localTodo.id!, true);
          } else if (localTodo.deleted) {
            // Local delete wasn't reflected in server response
            await dbService.markTodoDeleted(localTodo.id!, false);
          } else {
            // Update existing todo
            await dbService.updateTodo(localTodo.id!, {
              serverId: serverTodo._id,
              title: serverTodo.title,
              completed: serverTodo.completed,
              createdAt: new Date(serverTodo.createdAt).getTime(),
              updatedAt: new Date(serverTodo.updatedAt).getTime(),
              syncedAt: new Date(serverTodo.syncedAt).getTime(),
              lastAction: undefined,
              syncError: undefined,
            });
          }
        } else {
          // New todo from server
          await dbService.addTodo({
            serverId: serverTodo._id,
            title: serverTodo.title,
            completed: serverTodo.completed,
            createdAt: new Date(serverTodo.createdAt).getTime(),
            updatedAt: new Date(serverTodo.updatedAt).getTime(),
            syncedAt: new Date(serverTodo.syncedAt).getTime(),
            localOnly: false,
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to sync todos:", error);
      // Mark all attempted todos with sync error
      for (const todo of todos) {
        if (todo.id) {
          await dbService.updateTodo(todo.id, {
            syncError: error instanceof Error ? error.message : "Sync failed",
          });
        }
      }
      throw error;
    }
  }

  async syncData() {
    if (!this.isOnline || this.syncInProgress) return;

    try {
      this.syncInProgress = true;
      this.emitEvent("syncStart");

      const unsyncedTodos = await dbService.getUnsyncedTodos();
      console.log("Found unsynced todos:", unsyncedTodos);

      if (unsyncedTodos.length === 0) {
        this.emitEvent("syncComplete", {
          message: "No items to sync",
        });
        return;
      }

      const synced = await this.sendToServer(unsyncedTodos);

      if (!synced && this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.retryTimeout = setTimeout(() => {
          this.syncData();
        }, Math.min(1000 * Math.pow(2, this.retryCount), 30000));
        this.emitEvent("syncError", {
          message: `Failed to sync ${unsyncedTodos.length} items. Retrying...`,
          retryCount: this.retryCount,
        });
      } else if (synced) {
        this.retryCount = 0;
        this.emitEvent("syncComplete", {
          message: `Successfully synced ${unsyncedTodos.length} items`,
        });
      }
    } catch (error) {
      console.error("Failed to sync data:", error);
      this.emitEvent("syncError", {
        message: error instanceof Error ? error.message : "Sync failed",
        retryCount: this.retryCount,
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  getOnlineStatus() {
    return this.isOnline;
  }
}

const syncService = new SyncService();
export { syncService };
export type { SyncEventType, SyncEventListener };
export default syncService;
