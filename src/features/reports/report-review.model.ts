import { model, Schema } from "mongoose";
export interface ReportReview { weekId: string; finalScore?: number; managerComments?: string; improvementPoints: string[]; nextWeekFocus: string[]; }
const schema = new Schema<ReportReview>({ weekId: { type: String, required: true, unique: true }, finalScore: { type: Number, min: 0, max: 100 }, managerComments: String, improvementPoints: { type: [String], default: [] }, nextWeekFocus: { type: [String], default: [] } }, { timestamps: true });
export const ReportReviewModel = model<ReportReview>("ReportReview", schema);
