import mongoose from "mongoose";
export function objectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

export const quantityStages = [
  {
    $lookup: {
      from: "task_entries",
      let: { task: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$taskId", "$$task"] } } },
        { $count: "count" },
      ],
      as: "entryCount",
    },
  },
  {
    $set: {
      actualQuantity: {
        $cond: [
          { $eq: ["$workFormat", "sheet"] },
          { $ifNull: ["$numDone", 0] },
          {
            $cond: [
              { $eq: ["$categorySchema.mode", "aggregate"] },
              "$aggregateQuantity",
              { $ifNull: [{ $first: "$entryCount.count" }, 0] },
            ],
          },
        ],
      },
    },
  },
  { $unset: "entryCount" },
];
