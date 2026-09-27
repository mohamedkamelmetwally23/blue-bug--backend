import { model, Schema } from "mongoose";

export interface TaskEntry { taskId: Schema.Types.ObjectId; weekId: string; date: Date; completed: number; notes?: string; }
const schema = new Schema<TaskEntry>({
  taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
  weekId: { type: String, required: true, index: true }, date: { type: Date, required: true },
  completed: { type: Number, min: 0, default: 0 }, notes: String
}, { timestamps: true });
schema.index({ taskId: 1, date: 1 }, { unique: true });
export const TaskEntryModel = model<TaskEntry>("TaskEntry", schema);

