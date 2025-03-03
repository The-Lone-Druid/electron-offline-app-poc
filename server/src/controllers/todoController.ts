import { Request, Response } from "express";
import Todo, { ITodo, TodoDoc } from "../models/Todo";

export const getTodos = async (req: Request, res: Response) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: "Error fetching todos", error });
  }
};

export const createTodo = async (req: Request, res: Response) => {
  try {
    const { title, completed } = req.body;
    const todo = new Todo({
      title,
      completed,
      syncedAt: new Date(),
    });
    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    res.status(400).json({ message: "Error creating todo", error });
  }
};

export const updateTodo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const update = {
      ...req.body,
      syncedAt: new Date(),
    };
    const todo = await Todo.findByIdAndUpdate(id, update, { new: true });
    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }
    res.json(todo);
  } catch (error) {
    res.status(400).json({ message: "Error updating todo", error });
  }
};

export const deleteTodo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findByIdAndDelete(id);
    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }
    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Error deleting todo", error });
  }
};

// Helper function to convert Mongoose document to TodoDoc
const toTodoDoc = (doc: ITodo): TodoDoc => {
  const obj = doc.toObject();
  return {
    _id: obj._id.toString(),
    title: obj.title,
    completed: obj.completed,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    syncedAt: obj.syncedAt,
    deleted: obj.deleted,
  };
};

export const syncTodos = async (req: Request, res: Response) => {
  try {
    console.log("Received sync request with data:", req.body);
    const { todos } = req.body;

    if (!Array.isArray(todos)) {
      console.error("Invalid todos data received:", todos);
      return res.status(400).json({ message: "Invalid todos data" });
    }

    const syncedTodos: TodoDoc[] = [];
    const errors: { id?: string; error: string }[] = [];

    for (const todo of todos) {
      console.log("Processing todo:", todo);

      try {
        let newTodo;
        let updatedTodo;
        let deletedTodo;
        let existingTodo;

        switch (todo.action) {
          case "create":
            // Create new todo
            console.log("Creating new todo:", todo);
            newTodo = new Todo({
              title: todo.title,
              completed: todo.completed,
              createdAt: new Date(todo.createdAt),
              updatedAt: new Date(todo.updatedAt),
              syncedAt: new Date(),
            });
            await newTodo.save();
            console.log("New todo created:", newTodo);
            syncedTodos.push(toTodoDoc(newTodo));
            break;

          case "update":
            // Update existing todo
            if (todo._id) {
              console.log("Updating existing todo:", todo._id);
              updatedTodo = await Todo.findByIdAndUpdate(
                todo._id,
                {
                  title: todo.title,
                  completed: todo.completed,
                  updatedAt: new Date(todo.updatedAt),
                  syncedAt: new Date(),
                },
                { new: true }
              );

              if (updatedTodo) {
                console.log("Todo updated successfully:", updatedTodo);
                syncedTodos.push(toTodoDoc(updatedTodo));
              } else {
                errors.push({
                  id: todo._id,
                  error: "Todo not found for update",
                });
              }
            }
            break;

          case "delete":
            // Delete todo
            if (todo._id) {
              console.log("Deleting todo:", todo._id);
              deletedTodo = await Todo.findByIdAndDelete(todo._id);
              if (deletedTodo) {
                console.log("Todo deleted successfully:", deletedTodo);
                syncedTodos.push({
                  ...toTodoDoc(deletedTodo),
                  deleted: true,
                  syncedAt: new Date(),
                });
              } else {
                // If todo doesn't exist, consider it successfully deleted
                const deletedTodoDoc: TodoDoc = {
                  _id: todo._id,
                  title: todo.title,
                  completed: todo.completed,
                  deleted: true,
                  syncedAt: new Date(),
                  createdAt: new Date(todo.createdAt),
                  updatedAt: new Date(todo.updatedAt),
                };
                syncedTodos.push(deletedTodoDoc);
              }
            }
            break;

          default:
            // Handle todos without action (backward compatibility)
            if (todo._id) {
              // Update existing todo
              existingTodo = await Todo.findByIdAndUpdate(
                todo._id,
                {
                  title: todo.title,
                  completed: todo.completed,
                  syncedAt: new Date(),
                },
                { new: true, upsert: true }
              );
              if (existingTodo) {
                syncedTodos.push(toTodoDoc(existingTodo));
              }
            } else {
              // Create new todo
              newTodo = new Todo({
                title: todo.title,
                completed: todo.completed,
                syncedAt: new Date(),
              });
              await newTodo.save();
              syncedTodos.push(toTodoDoc(newTodo));
            }
        }
      } catch (todoError) {
        console.error("Error processing todo:", todo, todoError);
        errors.push({
          id: todo._id,
          error:
            todoError instanceof Error ? todoError.message : "Unknown error",
        });
      }
    }

    console.log("Sync completed. Sending response:", { syncedTodos, errors });
    res.json({
      todos: syncedTodos,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in syncTodos:", error);
    res.status(400).json({ message: "Error syncing todos", error });
  }
};
