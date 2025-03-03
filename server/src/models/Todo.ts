import mongoose, { Document, Schema } from 'mongoose';

// Plain object type without Document methods
export type TodoDoc = {
  _id?: string | mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  deleted?: boolean;
}

export interface ITodo extends Document, Omit<TodoDoc, '_id'> {}

const TodoSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  syncedAt: {
    type: Date,
    default: Date.now
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model<ITodo>('Todo', TodoSchema); 