import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { activities } from "~/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { allActivityKeys } from "~/config/calendars";

export const calendarRouter = createTRPCRouter({
  getActivities: publicProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }): Promise<(Record<string, string | number>)[]> => {
      const rows = await ctx.db
        .select()
        .from(activities)
        .where(
          and(
            gte(activities.date, input.startDate),
            lte(activities.date, input.endDate)
          )
        );

      const grouped: Record<string, Record<string, number>> = {};
      
      for (const row of rows) {
        if (!grouped[row.date]) {
          grouped[row.date] = {};
        }
        const dateGroup = grouped[row.date];
        if (dateGroup) {
          dateGroup[row.activityKey] = row.value;
        }
      }

      return Object.entries(grouped).map(([date, activities]) => ({
        date,
        ...activities,
      }));
    }),

  toggleActivity: publicProcedure
    .input(
      z.object({
        date: z.string(),
        activity: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!allActivityKeys.includes(input.activity)) {
        throw new Error(`Invalid activity: ${input.activity}`);
      }

      const existing = await ctx.db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.date, input.date),
            eq(activities.activityKey, input.activity)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await ctx.db
          .delete(activities)
          .where(
            and(
              eq(activities.date, input.date),
              eq(activities.activityKey, input.activity)
            )
          );
      } else {
        await ctx.db.insert(activities).values({
          date: input.date,
          activityKey: input.activity,
          value: 1,
        });
      }

      return { success: true };
    }),
});

