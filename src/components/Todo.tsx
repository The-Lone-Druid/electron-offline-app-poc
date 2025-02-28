import React, { useState, useEffect } from 'react';
import { dbService, TodoItem } from '../utils/database';
import { syncService } from '../utils/sync';
import '../styles/global.css';

type SyncStatus = {
  message: string;
  type: 'info' | 'error' | 'success';
};

export const Todo: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isOnline, setIsOnline] = useState(syncService.getOnlineStatus());
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    loadTodos();
    
    // Listen for online/offline status changes
    const handleOnlineStatus = (data: unknown) => {
      const isOnline = typeof data === 'boolean' ? data : navigator.onLine;
      setIsOnline(isOnline);
      setSyncStatus({
        message: isOnline ? 'Connected' : 'Working offline',
        type: isOnline ? 'success' : 'info'
      });
    };

    // Listen for sync events
    const handleSyncStart = () => {
      setSyncStatus({ message: 'Syncing...', type: 'info' });
    };

    const handleSyncComplete = (data: unknown) => {
      const message = data && typeof data === 'object' && 'message' in data
        ? String(data.message)
        : 'Sync completed';
      
      setSyncStatus({ 
        message, 
        type: 'success' 
      });
      loadTodos(); // Refresh todos after successful sync
    };

    const handleSyncError = (data: unknown) => {
      let message = 'Sync failed';
      
      if (data && typeof data === 'object') {
        if ('message' in data) {
          message = String(data.message);
        } else if ('error' in data && data.error instanceof Error) {
          message = data.error.message;
        }
      }

      setSyncStatus({ 
        message, 
        type: 'error' 
      });
    };

    // Add event listeners
    syncService.addEventListener('onlineStatusChange', handleOnlineStatus);
    syncService.addEventListener('syncStart', handleSyncStart);
    syncService.addEventListener('syncComplete', handleSyncComplete);
    syncService.addEventListener('syncError', handleSyncError);

    // Initial online status check
    handleOnlineStatus(navigator.onLine);

    return () => {
      // Remove event listeners
      syncService.removeEventListener('onlineStatusChange', handleOnlineStatus);
      syncService.removeEventListener('syncStart', handleSyncStart);
      syncService.removeEventListener('syncComplete', handleSyncComplete);
      syncService.removeEventListener('syncError', handleSyncError);
    };
  }, []);

  const loadTodos = async () => {
    try {
      const allTodos = await dbService.getAllTodos();
      setTodos(allTodos);
    } catch (error) {
      console.error('Failed to load todos:', error);
      setSyncStatus({
        message: 'Failed to load todos',
        type: 'error'
      });
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      await dbService.addTodo({
        title: newTodoTitle,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewTodoTitle('');
      await loadTodos();
      
      // Trigger sync if online
      if (isOnline) {
        syncService.syncData();
      }
    } catch (error) {
      console.error('Failed to add todo:', error);
      setSyncStatus({
        message: 'Failed to add todo',
        type: 'error'
      });
    }
  };

  const handleToggleTodo = async (id: number) => {
    try {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        // Update the todo with all necessary fields
        await dbService.updateTodo(id, {
          completed: !todo.completed,
          updatedAt: Date.now(),
          syncedAt: undefined, // Reset sync status to trigger sync
          lastAction: 'update'
        });
        
        await loadTodos(); // Refresh the list
        
        // Trigger sync if online
        if (isOnline) {
          syncService.syncData();
        }
      }
    } catch (error) {
      console.error('Failed to update todo:', error);
      setSyncStatus({
        message: 'Failed to update todo',
        type: 'error'
      });
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      await dbService.deleteTodo(id);
      await loadTodos();
      
      // Trigger sync if online
      if (isOnline) {
        syncService.syncData();
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
      setSyncStatus({
        message: 'Failed to delete todo',
        type: 'error'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Todo List</h1>
            <div className="flex items-center space-x-4">
              <div className={`status-badge ${isOnline ? 'status-badge-success' : 'status-badge-warning'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </div>
              {syncStatus && (
                <div className={`status-badge ${
                  syncStatus.type === 'error'
                    ? 'status-badge-error'
                    : syncStatus.type === 'success'
                    ? 'status-badge-success'
                    : 'status-badge-info'
                }`}>
                  {syncStatus.message}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleAddTodo} className="mb-6">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="input flex-1"
              />
              <button type="submit" className="btn btn-primary">
                Add Todo
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {todos.map((todo) => (
              <div key={todo.id} className="todo-item">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo.id!)}
                    className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className={`text-lg ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {todo.title}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  {!todo.syncedAt && (
                    <span className="status-badge status-badge-warning">
                      Not synced
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteTodo(todo.id!)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {todos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No todos yet. Add one above!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
