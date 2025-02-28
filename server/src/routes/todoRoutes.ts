import { Router } from 'express';
import {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  syncTodos
} from '../controllers/todoController';

const router = Router();

router.get('/', getTodos);
router.post('/', createTodo);
router.put('/:id', updateTodo);
router.delete('/:id', deleteTodo);
router.post('/sync', syncTodos);

export default router; 