import { Request, Response } from "express";
import Todo, { TodoDoc } from "../models/Todo";

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

export const syncTodos = async (req: Request, res: Response) => {
  try {
    console.log("Received sync request with data:", req.body);
    const { todos } = req.body;

    if (!Array.isArray(todos)) {
      console.error("Invalid todos data received:", todos);
      return res.status(400).json({ message: "Invalid todos data" });
    }

    const syncedTodos: TodoDoc[] = [];

    for (const todo of todos) {
      console.log("Processing todo:", todo);

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
          syncedTodos.push(newTodo.toObject());
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
              syncedTodos.push(updatedTodo.toObject());
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
                ...deletedTodo.toObject(),
                deleted: true,
                syncedAt: new Date(),
              });
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
              syncedTodos.push(existingTodo.toObject());
            }
          } else {
            // Create new todo
            newTodo = new Todo({
              title: todo.title,
              completed: todo.completed,
              syncedAt: new Date(),
            });
            await newTodo.save();
            syncedTodos.push(newTodo.toObject());
          }
      }
    }

    console.log("Sync completed. Sending response:", syncedTodos);
    res.json(syncedTodos);
  } catch (error) {
    console.error("Error in syncTodos:", error);
    res.status(400).json({ message: "Error syncing todos", error });
  }
};
