import { z } from "zod/v4";
import { useMemo } from "react";
import { useQuery } from "@powersync/react";
import { useKysely } from "./useKysely";
import { sql } from "@powersync/kysely-driver";

// Zod schemas
const TodoSchema = z.object({
  id: z.string(),
  list_id: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  description: z.string(),
  created_by: z.string(),
  completed_by: z.string().nullable(),
  completed: z.number()
});

const ListSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  name: z.string(),
  owner_id: z.string()
});

// Query result schema
export const TodoQueryResultSchema = z.object({
  ...TodoSchema.shape,
  list_name: z.string(),
  list_created_at: z.string(),
  list_owner_id: z.string(),
  total_todos: z.number(),
  completed_todos: z.number(),
  overdue_todos: z.number(),
  days_since_created: z.number(),
  is_overdue: z.number()
});

export type TodoQueryResult = z.infer<typeof TodoQueryResultSchema>;

// Filter types
export interface TodoFilters {
  listId?: string;
  completed?: boolean;
  overdueOnly?: boolean;
  createdBy?: string;
  searchText?: string;
  limit?: number;
  includeArchived?: boolean;
}

// Define the useTodos hook
export const useTodosQuery = (filters: TodoFilters) => {
  const {
    listId,
    completed,
    overdueOnly,
    createdBy,
    searchText,
    limit,
    includeArchived
  } = filters;

  const db = useKysely();

  // Complex query
  let query = db
    .selectFrom("todos")
    .selectAll("todos")
    .leftJoin("lists", "todos.list_id", "lists.id")
    .select([
      "lists.name as list_name",
      "lists.created_at as list_created_at",
      "lists.owner_id as list_owner_id",
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id)`.as("total_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id AND t.completed = 1)`.as("completed_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id AND t.completed = 0 AND datetime(t.created_at) < datetime('now', '-7 days'))`.as("overdue_todos"),
      sql<number>`julianday('now') - julianday(todos.created_at)`.as("days_since_created"),
      sql<number>`CASE WHEN todos.completed = 0 AND datetime(todos.created_at) < datetime('now', '-7 days') THEN 1 ELSE 0 END`.as("is_overdue")
    ])
    .orderBy("todos.created_at", "desc");

  // Apply filters
  if (listId !== undefined) {
    query = query.where("todos.list_id", "=", sql.lit(listId));
  }

  if (completed !== undefined) {
    query = query.where("todos.completed", "=", sql.lit(completed ? 1 : 0));
  }

  if (createdBy !== undefined) {
    query = query.where("todos.created_by", "=", sql.lit(createdBy));
  }

  if (searchText !== undefined) {
    query = query.where("todos.description", "like", sql.lit(`%${searchText}%`));
  }

  if (limit !== undefined) {
    query = query.limit(sql.lit(limit));
  }

  const compiledQuery = query.compile().sql;
  const { data: rawData, ...rest } = useQuery(compiledQuery);

  // Log the query for debugging
  console.log("Complex Todo Query: ", compiledQuery);
  console.log("Complex Todo Query Count: ", rawData.length);

  // Simple query (matching complex query output)
  // This query will now be a different object from the complex one, even if the result is the same
  const simpleQuery = db
    .selectFrom("todos")
    .selectAll("todos")
    .leftJoin("lists", "todos.list_id", "lists.id")
    .select([
      "lists.name as list_name",
      "lists.created_at as list_created_at",
      "lists.owner_id as list_owner_id",
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id)`.as("total_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id AND t.completed = 1)`.as("completed_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos AS t WHERE t.list_id = lists.id AND t.completed = 0 AND datetime(t.created_at) < datetime('now', '-7 days'))`.as("overdue_todos"),
      sql<number>`julianday('now') - julianday(todos.created_at)`.as("days_since_created"),
      sql<number>`CASE WHEN todos.completed = 0 AND datetime(todos.created_at) < datetime('now', '-7 days') THEN 1 ELSE 0 END`.as("is_overdue")
    ])
    .orderBy("todos.created_at", "desc");

  // Apply all the same filters to the simple query
  if (listId !== undefined) {
    simpleQuery.where("todos.list_id", "=", sql.lit(listId));
  }

  if (completed !== undefined) {
    simpleQuery.where("todos.completed", "=", sql.lit(completed ? 1 : 0));
  }

  if (createdBy !== undefined) {
    simpleQuery.where("todos.created_by", "=", sql.lit(createdBy));
  }

  if (searchText !== undefined) {
    simpleQuery.where("todos.description", "like", sql.lit(`%${searchText}%`));
  }

  if (limit !== undefined) {
    simpleQuery.limit(sql.lit(limit));
  }

  const compiledSimpleQuery = simpleQuery.compile().sql;
  const { data: rawSimpleQueryData } = useQuery(compiledSimpleQuery);
  console.log("Simple Todo Query:", compiledSimpleQuery);
  console.log("Simple Todo Query Count: ", rawSimpleQueryData.length);

  // Parse and validate both query results
  const complexData = useMemo(() => TodoQueryResultSchema.array().parse(rawData), [rawData]);
  const simpleData = useMemo(() => TodoQueryResultSchema.array().parse(rawSimpleQueryData), [rawSimpleQueryData]);

  return { data: complexData, simpleData, ...rest } as const;
};

// Additional hook for list statistics
export const useListStats = (listId?: string) => {
  const db = useKysely();

  let query = db
    .selectFrom("lists")
    .select([
      "lists.id",
      "lists.name",
      "lists.created_at",
      sql<number>`(SELECT COUNT(*) FROM todos WHERE todos.list_id = lists.id)`.as("total_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos WHERE todos.list_id = lists.id AND todos.completed = 1)`.as("completed_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos WHERE todos.list_id = lists.id AND todos.completed = 0 AND datetime(todos.created_at) < datetime('now', '-7 days'))`.as("overdue_todos"),
      sql<number>`(SELECT COUNT(*) FROM todos WHERE todos.list_id = lists.id AND todos.completed = 0)`.as("pending_todos")
    ])
    .orderBy("lists.created_at", "desc");

  if (listId !== undefined) {
    query = query.where("lists.id", "=", sql.lit(listId));
  }

  const compiledQuery = query.compile().sql;
  const { data: rawData, ...rest } = useQuery(compiledQuery);

  const ListStatsSchema = z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    total_todos: z.number(),
    completed_todos: z.number(),
    overdue_todos: z.number(),
    pending_todos: z.number()
  });

  const data = useMemo(() => ListStatsSchema.array().parse(rawData), [rawData]);

  return { data, ...rest } as const;
};