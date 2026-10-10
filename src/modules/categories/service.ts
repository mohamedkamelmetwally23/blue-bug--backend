import type { Actor } from "../auth/index.js";
import { Category, Task } from "../models.js";
import { categorySchema, ensure, id } from "../domain.js";
import { role } from "../../shared/permissions/index.js";
export async function saveCategory(
  actor: Actor,
  body: unknown,
  categoryId?: string,
) {
  role(actor, "coordinator");
  const data = categorySchema.parse(body);
  if (!categoryId) return Category.create({ ...data });
  id.parse(categoryId);
  const category = await Category.findOne({ _id: categoryId });
  ensure(category, 404, "Category not found");
  category.set({ ...data, version: category.get("version") + 1 });
  return category.save();
}
export async function deleteCategory(actor: Actor, categoryId: string) {
  role(actor, "coordinator");
  id.parse(categoryId);
  const category = await Category.findOne({ _id: categoryId });
  ensure(category, 404, "Category not found");
  ensure(
    !(await Task.exists({ categoryId })),
    409,
    "This category is linked to tasks and cannot be deleted.",
  );
  await category.deleteOne();
}
